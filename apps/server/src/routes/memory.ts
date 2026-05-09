import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@ghost/database'
import type { WorkspaceMemoryService, WorkspaceMemoryCategory } from '../services/memory'
import { getUserId } from '../utils/auth'

function isMemoryCategory(value: string): value is WorkspaceMemoryCategory {
  return (
    value === 'decision' ||
    value === 'bug_fix' ||
    value === 'failed_experiment' ||
    value === 'convention' ||
    value === 'incident' ||
    value === 'code_owner'
  )
}

async function requireMember(
  workspaceId: string,
  userId: string,
  reply: FastifyReply
): Promise<boolean> {
  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  if (!member) {
    void reply.status(403).send({ error: 'Access denied' })
    return false
  }
  return true
}

export function createMemoryRoutes(memory: WorkspaceMemoryService) {
  return async function registerMemoryRoutes(app: FastifyInstance): Promise<void> {
    app.get(
      '/:workspaceId',
      async (
        req: FastifyRequest<{
          Params: { workspaceId: string }
          Querystring: { category?: string; limit?: string }
        }>,
        reply: FastifyReply
      ) => {
        const userId = getUserId(req)
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

        const { workspaceId } = req.params
        if (!(await requireMember(workspaceId, userId, reply))) return

        const category = req.query.category
        if (category && !isMemoryCategory(category)) {
          return reply.status(400).send({ error: 'Invalid category' })
        }

        const limit = Math.min(Number(req.query.limit ?? 50), 200)
        const entries = await memory.getKnowledge(workspaceId, {
          limit,
          ...(category ? { category } : {}),
        })
        return reply.send({ entries, policy: memory.getPolicy() })
      }
    )

    app.post(
      '/:workspaceId',
      async (
        req: FastifyRequest<{
          Params: { workspaceId: string }
          Body: {
            category: WorkspaceMemoryCategory
            title: string
            detail: string
            tags?: string[]
            relatedEntity?: string
            severity?: 'low' | 'medium' | 'high'
          }
        }>,
        reply: FastifyReply
      ) => {
        const userId = getUserId(req)
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

        const { workspaceId } = req.params
        if (!(await requireMember(workspaceId, userId, reply))) return

        const { category, title, detail, tags, relatedEntity, severity } = req.body
        if (!isMemoryCategory(category)) {
          return reply.status(400).send({ error: 'Invalid category' })
        }
        if (!title?.trim() || !detail?.trim()) {
          return reply.status(400).send({ error: 'title and detail are required' })
        }

        const created = await memory.addKnowledge(workspaceId, userId, {
          category,
          title: title.trim(),
          detail: detail.trim(),
          ...(tags ? { tags } : {}),
          ...(relatedEntity ? { relatedEntity } : {}),
          ...(severity ? { severity } : {}),
        })

        return reply.status(201).send(created)
      }
    )
  }
}
