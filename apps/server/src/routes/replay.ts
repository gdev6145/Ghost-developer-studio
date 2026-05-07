import type { FastifyInstance } from 'fastify'
import { db } from '@ghost/database'

/**
 * Session replay routes.
 *
 * GET /api/replay/:workspaceId
 *   Returns paginated event log for the workspace.
 *
 * GET /api/replay/:workspaceId/stream?cursor=<timestamp>
 *   Returns events after the given cursor timestamp (for incremental loading).
 *
 * The frontend uses these to:
 *   1. Build a timeline of workspace activity
 *   2. Replay events at configurable speed
 */
export async function registerReplayRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/replay/:workspaceId?page=1&pageSize=100&since=<ISO>&until=<ISO>
   * Returns chronological event list.
   */
  app.get<{
    Params: { workspaceId: string }
    Querystring: { page?: string; pageSize?: string; since?: string; until?: string }
  }>('/:workspaceId', async (request, reply) => {
    const { workspaceId } = request.params
    const page = Math.max(1, parseInt(request.query.page ?? '1', 10))
    const pageSize = Math.min(500, parseInt(request.query.pageSize ?? '100', 10))
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = { workspaceId }
    if (request.query.since || request.query.until) {
      const tsFilter: Record<string, Date> = {}
      if (request.query.since) tsFilter['gte'] = new Date(request.query.since)
      if (request.query.until) tsFilter['lte'] = new Date(request.query.until)
      where['timestamp'] = tsFilter
    }

    const [events, total] = await Promise.all([
      db.event.findMany({
        where,
        orderBy: { timestamp: 'asc' },
        skip,
        take: pageSize,
      }),
      db.event.count({ where }),
    ])

    return reply.send({
      events: events.map((e: { id: string; type: string; workspaceId: string; actorId: string | null; timestamp: Date; payload: unknown }) => ({
        id: e.id,
        type: e.type,
        workspaceId: e.workspaceId,
        actorId: e.actorId,
        timestamp: e.timestamp.toISOString(),
        payload: e.payload,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  })

  /**
   * GET /api/replay/:workspaceId/summary
   * Returns a high-level summary of workspace activity (event counts by type).
   */
  app.get<{ Params: { workspaceId: string } }>(
    '/:workspaceId/summary',
    async (request, reply) => {
      const { workspaceId } = request.params

      // Group events by type and count
      const events = await db.event.findMany({
        where: { workspaceId },
        select: { type: true, timestamp: true },
        orderBy: { timestamp: 'asc' },
      })

      const byType: Record<string, number> = {}
      for (const e of events) {
        byType[e.type] = (byType[e.type] ?? 0) + 1
      }

      const first = events[0]?.timestamp
      const last = events[events.length - 1]?.timestamp

      return reply.send({
        total: events.length,
        byType,
        firstEvent: first?.toISOString(),
        lastEvent: last?.toISOString(),
      })
    }
  )
}
