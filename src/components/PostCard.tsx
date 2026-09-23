import { useState } from 'react'
import type { ForumAuthor, ForumPost } from '../data/forumTypes'
import { POST_KIND_META } from '../data/forum'
import { formatDate } from '../lib/format'

interface PostCardProps {
  post: ForumPost
  /** 本机身份；没有身份时不能回复。 */
  me: ForumAuthor | null
  onLike: (id: string) => void
  onReply: (id: string, body: string) => string | null
  /** 从命令面板跳进来时高亮这一条。 */
  focused?: boolean
}

export function PostCard({ post, me, onLike, onReply, focused }: PostCardProps) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const meta = POST_KIND_META[post.kind]

  const submitReply = () => {
    const failure = onReply(post.id, body)
    if (failure) {
      setError(failure)
      return
    }
    setError(null)
    setBody('')
    setReplyOpen(false)
  }

  return (
    <li
      className={`post ${focused ? 'is-focused' : ''}`}
      id={`post-${post.slug}`}
      data-testid={`post-${post.slug}`}
      style={{ ['--hue-a' as string]: post.author.hue, ['--hue-b' as string]: (post.author.hue + 50) % 360 }}
    >
      <div className="post__head">
        <span className={`chip chip--${meta.tone}`}>{meta.label}</span>
        <span className="post__author">
          <span className="post__dot" aria-hidden="true">
            {(post.author.nickname || '匿').slice(0, 1)}
          </span>
          {post.author.nickname || '匿名'}
          {post.author.handle && <em>@{post.author.handle}</em>}
          <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
        </span>
        {post.source === 'local' && <span className="chip chip--live">本机</span>}
      </div>

      <h3 className="post__title">{post.title}</h3>
      <p className="post__body">{post.body}</p>

      <div className="post__foot">
        <button type="button" className="ghost-btn" onClick={() => onLike(post.id)}>
          👍 点赞
        </button>
        <span className="post__count" data-testid={`post-likes-${post.slug}`}>
          {post.likes}
        </span>
        <span className="post__count">{post.replies.length} 条回复</span>
        {me ? (
          <button type="button" className="ghost-btn" onClick={() => setReplyOpen((open) => !open)}>
            回复
          </button>
        ) : (
          <span className="post__hint">设置本机身份后可回复</span>
        )}
      </div>

      {post.replies.length > 0 && (
        <ul className="post__replies">
          {post.replies.map((reply) => (
            <li key={reply.id}>
              <span className="post__reply-who">
                {reply.author.nickname || '匿名'}
                {reply.author.handle && <em>@{reply.author.handle}</em>}
              </span>
              <p>{reply.body}</p>
              <time dateTime={reply.createdAt}>{formatDate(reply.createdAt)}</time>
            </li>
          ))}
        </ul>
      )}

      {replyOpen && me && (
        <form
          className="post__form"
          onSubmit={(event) => {
            event.preventDefault()
            submitReply()
          }}
        >
          <label>
            <span>回复正文</span>
            <textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="说点什么有用的" />
          </label>
          <div className="post__form-actions">
            <button type="submit" className="btn btn--primary">
              发表回复
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setReplyOpen(false)}>
              取消
            </button>
          </div>
          {error && (
            <p className="post__error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </li>
  )
}
