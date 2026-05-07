import simpleGit, { type SimpleGit } from 'simple-git'
import type { EventDispatcher } from '@ghost/events'
import type { GitCommit } from '@ghost/protocol'
import { now } from '@ghost/shared'

export interface CloneOptions {
  url: string
  targetPath: string
  workspaceId: string
  branch?: string
  token?: string // GitHub personal access token for private repos
}

export interface CommitOptions {
  workspaceId: string
  repoPath: string
  message: string
  authorName: string
  authorEmail: string
  files?: string[]
}

export interface BranchOptions {
  workspaceId: string
  repoPath: string
  branchName: string
  fromBranch?: string
}

/**
 * GitService wraps simple-git with workspace-level event emission.
 *
 * DO NOT reinvent git internals – this is a thin adapter over simple-git.
 *
 * Supports:
 *  - clone (public & private via token)
 *  - pull
 *  - push
 *  - commit
 *  - branch create/switch
 *  - status
 */
export class GitService {
  constructor(private readonly events: EventDispatcher) {}

  private git(repoPath: string): SimpleGit {
    return simpleGit(repoPath)
  }

  /**
   * Clone a remote repository into a local path.
   * For private repos, inject the token into the URL.
   */
  async clone(options: CloneOptions): Promise<void> {
    const { url, targetPath, workspaceId, branch, token } = options

    let cloneUrl = url
    if (token) {
      // Inject OAuth token into HTTPS URL
      const u = new URL(url)
      u.username = 'oauth2'
      u.password = token
      cloneUrl = u.toString()
    }

    const args = branch ? ['--branch', branch, '--single-branch'] : []
    await simpleGit().clone(cloneUrl, targetPath, args)
    await this.events.dispatch('branch.created', workspaceId, {
      branchName: branch ?? 'main',
      fromBranch: '',
    })
  }

  /**
   * Pull latest changes from origin.
   */
  async pull(repoPath: string, workspaceId: string): Promise<void> {
    await this.git(repoPath).pull()
  }

  /**
   * Push commits to origin.
   */
  async push(repoPath: string, remote = 'origin', branch?: string): Promise<void> {
    const g = this.git(repoPath)
    if (branch) {
      await g.push(remote, branch)
    } else {
      await g.push()
    }
  }

  /**
   * Stage files and create a commit.
   */
  async commit(options: CommitOptions): Promise<string> {
    const { workspaceId, repoPath, message, authorName, authorEmail, files } = options
    const g = this.git(repoPath)

    await g.addConfig('user.name', authorName)
    await g.addConfig('user.email', authorEmail)

    if (files && files.length > 0) {
      await g.add(files)
    } else {
      await g.add('-A')
    }

    const result = await g.commit(message)
    return result.commit
  }

  /**
   * Create a new branch.
   */
  async createBranch(options: BranchOptions): Promise<void> {
    const { workspaceId, repoPath, branchName, fromBranch } = options
    const g = this.git(repoPath)
    if (fromBranch) {
      await g.checkoutBranch(branchName, fromBranch)
    } else {
      await g.checkoutLocalBranch(branchName)
    }
    await this.events.dispatch('branch.created', workspaceId, {
      branchName,
      fromBranch: fromBranch ?? '',
    })
  }

  /**
   * Switch to an existing branch.
   */
  async switchBranch(
    repoPath: string,
    workspaceId: string,
    branchName: string,
    previousBranch: string
  ): Promise<void> {
    await this.git(repoPath).checkout(branchName)
    await this.events.dispatch('branch.switched', workspaceId, {
      branchName,
      previousBranch,
    })
  }

  /**
   * Get git status for a repo.
   */
  async status(repoPath: string): Promise<{
    branch: string
    staged: string[]
    modified: string[]
    untracked: string[]
  }> {
    const result = await this.git(repoPath).status()
    return {
      branch: result.current ?? 'unknown',
      staged: result.staged,
      modified: result.modified,
      untracked: result.not_added,
    }
  }

  /**
   * List local branches.
   */
  async listBranches(repoPath: string): Promise<string[]> {
    const result = await this.git(repoPath).branchLocal()
    return result.all
  }

  /**
   * Get git commit log as a structured graph for branch visualization.
   * Returns commits in reverse-chronological order with parent SHAs.
   */
  async log(repoPath: string, options: { maxCount?: number; branch?: string } = {}): Promise<GitCommit[]> {
    const { maxCount = 50, branch } = options
    const g = this.git(repoPath)

    const args: string[] = [
      `--max-count=${maxCount}`,
      '--topo-order',
      '--format=%H%n%h%n%s%n%an%n%ae%n%aI%n%P%n%D%n---COMMIT---',
    ]
    if (branch) args.push(branch)

    const raw = await g.raw(['log', ...args])
    return parseGitLog(raw)
  }

  /**
   * Get the current HEAD commit SHA.
   */
  async headSha(repoPath: string): Promise<string> {
    const result = await this.git(repoPath).revparse(['HEAD'])
    return result.trim()
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseGitLog(raw: string): GitCommit[] {
  const commits: GitCommit[] = []
  const blocks = raw.split('---COMMIT---').map(b => b.trim()).filter(Boolean)

  for (const block of blocks) {
    const lines = block.split('\n')
    const sha = lines[0]?.trim() ?? ''
    const shortSha = lines[1]?.trim() ?? ''
    const message = lines[2]?.trim() ?? ''
    const authorName = lines[3]?.trim() ?? ''
    const authorEmail = lines[4]?.trim() ?? ''
    const authorDate = lines[5]?.trim() ?? ''
    const parents = (lines[6]?.trim() ?? '').split(' ').filter(Boolean)
    const refs = (lines[7]?.trim() ?? '').split(',').map(r => r.trim()).filter(Boolean)

    if (!sha) continue
    commits.push({ sha, shortSha, message, authorName, authorEmail, authorDate, parents, refs })
  }

  return commits
}
