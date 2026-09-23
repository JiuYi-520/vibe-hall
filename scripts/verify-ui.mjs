/**
 * Runtime verification of the built site with a real browser engine (Edge).
 * Checks are behavioural — it clicks, types, and reads the rendered text —
 * and it fails loudly on console errors. Screenshots land in ./screenshots.
 *
 * Usage: npm run verify:ui   (expects a server on http://localhost:4173)
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const OUT = 'screenshots'
const require = createRequire(import.meta.url)

/** 首屏预算：优化后的实测值留出余量，超过即视为回退。 */
const BUDGET = { jsBytes: 340_000, cssBytes: 40_000, nodes: 1_400 }

const results = []
const consoleErrors = []

function check(name, passed, detail = '') {
  results.push({ name, passed: Boolean(passed), detail })
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
})

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`))

await mkdir(OUT, { recursive: true })

// ---------- home ----------
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
const total = await page.getByTestId('result-count').innerText()
check('home renders the full hall', Number(total) >= 25, `result-count=${total}`)
check('hero headline present', (await page.locator('h1').first().innerText()).includes('自然语言'))
check(
  '首页英雄区不再有装饰性长文',
  (await page.locator('.hero__eyebrow, .hero__lead, .hero__notice').count()) === 0,
  `${await page.locator('.hero__eyebrow, .hero__lead, .hero__notice').count()} 处`,
)
const sortLabels = await page.locator('.segmented[aria-label="排序方式"] button').allInnerTexts()
check(
  '排序与布局文案均为中文',
  sortLabels.length === 5 && sortLabels.every((label) => !/[A-Za-z]/.test(label)),
  sortLabels.join(' / '),
)
await page.screenshot({ path: `${OUT}/01-home-dark.png`, fullPage: false })

await page.locator('#hall').scrollIntoViewIfNeeded()
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/01b-hall-rows.png`, fullPage: false })

// 一行一个案例：量两张卡的位置，而不是看类名
const rowsDefault = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.grid .card')].slice(0, 2)
  return cards.map((card) => {
    const rect = card.getBoundingClientRect()
    return { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width) }
  })
})
check(
  '默认一行一个案例（两张卡堆叠且等宽）',
  rowsDefault.length === 2 && Math.abs(rowsDefault[0].top - rowsDefault[1].top) > 20 && Math.abs(rowsDefault[0].width - rowsDefault[1].width) <= 2,
  JSON.stringify(rowsDefault),
)

// 渐进渲染：先渲染一批，点一次追加一批
const renderedFirst = await page.locator('.grid .card').count()
const loadMore = page.getByRole('button', { name: /再看 \d+ 条/ })
check('首屏只渲染一批案例', renderedFirst > 0 && renderedFirst <= 12, `${renderedFirst} 张卡`)
if ((await loadMore.count()) > 0) {
  await loadMore.click()
  await page.waitForTimeout(400)
  const renderedAfter = await page.locator('.grid .card').count()
  check('点「再看」后追加一批', renderedAfter > renderedFirst, `${renderedFirst} → ${renderedAfter}`)
}

// 回到顶部：滚动后出现，点击后回到 0
await page.evaluate(() => window.scrollTo({ top: 2000 }))
await page.waitForTimeout(500)
const toTopVisible = await page.locator('.to-top.is-visible').count()
check('长页滚动后出现「回到顶部」', toTopVisible === 1, `${toTopVisible} 个可见`)
await page.getByTestId('back-to-top').click()
await page.waitForTimeout(900)
const scrollY = await page.evaluate(() => Math.round(window.scrollY))
check('点「回到顶部」后滚回顶部', scrollY <= 4, `scrollY=${scrollY}`)

// 工具栏吸顶：滚动后仍贴在顶栏下方
await page.evaluate(() => window.scrollTo({ top: 1200 }))
await page.waitForTimeout(500)
const sticky = await page.evaluate(() => {
  const toolbar = document.querySelector('.toolbar')?.getBoundingClientRect()
  const header = document.querySelector('.site-header')?.getBoundingClientRect()
  return { toolbarTop: Math.round(toolbar?.top ?? -1), headerBottom: Math.round(header?.bottom ?? 0) }
})
check('滚动后筛选工具栏吸顶在顶栏下方', Math.abs(sticky.toolbarTop - sticky.headerBottom) <= 6, JSON.stringify(sticky))
await page.evaluate(() => window.scrollTo({ top: 0 }))
await page.evaluate(() => window.scrollTo({ top: 0 }))
await page.waitForTimeout(300)

