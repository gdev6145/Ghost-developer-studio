/**
 * Generate a unique ID.
 * Uses crypto.randomUUID() (available in Node 15+ and modern browsers).
 * Falls back to a simple random hex string for environments that lack it.
 */
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  // Fallback: 21-char random alphanumeric string
  return Array.from({ length: 21 }, () =>
    '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]
  ).join('')
}

/**
 * Generate a short human-readable color for a collaborator.
 * Colors are deterministic based on userId so the same user always
 * gets the same color within a session.
 */
export const COLLABORATOR_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#82E0AA',
] as const
const DEFAULT_COLLABORATOR_COLOR = '#FF6B6B'

export type CollaboratorColor = (typeof COLLABORATOR_COLORS)[number]

export const getCollaboratorColor = (userId: string): string => {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32bit integer
  }
  const index = Math.abs(hash) % COLLABORATOR_COLORS.length
  return COLLABORATOR_COLORS[index] ?? DEFAULT_COLLABORATOR_COLOR
}

/**
 * Create an ISO timestamp string (UTC).
 */
export const now = (): string => new Date().toISOString()

/**
 * Sleep for a given number of milliseconds.
 * Useful for retry delays and test helpers.
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

/**
 * Debounce a function call.
 * Returns a function that delays invoking `fn` until after `wait` ms
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  wait: number
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (...args: TArgs) {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
    }, wait)
  }
}

/**
 * Throttle a function call.
 * Returns a function that invokes `fn` at most once per `limit` ms.
 */
export function throttle<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  limit: number
): (...args: TArgs) => void {
  let inThrottle = false
  return function (...args: TArgs) {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Convert a base64 string to a Uint8Array.
 * Used for Yjs binary update transport over JSON.
 */
export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = atob(base64)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }
  return array
}

/**
 * Convert a Uint8Array to a base64 string.
 */
export const uint8ArrayToBase64 = (array: Uint8Array): string => {
  let binary = ''
  array.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

/**
 * Assert that a value is not null/undefined in a type-safe way.
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message)
  }
}

/**
 * Get language identifier from file extension for Monaco.
 */
export const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    mdx: 'markdown',
    html: 'html',
    css: 'css',
    scss: 'scss',
    py: 'python',
    rs: 'rust',
    go: 'go',
    rb: 'ruby',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'dockerfile',
    Dockerfile: 'dockerfile',
  }
  return languageMap[ext] ?? 'plaintext'
}
