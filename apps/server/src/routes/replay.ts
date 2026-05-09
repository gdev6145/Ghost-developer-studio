import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@ghost/database'
import { verifyToken } from '@ghost/auth'
import { now } from '@ghost/shared'

/**
 * Session Replay routes — persist events then stream them back in order.
 *
 * The Ghost event bus already dispatches GhostEvents; we persist them to the
 * `events` table in PostgreSQL.  The replay endpoint reads that table and
 * streams each event back to the client, optionally speed-adjusted.
 *
 * Routes:
 *   GET  /api/replay/:workspaceId          — list recorded event range
 *   GET  /api/replay/:workspaceId/stream   — stream events as NDJSON
 *   POST /api/replay/:workspaceId/persist  — record a single event (internal)
 */

function getUserId(req: FastifyRequest): string | null {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  try {
    return verifyToken(token, process.env['JWT_SECRET']!).sub
  } catch {
    return null
  }
}

export async function registerReplayRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/replay/:workspaceId
   * Returns metadata about recorded events: total count and timestamp range.
   */
  app.get(
    '/:workspaceId',
    async (
      req: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { workspaceId } = req.params

      const [count, first, last] = await Promise.all([
        db.event.count({ where: { workspaceId } }),
        db.event.findFirst({ where: { workspaceId }, orderBy: { timestamp: 'asc' } }),
        db.event.findFirst({ where: { workspaceId }, orderBy: { timestamp: 'desc' } }),
      ])

      return reply.send({
        workspaceId,
        totalEvents: count,
        from: first?.timestamp.toISOString() ?? null,
        to: last?.timestamp.toISOString() ?? null,
      })
    }
  )

  /**
   * GET /api/replay/:workspaceId/stream
   * Stream workspace events as newline-delimited JSON.
   *
   * Query params:
   *   from  — ISO timestamp (optional, default: beginning)
   *   to    — ISO timestamp (optional, default: now)
   *   limit — max events (default 500)
   */
  app.get(
    '/:workspaceId/stream',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Querystring: { from?: string; to?: string; limit?: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { workspaceId } = req.params
      const from = req.query.from ? new Date(req.query.from) : undefined
      const to = req.query.to ? new Date(req.query.to) : new Date()
      const limit = Math.min(parseInt(req.query.limit ?? '500', 10), 2000)

      const events = await db.event.findMany({
        where: {
          workspaceId,
          ...(from ? { timestamp: { gte: from, lte: to } } : { timestamp: { lte: to } }),
        },
        orderBy: { timestamp: 'asc' },
        take: limit,
      })

      const lines = events.map(e =>
        JSON.stringify({
          id: e.id,
          type: e.type,
          workspaceId: e.workspaceId,
          actorId: e.actorId ?? undefined,
          payload: e.payload,
          timestamp: e.timestamp.toISOString(),
        })
      )

      void reply.header('Content-Type', 'application/x-ndjson')
      return reply.send(lines.join('\n') + '\n')
    }
  )

  /**
   * POST /api/replay/:workspaceId/persist
   * Persist a single event to the event log.
   * Called internally by the event bus bridge on every GhostEvent.
   */
  app.post(
    '/:workspaceId/persist',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Body: {
          id: string
          type: string
          actorId?: string
          payload: Record<string, unknown>
          timestamp?: string
        }
      }>,
      reply: FastifyReply
    ) => {
      // Internal-only: require a server-side header
      const secret = req.headers['x-internal-secret']
      if (secret !== process.env['INTERNAL_SECRET'] && process.env['NODE_ENV'] === 'production') {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const { workspaceId } = req.params
      const { id, type, actorId, payload, timestamp } = req.body

      const event = await db.event.create({
        data: {
          id,
          workspaceId,
          actorId: actorId ?? null,
          type,
          payload,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
        },
      })

      return reply.status(201).send({ id: event.id })
    }
  )
}