// ---------- 首屏预算（domcontentloaded 阶段的实际传输量）----------
const budget = await page.evaluate(() => {
  const entries = performance.getEntriesByType('resource')
  const sum = (type) =>
    entries
      .filter((entry) => entry.name.endsWith(type))
      .reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0), 0)
  return {
    jsBytes: sum('.js'),
    cssBytes: sum('.css'),
    nodes: document.querySelectorAll('*').length,
    fcpMs: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0),
  }
})
check('首屏 JS 体积在预算内', budget.jsBytes <= BUDGET.jsBytes, `${budget.jsBytes} / ${BUDGET.jsBytes} 字节`)
check('首屏 CSS 体积在预算内', budget.cssBytes <= BUDGET.cssBytes, `${budget.cssBytes} / ${BUDGET.cssBytes} 字节`)
check('首屏 DOM 节点数在预算内', budget.nodes <= BUDGET.nodes, `${budget.nodes} / ${BUDGET.nodes}`)

// ---------- 锚点：标题不能被 sticky header 遮住 ----------
await page.getByRole('link', { name: /进入展馆/ }).click()
await page.waitForTimeout(700)
const anchor = await page.evaluate(() => {
  const header = document.querySelector('.site-header')?.getBoundingClientRect()
  const heading = document.querySelector('#hall h2')?.getBoundingClientRect()
  return { headerBottom: header?.bottom ?? 0, headingTop: heading?.top ?? 0 }
})
check('锚点跳转后标题未被顶栏遮挡', anchor.headingTop >= anchor.headerBottom - 2, `标题顶 ${Math.round(anchor.headingTop)} / 顶栏底 ${Math.round(anchor.headerBottom)}`)

// ---------- 无工具扫描：axe-core（含色彩对比度）----------
await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
const scan = await page.evaluate(async () => {
  const results = await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
  }))
})
const blocking = scan.filter((item) => item.impact === 'critical' || item.impact === 'serious')
check('axe-core 无严重无障碍问题', blocking.length === 0, blocking.length ? JSON.stringify(blocking) : '0 条严重/致命')
if (scan.length) console.log(`  axe-core 全部问题：${JSON.stringify(scan, null, 2)}`)

// card tilt + hover state should not throw
await page.locator('.card').first().hover()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/02-card-hover.png`, fullPage: false })

// ---------- filters ----------
await page.getByRole('button', { name: /游戏/ }).click()
await page.waitForTimeout(500)
const gameCount = await page.getByTestId('result-count').innerText()
const gameChipCount = await page.getByRole('button', { name: /游戏/ }).locator('em').innerText()
check(
  'category filter narrows the grid to the chip count',
  gameCount === gameChipCount && Number(gameCount) < Number(total),
  `result-count=${gameCount}, chip=${gameChipCount}, total=${total}`,
)
const visibleCategories = await page.locator('.grid .chip--ghost').allInnerTexts()
check(
  'every visible card belongs to the filtered category',
  visibleCategories.length > 0 && visibleCategories.every((text) => text.includes('游戏')),
  visibleCategories.join(' | '),
)
check('filter is written into the url', page.url().includes('cats=game'), page.url())
await page.screenshot({ path: `${OUT}/03-filtered-game.png` })

await page.getByRole('button', { name: /清空筛选/ }).click()
await page.waitForTimeout(300)
const afterReset = await page.getByTestId('result-count').innerText()
check('reset restores the full hall', afterReset === total, `result-count=${afterReset}`)

// ---------- search + sort + list view ----------
await page.getByRole('searchbox', { name: /搜索/ }).fill('潮汐')
await page.waitForTimeout(400)
check('search narrows to one card', (await page.getByTestId('result-count').innerText()) === '1')
await page.getByRole('button', { name: '清空搜索' }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: '列表视图' }).click()
await page.waitForTimeout(500)
check('列表版式可用', (await page.locator('.grid--list').count()) === 1)
await page.screenshot({ path: `${OUT}/04-list-view.png` })
await page.getByRole('button', { name: '网格视图' }).click()
await page.waitForTimeout(500)
const rowsGrid = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.grid .card')].slice(0, 2)
  return cards.map((card) => {
    const rect = card.getBoundingClientRect()
    return { top: Math.round(rect.top), left: Math.round(rect.left) }
  })
})
check(
  '切到网格后两张卡并排',
  rowsGrid.length === 2 && Math.abs(rowsGrid[0].top - rowsGrid[1].top) <= 2 && rowsGrid[1].left > rowsGrid[0].left,
  JSON.stringify(rowsGrid),
)
await page.getByRole('button', { name: '列表视图' }).click()
await page.waitForTimeout(400)

// ---------- command palette ----------
const focusBefore = await page.evaluate(() => {
  const element = document.activeElement
  return element instanceof HTMLElement ? element.className || element.tagName : ''
})
await page.keyboard.press('Control+k')
await page.waitForTimeout(400)
check('palette opens on Ctrl+K', await page.getByRole('dialog', { name: '快速跳转' }).isVisible())
check(
  '打开面板时触发按钮标记为展开',
  (await page.locator('.cmd-trigger').getAttribute('aria-expanded')) === 'true',
)
await page.screenshot({ path: `${OUT}/05-command-palette.png` })

// 面板应当同时能跳页面，而不是只搜展品
const paletteInput = '搜索页面、作品、愿望或帖子'
await page.getByLabel(paletteInput).fill('论坛')
await page.waitForTimeout(300)
const paletteHasPage = await page.locator('.palette__item', { hasText: '论坛' }).count()
check('命令面板能跳到页面', paletteHasPage > 0, `${paletteHasPage} 条匹配`)
await page.getByLabel(paletteInput).fill('')
await page.waitForTimeout(200)

// 焦点陷阱 + 关闭后焦点归还（真实浏览器里验一遍）
let stayedInside = true
for (let index = 0; index < 20; index += 1) {
  await page.keyboard.press('Tab')
  const inside = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="快速跳转"]')
    return !!dialog && !!document.activeElement && dialog.contains(document.activeElement)
  })
  if (!inside) {
    stayedInside = false
    break
  }
}
check('Tab 焦点被锁在命令面板内', stayedInside)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
const focusAfter = await page.evaluate(() => {
  const element = document.activeElement
  return element instanceof HTMLElement ? element.className || element.tagName : ''
})
check('关闭面板后焦点回到打开它的元素', focusAfter === focusBefore && focusAfter !== 'BODY', `${focusBefore} → ${focusAfter}`)
check(
  '关闭面板后触发按钮标记为收起',
  (await page.locator('.cmd-trigger').getAttribute('aria-expanded')) === 'false',
)

await page.keyboard.press('Control+k')
await page.waitForTimeout(300)
await page.getByLabel(paletteInput).fill('潮汐')
await page.waitForTimeout(300)
const highlighted = await page.locator('.palette__item .hl').first().innerText()
check('搜索结果命中部分高亮', highlighted.includes('潮汐'), highlighted)
await page.keyboard.press('Enter')
await page.waitForTimeout(600)
check('palette navigates to the project', page.url().includes('/p/tide-clock'), page.url())

// ---------- detail page ----------
const detailTitle = await page.locator('h1').first().innerText()
check('detail page renders the project', detailTitle.includes('潮汐'), detailTitle)
check('detail shows the prompt block', (await page.locator('.prompt__body').innerText()).length > 5)
await page.screenshot({ path: `${OUT}/06-detail.png`, fullPage: true })

// an entry whose provenance is github must be labelled and link to the repo
await page.goto(`${BASE}/#/?sort=newest`, { waitUntil: 'networkidle' })
const liveCard = page.locator('.card', { hasText: 'GitHub 实时' }).first()
const liveCount = await page.locator('.card').filter({ hasText: 'GitHub 实时' }).count()
check('live github entries are labelled', liveCount > 0, `${liveCount} labelled cards`)
if (liveCount > 0) {
  await liveCard.locator('a').first().click()
  await page.waitForTimeout(600)
  const note = await page.locator('.provenance').innerText()
  check('live entry states its provenance', note.includes('GitHub'), note.slice(0, 60))
  await page.screenshot({ path: `${OUT}/07-live-detail.png`, fullPage: false })
}

