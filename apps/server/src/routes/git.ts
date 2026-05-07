import type { FastifyInstance } from 'fastify'
import { GitService } from '@ghost/git'
import { eventBus } from '@ghost/events'
import path from 'node:path'
import { db } from '@ghost/database'

/**
 * Git branch visualization routes.
 *
 * GET /api/git/:workspaceId/log
 *   Returns git commit graph for branch visualization.
 *
 * GET /api/git/:workspaceId/branches
 *   Returns all branches with their latest commit info.
 *
 * POST /api/git/:workspaceId/branches
 *   Creates a new branch.
 *
 * POST /api/git/:workspaceId/commit
 *   Stages all changes and creates a commit.
 */

const gitService = new GitService(eventBus)

/** Resolve workspace repo path from the workspace record or a convention. */
async function resolveRepoPath(workspaceId: string): Promise<string | null> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  })
  if (!workspace) return null
  // Convention: repos are stored at /tmp/ghost-repos/<workspaceSlug>
  return path.join('/tmp/ghost-repos', workspace.slug)
}

export async function registerGitRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/git/:workspaceId/log?limit=50
   * Returns commits for branch graph visualization.
   */
  app.get<{
    Params: { workspaceId: string }
    Querystring: { limit?: string }
  }>('/:workspaceId/log', async (request, reply) => {
    const { workspaceId } = request.params
    const limit = Math.min(200, parseInt(request.query.limit ?? '50', 10))

    // Return commits from the database Branch records as a lightweight graph
    // representation. A full git log requires the repo to be cloned on disk.
    const branches = await db.branch.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    })

    const repoPath = await resolveRepoPath(workspaceId)

    if (!repoPath) {
      return reply.status(404).send({ error: 'Workspace not found' })
    }

    try {
      // Attempt to read live git log from disk
      const commits = await readGitLog(repoPath, limit)
      return reply.send({ commits, branches: branches.map(b => b.name) })
    } catch {
      // Repo not cloned yet — return branch metadata only
      return reply.send({
        commits: [],
        branches: branches.map(b => b.name),
        message: 'Repository not yet cloned. Commit history will appear after cloning.',
      })
    }
  })

  /**
   * GET /api/git/:workspaceId/branches
   * Returns all branches for the workspace.
   */
  app.get<{ Params: { workspaceId: string } }>(
    '/:workspaceId/branches',
    async (request, reply) => {
      const { workspaceId } = request.params

      const branches = await db.branch.findMany({
        where: { workspaceId },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      })

      return reply.send({ branches })
    }
  )

  /**
   * POST /api/git/:workspaceId/branches
   * Creates a new branch in the workspace.
   */
  app.post<{
    Params: { workspaceId: string }
    Body: { name: string; fromBranch?: string }
  }>('/:workspaceId/branches', async (request, reply) => {
    const { workspaceId } = request.params
    const { name, fromBranch = 'main' } = request.body

    // Persist to DB
    const branch = await db.branch.create({
      data: { workspaceId, name, createdFromBranch: fromBranch },
    })

    // Attempt live git branch creation if repo is available
    const repoPath = await resolveRepoPath(workspaceId)
    if (repoPath) {
      try {
        await gitService.createBranch({ workspaceId, repoPath, branchName: name, fromBranch })
      } catch {
        // Non-fatal — branch is recorded in DB regardless
      }
    }

    return reply.status(201).send({ branch })
  })

  /**
   * POST /api/git/:workspaceId/commit
   * Creates a commit from staged changes.
   */
  app.post<{
    Params: { workspaceId: string }
    Body: { message: string; authorName: string; authorEmail: string }
  }>('/:workspaceId/commit', async (request, reply) => {
    const { workspaceId } = request.params
    const { message, authorName, authorEmail } = request.body

    const repoPath = await resolveRepoPath(workspaceId)
    if (!repoPath) {
      return reply.status(404).send({ error: 'Workspace not found' })
    }

    try {
      const sha = await gitService.commit({
        workspaceId,
        repoPath,
        message,
        authorName,
        authorEmail,
      })
      return reply.send({ sha })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.status(500).send({ error: msg })
    }
  })

  /**
   * GET /api/git/:workspaceId/status
   * Returns git status for the workspace repo.
   */
  app.get<{ Params: { workspaceId: string } }>(
    '/:workspaceId/status',
    async (request, reply) => {
      const { workspaceId } = request.params
      const repoPath = await resolveRepoPath(workspaceId)
      if (!repoPath) {
        return reply.status(404).send({ error: 'Workspace not found' })
      }

      try {
        const status = await gitService.status(repoPath)
        return reply.send(status)
      } catch {
        return reply.send({ branch: 'main', staged: [], modified: [], untracked: [] })
      }
    }
  )
}

/**
 * Parse `git log` output into CommitNode objects.
 * Format: SHA<UNIT SEPARATOR>short_sha<US>subject<US>author<US>email<US>date<US>parents<RS>
 */
async function readGitLog(
  repoPath: string,
  limit: number
): Promise<Array<{
  sha: string
  shortSha: string
  message: string
  author: string
  email: string
  timestamp: string
  parents: string[]
  refs: string[]
}>> {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const exec = promisify(execFile)

  const US = '\x1F' // Unit Separator
  const RS = '\x1E' // Record Separator
  const format = [
    '%H',   // full SHA
    '%h',   // short SHA
    '%s',   // subject
    '%an',  // author name
    '%ae',  // author email
    '%aI',  // ISO date
    '%P',   // parent SHAs (space-separated)
    '%D',   // refs (branch names, HEAD)
  ].join(US)

  const { stdout } = await exec('git', [
    'log',
    `--format=${format}${RS}`,
    `--max-count=${limit}`,
    '--all',
  ], { cwd: repoPath })

  return stdout
    .split(RS)
    .filter(Boolean)
    .map(record => {
      const [sha, shortSha, message, author, email, timestamp, parentsStr, refsStr] = record
        .trim()
        .split(US)
      return {
        sha: sha ?? '',
        shortSha: shortSha ?? '',
        message: message ?? '',
        author: author ?? '',
        email: email ?? '',
        timestamp: timestamp ?? '',
        parents: parentsStr ? parentsStr.split(' ').filter(Boolean) : [],
        refs: refsStr ? refsStr.split(',').map(r => r.trim()).filter(Boolean) : [],
      }
    })
    .filter(c => c.sha)
}
