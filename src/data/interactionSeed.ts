import type { Comment } from './interactionTypes'

const yui = { name: 'Yui', handle: 'yui-type', hue: 318 }
const ada = { name: 'Ada', handle: 'ada-standup', hue: 212 }
const ken = { name: 'Ken', handle: 'ken-sleeps', hue: 192 }
const tao = { name: 'Tao', handle: 'tao-chord', hue: 286 }

/** 演示评论：用于展示评论区的字段与排序，不代表真实用户发言。 */
export const seedComments: Comment[] = [
  {
    id: 'comment-seed-01',
    projectSlug: 'neon-kanban',
    author: yui,
    body: '拖拽的惯性很舒服，想知道缓动曲线你调了几版？',
    createdAt: '2026-09-12',
    source: 'seed',
  },
  {
    id: 'comment-seed-02',
    projectSlug: 'neon-kanban',
    author: ada,
    body: '深色下卡片边框的对比度刚好好，没有那种脏紫色。',
    createdAt: '2026-09-14',
    source: 'seed',
  },
  {
    id: 'comment-seed-03',
    projectSlug: 'tide-clock',
    author: ken,
    body: '只显示一件事这个思路太对了，我也想做一个只显示一个指标的屏。',
    createdAt: '2026-09-16',
    source: 'seed',
  },
  {
    id: 'comment-seed-04',
    projectSlug: 'type-museum',
    author: tao,
    body: '走进展厅的纵深感是怎么做的？纯 3D 还是视差？',
    createdAt: '2026-09-18',
    source: 'seed',
  },
]
