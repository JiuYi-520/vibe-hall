import { describe, expect, it } from 'vitest'
import { DEFAULT_GALLERY_STATE, parseGalleryState, serializeGalleryState, toggleInList } from './urlState'

describe('parseGalleryState', () => {
  it('returns defaults for an empty search', () => {
    expect(parseGalleryState('')).toEqual(DEFAULT_GALLERY_STATE)
    expect(parseGalleryState('?')).toEqual(DEFAULT_GALLERY_STATE)
  })

  it('reads query, categories, stack, statuses, sort and view', () => {
    const state = parseGalleryState('?q=%E7%9C%8B%E6%9D%BF&cats=tool,game&stack=React&status=live&sort=stars&view=list')
    expect(state.q).toBe('看板')
    expect(state.cats).toEqual(['tool', 'game'])
    expect(state.stack).toEqual(['React'])
    expect(state.statuses).toEqual(['live'])
    expect(state.sort).toBe('stars')
    expect(state.view).toBe('list')
  })

  it('drops unknown categories, statuses and sort keys instead of trusting them', () => {
    const state = parseGalleryState('?cats=tool,nope&status=ghost&sort=explode')
    expect(state.cats).toEqual(['tool'])
    expect(state.statuses).toEqual([])
    expect(state.sort).toBe(DEFAULT_GALLERY_STATE.sort)
  })

  it('reads the featured flag only when it is truthy', () => {
    expect(parseGalleryState('?featured=1').featured).toBe(true)
    expect(parseGalleryState('?featured=0').featured).toBe(false)
  })
})

describe('serializeGalleryState', () => {
  it('round-trips a non default state and omits defaults', () => {
    const state = { ...DEFAULT_GALLERY_STATE, q: '霓虹', cats: ['tool' as const], sort: 'newest' as const }
    const search = serializeGalleryState(state)
    expect(search).toBe('cats=tool&q=%E9%9C%93%E8%99%B9&sort=newest')
    expect(parseGalleryState(`?${search}`)).toEqual(state)
  })

  it('produces an empty string for the default state', () => {
    expect(serializeGalleryState(DEFAULT_GALLERY_STATE)).toBe('')
  })
})

describe('toggleInList', () => {
  it('adds when missing and removes when present without mutating the input', () => {
    const list = ['a'] as const
    expect(toggleInList([...list], 'b')).toEqual(['a', 'b'])
    expect(toggleInList([...list], 'a')).toEqual([])
    expect(list).toEqual(['a'])
  })
})
