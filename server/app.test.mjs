// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
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

const postWithCookie = async (path, body, cookie) => {
  const response = await api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  return { status: response.status, body: response.status === 204 ? {} : await response.json(), response }
}

const cookieFrom = (response) => response.headers.get('set-cookie')?.split(';', 1)[0] ?? ''

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

describe('自建账号登录与个人资料（真实 HTTP）', () => {
  it('注册账号设置会话，资料跨请求可读写，登出后会话失效', async () => {
    const registered = await postWithCookie('/api/auth/register', {
      handle: 'lin-zi',
      password: 'correct horse battery staple',
      nickname: '林子',
      bio: '做可靠的工具',
      hue: 268,
    })
    expect(registered.status).toBe(201)
    const cookie = cookieFrom(registered.response)
    expect(cookie).toMatch(/^vh_session=/)
    expect(registered.response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(registered.response.headers.get('set-cookie')).toContain('SameSite=Lax')
    expect(registered.body.user).toMatchObject({ handle: 'lin-zi', nickname: '林子', bio: '做可靠的工具', hue: 268 })

    const me = await json('/api/auth/me', { headers: { Cookie: cookie } })
    expect(me.status).toBe(200)
    expect(me.body.user.handle).toBe('lin-zi')

    const updated = await fetch(`${hall.url}/api/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ nickname: '林子·更新', bio: '持续做可靠的工具', hue: 318 }),
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).user).toMatchObject({ nickname: '林子·更新', bio: '持续做可靠的工具', hue: 318 })

    const logout = await postWithCookie('/api/auth/logout', {}, cookie)
    expect(logout.status).toBe(204)
    const after = await json('/api/auth/me', { headers: { Cookie: cookie } })
    expect(after.status).toBe(401)
  })

  it('同一账号不能重复注册，错误密码不能登录', async () => {
    const first = await postWithCookie('/api/auth/register', { handle: 'unique-user', password: 'correct horse battery staple', nickname: '唯一用户' })
    expect(first.status).toBe(201)
    const duplicate = await postWithCookie('/api/auth/register', { handle: 'unique-user', password: 'another secure password', nickname: '重复用户' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error.code).toBe('handle-taken')

    const wrong = await postWithCookie('/api/auth/login', { handle: 'unique-user', password: 'wrong password' })
    expect(wrong.status).toBe(401)
    expect(wrong.body.error.code).toBe('bad-credentials')
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

describe('同一进程托管前端（部署形态）', () => {
  let staticRoot
  let hallStatic

  beforeEach(async () => {
    staticRoot = mkdtempSync(path.join(tmpdir(), 'vibe-hall-dist-'))
    mkdirSync(path.join(staticRoot, 'assets'))
    writeFileSync(path.join(staticRoot, 'index.html'), '<!doctype html><title>VIBE HALL</title><div id="root"></div>')
    writeFileSync(path.join(staticRoot, 'assets', 'app.js'), 'console.log("hall")')
    writeFileSync(path.join(staticRoot, '..', 'secret.txt'), '不该被读到')
    hallStatic = await startServer({ port: 0, file: ':memory:', staticRoot })
  })

  afterEach(async () => {
    await hallStatic?.close()
    rmSync(staticRoot, { recursive: true, force: true })
  })

  const get = async (path) => {
    const response = await fetch(`${hallStatic.url}${path}`)
    return { status: response.status, type: response.headers.get('content-type'), text: await response.text() }
  }

  it('根路径返回 index.html', async () => {
    const root = await get('/')
    expect(root.status).toBe(200)
    expect(root.type).toContain('text/html')
    expect(root.text).toContain('VIBE HALL')
  })

  it('静态资源带正确的 content-type', async () => {
    const asset = await get('/assets/app.js')
    expect(asset.status).toBe(200)
    expect(asset.type).toContain('javascript')
    expect(asset.text).toContain('hall')
  })

  it('前端路由（如 /wishes）回落 index.html，而不是 404', async () => {
    const route = await get('/wishes')
    expect(route.status).toBe(200)
    expect(route.text).toContain('VIBE HALL')
  })

  it('API 仍然优先于静态文件', async () => {
    const health = await get('/api/health')
    expect(health.status).toBe(200)
    expect(JSON.parse(health.text)).toMatchObject({ ok: true, storage: 'sqlite' })
  })

  it('不允许目录穿越读到静态根之外的文件', async () => {
    const escaped = await get('/..%2Fsecret.txt')
    expect(escaped.text).not.toContain('不该被读到')
    const encoded = await get('/%2e%2e%2fsecret.txt')
    expect(encoded.text).not.toContain('不该被读到')
  })
})

describe('限流（公网必备）', () => {
  it('同一来源超过阈值后返回 429，且带明确错误码', async () => {
    const hall = await startServer({ port: 0, file: ':memory:', rateLimit: { windowMs: 60_000, max: 5 } })
    try {
      const home = (path) => fetch(`${hall.url}${path}`)
      for (let index = 0; index < 5; index += 1) {
        expect((await home('/api/health')).status).toBe(200)
      }
      const blocked = await home('/api/health')
      expect(blocked.status).toBe(429)
      expect((await blocked.json()).error.code).toBe('rate-limited')
    } finally {
      await hall.close()
    }
  })

  it('默认限流阈值足够宽，正常浏览不会被误伤', async () => {
    const hall = await startServer({ port: 0, file: ':memory:' })
    try {
      for (let index = 0; index < 40; index += 1) {
        expect((await fetch(`${hall.url}/api/health`)).status).toBe(200)
      }
    } finally {
      await hall.close()
    }
  })
})
