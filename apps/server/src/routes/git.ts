import type { FastifyInstance } from 'fastify'
import { GitService } from '@ghost/git'
import { eventBus } from '@ghost/events'
import { db } from '@ghost/database'
import path from 'path'

const gitService = new GitService(eventBus)

/**
 * Git HTTP routes — branch list, commit log, and workspace git status.
 *
 * All routes are scoped under /api/git/:workspaceId
 */
export async function registerGitRoutes(app: FastifyInstance): Promise<void> {
  // ─── GET /api/git/:workspaceId/branches ───────────────────────────────────
  app.get<{ Params: { workspaceId: string } }>(
    '/:workspaceId/branches',
    async (request, reply) => {
      const { workspaceId } = request.params
      const repoPath = resolveRepoPath(workspaceId)

      try {
        const branches = await gitService.listBranches(repoPath)
        return { branches }
      } catch {
        return reply.status(422).send({ error: 'GIT_UNAVAILABLE', message: 'Git repo not initialised for this workspace' })
      }
    }
  )

  // ─── GET /api/git/:workspaceId/log ────────────────────────────────────────
  app.get<{
    Params: { workspaceId: string }
    Querystring: { branch?: string; limit?: string }
  }>(
    '/:workspaceId/log',
    async (request, reply) => {
      const { workspaceId } = request.params
      const { branch, limit } = request.query
      const maxCount = Math.min(parseInt(limit ?? '50', 10), 200)
      const repoPath = resolveRepoPath(workspaceId)

      try {
        const commits = await gitService.log(repoPath, { maxCount, branch })
        return { commits }
      } catch {
        return reply.status(422).send({ error: 'GIT_UNAVAILABLE', message: 'Git repo not initialised for this workspace' })
      }
    }
  )

  // ─── GET /api/git/:workspaceId/status ─────────────────────────────────────
  app.get<{ Params: { workspaceId: string } }>(
    '/:workspaceId/status',
    async (request, reply) => {
      const { workspaceId } = request.params
      const repoPath = resolveRepoPath(workspaceId)

      try {
        const status = await gitService.status(repoPath)
        return status
      } catch {
        return reply.status(422).send({ error: 'GIT_UNAVAILABLE', message: 'Git repo not initialised for this workspace' })
      }
    }
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve workspace repo path from workspaceId.
 * Repos are stored under WORKSPACE_ROOT env var (default: /workspaces).
 */
function resolveRepoPath(workspaceId: string): string {
  const root = process.env['WORKSPACE_ROOT'] ?? '/workspaces'
  // Sanitise: only allow alphanumerics, hyphens, underscores
  const safe = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(root, safe)
}
