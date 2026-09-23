import type { ForumPost } from './forumTypes'

const xiaoman = { nickname: '小满', handle: 'xiaoman', hue: 168 }
const ada = { nickname: 'Ada', handle: 'ada-standup', hue: 212 }
const yui = { nickname: 'Yui', handle: 'yui-type', hue: 318 }
const ken = { nickname: 'Ken', handle: 'ken-sleeps', hue: 192 }
const tao = { nickname: 'Tao', handle: 'tao-chord', hue: 286 }

/** 演示帖子：用于展示论坛的字段与交互，不代表真实用户发言。 */
export const seedPosts: ForumPost[] = [
  {
    id: 'forum-seed-01',
    slug: 'forum-acceptance',
    title: '接单之后怎么验收比较公平？',
    body: '我在愿望墙贴了一条愿望，接单人交付了，但和我脑子里想要的不太一样。想听听大家是怎么约定验收标准的。',
    kind: 'ask',
    author: xiaoman,
    createdAt: '2026-09-20',
    replies: [
      { id: 'r-1', author: ada, body: '我会在贴愿望的时候写三条「做到就算成」，交付时逐条对。', createdAt: '2026-09-20', source: 'seed' },
      { id: 'r-2', author: yui, body: '同意，另外允许接单人先交一个最小版本，再决定要不要继续。', createdAt: '2026-09-21', source: 'seed' },
    ],
    likes: 12,
    source: 'seed',
  },
  {
    id: 'forum-seed-02',
    slug: 'forum-first-vibe-app',
    title: '第一次用自然语言做工具：三个踩过的坑',
    body: '分享我第一次做出可用工具的过程：一是别一次提十个需求，二是让 AI 先给最小版本，三是每改一次都自己点一遍。',
    kind: 'share',
    author: ken,
    createdAt: '2026-09-18',
    replies: [{ id: 'r-3', author: tao, body: '第三条太重要了，我上次就是攒了十个改动一起提，结果全乱。', createdAt: '2026-09-19', source: 'seed' }],
    likes: 28,
    source: 'seed',
  },
  {
    id: 'forum-seed-03',
    slug: 'forum-recruit-dog-walk',
    title: '招募：一起做遛狗路线看板',
    body: '想做一块看板：显示附近的遛狗路线、草地、饮水和避雨点。我出数据和设计，希望有人一起做前端。',
    kind: 'recruit',
    author: yui,
    createdAt: '2026-09-16',
    replies: [],
    likes: 9,
    source: 'seed',
  },
  {
    id: 'forum-seed-04',
    slug: 'forum-showcase-tide-clock',
    title: '作品：一块只显示下一次潮汐的时钟',
    body: '做完挂在墙上当屏保了。关键提示词贴在展馆详情页里，迭代了三版才把留白调到能看。',
    kind: 'showcase',
    author: ken,
    createdAt: '2026-09-14',
    replies: [{ id: 'r-4', author: xiaoman, body: '这个留白很好看，回头我也想做一个只显示一件事的屏。', createdAt: '2026-09-15', source: 'seed' }],
    likes: 21,
    source: 'seed',
  },
  {
    id: 'forum-seed-05',
    slug: 'forum-chat-tools',
    title: '闲聊：你们平时用什么记录灵感？',
    body: '我发现自己想到要做的东西，第二天就忘了。想问问大家怎么记的，纸条、语音还是直接贴到愿望墙？',
    kind: 'chat',
    author: tao,
    createdAt: '2026-09-11',
    replies: [{ id: 'r-5', author: ada, body: '直接贴愿望墙，反正只有我自己看得到，先记下来最重要。', createdAt: '2026-09-12', source: 'seed' }],
    likes: 6,
    source: 'seed',
  },
  {
    id: 'forum-seed-06',
    slug: 'forum-bounty-question',
    title: '悬赏金额一般写多少合适？',
    body: '愿望墙上可以标意向悬赏，但我不确定写多少合适。想听听大家的心理价位，或者干脆不写？',
    kind: 'ask',
    author: ada,
    createdAt: '2026-09-09',
    replies: [
      { id: 'r-6', author: yui, body: '我的建议是写一个「请喝咖啡」的量级，别当真报价，反正这里不收款。', createdAt: '2026-09-10', source: 'seed' },
    ],
    likes: 15,
    source: 'seed',
  },
]