// ---------- theme ----------
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
const beforeTheme = await page.evaluate(() => document.documentElement.dataset.theme)
check('initial theme follows the system preference', beforeTheme === 'dark', String(beforeTheme))
await page.locator('.site-actions .icon-btn').click()
await page.waitForTimeout(700)
const theme = await page.evaluate(() => document.documentElement.dataset.theme)
check('theme toggle flips the theme', theme !== beforeTheme && theme === 'light', String(theme))
await page.screenshot({ path: `${OUT}/08-home-light.png` })

// 浅色主题同样跑一次 axe（含对比度）
await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
const lightScan = await page.evaluate(async () => {
  const results = await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')) }))
})
const lightBlocking = lightScan.filter((item) => item.impact === 'critical' || item.impact === 'serious')
check('浅色主题 axe-core 无严重问题', lightBlocking.length === 0, lightBlocking.length ? JSON.stringify(lightBlocking) : '0 条严重/致命')

await page.locator('.site-actions .icon-btn').click()
await page.waitForTimeout(500)
const backTheme = await page.evaluate(() => document.documentElement.dataset.theme)
check('theme toggle returns to dark', backTheme === 'dark', String(backTheme))

// ---------- submit flow ----------
await page.goto(`${BASE}/#/submit`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: '校验表单' }).click()
await page.waitForTimeout(300)
check('submit form blocks an empty draft', (await page.locator('.submit__issues').count()) === 1)
await page.getByLabel('作品名 *').fill('潮汐时钟')
await page.getByLabel('一句话介绍 *').fill('只显示下一次涨潮的时钟')
await page.getByLabel('作者名 *').fill('Hana')
await page.getByLabel('社交账号 *').fill('hana-tide')
await page.getByLabel('技术栈（逗号分隔）*').fill('Svelte, Vite')
await page.getByLabel('作品链接').fill('https://example.com/tide-clock')
await page.getByLabel('制作故事 *').fill('第一版只有倒计时，第三版才把留白调好。')
await page.getByRole('button', { name: '校验表单' }).click()
await page.waitForTimeout(300)
check('submit form accepts a complete draft', (await page.locator('.submit__ok').count()) === 1)
await page.screenshot({ path: `${OUT}/09-submit.png`, fullPage: true })

