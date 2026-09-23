import { describe, expect, it } from 'vitest'
import { formatCompact, formatDate, readingTime, slugify } from './format'

describe('formatCompact', () => {
  it('compacts thousands and keeps small numbers exact', () => {
    expect(formatCompact(0)).toBe('0')
    expect(formatCompact(999)).toBe('999')
    expect(formatCompact(1200)).toBe('1.2k')
    expect(formatCompact(15000)).toBe('15k')
    expect(formatCompact(1240000)).toBe('1.2m')
  })
})

describe('slugify', () => {
  it('keeps CJK characters and normalises latin text', () => {
    expect(slugify('Neon  Kanban!!!')).toBe('neon-kanban')
    expect(slugify('像素农场')).toBe('像素农场')
    expect(slugify('  --A/B--  ')).toBe('a-b')
  })
})

describe('formatDate', () => {
  it('renders a stable day precision string', () => {
    expect(formatDate('2026-09-01')).toBe('2026.09')
    expect(formatDate('2026-09-01T10:00:00.000Z')).toBe('2026.09')
  })
})

describe('readingTime', () => {
  it('estimates minutes and never returns zero', () => {
    expect(readingTime('短句')).toBe(1)
    expect(readingTime('字'.repeat(400))).toBe(2)
  })
})
