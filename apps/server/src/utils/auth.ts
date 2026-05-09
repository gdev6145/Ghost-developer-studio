import type { FastifyRequest } from 'fastify'
import { verifyToken } from '@ghost/auth'

/**
 * Extract the authenticated user ID from the request Authorization header.
 * Returns null if the token is missing or invalid.
 */
export function getUserId(req: FastifyRequest): string | null {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  try {
    return verifyToken(token, process.env['JWT_SECRET']!).sub
  } catch {
    return null
  }
}
