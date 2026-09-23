/**
 * 演示示例数据的开关。
 *
 * 生产构建默认隐藏全部演示内容（示例展品、演示愿望、演示帖子、演示评论），
 * 只有显式设置 VITE_HALL_DEMO=1 时才在线上展示演示数据。
 */
const flag = import.meta.env.VITE_HALL_DEMO

export const SHOW_DEMO_CONTENT = flag === '1' || (flag !== '0' && Boolean(import.meta.env.DEV))

/** 按开关决定是否带上演示数据；生产环境返回空数组。 */
export function withDemo<T>(items: T[]): T[] {
  return SHOW_DEMO_CONTENT ? items : []
}
