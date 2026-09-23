import { describe, expect, it } from 'vitest'
import { splitHighlight } from './highlight'

describe('splitHighlight', () => {
  it('marks the matched span and keeps the rest plain', () => {
    expect(splitHighlight('霓虹看板', '看板')).toEqual([
      { text: '霓虹', match: false },
      { text: '看板', match: true },
    ])
  })

  it('is case insensitive for latin text and supports several terms', () => {
    const parts = splitHighlight('React 与 Vite 的看板', 'react vite')
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(['React', 'Vite'])
  })

  it('returns a single plain segment when nothing matches or the query is empty', () => {
    expect(splitHighlight('霓虹看板', '不存在')).toEqual([{ text: '霓虹看板', match: false }])
    expect(splitHighlight('霓虹看板', '   ')).toEqual([{ text: '霓虹看板', match: false }])
  })

  it('reassembles to the original text', () => {
    const text = 'React 与 Vite 的看板'
    expect(splitHighlight(text, 'vite react').map((part) => part.text).join('')).toBe(text)
  })
})
