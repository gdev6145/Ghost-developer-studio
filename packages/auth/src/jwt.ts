import { decode, sign, verify, type SignOptions } from 'jsonwebtoken'

// ─── JWT Token Payload ───────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string // userId
  email: string
  username: string
  iat?: number
  exp?: number
}

export interface JwtSubject {
  id: string
  email: string
  username: string
}

// ─── Sign & Verify ───────────────────────────────────────────────────────────

/**
 * Sign a JWT for the given user.
 * The caller is responsible for passing the secret from env config.
 */
export function signToken(
  user: JwtSubject,
  secret: string,
  expiresIn: SignOptions['expiresIn'] = '7d'
): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    username: user.username,
  }
  return sign(payload, secret, { expiresIn })
}

/**
 * Verify a JWT and return the decoded payload.
 * Throws if the token is invalid or expired.
 */
export function verifyToken(token: string, secret: string): JwtPayload {
  const verified: unknown = verify(token, secret)
  if (!isJwtPayload(verified)) {
    throw new Error('Invalid token payload')
  }

  return verified
}

/**
 * Decode a JWT without verifying the signature.
 * Useful for extracting userId from expired tokens in reconnect flows.
 */
export function decodeToken(token: string): JwtPayload | null {
  const decodedValue: unknown = decode(token)
  return isJwtPayload(decodedValue) ? decodedValue : null
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

function isJwtPayload(value: unknown): value is JwtPayload {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate['sub'] === 'string' &&
    typeof candidate['email'] === 'string' &&
    typeof candidate['username'] === 'string' &&
    (candidate['iat'] === undefined || typeof candidate['iat'] === 'number') &&
    (candidate['exp'] === undefined || typeof candidate['exp'] === 'number')
  )
}