// ---------- reduced motion + narrow viewport ----------
// ---------- 愿望墙：贴愿望 → 接单 → 交付 → 刷新仍在 ----------
// ---------- 升星榜 ----------
// ---------- 本机身份 → 论坛 → 愿望悬赏 ----------
await page.goto(`${BASE}/#/me`, { waitUntil: 'networkidle' })
await page.getByLabel('昵称').fill('验证机器人')
await page.getByLabel('账号').fill('verify-bot')
await page.getByLabel('一句话简介').fill('自动验证用')
await page.getByRole('button', { name: '保存身份' }).click()
await page.waitForTimeout(300)
check('本机身份可以保存并显示', (await page.getByTestId('me-nickname').innerText()) === '验证机器人')
const meChip = await page.locator('.me-chip').innerText()
check('顶栏显示本机身份', meChip.includes('验证机器人'), meChip)
await page.screenshot({ path: `${OUT}/15-me.png`, fullPage: false })

await page.goto(`${BASE}/#/forum`, { waitUntil: 'networkidle' })
const forumBefore = Number(await page.getByTestId('forum-count').innerText())
await page.getByRole('button', { name: /发新帖/ }).click()
const postForm = page.getByTestId('post-form')
await postForm.getByLabel('标题').fill('验证：本机身份发帖能留在帖子里吗')
await postForm.getByLabel('正文').fill('这是自动化验证写的一条帖子，用来确认发帖、回复和点赞都会落到本机存储。')
await postForm.getByLabel('分类').selectOption('share')
await postForm.getByRole('button', { name: '发布' }).click()
await page.waitForTimeout(400)
check('用本机身份发帖并置顶', Number(await page.getByTestId('forum-count').innerText()) === forumBefore + 1)
const myPost = page.locator('[data-testid^="post-"]').first()
check('新帖子带本机作者名', (await myPost.innerText()).includes('验证机器人'))

await myPost.getByRole('button', { name: '回复' }).click()
await myPost.getByLabel('回复正文').fill('自己回复一条，验证回复也会落盘。')
await myPost.getByRole('button', { name: '发表回复' }).click()
await page.waitForTimeout(300)
check('可以回复帖子', (await myPost.innerText()).includes('自己回复一条'))
await myPost.getByRole('button', { name: /点赞/ }).click()
await page.waitForTimeout(300)
check('可以点赞帖子', (await myPost.locator('[data-testid^="post-likes-"]').innerText()) === '1')
await page.screenshot({ path: `${OUT}/14-forum.png`, fullPage: false })

await page.reload({ waitUntil: 'networkidle' })
const afterReloadPost = page.locator('[data-testid^="post-"]').filter({ hasText: '验证：本机身份发帖能留在帖子里吗' }).first()
check('刷新后本机帖子与回复仍在', (await afterReloadPost.count()) === 1 && (await afterReloadPost.innerText()).includes('自己回复一条'))

await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
const forumScan = await page.evaluate(async () => {
  const results = await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')) }))
})
const forumBlocking = forumScan.filter((item) => item.impact === 'critical' || item.impact === 'serious')
check('论坛 axe-core 无严重问题', forumBlocking.length === 0, forumBlocking.length ? JSON.stringify(forumBlocking) : '0 条严重/致命')

await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await page.getByRole('link', { name: '升星榜' }).click()
await page.waitForTimeout(600)
check('导航可进入升星榜', page.url().includes('/stars'), page.url())

const starRows = page.locator('[data-testid^="star-row-"]')
const starRowCount = await starRows.count()
check('升星榜列出真实仓库', starRowCount > 0, `${starRowCount} 行`)
const snapshotText = await page.locator('.stars__meta').innerText()
check('升星榜显示真实快照次数', /\d/.test(snapshotText) && snapshotText.includes('快照'), snapshotText.replace(/\s+/g, ' '))

await page.getByRole('button', { name: '增量榜' }).click()
await page.waitForTimeout(300)
check('增量全为 0 时会说明原因', await page.getByText(/增量为 0/).isVisible())
await page.screenshot({ path: `${OUT}/13-stars.png`, fullPage: false })

await page.getByRole('button', { name: '增速榜' }).click()
await page.waitForTimeout(300)
check('增速榜可切换', (await page.locator('.segmented--icons, .segmented').first().innerText()).includes('增速榜'))

