import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@ghost/database'
import { generateId } from '@ghost/shared'
import { requireAdminAccess } from '../middleware/rbac'
import { getUserId } from '../utils/auth'

export async function registerWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/workspaces
   * List workspaces for the current user
   */
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(req)
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    const memberships = await db.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: { members: { include: { user: true } } },
        },
      },
    })

    return reply.send(memberships.map(m => m.workspace))
  })

  /**
   * POST /api/workspaces
   * Create a new workspace
   */
  app.post(
    '/',
    async (
      req: FastifyRequest<{ Body: { name: string; description?: string } }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { name, description } = req.body
      const slug = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .concat('-', generateId().slice(0, 6))

      const workspace = await db.workspace.create({
        data: {
          name,
          slug,
          description,
          ownerId: userId,
          members: {
            create: { userId, role: 'owner' },
          },
          runtimeState: {
            create: { status: 'idle' },
          },
        },
        include: { members: { include: { user: true } }, runtimeState: true },
      })

      return reply.status(201).send(workspace)
    }
  )

  /**
   * GET /api/workspaces/:id
   * Get workspace by ID
   */
  app.get(
    '/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const workspace = await db.workspace.findUnique({
        where: { id: req.params.id },
        include: {
          members: { include: { user: true } },
          branches: true,
          runtimeState: true,
        },
      })

      if (!workspace) return reply.status(404).send({ error: 'Workspace not found' })

      const isMember = workspace.members.some(m => m.userId === userId)
      if (!isMember) return reply.status(403).send({ error: 'Access denied' })

      return reply.send(workspace)
    }
  )

  /**
   * POST /api/workspaces/:id/members
   * Invite a user to a workspace — requires admin or owner role
   */
  app.post(
    '/:id/members',
    async (
      req: FastifyRequest<{
        Params: { id: string }
        Body: { userId: string; role?: 'editor' | 'viewer' | 'admin' }
      }>,
      reply: FastifyReply
    ) => {
      const { id: workspaceId } = req.params
      const access = await requireAdminAccess(req, reply, workspaceId)
      if (!access) return

      const { userId, role = 'editor' } = req.body

      const member = await db.workspaceMember.create({
        data: { workspaceId, userId, role },
        include: { user: true },
      })

      return reply.status(201).send(member)
    }
  )
}
