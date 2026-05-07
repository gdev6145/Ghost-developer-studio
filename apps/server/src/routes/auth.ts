import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@ghost/database'
import { signToken, verifyToken } from '@ghost/auth'
import { generateId, now } from '@ghost/shared'
import { createHash } from 'crypto'

// Simple password hashing using SHA-256 (use bcrypt in production)
const hashPassword = (password: string): string =>
  createHash('sha256').update(password).digest('hex')

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /auth/register
   * Create a new user account
   */
  app.post(
    '/register',
    async (
      req: FastifyRequest<{
        Body: { email: string; username: string; displayName: string; password: string }
      }>,
      reply: FastifyReply
    ) => {
      const { email, username, displayName, password } = req.body

      const existing = await db.user.findFirst({
        where: { OR: [{ email }, { username }] },
      })
      if (existing) {
        return reply.status(409).send({ error: 'Email or username already taken' })
      }

      const user = await db.user.create({
        data: {
          email,
          username,
          displayName,
          passwordHash: hashPassword(password),
        },
      })

      const jwtSecret = process.env['JWT_SECRET']!
      const token = signToken(user, jwtSecret)

      return reply.status(201).send({
        token,
        user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
      })
    }
  )

  /**
   * POST /auth/login
   * Authenticate with email + password
   */
  app.post(
    '/login',
    async (
      req: FastifyRequest<{ Body: { email: string; password: string } }>,
      reply: FastifyReply
    ) => {
      const { email, password } = req.body

      const user = await db.user.findUnique({ where: { email } })
      if (!user || user.passwordHash !== hashPassword(password)) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      const jwtSecret = process.env['JWT_SECRET']!
      const token = signToken(user, jwtSecret)

      return reply.send({
        token,
        user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
      })
    }
  )

  /**
   * GET /auth/me
   * Get current user info
   */
  app.get(
    '/me',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const authHeader = req.headers.authorization
      const token = authHeader?.replace('Bearer ', '')
      if (!token) return reply.status(401).send({ error: 'Unauthorized' })

      try {
        const jwtSecret = process.env['JWT_SECRET']!
        const payload = verifyToken(token, jwtSecret)
        const user = await db.user.findUnique({ where: { id: payload.sub } })
        if (!user) return reply.status(404).send({ error: 'User not found' })
        return reply.send({
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        })
      } catch {
        return reply.status(401).send({ error: 'Invalid token' })
      }
    }
  )
}
