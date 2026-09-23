import { createServer } from 'node:http'
import { StoreError, createStore } from './store.mjs'

const MAX_BODY = 64 * 1024

function send(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new StoreError('body-too-large', 413, '请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (!text) {
        resolve({})
        return
      }
      try {
        const parsed = JSON.parse(text)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new StoreError('bad-json', 400, '请求体必须是 JSON 对象'))
          return
        }
        resolve(parsed)
      } catch {
        reject(new StoreError('bad-json', 400, '请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function tokenOf(req, body) {
  const header = req.headers.authorization ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (match) return match[1].trim()
  return typeof body.token === 'string' ? body.token : ''
}

/**
 * 展馆后端：零依赖 HTTP API（node:http）+ SQLite（node:sqlite）。
 * 身份是设备令牌，不是账号：没有密码、没有第三方登录；令牌只证明“同一台设备”。
 */
export function createApp({ store, allowedOrigin = '*' } = {}) {
  if (!store) throw new Error('createApp requires a store')

  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Vary', 'Origin')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', 'http://localhost')
    const segments = url.pathname.split('/').filter(Boolean)
    const route = `${req.method} /${segments.slice(0, 3).join('/')}`

    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        send(res, 200, { ok: true, storage: 'sqlite', stats: store.stats() })
        return
      }

      const body = req.method === 'POST' ? await readBody(req) : {}
      const viewer = (() => {
        const token = tokenOf(req, body)
        if (!token) return null
        try {
          return store.authenticate(token)
        } catch {
          return null
        }
      })()

      switch (route) {
        case 'POST /api/identity': {
          const identity = store.createIdentity(body)
          send(res, 201, { token: identity.token, nickname: identity.nickname, handle: identity.handle })
          return
        }
        case 'GET /api/wishes': {
          send(res, 200, { wishes: store.listWishes(viewer?.id) })
          return
        }
        case 'POST /api/wishes': {
          send(res, 201, { wish: store.createWish({ ...body, token: tokenOf(req, body) }) })
          return
        }
        case 'GET /api/posts': {
          send(res, 200, { posts: store.listPosts(viewer?.id) })
          return
        }
        case 'POST /api/posts': {
          send(res, 201, { post: store.createPost({ ...body, token: tokenOf(req, body) }) })
          return
        }
        default:
          break
      }

      // 带 :id 的动作路由
      if (req.method === 'POST' && segments.length === 4 && segments[0] === 'api') {
        const [, area, id, action] = segments
        const token = tokenOf(req, body)
        if (area === 'wishes') {
          if (action === 'cheer') {
            send(res, 200, { wish: store.toggleCheer({ token, wishId: id }) })
            return
          }
          if (action === 'claim') {
            send(res, 200, { wish: store.claimWish({ token, wishId: id, note: body.note }) })
            return
          }
          if (action === 'deliver') {
            send(res, 200, {
              wish: store.deliverWish({ token, wishId: id, projectSlug: body.projectSlug, note: body.note }),
            })
            return
          }
        }
        if (area === 'posts') {
          if (action === 'replies') {
            send(res, 201, { post: store.replyPost({ token, postId: id, body: body.body }) })
            return
          }
          if (action === 'like') {
            send(res, 200, { post: store.toggleLike({ token, postId: id }) })
            return
          }
        }
      }

      send(res, 404, { error: { code: 'not-found', message: `没有这个接口：${route}` } })
    } catch (error) {
      if (error instanceof StoreError) {
        send(res, error.status, { error: { code: error.code, message: error.message } })
        return
      }
      send(res, 500, { error: { code: 'internal', message: '服务器内部错误' } })
    }
  })

  return server
}

export function startServer({ port = 8787, file = 'server/hall.sqlite', host = '127.0.0.1', allowedOrigin = '*' } = {}) {
  const store = createStore({ file })
  const server = createApp({ store, allowedOrigin })
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address()
      const actualPort = typeof address === 'object' && address ? address.port : port
      resolve({
        server,
        store,
        url: `http://${host}:${actualPort}`,
        close: () =>
          new Promise((done) => {
            server.close(() => {
              store.close()
              done()
            })
          }),
      })
    })
  })
}

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server/app.mjs')
if (isDirectRun) {
  const port = Number(process.env.PORT ?? 8787)
  const file = process.env.HALL_DB ?? 'server/hall.sqlite'
  const origin = process.env.HALL_ORIGIN ?? '*'
  const started = await startServer({ port, file, allowedOrigin: origin })
  console.log(`VIBE HALL 后端已启动：${started.url}`)
  console.log(`数据文件：${file}（SQLite，node:sqlite 内置）`)
  console.log(`健康检查：${started.url}/api/health`)
}
