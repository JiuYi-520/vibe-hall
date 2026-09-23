// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createStore, StoreError } from './store.mjs'

let store

beforeEach(() => {
  store = createStore()
})

afterEach(() => {
  store?.close()
})

const register = (nickname = '阿岛', handle = 'a-dao') => store.createIdentity({ nickname, handle })

function expectError(fn, code) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(StoreError)
    expect(error.code).toBe(code)
    return
  }
  throw new Error(`expected ${code}`)
}

describe('身份（设备令牌，不是账号）', () => {
  it('注册后拿到令牌，令牌能换回身份，错的令牌换不回', () => {
    const identity = register()
    expect(identity.token).toMatch(/^[\w-]{20,}$/)
    expect(store.authenticate(identity.token).nickname).toBe('阿岛')
    expectError(() => store.authenticate('wrong-token'), 'unauthenticated')
    expectError(() => store.authenticate(undefined), 'unauthenticated')
  })

  it('昵称必填、账号格式受限', () => {
    expectError(() => store.createIdentity({ nickname: '  ' }), 'empty-field')
    expectError(() => store.createIdentity({ nickname: '阿岛', handle: '中文账号' }), 'bad-handle')
    expect(store.createIdentity({ nickname: '阿岛', handle: 'a-dao' }).handle).toBe('a-dao')
  })
})

describe('愿望', () => {
  it('创建后能列出来，作者与状态都带上', () => {
    const identity = register()
    const created = store.createWish({
      token: identity.token,
      title: '想要一个晾衣提醒看板',
      brief: '每天早上看一眼今天能不能晾衣服。',
      category: 'life',
      tags: ['生活'],
    })
    expect(created.status).toBe('open')
    expect(created.wisher.nickname).toBe('阿岛')

    const list = store.listWishes()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(created.id)
    expect(store.stats().wishes).toBe(1)
  })

  it('参数不合法会被拒（缺令牌、空标题、未知分类、坏悬赏）', () => {
    const identity = register()
    // 不带令牌：拒
    expectError(() => store.createWish({ title: '标题', brief: '描述足够长', category: 'life' }), 'unauthenticated')
    const base = { token: identity.token, brief: '描述足够长', category: 'life' }
    expectError(() => store.createWish({ ...base, title: '' }), 'empty-field')
    expectError(() => store.createWish({ ...base, title: '标题', category: 'nope' }), 'unknown-category')
    expectError(() => store.createWish({ ...base, title: '标题', bountyAmount: -5 }), 'bad-bounty')
  })

  it('「我也想要」按设备记一次，可取消', () => {
    const a = register()
    const b = register('小满', 'xiaoman')
    const wish = store.createWish({ token: a.token, title: '想要一个记账小工具', brief: '每天记一笔。', category: 'tool' })

    expect(store.toggleCheer({ token: b.token, wishId: wish.id }).cheers).toBe(1)
    expect(store.listWishes(b.id)[0].cheered).toBe(true)
    expect(store.listWishes(a.id)[0].cheered).toBe(false)
    expect(store.toggleCheer({ token: b.token, wishId: wish.id }).cheers).toBe(0)
  })

  it('接单只能一次，只有接单人能交付', () => {
    const author = register()
    const maker = register('阿岛', 'a-dao')
    const other = register('别人', 'other')
    const wish = store.createWish({ token: author.token, title: '想要一个记账小工具', brief: '每天记一笔。', category: 'tool' })

    const claimed = store.claimWish({ token: maker.token, wishId: wish.id, note: '我来做' })
    expect(claimed.status).toBe('claimed')
    expect(claimed.claim.maker.handle).toBe('a-dao')
    expectError(() => store.claimWish({ token: other.token, wishId: wish.id }), 'already-claimed')
    expectError(() => store.deliverWish({ token: other.token, wishId: wish.id, projectSlug: 'neon-kanban' }), 'not-claimant')

    const delivered = store.deliverWish({ token: maker.token, wishId: wish.id, projectSlug: 'neon-kanban', note: '做完了' })
    expect(delivered.status).toBe('delivered')
    expect(delivered.delivered.projectSlug).toBe('neon-kanban')
    expectError(() => store.deliverWish({ token: maker.token, wishId: wish.id, projectSlug: 'x' }), 'already-delivered')
    expectError(() => store.deliverWish({ token: maker.token, wishId: 'nope', projectSlug: 'x' }), 'not-found')
  })
})

describe('论坛', () => {
  it('发帖、回复、点赞（可取消）都落到服务端', () => {
    const a = register()
    const b = register('小满', 'xiaoman')
    const post = store.createPost({ token: a.token, title: '接单之后怎么验收', body: '想听大家的做法。', kind: 'ask' })
    expect(post.author.nickname).toBe('阿岛')

    const replied = store.replyPost({ token: b.token, postId: post.id, body: '先把验收标准写进愿望。' })
    expect(replied.replies).toHaveLength(1)
    expect(replied.replies[0].author.handle).toBe('xiaoman')

    expect(store.toggleLike({ token: b.token, postId: post.id }).likes).toBe(1)
    expect(store.toggleLike({ token: b.token, postId: post.id }).likes).toBe(0)
    expect(store.toggleLike({ token: a.token, postId: post.id }).likes).toBe(1)

    const list = store.listPosts(b.id)
    expect(list[0].liked).toBe(false)
    expect(store.listPosts(a.id)[0].liked).toBe(true)
    expect(store.stats()).toMatchObject({ posts: 1, replies: 1 })
  })

  it('非法分类与空正文会被拒', () => {
    const a = register()
    expectError(() => store.createPost({ token: a.token, title: '标题', body: '正文够长', kind: 'nope' }), 'unknown-kind')
    expectError(() => store.createPost({ token: a.token, title: '标题', body: '  ', kind: 'ask' }), 'empty-field')
    const post = store.createPost({ token: a.token, title: '标题', body: '正文够长', kind: 'ask' })
    expectError(() => store.replyPost({ token: a.token, postId: post.id, body: '' }), 'empty-field')
  })
})

describe('持久化', () => {
  it('写到文件后重开，数据还在', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'vibe-hall-'))
    const file = path.join(dir, 'hall.sqlite')
    try {
      const first = createStore({ file })
      const identity = first.createIdentity({ nickname: '阿岛', handle: 'a-dao' })
      first.createWish({ token: identity.token, title: '想要一个记账小工具', brief: '每天记一笔。', category: 'tool' })
      first.close()

      const second = createStore({ file })
      expect(second.stats().wishes).toBe(1)
      expect(second.authenticate(identity.token).nickname).toBe('阿岛')
      second.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
