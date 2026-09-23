/**
 * Runtime verification of the built site with a real browser engine (Edge).
 * Checks are behavioural — it clicks, types, and reads the rendered text —
 * and it fails loudly on console errors. Screenshots land in ./screenshots.
 *
 * Usage: npm run verify:ui   (expects a server on http://localhost:4173)
 */
import { mkdir } from 'node:fs/promises'
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
const sortLabels = await page.locator('.segmented[aria-label="排序方式"] button').allInnerTexts()
check(
  '排序与布局文案均为中文',
  sortLabels.length === 5 && sortLabels.every((label) => !/[A-Za-z]/.test(label)),
  sortLabels.join(' / '),
)
await page.screenshot({ path: `${OUT}/01-home-dark.png`, fullPage: false })

await page.locator('#hall').scrollIntoViewIfNeeded()
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/01b-hall-grid.png`, fullPage: false })
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
check('list view switches the grid', (await page.locator('.grid--list').count()) === 1)
await page.screenshot({ path: `${OUT}/04-list-view.png` })
await page.getByRole('button', { name: '网格视图' }).click()
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
await page.getByLabel('搜索作品、作者或技术栈').fill('潮汐')
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
await page.locator('.icon-btn').click()
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

await page.locator('.icon-btn').click()
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
await page.goto(`${BASE}/#/wishes`, { waitUntil: 'networkidle' })
const wishTotalBefore = Number(await page.getByTestId('wish-count').innerText())
check('愿望墙列出愿望', wishTotalBefore > 0, `共 ${wishTotalBefore} 条`)
await page.screenshot({ path: `${OUT}/11-wish-wall.png`, fullPage: true })

const myWishTitle = '想要一个把晾衣绳天气提醒做成看板的东西'
await page.getByRole('button', { name: /贴一个新愿望/ }).click()
const wishForm = page.getByTestId('wish-form')
await wishForm.getByLabel('愿望标题').fill(myWishTitle)
await wishForm.getByLabel('愿望描述').fill('每天早上看一眼：今天能不能晾衣服、几点最合适、要不要收。')
await wishForm.getByLabel('署名').fill('验证机器人')
await wishForm.getByLabel('账号').fill('verify-bot')
await wishForm.getByRole('button', { name: '贴到愿望墙' }).click()
await page.waitForTimeout(400)
check('贴出的愿望进入列表且计数加一', Number(await page.getByTestId('wish-count').innerText()) === wishTotalBefore + 1)
const myCard = page.locator('[data-testid^="wish-card-"]').filter({ hasText: myWishTitle }).first()
check('新愿望排在最前', (await page.locator('[data-testid^="wish-card-"]').first().innerText()).includes('晾衣绳'))

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

const mobile = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
await mobile.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
check('mobile layout renders cards', (await mobile.locator('.card').count()) > 0)
await mobile.screenshot({ path: `${OUT}/10-mobile.png`, fullPage: false })
await mobile.close()

const calm = await browser.newPage({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
await calm.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await calm.waitForTimeout(400)
check('reduced motion still renders the hall', (await calm.locator('.card').count()) > 0)
await calm.close()

await browser.close()

const failures = results.filter((item) => !item.passed)
console.log(`\n${results.length - failures.length}/${results.length} runtime checks passed`)
if (consoleErrors.length) {
  console.log(`\nConsole errors (${consoleErrors.length}):`)
  for (const error of [...new Set(consoleErrors)].slice(0, 10)) console.log(`  ! ${error}`)
} else {
  console.log('Console errors: none')
}

if (failures.length || consoleErrors.length) process.exitCode = 1
