/**
 * Client-side session helpers.
 * Reads auth data stored in localStorage by the login flow.
 * These are browser-only — all functions guard for SSR (typeof window check).
 */

export function getCurrentUserId(): string {
  if (typeof window === 'undefined') return 'anon'
  return localStorage.getItem('ghost_userId') ?? 'anon'
}

export function getCurrentDisplayName(): string {
  if (typeof window === 'undefined') return 'Anonymous'
  return localStorage.getItem('ghost_displayName') ?? 'Anonymous'
}

export function getSessionToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('ghost_token') ?? ''
}

export function setSession(userId: string, displayName: string, token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('ghost_userId', userId)
  localStorage.setItem('ghost_displayName', displayName)
  localStorage.setItem('ghost_token', token)
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('ghost_userId')
  localStorage.removeItem('ghost_displayName')
  localStorage.removeItem('ghost_token')
}
