import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@ghost/database'
import { verifyToken } from '@ghost/auth'
import { generateId } from '@ghost/shared'

function getUserId(req: FastifyRequest): string | null {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  try {
    return verifyToken(token, process.env['JWT_SECRET']!).sub
  } catch {
    return null
  }
}

export async function registerChatRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/chat/:workspaceId/messages
   * Get recent messages for a workspace (last 100)
   */
  app.get(
    '/:workspaceId/messages',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Querystring: { before?: string; limit?: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { workspaceId } = req.params
      const limit = Math.min(parseInt(req.query.limit ?? '100', 10), 200)

      const messages = await db.chatMessage.findMany({
        where: {
          workspaceId,
          ...(req.query.before ? { createdAt: { lt: new Date(req.query.before) } } : {}),
        },
        include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return reply.send(messages.reverse())
    }
  )

  /**
   * POST /api/chat/:workspaceId/messages
   * Send a message (REST fallback; realtime goes via Socket.IO)
   */
  app.post(
    '/:workspaceId/messages',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Body: { content: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const message = await db.chatMessage.create({
        data: {
          workspaceId: req.params.workspaceId,
          authorId: userId,
          content: req.body.content,
        },
        include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
      })

      return reply.status(201).send(message)
    }
  )
}
