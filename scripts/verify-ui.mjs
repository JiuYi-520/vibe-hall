/**
 * Runtime verification of the built site with a real browser engine (Edge).
 * Checks are behavioural — it clicks, types, and reads the rendered text —
 * and it fails loudly on console errors. Screenshots land in ./screenshots.
 *
 * Usage: npm run verify:ui   (expects a server on http://localhost:4173)
 */
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const OUT = 'screenshots'

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
await page.screenshot({ path: `${OUT}/01-home-dark.png`, fullPage: false })

await page.locator('#hall').scrollIntoViewIfNeeded()
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/01b-hall-grid.png`, fullPage: false })
await page.evaluate(() => window.scrollTo({ top: 0 }))
await page.waitForTimeout(300)

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
await page.keyboard.press('Control+k')
await page.waitForTimeout(400)
check('palette opens on Ctrl+K', await page.getByRole('dialog', { name: '快速跳转' }).isVisible())
await page.screenshot({ path: `${OUT}/05-command-palette.png` })
await page.getByLabel('搜索作品、作者或技术栈').fill('潮汐')
await page.waitForTimeout(300)
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
await page.getByLabel('社交 handle *').fill('hana-tide')
await page.getByLabel('技术栈（逗号分隔）*').fill('Svelte, Vite')
await page.getByLabel('作品链接').fill('https://example.com/tide-clock')
await page.getByLabel('制作故事 *').fill('第一版只有倒计时，第三版才把留白调好。')
await page.getByRole('button', { name: '校验表单' }).click()
await page.waitForTimeout(300)
check('submit form accepts a complete draft', (await page.locator('.submit__ok').count()) === 1)
await page.screenshot({ path: `${OUT}/09-submit.png`, fullPage: true })

// ---------- reduced motion + narrow viewport ----------
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
