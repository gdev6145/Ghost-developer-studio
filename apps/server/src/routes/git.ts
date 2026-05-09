import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { eventBus } from '@ghost/events'
import { GitService } from '@ghost/git'
import { getUserId } from '../utils/auth'

/**
 * Git REST routes for branch visualization and repository operations.
 *
 * Routes:
 *   GET  /api/git/:workspaceId/branches     — list branches
 *   POST /api/git/:workspaceId/branch       — create a new branch
 *   GET  /api/git/:workspaceId/status       — working-tree status
 *   GET  /api/git/:workspaceId/log          — commit history (for graph)
 *   POST /api/git/:workspaceId/commit       — stage + commit
 *   POST /api/git/:workspaceId/push         — push to remote
 *   POST /api/git/:workspaceId/clone        — clone a remote repo
 *
 * All routes require:
 *   - Authorization: Bearer <jwt>
 *   - Body param `repoPath` — absolute path of the workspace git repo on the server
 */

const git = new GitService(eventBus)

const DEFAULT_GIT_LOG_LIMIT = 50
const MAX_GIT_LOG_LIMIT = 200

export async function registerGitRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/git/:workspaceId/branches
   * Returns all local branch names.
   */
  app.get(
    '/:workspaceId/branches',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Querystring: { repoPath: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { repoPath } = req.query
      if (!repoPath) return reply.status(400).send({ error: 'repoPath is required' })

      try {
        const branches = await git.listBranches(repoPath)
        return reply.send({ branches })
      } catch (err) {
        return reply.status(500).send({ error: (err as Error).message })
      }
    }
  )

  /**
   * GET /api/git/:workspaceId/status
   * Returns working-tree status (branch, staged, modified, untracked).
   */
  app.get(
    '/:workspaceId/status',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Querystring: { repoPath: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { repoPath } = req.query
      if (!repoPath) return reply.status(400).send({ error: 'repoPath is required' })

      try {
        const status = await git.status(repoPath)
        return reply.send(status)
      } catch (err) {
        return reply.status(500).send({ error: (err as Error).message })
      }
    }
  )

  /**
   * GET /api/git/:workspaceId/log
   * Returns recent commit history for branch graph visualization.
   */
  app.get(
    '/:workspaceId/log',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Querystring: { repoPath: string; limit?: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { repoPath } = req.query
      if (!repoPath) return reply.status(400).send({ error: 'repoPath is required' })

      const limit = Math.min(parseInt(req.query.limit ?? String(DEFAULT_GIT_LOG_LIMIT), 10), MAX_GIT_LOG_LIMIT)

      try {
        const { simpleGit } = await import('simple-git')
        const g = simpleGit(repoPath)
        const log = await g.log({ maxCount: limit })
        return reply.send({ commits: log.all })
      } catch (err) {
        return reply.status(500).send({ error: (err as Error).message })
      }
    }
  )

  /**
   * POST /api/git/:workspaceId/branch
   * Create a new branch and optionally switch to it.
   */
  app.post(
    '/:workspaceId/branch',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Body: { repoPath: string; branchName: string; fromBranch?: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { workspaceId } = req.params
      const { repoPath, branchName, fromBranch } = req.body

      try {
        await git.createBranch({ workspaceId, repoPath, branchName, fromBranch })
        return reply.status(201).send({ branchName })
      } catch (err) {
        return reply.status(500).send({ error: (err as Error).message })
      }
    }
  )

  /**
   * POST /api/git/:workspaceId/commit
   * Stage files and create a commit.
   */
  app.post(
    '/:workspaceId/commit',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Body: {
          repoPath: string
          message: string
          authorName: string
          authorEmail: string
          files?: string[]
        }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { workspaceId } = req.params
      const { repoPath, message, authorName, authorEmail, files } = req.body

      try {
        const sha = await git.commit({ workspaceId, repoPath, message, authorName, authorEmail, files })
        return reply.send({ sha })
      } catch (err) {
        return reply.status(500).send({ error: (err as Error).message })
      }
    }
  )

  /**
   * POST /api/git/:workspaceId/push
   * Push commits to the remote.
   */
  app.post(
    '/:workspaceId/push',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Body: { repoPath: string; remote?: string; branch?: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { repoPath, remote = 'origin', branch } = req.body

      try {
        await git.push(repoPath, remote, branch)
        return reply.send({ ok: true })
      } catch (err) {
        return reply.status(500).send({ error: (err as Error).message })
      }
    }
  )

  /**
   * POST /api/git/:workspaceId/clone
   * Clone a remote repository to a server-side path.
   */
  app.post(
    '/:workspaceId/clone',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Body: { url: string; targetPath: string; branch?: string; token?: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { workspaceId } = req.params
      const { url, targetPath, branch, token } = req.body

      try {
        await git.clone({ url, targetPath, workspaceId, branch, token })
        return reply.status(201).send({ ok: true, targetPath })
      } catch (err) {
        return reply.status(500).send({ error: (err as Error).message })
      }
    }
  )
}
