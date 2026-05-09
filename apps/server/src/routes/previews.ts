import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { generateId, now } from '@ghost/shared'
import { requireWriteAccess, requireAdminAccess } from '../middleware/rbac'
import { getUserId } from '../utils/auth'

/**
 * Ephemeral Preview Environment routes.
 *
 * Each workspace branch can have one ephemeral preview environment spun up
 * on demand. Environments have a TTL after which they are automatically torn down.
 *
 * Routes:
 *   POST   /api/previews/:workspaceId            — create / wake a preview env
 *   GET    /api/previews/:workspaceId            — list preview envs for workspace
 *   GET    /api/previews/:workspaceId/:envId     — get specific env status
 *   DELETE /api/previews/:workspaceId/:envId     — tear down env
 */

export type PreviewStatus = 'provisioning' | 'running' | 'sleeping' | 'stopped' | 'error'

export interface PreviewEnvironment {
  envId: string
  workspaceId: string
  branch: string
  status: PreviewStatus
  previewUrl?: string
  /** Unique subdomain allocated for this environment */
  subdomain: string
  createdBy: string
  createdAt: string
  lastActiveAt: string
  /** ISO timestamp when the env will auto-sleep if inactive */
  sleepAt: string
}

/** Base domain for preview environment URLs (configurable via env) */
const PREVIEW_BASE_DOMAIN =
  process.env['PREVIEW_BASE_DOMAIN'] ?? 'preview.ghostdev.studio'

// In-memory store (production: PostgreSQL + container orchestrator)
const previews = new Map<string, PreviewEnvironment>()

function allocateSubdomain(workspaceId: string, branch: string): string {
  const safe = branch.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)
  return `${safe}-${workspaceId.slice(0, 6)}`
}

export async function registerPreviewRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/previews/:workspaceId
   * Create or wake a preview environment for the given branch.
   * Body: { branch: string }
   */
  app.post(
    '/:workspaceId',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Body: { branch: string }
      }>,
      reply: FastifyReply
    ) => {
      const access = await requireWriteAccess(req, reply, req.params.workspaceId)
      if (!access) return

      const { workspaceId } = req.params
      const branch = req.body.branch ?? 'main'

      // Check if env already exists for this branch
      const existing = Array.from(previews.values()).find(
        e => e.workspaceId === workspaceId && e.branch === branch && e.status !== 'stopped'
      )

      if (existing) {
        // Wake sleeping env
        if (existing.status === 'sleeping') {
          existing.status = 'running'
        }
        existing.lastActiveAt = now()
        existing.sleepAt = new Date(Date.now() + SLEEP_TTL_MS).toISOString()
        return reply.send(existing)
      }

      const subdomain = allocateSubdomain(workspaceId, branch)
      const env: PreviewEnvironment = {
        envId: generateId(),
        workspaceId,
        branch,
        status: 'provisioning',
        subdomain,
        previewUrl: `https://${subdomain}.${PREVIEW_BASE_DOMAIN}`,
        createdBy: access.userId,
        createdAt: now(),
        lastActiveAt: now(),
        sleepAt: new Date(Date.now() + SLEEP_TTL_MS).toISOString(),
      }

      previews.set(env.envId, env)

      // Simulate async provisioning (in production: trigger container build pipeline)
      setTimeout(() => {
        const e = previews.get(env.envId)
        if (e && e.status === 'provisioning') {
          e.status = 'running'
        }
      }, 2000)

      return reply.status(201).send(env)
    }
  )

  /**
   * GET /api/previews/:workspaceId
   * List all preview environments for the workspace.
   */
  app.get(
    '/:workspaceId',
    async (
      req: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const access = await requireWriteAccess(req, reply, req.params.workspaceId)
      if (!access) return

      const envs = Array.from(previews.values()).filter(
        e => e.workspaceId === req.params.workspaceId
      )

      // Auto-sleep stale environments
      const now_ = Date.now()
      envs.forEach(e => {
        if (e.status === 'running' && new Date(e.sleepAt).getTime() < now_) {
          e.status = 'sleeping'
        }
      })

      return reply.send({ environments: envs })
    }
  )

  /**
   * GET /api/previews/:workspaceId/:envId
   * Get a specific preview environment.
   */
  app.get(
    '/:workspaceId/:envId',
    async (
      req: FastifyRequest<{ Params: { workspaceId: string; envId: string } }>,
      reply: FastifyReply
    ) => {
      const access = await requireWriteAccess(req, reply, req.params.workspaceId)
      if (!access) return

      const env = previews.get(req.params.envId)
      if (!env || env.workspaceId !== req.params.workspaceId) {
        return reply.status(404).send({ error: 'Preview environment not found' })
      }

      return reply.send(env)
    }
  )

  /**
   * DELETE /api/previews/:workspaceId/:envId
   * Tear down a preview environment — requires admin.
   */
  app.delete(
    '/:workspaceId/:envId',
    async (
      req: FastifyRequest<{ Params: { workspaceId: string; envId: string } }>,
      reply: FastifyReply
    ) => {
      const access = await requireAdminAccess(req, reply, req.params.workspaceId)
      if (!access) return

      const env = previews.get(req.params.envId)
      if (!env || env.workspaceId !== req.params.workspaceId) {
        return reply.status(404).send({ error: 'Preview environment not found' })
      }

      env.status = 'stopped'
      return reply.send({ ok: true, envId: env.envId })
    }
  )
}
