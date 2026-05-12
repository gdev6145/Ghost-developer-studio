import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@ghost/database'
import { getUserId } from '../utils/auth'

/**
 * Audit log routes — queryable history of workspace events.
 *
 * Routes:
 *   GET /api/audit/:workspaceId          — list events (filterable by type, actor, date range)
 *   GET /api/audit/:workspaceId/export   — export events as NDJSON
 */

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/audit/:workspaceId
   * Query the audit event log for a workspace.
   *
   * Query params:
   *   type    — filter by event type (e.g. "chat.sent")
   *   actorId — filter by actor user ID
   *   from    — ISO8601 start date
   *   to      — ISO8601 end date
   *   limit   — max results (default 50, max 200)
   *   cursor  — pagination cursor (event ID)
   */
  app.get(
    '/:workspaceId',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Querystring: {
          type?: string
          actorId?: string
          from?: string
          to?: string
          limit?: string
          cursor?: string
        }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { workspaceId } = req.params
      const { type, actorId, from, to, limit: limitStr, cursor } = req.query

      // Verify membership
      const member = await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      })
      if (!member) return reply.status(403).send({ error: 'Access denied' })

      const limit = Math.min(Number(limitStr ?? 50), 200)

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
        select: {
          id: true,
          type: true,
          actorId: true,
          payload: true,
          timestamp: true,
        },
      })

      const nextCursor = events.length === limit ? events[events.length - 1]?.id : null

      return reply.send({ events, nextCursor, count: events.length })
    }
  )

  /**
   * GET /api/audit/:workspaceId/export
   * Export all events for the workspace as NDJSON (newline-delimited JSON).
   * Useful for compliance, data portability, and external tooling.
   */
  app.get(
    '/:workspaceId/export',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Querystring: { from?: string; to?: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { workspaceId } = req.params
      const { from, to } = req.query

      // Only admins/owners can export
      const member = await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      })
      if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        return reply.status(403).send({ error: 'Admin or owner role required for export' })
      }

      const events = await db.event.findMany({
        where: {
          workspaceId,
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
      })

      void reply.header('Content-Type', 'application/x-ndjson')
      void reply.header('Content-Disposition', `attachment; filename="audit-${workspaceId}.ndjson"`)
      return reply.send(events.map(e => JSON.stringify(e)).join('\n') + '\n')
    }
  )
}