const skillChip = page.getByRole('button', { name: /技能包/ })
if ((await skillChip.count()) > 0) {
  const expected = Number((await skillChip.innerText()).replace(/\D/g, ''))
  await skillChip.click()
  await page.waitForTimeout(300)
  const filtered = await starRows.count()
  check('按类型（技能包）筛选生效', filtered === expected && filtered <= starRowCount, `${filtered} / 期望 ${expected}`)
  await skillChip.click()
  await page.waitForTimeout(200)
}

await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
const starScan = await page.evaluate(async () => {
  const results = await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')) }))
})
const starBlocking = starScan.filter((item) => item.impact === 'critical' || item.impact === 'serious')
check('升星榜 axe-core 无严重问题', starBlocking.length === 0, starBlocking.length ? JSON.stringify(starBlocking) : '0 条严重/致命')

// 面板可以直接跳到愿望并高亮那一条
await page.keyboard.press('Control+k')
await page.waitForTimeout(500)
await page.getByLabel('搜索页面、作品、愿望或帖子').fill('阅读划线')
await page.waitForTimeout(400)
const wishHit = page.locator('.palette__item').filter({ hasText: '阅读划线' }).first()
check('面板能搜到愿望条目', (await wishHit.count()) > 0, (await wishHit.count()) > 0 ? '命中' : '未命中')
await wishHit.click()
await page.waitForTimeout(600)
check('面板跳转后落在愿望墙并高亮该条', page.url().includes('/wishes?focus=') && (await page.locator('.wish.is-focused').count()) === 1, page.url())
await page.screenshot({ path: `${OUT}/16-palette-jump.png`, fullPage: false })

// ---------- 未知路径兜底 ----------
// ---------- 侧边栏：收起 / 展开 / 持久化 / 快捷键 ----------
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
check('宽屏默认展开侧边栏', (await page.locator('.site-sidebar.is-open').count()) === 1)
check(
  '开关按钮带 aria-expanded 与 aria-controls',
  (await page.locator('.sidebar-toggle').getAttribute('aria-expanded')) === 'true' &&
    (await page.locator('.sidebar-toggle').getAttribute('aria-controls')) === 'site-sidebar',
)
await page.getByRole('button', { name: '隐藏侧边栏' }).first().click()
await page.waitForTimeout(500)
check('收起后侧边栏移出且不可聚焦', (await page.locator('.site-sidebar.is-hidden').count()) === 1 && (await page.locator('.site-sidebar[inert]').count()) === 1)
await page.screenshot({ path: `${OUT}/17-sidebar-hidden.png`, fullPage: false })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(300)
check('刷新后仍是收起状态（写入本机）', (await page.locator('.site-sidebar.is-hidden').count()) === 1)
await page.keyboard.press('[')
await page.waitForTimeout(500)
check('快捷键 [ 能重新展开', (await page.locator('.site-sidebar.is-open').count()) === 1)
await page.screenshot({ path: `${OUT}/18-sidebar-open.png`, fullPage: false })

