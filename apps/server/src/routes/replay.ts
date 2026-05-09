import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@ghost/database'
import { getUserId } from '../utils/auth'

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

function classifyReplayEvent(type: string): string {
  if (type.startsWith('file.') || type.startsWith('document.')) return 'code'
  if (type.startsWith('presence.') || type.startsWith('user.')) return 'collaboration'
  if (type.startsWith('terminal.')) return 'terminal'
  if (type.startsWith('ai.')) return 'ai'
  if (type.startsWith('branch.') || type.startsWith('git.')) return 'branch'
  if (type.startsWith('runtime.') || type.startsWith('preview.')) return 'deployment'
  if (type.startsWith('memory.')) return 'memory'
  if (type.startsWith('debug.')) return 'debug'
  return 'other'
}

async function requireWorkspaceMembership(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  return Boolean(member)
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

      if (!(await requireWorkspaceMembership(workspaceId, userId))) {
        return reply.status(403).send({ error: 'Access denied' })
      }

      const [count, first, last, recent] = await Promise.all([
        db.event.count({ where: { workspaceId } }),
        db.event.findFirst({ where: { workspaceId }, orderBy: { timestamp: 'asc' } }),
        db.event.findFirst({ where: { workspaceId }, orderBy: { timestamp: 'desc' } }),
        db.event.findMany({
          where: { workspaceId },
          orderBy: { timestamp: 'desc' },
          take: 500,
          select: { type: true },
        }),
      ])

      const eventTypeCounts = recent.reduce<Record<string, number>>((acc, event) => {
        const key = classifyReplayEvent(event.type)
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      }, {})

      return reply.send({
        workspaceId,
        totalEvents: count,
        from: first?.timestamp.toISOString() ?? null,
        to: last?.timestamp.toISOString() ?? null,
        eventTypeCounts,
      })
    }
  )

  app.get(
    '/:workspaceId/query',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Querystring: {
          from?: string
          to?: string
          type?: string
          actorId?: string
          category?: string
          search?: string
          cursor?: string
          limit?: string
        }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { workspaceId } = req.params
      const { from, to, type, actorId, category, search, cursor } = req.query
      if (!(await requireWorkspaceMembership(workspaceId, userId))) {
        return reply.status(403).send({ error: 'Access denied' })
      }

      const parsedLimit = Number(req.query.limit ?? 100)
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100

      const events = await db.event.findMany({
        where: {
          workspaceId,
          ...(type ? { type } : {}),
          ...(actorId ? { actorId } : {}),
          ...(from || to
            ? {
                timestamp: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to) } : {}),
                },
              }
            : {}),
          ...(cursor ? { id: { lt: cursor } } : {}),
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      })

      const filtered = events
        .map(event => ({
          id: event.id,
          type: event.type,
          category: classifyReplayEvent(event.type),
          workspaceId: event.workspaceId,
          actorId: event.actorId,
          payload: event.payload,
          timestamp: event.timestamp.toISOString(),
        }))
        .filter(event => (category ? event.category === category : true))
        .filter(event =>
          search
            ? JSON.stringify(event.payload).toLowerCase().includes(search.toLowerCase()) ||
              event.type.toLowerCase().includes(search.toLowerCase())
            : true
        )

      const nextCursor = filtered.length === limit ? filtered[filtered.length - 1]?.id : null
      return reply.send({ events: filtered, nextCursor, count: filtered.length })
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
         Querystring: {
          from?: string
          to?: string
          type?: string
          actorId?: string
          category?: string
          search?: string
          limit?: string
        }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { workspaceId } = req.params
      if (!(await requireWorkspaceMembership(workspaceId, userId))) {
        return reply.status(403).send({ error: 'Access denied' })
      }
      const from = req.query.from ? new Date(req.query.from) : undefined
      const to = req.query.to ? new Date(req.query.to) : new Date()
      const parsedLimit = parseInt(req.query.limit ?? '500', 10)
      const limit = Number.isFinite(parsedLimit) ? Math.min(parsedLimit, 2000) : 500

      const events = await db.event.findMany({
        where: {
          workspaceId,
          ...(req.query.type ? { type: req.query.type } : {}),
          ...(req.query.actorId ? { actorId: req.query.actorId } : {}),
          ...(from ? { timestamp: { gte: from, lte: to } } : { timestamp: { lte: to } }),
        },
        orderBy: { timestamp: 'asc' },
        take: limit,
      })

      const lines = events.map(e =>
        ({
          id: e.id,
          type: e.type,
          category: classifyReplayEvent(e.type),
          workspaceId: e.workspaceId,
          actorId: e.actorId ?? undefined,
          payload: e.payload,
          timestamp: e.timestamp.toISOString(),
        })
      )
        .filter(e => (req.query.category ? e.category === req.query.category : true))
        .filter(e =>
          req.query.search
            ? JSON.stringify(e.payload).toLowerCase().includes(req.query.search.toLowerCase())
            : true
        )
        .map(e => JSON.stringify(e))

      void reply.header('Content-Type', 'application/x-ndjson')
      return reply.send(lines.join('\n') + '\n')
    }
  )

  app.get(
    '/:workspaceId/state',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Querystring: { at?: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
      const { workspaceId } = req.params
      if (!(await requireWorkspaceMembership(workspaceId, userId))) {
        return reply.status(403).send({ error: 'Access denied' })
      }

      const at = req.query.at ? new Date(req.query.at) : new Date()
      const events = await db.event.findMany({
        where: { workspaceId, timestamp: { lte: at } },
        orderBy: { timestamp: 'asc' },
      })

      const countsByCategory = events.reduce<Record<string, number>>((acc, event) => {
        const category = classifyReplayEvent(event.type)
        acc[category] = (acc[category] ?? 0) + 1
        return acc
      }, {})

      const latestByCategory = events.reduce<Record<string, { type: string; timestamp: string }>>((acc, event) => {
        const category = classifyReplayEvent(event.type)
        acc[category] = { type: event.type, timestamp: event.timestamp.toISOString() }
        return acc
      }, {})

      return reply.send({
        workspaceId,
        at: at.toISOString(),
        totalEvents: events.length,
        countsByCategory,
        latestByCategory,
      })
    }
  )

  app.get(
    '/:workspaceId/share',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Querystring: { from?: string; to?: string; type?: string; actorId?: string; category?: string; search?: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
      const { workspaceId } = req.params
      if (!(await requireWorkspaceMembership(workspaceId, userId))) {
        return reply.status(403).send({ error: 'Access denied' })
      }

      const params = new URLSearchParams()
      if (req.query.from) params.set('from', req.query.from)
      if (req.query.to) params.set('to', req.query.to)
      if (req.query.type) params.set('type', req.query.type)
      if (req.query.actorId) params.set('actorId', req.query.actorId)
      if (req.query.category) params.set('category', req.query.category)
      if (req.query.search) params.set('search', req.query.search)

      const link = `/workspace/${workspaceId}?tab=replay&${params.toString()}`
      return reply.send({ link })
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
      // Internal-only: require a server-side header in all environments
      const secret = req.headers['x-internal-secret']
      if (!process.env['INTERNAL_SECRET'] || secret !== process.env['INTERNAL_SECRET']) {
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
