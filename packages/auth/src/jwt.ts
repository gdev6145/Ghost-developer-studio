import jwt from 'jsonwebtoken'
import type { User } from '@ghost/protocol'

// ─── JWT Token Payload ───────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string // userId
  email: string
  username: string
  iat?: number
  exp?: number
}

// ─── Sign & Verify ───────────────────────────────────────────────────────────

/**
 * Sign a JWT for the given user.
 * The caller is responsible for passing the secret from env config.
 */
export function signToken(
  user: Pick<User, 'id' | 'email' | 'username'>,
  secret: string,
  expiresIn = '7d'
): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    username: user.username,
  }
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions)
}

/**
 * Verify a JWT and return the decoded payload.
 * Throws if the token is invalid or expired.
 */
export function verifyToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload
}

/**
 * Decode a JWT without verifying the signature.
 * Useful for extracting userId from expired tokens in reconnect flows.
 */
export function decodeToken(token: string): JwtPayload | null {
  const decoded = jwt.decode(token)
  if (!decoded || typeof decoded === 'string') return null
  return decoded as JwtPayload
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Extract Bearer token from an Authorization header value.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  return token.length > 0 ? token : null
}

/**
 * Parse an Authorization header or cookie to get the JWT.
 * Checks header first, then cookie fallback (useful for websocket upgrades).
 */
export function resolveToken(options: {
  authHeader?: string
  cookieHeader?: string
  cookieName?: string
}): string | null {
  const { authHeader, cookieHeader, cookieName = 'ghost_token' } = options

  const fromHeader = extractBearerToken(authHeader)
  if (fromHeader) return fromHeader

  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader)
    return cookies[cookieName] ?? null
  }

  return null
}

function parseCookies(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...rest] = c.trim().split('=')
      return [k?.trim() ?? '', rest.join('=').trim()]
    })
  )
}