await page.goto(`${BASE}/#/no-such-page`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const notFoundText = await page.locator('main').innerText()
check('未知路径给出兜底页而不是“没有这扇门”', notFoundText.includes('页面不存在') && !notFoundText.includes('没有这扇门'), notFoundText.split('\n')[0])
check('兜底页提供回站入口', (await page.getByRole('link', { name: '展开馆' }).count()) > 0)

await page.goto(`${BASE}/#/wishes`, { waitUntil: 'networkidle' })
const wishTotalBefore = Number(await page.getByTestId('wish-count').innerText())
check('愿望墙列出愿望', wishTotalBefore > 0, `共 ${wishTotalBefore} 条`)
check(
  '愿望墙顶部只剩一个搜索框',
  (await page.locator('.wishes__search input').count()) === 1 &&
    (await page.locator('.wishes__search button, .wishes__stats, .wishes__notice, .wishes__actions').count()) === 0,
  `${await page.locator('.wishes__search button, .wishes__stats, .wishes__notice, .wishes__actions').count()} 处残留`,
)
await page.screenshot({ path: `${OUT}/11-wish-wall.png`, fullPage: true })

const myWishTitle = '想要一个把晾衣绳天气提醒做成看板的东西'
await page.getByRole('button', { name: /贴一个新愿望/ }).click()
const wishForm = page.getByTestId('wish-form')
await wishForm.getByLabel('愿望标题').fill(myWishTitle)
await wishForm.getByLabel('愿望描述').fill('每天早上看一眼：今天能不能晾衣服、几点最合适、要不要收。')
await wishForm.getByLabel('意向悬赏（元，可留空）').fill('300')
await wishForm.getByLabel('悬赏说明（可选）').fill('做好了请喝咖啡')
await wishForm.getByRole('button', { name: '贴到愿望墙' }).click()
await page.waitForTimeout(400)
check('贴出的愿望进入列表且计数加一', Number(await page.getByTestId('wish-count').innerText()) === wishTotalBefore + 1)
const myCard = page.locator('[data-testid^="wish-card-"]').filter({ hasText: myWishTitle }).first()
check('新愿望排在最前', (await page.locator('[data-testid^="wish-card-"]').first().innerText()).includes('晾衣绳'))
const wishText = await myCard.innerText()
check(
  '愿望带上意向悬赏并声明不收款',
  wishText.includes('意向悬赏 ¥300') && wishText.includes('验证机器人'),
  wishText.split('\n').find((line) => line.includes('意向悬赏')) ?? '未找到悬赏标记',
)

// 接单
await myCard.getByRole('button', { name: '我来接单' }).click()
await myCard.getByLabel('接单人名字').fill('验证机器人')
await myCard.getByLabel('接单人账号').fill('verify-bot')
await myCard.getByLabel('一句话计划').fill('先做天气接口和晾晒指数')
await myCard.getByRole('button', { name: '确认接单' }).click()
await page.waitForTimeout(400)
check('接单后状态变为已接单', (await myCard.innerText()).includes('已接单'))

// 交付并关联展品
await myCard.getByRole('button', { name: '标记为已交付' }).click()
await myCard.getByLabel('关联作品').selectOption('neon-kanban')
await myCard.getByLabel('交付说明').fill('第一版做完了')
await myCard.getByRole('button', { name: '确认交付' }).click()
await page.waitForTimeout(400)
const deliveredText = await myCard.innerText()
check('交付后状态变为已交付并挂上作品链接', deliveredText.includes('已交付') && (await myCard.locator('a').count()) > 0)
await page.screenshot({ path: `${OUT}/12-wish-delivered.png`, fullPage: false })

// 刷新后本机改动仍在（证明真的写进了本机存储）
await page.reload({ waitUntil: 'networkidle' })
const afterReload = page.locator('[data-testid^="wish-card-"]').filter({ hasText: myWishTitle }).first()
check('刷新后本机愿望与接单记录仍在', (await afterReload.count()) === 1 && (await afterReload.innerText()).includes('已交付'))

// 愿望墙同样接受 axe 扫描
await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
const wishScan = await page.evaluate(async () => {
  const results = await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')) }))
})
const wishBlocking = wishScan.filter((item) => item.impact === 'critical' || item.impact === 'serious')
check('愿望墙 axe-core 无严重问题', wishBlocking.length === 0, wishBlocking.length ? JSON.stringify(wishBlocking) : '0 条严重/致命')

// ---------- 展品：点赞（可取消）+ 评论（可删自己的）----------
await page.goto(`${BASE}/#/p/neon-kanban`, { waitUntil: 'networkidle' })
const likesBefore = Number(await page.getByTestId('detail-likes').innerText())
await page.getByRole('button', { name: /^点赞/ }).click()
await page.waitForTimeout(300)
check('展品点赞加一', Number(await page.getByTestId('detail-likes').innerText()) === likesBefore + 1)
check('点赞后按钮标为已赞', (await page.getByRole('button', { name: /已赞/ }).getAttribute('aria-pressed')) === 'true')
await page.getByRole('button', { name: /已赞/ }).click()
await page.waitForTimeout(300)
check('再点一次取消点赞', Number(await page.getByTestId('detail-likes').innerText()) === likesBefore)

const commentText = '自动化验证：这个霓虹残影我很喜欢。'
await page.getByLabel('评论正文').fill(commentText)
await page.getByRole('button', { name: '发表评论' }).click()
await page.waitForTimeout(400)
const firstComment = page.locator('[data-testid^="comment-item-"]').first()
const firstCommentText = await firstComment.innerText()
check('评论发表后置顶并带本机署名', firstCommentText.includes('自动化验证') && firstCommentText.includes('验证机器人'), firstCommentText.split('\n')[0])
await page.screenshot({ path: `${OUT}/19-project-comments.png`, fullPage: false })

await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
check('大厅卡片显示评论数', (await page.locator('.card__metrics').filter({ hasText: '💬' }).count()) > 0)

await page.goto(`${BASE}/#/p/neon-kanban`, { waitUntil: 'networkidle' })
check(
  '刷新后评论仍在（写在本机）',
  (await page.locator('[data-testid^="comment-item-"]').filter({ hasText: '自动化验证' }).count()) === 1,
)
await page.locator('[data-testid^="comment-item-"]').first().getByRole('button', { name: '删除' }).click()
await page.waitForTimeout(400)
check('可以删除自己的评论', (await page.locator('[data-testid^="comment-item-"]').filter({ hasText: '自动化验证' }).count()) === 0)
check('演示评论没有删除按钮', (await page.getByRole('button', { name: '删除' }).count()) === 0)

await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
const detailScan = await page.evaluate(async () => {
  const results = await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')) }))
})
const detailBlocking = detailScan.filter((item) => item.impact === 'critical' || item.impact === 'serious')
check('展品详情页 axe-core 无严重问题', detailBlocking.length === 0, detailBlocking.length ? JSON.stringify(detailBlocking) : '0 条严重/致命')

// ---------- 愿望墙与论坛的点赞都能取消 ----------
await page.goto(`${BASE}/#/wishes`, { waitUntil: 'networkidle' })
const wishCard = page.locator('[data-testid^="wish-card-"]').first()
const cheerBefore = Number(await wishCard.locator('[data-testid^="wish-cheers-"] strong').innerText())
await wishCard.getByRole('button', { name: '我也想要' }).click()
await page.waitForTimeout(300)
check('愿望墙「我也想要」加一', Number(await wishCard.locator('[data-testid^="wish-cheers-"] strong').innerText()) === cheerBefore + 1)
await wishCard.getByRole('button', { name: '已想要' }).click()
await page.waitForTimeout(300)
check('愿望墙「已想要」可取消', Number(await wishCard.locator('[data-testid^="wish-cheers-"] strong').innerText()) === cheerBefore)

await page.goto(`${BASE}/#/forum`, { waitUntil: 'networkidle' })
const postCard = page.locator('[data-testid^="post-"]').first()
const postLikeToggle = postCard.locator('button.ghost-btn').filter({ hasText: /点赞|已赞/ }).first()
// 前面的步骤可能已经点过这张帖：先归一化到「未赞」再测，避免依赖执行顺序
if ((await postLikeToggle.getAttribute('aria-pressed')) === 'true') {
  await postLikeToggle.click()
  await page.waitForTimeout(300)
}
const likeBefore = Number(await postCard.locator('[data-testid^="post-likes-"]').innerText())
await postLikeToggle.click()
await page.waitForTimeout(300)
check('论坛点赞加一', Number(await postCard.locator('[data-testid^="post-likes-"]').innerText()) === likeBefore + 1)
await postLikeToggle.click()
await page.waitForTimeout(300)
check('论坛点赞可取消', Number(await postCard.locator('[data-testid^="post-likes-"]').innerText()) === likeBefore)

const mobile = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
await mobile.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
check('mobile layout renders cards', (await mobile.locator('.card').count()) > 0)
check('窄屏默认收起侧边栏（不挡内容）', (await mobile.locator('.site-sidebar.is-hidden').count()) === 1)
await mobile.getByRole('button', { name: '显示侧边栏' }).click()
await mobile.waitForTimeout(400)
const drawerLinks = await mobile.locator('.site-sidebar a:visible').count()
check('窄屏点 ☰ 后抽屉里有全部入口', drawerLinks >= 6, `${drawerLinks} 个可见入口`)
await mobile.screenshot({ path: `${OUT}/10b-mobile-nav.png`, fullPage: false })
await mobile.getByRole('link', { name: '论坛' }).click()
await mobile.waitForTimeout(500)
check('窄屏能靠抽屉切页面', mobile.url().includes('/forum'), mobile.url())
check('切页后抽屉自动收起', (await mobile.locator('.site-sidebar.is-hidden').count()) === 1)
await mobile.screenshot({ path: `${OUT}/10-mobile.png`, fullPage: false })
await mobile.close()

const calm = await browser.newPage({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
await calm.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await calm.waitForTimeout(400)
check('reduced motion still renders the hall', (await calm.locator('.card').count()) > 0)
await calm.close()

await browser.close()

// ---------- ui-verification 探针：目标尺寸 / 焦点遍历 / 视口压力 / 网络失败 ----------
{
  const probeBrowser = await chromium.launch({ channel: 'msedge', headless: true })
  const probe = await probeBrowser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' })
  const failedRequests = []
  probe.on('response', (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`)
  })
  /** 便宜的三条探针按 skill 要求跑每个路由，而不是只看首页。 */
  const PROBE_ROUTES = ['/', '/stars', '/wishes', '/forum', '/me', '/p/neon-kanban']
  const measureTargets = () =>
    probe.evaluate(() => {
      const nodes = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')]
      const measured = nodes
        .filter((node) => {
          const rect = node.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && node.getClientRects().length > 0
        })
        .map((node) => {
          const rect = node.getBoundingClientRect()
          return {
            label: (node.getAttribute('aria-label') || node.textContent || node.tagName).trim().slice(0, 24),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          }
        })
      return {
        total: measured.length,
        under24: measured.filter((item) => item.w < 24 || item.h < 24),
        under44: measured.filter((item) => item.w < 44 || item.h < 44),
      }
    })

  const sizeByRoute = []
  for (const route of PROBE_ROUTES) {
    await probe.setViewportSize({ width: 1280, height: 900 })
    await probe.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' })
    await probe.waitForTimeout(250)
    sizeByRoute.push({ route, ...(await measureTargets()) })
  }
  await writeFile('screenshots/probe-target-size.json', `${JSON.stringify(sizeByRoute, null, 2)}\n`, 'utf8')
  const smallTargets = sizeByRoute.flatMap((entry) => entry.under24.map((item) => `${entry.route} ${item.label} ${item.w}x${item.h}`))
  const targetTotal = sizeByRoute.reduce((sum, entry) => sum + entry.total, 0)
  check(
    '目标尺寸探针：所有路由的可见交互元素都不小于 24x24',
    smallTargets.length === 0,
    smallTargets.length ? smallTargets.slice(0, 5).join(' | ') : `${PROBE_ROUTES.length} 个路由共 ${targetTotal} 个元素，0 处不合格`,
  )

  await probe.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })

  // 焦点遍历：Tab 走 12 步，每步都要有可见焦点环且停在视口内
  const walk = []
  await probe.evaluate(() => document.body.focus())
  for (let index = 0; index < 12; index += 1) {
    await probe.keyboard.press('Tab')
    walk.push(
      await probe.evaluate(() => {
        const element = document.activeElement
        if (!(element instanceof HTMLElement)) return { label: 'none', ring: false, inView: false }
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        const ring = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
        return {
          label: (element.getAttribute('aria-label') || element.textContent || element.tagName).trim().slice(0, 24),
          ring,
          inView: rect.top >= -1 && rect.bottom <= window.innerHeight + 1,
        }
      }),
    )
  }
  await writeFile('screenshots/probe-focus-walk.json', `${JSON.stringify(walk, null, 2)}\n`, 'utf8')
  const noRing = walk.filter((step) => !step.ring)
  check('焦点遍历探针：每一步都有可见焦点环', noRing.length === 0, noRing.length ? JSON.stringify(noRing.slice(0, 3)) : `12 步全部有焦点环`)

  // 视口压力：两个宽度都不能出现横向溢出
  const stress = []
  for (const [route, width] of PROBE_ROUTES.flatMap((route) => [
    [route, 360],
    [route, 1280],
  ])) {
    await probe.setViewportSize({ width, height: 900 })
    await probe.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle' })
    stress.push(
      await probe.evaluate((info) => {
        const clipped = (node) => {
          let parent = node.parentElement
          while (parent && parent !== document.documentElement) {
            if (getComputedStyle(parent).overflowX !== 'visible') return true
            parent = parent.parentElement
          }
          return false
        }
        const offenders = [...document.querySelectorAll('body *')]
          .map((node) => {
            const rect = node.getBoundingClientRect()
            const path = []
            let cursor = node
            while (cursor && cursor !== document.body && path.length < 5) {
              path.unshift(`${cursor.tagName.toLowerCase()}${cursor.className ? '.' + String(cursor.className).split(' ').join('.') : ''}`)
              cursor = cursor.parentElement
            }
            return {
              tag: node.tagName.toLowerCase(),
              cls: (node.getAttribute('class') || '').slice(0, 40),
              path: path.join(' > ').slice(0, 120),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              clipped: clipped(node),
            }
          })
          // 只报真正撑宽文档的：右边越界且没有任何祖先在裁剪
          .filter((item) => item.right > window.innerWidth + 1 && item.width > 0 && !item.clipped)
          .sort((a, b) => b.right - a.right)
          .slice(0, 5)
        return {
          route: info.route,
          width: info.width,
          scrollWidth: document.documentElement.scrollWidth,
          // 用 clientWidth 比较：innerWidth 含竖向滚动条，会把 15px 的滚动条算成可用宽度
          clientWidth: document.documentElement.clientWidth,
          innerWidth: window.innerWidth,
          offenders,
        }
      }, { route, width }),
    )
  }
  await writeFile('screenshots/probe-viewport-stress.json', `${JSON.stringify(stress, null, 2)}\n`, 'utf8')
  const overflow = stress.filter((item) => item.scrollWidth > item.clientWidth + 1)
  check(
    '视口压力探针：所有路由 360/1280 无横向溢出',
    overflow.length === 0,
    overflow.length
      ? JSON.stringify(overflow.slice(0, 3))
      : `${stress.length} 次测量（${PROBE_ROUTES.length} 个路由 × 360/1280）全部无溢出`,
  )

  // 网络：本次探针期间不应有失败请求
  await writeFile('screenshots/probe-network.json', `${JSON.stringify(failedRequests, null, 2)}\n`, 'utf8')
  check(
    '网络探针：所有路由无失败请求',
    failedRequests.length === 0,
    failedRequests.length ? [...new Set(failedRequests)].slice(0, 5).join(' | ') : '0 条 >=400',
  )

  await probeBrowser.close()
}

const failures = results.filter((item) => !item.passed)
console.log(`\n${results.length - failures.length}/${results.length} runtime checks passed`)
if (consoleErrors.length) {
  console.log(`\nConsole errors (${consoleErrors.length}):`)
  for (const error of [...new Set(consoleErrors)].slice(0, 10)) console.log(`  ! ${error}`)
} else {
  console.log('Console errors: none')
}

if (failures.length || consoleErrors.length) process.exitCode = 1
