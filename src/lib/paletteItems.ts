import type { Project } from '../data/types'
import type { Wish } from '../data/wishTypes'
import type { ForumPost } from '../data/forumTypes'
import { CATEGORY_LABEL, categoryMeta } from '../data/categories'
import { POST_KIND_META } from '../data/forum'
import { WISH_STATUS_META } from '../data/wishes'
import { trendingScore } from '../data/queries'
import { formatCompact } from './format'

export type PaletteKind = 'page' | 'project' | 'wish' | 'post'

export interface PaletteItem {
  /** `page:/forum`、`project:slug`、`wish:slug`、`post:slug` */
  id: string
  kind: PaletteKind
  label: string
  sub: string
  badge: string
  hue: number
  /** 页面条目直接用路径跳转 */
  path?: string
  haystack: string
  /** 并列时的次序（页面固定最高，其余取热度） */
  rank: number
}

export const PALETTE_KIND_LABEL: Record<PaletteKind, string> = {
  page: '页面',
  project: '展品',
  wish: '愿望',
  post: '帖子',
}

/** 静态页面入口：让 ⌘K 同时是「全站路由」，移动端也能靠它导航。 */
export const PALETTE_PAGES: { path: string; label: string; sub: string; hue: number; keywords: string }[] = [
  { path: '/', label: '展馆', sub: '所有 vibecoding 作品', hue: 212, keywords: '展馆 大厅 作品 home hall 首页' },
  { path: '/stars', label: '升星榜', sub: 'GitHub 星标增量与增速', hue: 154, keywords: '升星 星标 stars github 榜 排行' },
  { path: '/wishes', label: '愿望墙', sub: '贴愿望、接单、交付', hue: 38, keywords: '愿望 悬赏 接单 wishes 需求' },
  { path: '/forum', label: '论坛', sub: '求助 / 经验 / 作品 / 招募 / 闲聊', hue: 268, keywords: '论坛 帖子 讨论 forum 社区' },
  { path: '/me', label: '我的主页', sub: '本机身份与本机数据', hue: 318, keywords: '我的 身份 资料 me profile 设置' },
  { path: '/submit', label: '提交作品', sub: '生成符合展馆格式的 JSON', hue: 192, keywords: '提交 投稿 submit 收录' },
  { path: '/about', label: '关于', sub: '数据来源与边界', hue: 230, keywords: '关于 about 说明 边界' },
]

export function buildPaletteItems({
  projects,
  wishes = [],
  posts = [],
  pages = PALETTE_PAGES,
}: {
  projects: Project[]
  wishes?: Wish[]
  posts?: ForumPost[]
  pages?: typeof PALETTE_PAGES
}): PaletteItem[] {
  const items: PaletteItem[] = []

  for (const page of pages) {
    items.push({
      id: `page:${page.path}`,
      kind: 'page',
      label: page.label,
      sub: page.sub,
      badge: '页面',
      hue: page.hue,
      path: page.path,
      haystack: `${page.label} ${page.sub} ${page.keywords}`.toLowerCase(),
      rank: 1_000_000,
    })
  }

  for (const project of projects) {
    const meta = categoryMeta(project.category)
    items.push({
      id: `project:${project.slug}`,
      kind: 'project',
      label: project.title,
      sub: `${project.maker.name} · ${project.stack.slice(0, 3).join(' / ')}`,
      badge: project.provenance.source === 'github' ? `★ ${formatCompact(project.stars ?? 0)}` : CATEGORY_LABEL[project.category],
      hue: meta.hue[0],
      haystack: `${project.title} ${project.tagline} ${project.stack.join(' ')} ${project.tags.join(' ')} ${project.maker.name} ${
        project.maker.handle
      }`.toLowerCase(),
      rank: trendingScore(project),
    })
  }

  for (const wish of wishes) {
    const meta = categoryMeta(wish.category)
    items.push({
      id: `wish:${wish.slug}`,
      kind: 'wish',
      label: wish.title,
      sub: `${wish.wisher.name || '匿名'} · ${WISH_STATUS_META[wish.status].label}`,
      badge: '愿望',
      hue: meta.hue[0],
      haystack: `${wish.title} ${wish.brief} ${wish.tags.join(' ')} ${wish.wisher.name} ${wish.wisher.handle}`.toLowerCase(),
      rank: wish.cheers,
    })
  }

  for (const post of posts) {
    items.push({
      id: `post:${post.slug}`,
      kind: 'post',
      label: post.title,
      sub: `${post.author.nickname || '匿名'} · ${POST_KIND_META[post.kind].label}`,
      badge: '帖子',
      hue: post.author.hue,
      haystack: `${post.title} ${post.body} ${post.author.nickname} ${post.author.handle}`.toLowerCase(),
      rank: post.likes,
    })
  }

  return items
}

/** 标题命中优先，其次并列热度；空查询返回全部。 */
export function filterPaletteItems(items: PaletteItem[], query: string): PaletteItem[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (terms.length === 0) return [...items]

  const scored: { item: PaletteItem; score: number }[] = []
  for (const item of items) {
    let score = 0
    let matchedAll = true
    for (const term of terms) {
      if (!item.haystack.includes(term)) {
        matchedAll = false
        break
      }
      const label = item.label.toLowerCase()
      if (label.includes(term)) score += label.startsWith(term) ? 12 : 8
      else score += 1
    }
    if (matchedAll) scored.push({ item, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || b.item.rank - a.item.rank || a.item.label.localeCompare(b.item.label))
    .map((entry) => entry.item)
}
