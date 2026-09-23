import { useMemo, useState } from 'react'
import { PROJECT_CATEGORIES } from '../data/categories'
import type { CategoryId, Project } from '../data/types'
import { slugify } from '../lib/format'
import { useCopy } from '../lib/hooks'
import { validateProjects } from '../data/validateProjects'

interface FormState {
  title: string
  tagline: string
  story: string
  prompt: string
  category: CategoryId
  stack: string
  tags: string
  makerName: string
  makerHandle: string
  demoUrl: string
  repoUrl: string
}

const EMPTY: FormState = {
  title: '',
  tagline: '',
  story: '',
  prompt: '',
  category: 'tool',
  stack: '',
  tags: '',
  makerName: '',
  makerHandle: '',
  demoUrl: '',
  repoUrl: '',
}

export function SubmitPage() {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [touched, setTouched] = useState(false)
  const [toast, copy] = useCopy()

  const draft = useMemo<Project>(() => {
    const links: Project['links'] = []
    if (form.demoUrl.trim()) links.push({ kind: 'demo', label: '打开作品', url: form.demoUrl.trim() })
    if (form.repoUrl.trim()) links.push({ kind: 'repo', label: '查看源码', url: form.repoUrl.trim() })
    return {
      id: `draft-${slugify(form.title) || 'untitled'}`,
      slug: slugify(form.title) || 'untitled',
      title: form.title.trim(),
      tagline: form.tagline.trim(),
      story: form.story.trim(),
      prompt: form.prompt.trim() || undefined,
      category: form.category,
      tags: form.tags
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
      stack: form.stack
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
      maker: { name: form.makerName.trim(), handle: form.makerHandle.trim().replace(/^@/, '') },
      links,
      createdAt: new Date().toISOString().slice(0, 10),
      likes: 0,
      featured: false,
      status: 'live',
      provenance: { source: 'seed', note: 'submit draft' },
    }
  }, [form])

  const issues = useMemo(() => validateProjects([draft]), [draft])
  const preview = useMemo(() => JSON.stringify(stripDraft(draft), null, 2), [draft])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="section submit">
      <header className="submit__head">
        <h1>提交你的作品</h1>
        <p>
          第一版不接后端：填完表单会在本地生成一条符合展馆数据格式的 JSON，复制它就能贴进
          GitHub 议题（Issue）或合并请求（Pull Request）。展馆只要求一件事——请把提示词或迭代过程一起交上来。
        </p>
      </header>

      <div className="submit__grid">
        <form
          className="submit__form"
          onSubmit={(event) => {
            event.preventDefault()
            setTouched(true)
          }}
        >
          <label>
            <span>作品名 *</span>
            <input value={form.title} onChange={(event) => set('title', event.target.value)} placeholder="例如：霓虹看板" />
          </label>
          <label>
            <span>一句话介绍 *</span>
            <input
              value={form.tagline}
              onChange={(event) => set('tagline', event.target.value)}
              placeholder="例如：一句话描述需求，AI 给了一块会呼吸的看板"
            />
          </label>
          <div className="submit__row">
            <label>
              <span>作者名 *</span>
              <input value={form.makerName} onChange={(event) => set('makerName', event.target.value)} placeholder="你的名字" />
            </label>
            <label>
              <span>社交账号 *</span>
              <input value={form.makerHandle} onChange={(event) => set('makerHandle', event.target.value)} placeholder="例如 GitHub 用户名" />
            </label>
          </div>
          <div className="submit__row">
            <label>
              <span>分类 *</span>
              <select value={form.category} onChange={(event) => set('category', event.target.value as CategoryId)}>
                {PROJECT_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>技术栈（逗号分隔）*</span>
              <input value={form.stack} onChange={(event) => set('stack', event.target.value)} placeholder="React, Vite" />
            </label>
          </div>
          <div className="submit__row">
            <label>
              <span>作品链接</span>
              <input value={form.demoUrl} onChange={(event) => set('demoUrl', event.target.value)} placeholder="https://" />
            </label>
            <label>
              <span>源码链接</span>
              <input value={form.repoUrl} onChange={(event) => set('repoUrl', event.target.value)} placeholder="https://github.com/…" />
            </label>
          </div>
          <label>
            <span>标签（逗号分隔）</span>
            <input value={form.tags} onChange={(event) => set('tags', event.target.value)} placeholder="动效, 拖拽" />
          </label>
          <label>
            <span>关键提示词</span>
            <textarea
              rows={3}
              value={form.prompt}
              onChange={(event) => set('prompt', event.target.value)}
              placeholder="把最初那句最有用的话贴在这里"
            />
          </label>
          <label>
            <span>制作故事 *</span>
            <textarea
              rows={5}
              value={form.story}
              onChange={(event) => set('story', event.target.value)}
              placeholder="第一版是什么样？哪一步最难？你改了几轮？"
            />
          </label>

          {touched && issues.length > 0 && (
            <ul className="submit__issues" role="alert">
              {issues.map((issue) => (
                <li key={`${issue.code}-${issue.detail}`}>
                  {issue.code === 'unsafe-link' ? '链接必须以 http(s):// 开头' : `请补全：${issue.detail}`}
                </li>
              ))}
            </ul>
          )}
          {touched && issues.length === 0 && (
            <p className="submit__ok" role="status">
              通过校验，可以复制下面的 JSON 提交了。
            </p>
          )}

          <div className="submit__actions">
            <button type="submit" className="btn btn--primary">
              校验表单
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => copy(preview, ' JSON')}>
              复制 JSON
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => { setForm(EMPTY); setTouched(false) }}>
              重置
            </button>
          </div>
        </form>

        <aside className="submit__preview">
          <h2>生成的数据</h2>
          <pre>{preview}</pre>
          <p className="submit__note">
            展馆按这份 schema 渲染卡片与详情页；提交前请确认链接可访问、没有他人未授权的作品。
          </p>
        </aside>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function stripDraft(project: Project) {
  const { provenance, ...rest } = project
  void provenance
  return rest
}
