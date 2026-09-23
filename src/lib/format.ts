export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs < 1000) return String(Math.round(value))
  if (abs < 1_000_000) return trim(value / 1000) + 'k'
  return trim(value / 1_000_000) + 'm'
}

function trim(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(value >= 100 || Number.isInteger(Math.round(value * 10) / 10) ? 0 : 1)
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 7).replace('-', '.')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${date.getUTCFullYear()}.${month}`
}

export function readingTime(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const words = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9'’-]+/g) ?? []).length
  return Math.max(1, Math.round(cjk / 250 + words / 200))
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}
