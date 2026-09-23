import { DatabaseSync } from 'node:sqlite'
import { randomBytes, randomUUID } from 'node:crypto'

const HANDLE = /^[a-z0-9][a-z0-9._-]{1,29}$/i
const CATEGORIES = ['tool', 'game', 'education', 'visual', 'data', 'ai', 'life', 'sound']
const POST_KINDS = ['ask', 'share', 'showcase', 'recruit', 'chat']
const LIMITS = { title: 60, brief: 400, body: 2000, note: 120, reply: 400 }

export class StoreError extends Error {
  constructor(code, status, message) {
    super(message)
    this.code = code
    this.status = status
  }
}

const fail = (code, status, message) => {
  throw new StoreError(code, status, message)
}

function nowIso() {
  return new Date().toISOString()
}

function shortId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function requireText(value, field, limit) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) fail('empty-field', 400, `${field} 不能为空`)
  if (text.length > limit) fail('too-long', 400, `${field} 超过 ${limit} 字`)
  return text
}

/**
 * 展馆后端存储：SQLite（node:sqlite 内置，无需编译原生依赖）。
 * 身份是「设备令牌」而不是账号：没有密码、没有第三方登录，令牌只是同一设备的凭据。
 */
export function createStore({ file = ':memory:' } = {}) {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL,
      handle TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wishes (
      id TEXT PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES identities(id),
      title TEXT NOT NULL,
      brief TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      bounty_amount INTEGER,
      bounty_note TEXT,
      created_at TEXT NOT NULL,
      claimed_by INTEGER REFERENCES identities(id),
      claimed_note TEXT,
      claimed_at TEXT,
      delivered_at TEXT,
      delivered_project TEXT,
      delivered_note TEXT
    );
    CREATE TABLE IF NOT EXISTS wish_cheers (
      wish_id TEXT NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
      identity_id INTEGER NOT NULL REFERENCES identities(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (wish_id, identity_id)
    );
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES identities(id),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      identity_id INTEGER NOT NULL REFERENCES identities(id),
      PRIMARY KEY (post_id, identity_id)
    );
    CREATE TABLE IF NOT EXISTS replies (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES identities(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)

  const identityById = db.prepare('SELECT * FROM identities WHERE id = ?')
  const identityByToken = db.prepare('SELECT * FROM identities WHERE token = ?')
  const cheersFor = db.prepare('SELECT identity_id FROM wish_cheers WHERE wish_id = ?')
  const repliesFor = db.prepare('SELECT * FROM replies WHERE post_id = ? ORDER BY created_at ASC')
  const likesFor = db.prepare('SELECT identity_id FROM post_likes WHERE post_id = ?')

  const asIdentity = (row) => ({ nickname: row.nickname, handle: row.handle })

  const mapWish = (row, viewerId) => {
    const cheerIds = cheersFor.all(row.id).map((entry) => entry.identity_id)
    const claimer = row.claimed_by ? identityById.get(row.claimed_by) : null
    const author = identityById.get(row.author_id)
    return {
      id: row.id,
      title: row.title,
      brief: row.brief,
      category: row.category,
      tags: parseJson(row.tags, []),
      createdAt: row.created_at.slice(0, 10),
      cheers: cheerIds.length,
      cheered: viewerId ? cheerIds.includes(viewerId) : false,
      wisher: asIdentity(author),
      status: row.delivered_at ? 'delivered' : row.claimed_by ? 'claimed' : 'open',
      ...(claimer
        ? { claim: { maker: asIdentity(claimer), note: row.claimed_note ?? '', claimedAt: (row.claimed_at ?? '').slice(0, 10) } }
        : {}),
      ...(row.delivered_at
        ? {
            delivered: {
              at: row.delivered_at.slice(0, 10),
              ...(row.delivered_project ? { projectSlug: row.delivered_project } : {}),
              ...(row.delivered_note ? { note: row.delivered_note } : {}),
            },
          }
        : {}),
      source: 'server',
    }
  }

  const mapPost = (row, viewerId) => {
    const author = identityById.get(row.author_id)
    const likeIds = likesFor.all(row.id).map((entry) => entry.identity_id)
    return {
      id: row.id,
      slug: row.id,
      title: row.title,
      body: row.body,
      kind: row.kind,
      createdAt: row.created_at.slice(0, 10),
      likes: likeIds.length,
      liked: viewerId ? likeIds.includes(viewerId) : false,
      author: asIdentity(author),
      replies: repliesFor.all(row.id).map((reply) => ({
        id: reply.id,
        body: reply.body,
        createdAt: reply.created_at.slice(0, 10),
        author: asIdentity(identityById.get(reply.author_id)),
        source: 'server',
      })),
      source: 'server',
    }
  }

  const authenticate = (token) => {
    const text = typeof token === 'string' ? token.trim() : ''
    if (!text) fail('unauthenticated', 401, '缺少设备令牌')
    const row = identityByToken.get(text)
    if (!row) fail('unauthenticated', 401, '设备令牌无效')
    return row
  }

  return {
    authenticate,

    createIdentity({ nickname, handle } = {}) {
      const cleanNickname = requireText(nickname, '昵称', 20)
      const cleanHandle = typeof handle === 'string' ? handle.trim().slice(0, 30) : ''
      if (cleanHandle && !HANDLE.test(cleanHandle)) fail('bad-handle', 400, '账号只能用字母、数字、点、下划线和短横线')
      const token = randomBytes(24).toString('base64url')
      const createdAt = nowIso()
      const info = db
        .prepare('INSERT INTO identities (token, nickname, handle, created_at) VALUES (?, ?, ?, ?)')
        .run(token, cleanNickname, cleanHandle, createdAt)
      return { id: Number(info.lastInsertRowid), token, nickname: cleanNickname, handle: cleanHandle, createdAt }
    },

    listWishes(viewerId) {
      return db
        .prepare('SELECT * FROM wishes ORDER BY created_at DESC')
        .all()
        .map((row) => mapWish(row, viewerId))
    },

    createWish({ token, title, brief, category, tags, bountyAmount, bountyNote } = {}) {
      const identity = authenticate(token)
      const cleanTitle = requireText(title, '愿望标题', LIMITS.title)
      const cleanBrief = requireText(brief, '愿望描述', LIMITS.brief)
      if (!CATEGORIES.includes(category)) fail('unknown-category', 400, '分类不在允许范围内')
      const cleanTags = Array.isArray(tags) ? tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 6) : []
      let amount = null
      if (bountyAmount !== undefined && bountyAmount !== null && `${bountyAmount}`.trim() !== '') {
        amount = Number(bountyAmount)
        if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000) fail('bad-bounty', 400, '悬赏只能是 1-100000 的整数')
      }
      const id = shortId('wish')
      db.prepare(
        `INSERT INTO wishes (id, author_id, title, brief, category, tags, bounty_amount, bounty_note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        identity.id,
        cleanTitle,
        cleanBrief,
        category,
        JSON.stringify(cleanTags),
        amount,
        typeof bountyNote === 'string' ? bountyNote.trim().slice(0, LIMITS.note) : null,
        nowIso(),
      )
      return mapWish(db.prepare('SELECT * FROM wishes WHERE id = ?').get(id), identity.id)
    },

    toggleCheer({ token, wishId } = {}) {
      const identity = authenticate(token)
      const wish = db.prepare('SELECT * FROM wishes WHERE id = ?').get(wishId)
      if (!wish) fail('not-found', 404, '没有这条愿望')
      const existing = db.prepare('SELECT 1 FROM wish_cheers WHERE wish_id = ? AND identity_id = ?').get(wishId, identity.id)
      if (existing) db.prepare('DELETE FROM wish_cheers WHERE wish_id = ? AND identity_id = ?').run(wishId, identity.id)
      else db.prepare('INSERT INTO wish_cheers (wish_id, identity_id, created_at) VALUES (?, ?, ?)').run(wishId, identity.id, nowIso())
      return mapWish(db.prepare('SELECT * FROM wishes WHERE id = ?').get(wishId), identity.id)
    },

    claimWish({ token, wishId, note } = {}) {
      const identity = authenticate(token)
      const wish = db.prepare('SELECT * FROM wishes WHERE id = ?').get(wishId)
      if (!wish) fail('not-found', 404, '没有这条愿望')
      if (wish.delivered_at) fail('already-delivered', 409, '这条愿望已经交付')
      if (wish.claimed_by) fail('already-claimed', 409, '这条愿望已经有人接单')
      db.prepare('UPDATE wishes SET claimed_by = ?, claimed_note = ?, claimed_at = ? WHERE id = ?').run(
        identity.id,
        typeof note === 'string' ? note.trim().slice(0, LIMITS.note) : '',
        nowIso(),
        wishId,
      )
      return mapWish(db.prepare('SELECT * FROM wishes WHERE id = ?').get(wishId), identity.id)
    },

    deliverWish({ token, wishId, projectSlug, note } = {}) {
      const identity = authenticate(token)
      const wish = db.prepare('SELECT * FROM wishes WHERE id = ?').get(wishId)
      if (!wish) fail('not-found', 404, '没有这条愿望')
      if (wish.delivered_at) fail('already-delivered', 409, '这条愿望已经交付')
      if (!wish.claimed_by) fail('not-claimed', 409, '这条愿望还没有人接单')
      if (wish.claimed_by !== identity.id) fail('not-claimant', 403, '只有接单人本人可以标记交付')
      const project = typeof projectSlug === 'string' ? projectSlug.trim() : ''
      if (!project) fail('missing-delivery', 400, '请给出关联作品')
      db.prepare('UPDATE wishes SET delivered_at = ?, delivered_project = ?, delivered_note = ? WHERE id = ?').run(
        nowIso(),
        project.slice(0, 80),
        typeof note === 'string' ? note.trim().slice(0, LIMITS.note) : null,
        wishId,
      )
      return mapWish(db.prepare('SELECT * FROM wishes WHERE id = ?').get(wishId), identity.id)
    },

    listPosts(viewerId) {
      return db
        .prepare('SELECT * FROM posts ORDER BY created_at DESC')
        .all()
        .map((row) => mapPost(row, viewerId))
    },

    createPost({ token, title, body, kind } = {}) {
      const identity = authenticate(token)
      const cleanTitle = requireText(title, '标题', LIMITS.title)
      const cleanBody = requireText(body, '正文', LIMITS.body)
      if (!POST_KINDS.includes(kind)) fail('unknown-kind', 400, '分类不在允许范围内')
      const id = shortId('post')
      db.prepare('INSERT INTO posts (id, author_id, title, body, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        id,
        identity.id,
        cleanTitle,
        cleanBody,
        kind,
        nowIso(),
      )
      return mapPost(db.prepare('SELECT * FROM posts WHERE id = ?').get(id), identity.id)
    },

    replyPost({ token, postId, body } = {}) {
      const identity = authenticate(token)
      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId)
      if (!post) fail('not-found', 404, '没有这个帖子')
      const cleanBody = requireText(body, '回复', LIMITS.reply)
      db.prepare('INSERT INTO replies (id, post_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)').run(
        shortId('reply'),
        postId,
        identity.id,
        cleanBody,
        nowIso(),
      )
      return mapPost(db.prepare('SELECT * FROM posts WHERE id = ?').get(postId), identity.id)
    },

    toggleLike({ token, postId } = {}) {
      const identity = authenticate(token)
      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId)
      if (!post) fail('not-found', 404, '没有这个帖子')
      const existing = db.prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND identity_id = ?').get(postId, identity.id)
      if (existing) db.prepare('DELETE FROM post_likes WHERE post_id = ? AND identity_id = ?').run(postId, identity.id)
      else db.prepare('INSERT INTO post_likes (post_id, identity_id) VALUES (?, ?)').run(postId, identity.id)
      return mapPost(db.prepare('SELECT * FROM posts WHERE id = ?').get(postId), identity.id)
    },

    stats() {
      const one = (sql) => Number(db.prepare(sql).get().count ?? 0)
      return {
        identities: one('SELECT COUNT(*) AS count FROM identities'),
        wishes: one('SELECT COUNT(*) AS count FROM wishes'),
        posts: one('SELECT COUNT(*) AS count FROM posts'),
        replies: one('SELECT COUNT(*) AS count FROM replies'),
      }
    },

    close() {
      db.close()
    },
  }
}
