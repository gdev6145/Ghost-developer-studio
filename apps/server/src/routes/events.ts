import type { FastifyInstance } from 'fastify'
import type { Server as SocketIOServer } from 'socket.io'
import { db } from '@ghost/database'
import { generateId } from '@ghost/shared'
import { replayWorkspaceSession } from '../handlers/event-persistence'

/**
 * Events REST routes — expose workspace event history and trigger replay.
 *
 * GET  /api/events/:workspaceId            List persisted events (paginated)
 * POST /api/events/:workspaceId/replay     Start a replay session
 */
export function createEventsRoutes(io: SocketIOServer) {
  return async function registerEventsRoutes(app: FastifyInstance): Promise<void> {
    // ─── GET /api/events/:workspaceId ─────────────────────────────────────────
    app.get<{
      Params: { workspaceId: string }
      Querystring: { from?: string; to?: string; limit?: string; type?: string }
    }>(
      '/:workspaceId',
      async (request, reply) => {
        const { workspaceId } = request.params
        const { from, to, limit = '100', type } = request.query
        const take = Math.min(parseInt(limit, 10), 500)

        const events = await db.event.findMany({
          where: {
            workspaceId,
            ...(type ? { type } : {}),
            ...(from || to
              ? {
                  timestamp: {
                    ...(from ? { gte: new Date(from) } : {}),
                    ...(to ? { lte: new Date(to) } : {}),
                  },
                }
              : {}),
          },
          orderBy: { timestamp: 'asc' },
          take,
          select: {
            id: true,
            type: true,
            workspaceId: true,
            actorId: true,
            payload: true,
            timestamp: true,
          },
        })

        return { events, count: events.length }
      }
    )

    // ─── POST /api/events/:workspaceId/replay ─────────────────────────────────
    app.post<{
      Params: { workspaceId: string }
      Body: { from: string; to: string; speed?: number }
    }>(
      '/:workspaceId/replay',
      async (request, reply) => {
        const { workspaceId } = request.params
        const { from, to, speed = 1 } = request.body

        if (!from || !to) {
          return reply.status(400).send({ error: 'MISSING_PARAMS', message: 'from and to timestamps are required' })
        }

        const replayId = generateId()

        // Run replay asynchronously so we can return immediately
        void replayWorkspaceSession(io, workspaceId, replayId, from, to, Math.max(0.1, Math.min(speed, 100)))

        return { replayId, status: 'started' }
      }
    )
  }
}
