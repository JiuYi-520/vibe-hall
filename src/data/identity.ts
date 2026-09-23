export interface LocalProfile {
  nickname: string
  handle: string
  bio?: string
  /** 头像底色色相，0-359。 */
  hue: number
}

export type IdentityIssueCode = 'empty-nickname' | 'long-nickname' | 'bad-handle'

export interface IdentityIssue {
  code: IdentityIssueCode
  detail: string
}

export const EMPTY_PROFILE: LocalProfile = { nickname: '', handle: '', bio: '', hue: 212 }

const HANDLE = /^[a-z0-9][a-z0-9._-]{1,29}$/i

export function validateProfile(profile: LocalProfile): IdentityIssue[] {
  const issues: IdentityIssue[] = []
  const nickname = profile.nickname.trim()
  if (!nickname) issues.push({ code: 'empty-nickname', detail: '昵称不能为空' })
  else if (nickname.length > 20) issues.push({ code: 'long-nickname', detail: '昵称不要超过 20 个字' })

  const handle = profile.handle.trim()
  if (handle && !HANDLE.test(handle)) {
    issues.push({ code: 'bad-handle', detail: '账号只能用字母、数字、点、下划线和短横线（2-30 位）' })
  }
  return issues
}

export function sanitizeProfile(value: unknown): LocalProfile | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<LocalProfile>
  if (typeof candidate.nickname !== 'string' || !candidate.nickname.trim()) return null
  return {
    nickname: candidate.nickname.trim().slice(0, 20),
    handle: typeof candidate.handle === 'string' ? candidate.handle.trim().slice(0, 30) : '',
    bio: typeof candidate.bio === 'string' ? candidate.bio.slice(0, 160) : '',
    hue: typeof candidate.hue === 'number' && Number.isFinite(candidate.hue) ? Math.abs(candidate.hue) % 360 : 212,
  }
}

export function displayName(profile: LocalProfile | null, fallback = '匿名'): string {
  return profile?.nickname?.trim() || fallback
}
