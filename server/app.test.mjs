// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startServer } from './app.mjs'

let hall

beforeEach(async () => {
  hall = await startServer({ port: 0, file: ':memory:' })
})

afterEach(async () => {
  await hall?.close()
})

const api = (path, init) => fetch(`${hall.url}${path}`, init)
const json = async (path, init) => {
  const response = await api(path, init)
  return { status: response.status, body: await response.json() }
}
const post = (path, body, token) =>
  json(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  })

async function register(nickname = '阿岛', handle = 'a-dao') {
  const { status, body } = await post('/api/identity', { nickname, handle })
  expect(status).toBe(201)
  return body.token
}

describe('健康检查与 CORS', () => {
  it('health 报告存储类型与计数', async () => {
    const { status, body } = await json('/api/health')
    expect(status).toBe(200)
    expect(body).toMatchObject({ ok: true, storage: 'sqlite' })
    expect(body.stats.wishes).toBe(0)
  })

  it('预检请求得到 204 与 CORS 头', async () => {
    const response = await api('/api/wishes', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:4173', 'Access-Control-Request-Method': 'POST' },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-headers')).toContain('Authorization')
  })
})

describe('身份与愿望（真实 HTTP）', () => {
  it('注册 → 发愿 → 列表里能看到', async () => {
    const token = await register()
    const created = await post(
      '/api/wishes',
      { title: '想要一个晾衣提醒看板', brief: '每天早上看一眼今天能不能晾衣服。', category: 'life', tags: ['生活'] },
      token,
    )
    expect(created.status).toBe(201)
    expect(created.body.wish.status).toBe('open')

    const list = await json('/api/wishes')
    expect(list.body.wishes).toHaveLength(1)
    expect(list.body.wishes[0].title).toBe('想要一个晾衣提醒看板')
    expect(list.body.wishes[0].wisher.nickname).toBe('阿岛')
  })

  it('没有令牌不能写，非法参数返回 400 与错误码', async () => {
    const unauthorized = await post('/api/wishes', { title: '标题', brief: '描述足够长', category: 'life' })
    expect(unauthorized.status).toBe(401)
    expect(unauthorized.body.error.code).toBe('unauthenticated')

    const token = await register()
    const bad = await post('/api/wishes', { title: '', brief: '描述足够长', category: 'life' }, token)
    expect(bad.status).toBe(400)
    expect(bad.body.error.code).toBe('empty-field')

    const notJson = await fetch(`${hall.url}/api/wishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: 'not json',
    })
    expect(notJson.status).toBe(400)
  })

  it('接单 → 交付走完整状态机，权限与冲突都有明确状态码', async () => {
    const author = await register('小满', 'xiaoman')
    const maker = await register('阿岛', 'a-dao')
    const other = await register('别人', 'other')
    const created = await post('/api/wishes', { title: '想要一个记账小工具', brief: '每天记一笔。', category: 'tool' }, author)
    const id = created.body.wish.id

    const claimed = await post(`/api/wishes/${id}/claim`, { note: '我来做' }, maker)
    expect(claimed.body.wish.status).toBe('claimed')

    const conflict = await post(`/api/wishes/${id}/claim`, {}, other)
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('already-claimed')

    const forbidden = await post(`/api/wishes/${id}/deliver`, { projectSlug: 'neon-kanban' }, other)
    expect(forbidden.status).toBe(403)
    expect(forbidden.body.error.code).toBe('not-claimant')

    const delivered = await post(`/api/wishes/${id}/deliver`, { projectSlug: 'neon-kanban', note: '做完了' }, maker)
    expect(delivered.body.wish.status).toBe('delivered')
    expect(delivered.body.wish.delivered.projectSlug).toBe('neon-kanban')
  })

  it('「我也想要」可切换，并且按设备区分', async () => {
    const author = await register('小满', 'xiaoman')
    const visitor = await register()
    const created = await post('/api/wishes', { title: '想要一个记账小工具', brief: '每天记一笔。', category: 'tool' }, author)
    const id = created.body.wish.id

    const first = await post(`/api/wishes/${id}/cheer`, {}, visitor)
    expect(first.body.wish.cheers).toBe(1)
    expect(first.body.wish.cheered).toBe(true)

    const mine = await json('/api/wishes', { headers: { Authorization: `Bearer ${author}` } })
    expect(mine.body.wishes[0].cheered).toBe(false)

    const second = await post(`/api/wishes/${id}/cheer`, {}, visitor)
    expect(second.body.wish.cheers).toBe(0)
  })
})

describe('论坛（真实 HTTP）', () => {
  it('发帖、回复、点赞都能读到', async () => {
    const author = await register('小满', 'xiaoman')
    const created = await post('/api/posts', { title: '接单之后怎么验收', body: '想听大家的做法。', kind: 'ask' }, author)
    const id = created.body.post.id

    const replied = await post(`/api/posts/${id}/replies`, { body: '先把验收标准写进愿望。' }, author)
    expect(replied.body.post.replies).toHaveLength(1)

    const liked = await post(`/api/posts/${id}/like`, {}, author)
    expect(liked.body.post.likes).toBe(1)
    expect(liked.body.post.liked).toBe(true)

    const list = await json('/api/posts')
    expect(list.body.posts[0].replies[0].body).toContain('验收标准')
    expect(list.body.posts[0].likes).toBe(1)
  })

  it('未知接口返回 404，未知动作不会误伤', async () => {
    const missing = await json('/api/nope')
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('not-found')

    const token = await register()
    const unknownAction = await post('/api/wishes/whatever/blah', {}, token)
    expect(unknownAction.status).toBe(404)
  })
})
