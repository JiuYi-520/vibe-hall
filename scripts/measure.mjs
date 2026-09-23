/**
 * 采集优化前后的可测指标（生产构建，真实浏览器）。
 * 用法：node scripts/measure.mjs [--label=before]
 */
import { writeFile, readFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const label = process.argv.find((arg) => arg.startsWith('--label='))?.split('=')[1] ?? 'run'
const OUT = `screenshots/metrics-${label}.json`

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, colorScheme: 'dark' })

const transfers = []
page.on('response', async (response) => {
  const url = response.url()
  if (!/\.(js|css)$/.test(url)) return
  try {
    const body = await response.body()
    transfers.push({ url: url.split('/').pop(), type: url.endsWith('.css') ? 'css' : 'js', bytes: body.length })
  } catch {
    /* 忽略无法读取正文的响应 */
  }
})

const started = Date.now()
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await page.locator('.card').first().waitFor({ state: 'visible' })
const interactiveMs = Date.now() - started

// 首屏只算「页面已经能看见卡片」之前完成的请求；之后（例如打开 ⌘K 才取的索引）单独统计
const firstPaint = [...transfers]
const sumBytes = (list, type) =>
  list.filter((item) => item.type === type).reduce((total, item) => total + item.bytes, 0)

const paint = await page.evaluate(() => {
  const fcp = performance.getEntriesByName('first-contentful-paint')[0]
  const navigation = performance.getEntriesByType('navigation')[0]
  return {
    fcpMs: fcp ? Math.round(fcp.startTime) : null,
    domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
  }
})

const domStats = await page.evaluate(() => ({
  nodes: document.querySelectorAll('*').length,
  svgNodes: document.querySelectorAll('svg').length,
  svgDetailNodes: document.querySelectorAll('svg *').length,
  cards: document.querySelectorAll('.card').length,
}))

// 强制布局 + 全量重排的成本（屏外卡片的样式/布局是否被跳过）
const renderCost = await page.evaluate(async () => {
  const run = () => {
    const start = performance.now()
    for (const node of document.querySelectorAll('.card')) node.getBoundingClientRect()
    return performance.now() - start
  }
  const samples = []
  for (let index = 0; index < 6; index += 1) {
    run()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    samples.push(run())
  }
  const sorted = [...samples].sort((a, b) => a - b)
  return { layoutMs: Math.round(sorted[Math.floor(sorted.length / 2)] * 100) / 100, maxLayoutMs: Math.round(Math.max(...samples) * 100) / 100 }
})

// 指针扫过 60 次，统计长任务（>50ms 的主线程阻塞）
const longTasks = await page.evaluate(async () => {
  const entries = []
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) entries.push(entry.duration)
  })
  try {
    observer.observe({ entryTypes: ['longtask'] })
  } catch {
    return { supported: false, count: 0, total: 0, max: 0 }
  }
  const card = document.querySelector('.card')
  const rect = card.getBoundingClientRect()
  for (let index = 0; index < 60; index += 1) {
    const ratio = index / 60
    card.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + rect.width * ratio,
        clientY: rect.top + rect.height * (0.2 + 0.6 * ratio),
      }),
    )
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  observer.disconnect()
  return {
    supported: true,
    count: entries.length,
    total: Math.round(entries.reduce((sum, value) => sum + value, 0)),
    max: Math.round(Math.max(0, ...entries)),
  }
})

// 首屏抽屉式交互：打开命令面板到出结果
const paletteStart = Date.now()
await page.keyboard.press('Control+k')
await page.locator('.palette__item').first().waitFor({ state: 'visible' })
const paletteMs = Date.now() - paletteStart
await page.keyboard.press('Escape')

const js = firstPaint.filter((item) => item.type === 'js')
const css = firstPaint.filter((item) => item.type === 'css')
const metrics = {
  label,
  at: new Date().toISOString(),
  jsFiles: js.length,
  jsBytes: js.reduce((sum, item) => sum + item.bytes, 0),
  cssBytes: css.reduce((sum, item) => sum + item.bytes, 0),
  deferredJsBytes: sumBytes(transfers, 'js') - sumBytes(firstPaint, 'js'),
  largestJs: js.sort((a, b) => b.bytes - a.bytes).slice(0, 3).map((item) => `${item.url}:${item.bytes}`),
  interactiveMs,
  paletteMs,
  ...paint,
  ...domStats,
  ...renderCost,
  longTasks,
}

await browser.close()
await writeFile(OUT, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8')

let previous = null
try {
  previous = JSON.parse(await readFile('screenshots/metrics-before.json', 'utf8'))
} catch {
  /* 没有基线就只打印本次 */
}

console.log(JSON.stringify(metrics, null, 2))
if (previous && label !== 'before') {
  const delta = (key) =>
    `${typeof previous[key] === 'object' ? JSON.stringify(previous[key]) : previous[key]} → ${
      typeof metrics[key] === 'object' ? JSON.stringify(metrics[key]) : metrics[key]
    }`
  console.log('\n与基线对比：')
  console.log(`  首屏 JS：${delta('jsBytes')} 字节`)
  console.log(`  首屏 CSS：${delta('cssBytes')} 字节`)
  console.log(`  JS 文件数：${delta('jsFiles')}`)
  console.log(`  DOM 节点：${delta('nodes')}`)
  console.log(`  svg 子节点：${delta('svgDetailNodes')}`)
  console.log(`  长任务次数：${delta('longTasks')}`)
  console.log(`  首次内容渲染：${delta('fcpMs')} ms`)
  console.log(`  首屏可交互耗时（含冷启动，噪声大）：${delta('interactiveMs')} ms`)
  console.log(`  面板响应：${delta('paletteMs')} ms`)
}
