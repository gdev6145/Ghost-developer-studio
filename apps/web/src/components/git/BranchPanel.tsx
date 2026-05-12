'use client'

import React, { useEffect, useState } from 'react'
import type { CollaborationClient } from '@ghost/collaboration'
import { useGitStore } from '@ghost/state'
import { getSessionToken } from '@/lib/session'

interface BranchPanelProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
  repoPath?: string
}

/**
 * BranchPanel — real-time git branch visualization.
 *
 * Shows:
 *  - Current branch with status (staged/modified/untracked counts)
 *  - Full list of local branches (switch by clicking)
 *  - Recent commit history graph (simplified ASCII-style)
 *  - New branch creation
 *
 * Data is fetched from the server-side git REST API.
 */
export function BranchPanel({ workspaceId, repoPath }: BranchPanelProps) {
  const { branches, currentBranch, commits, status, setBranches, setCommits, setStatus } =
    useGitStore()

  const [view, setView] = useState<'branches' | 'log'>('branches')
  const [newBranchName, setNewBranchName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
  const token = getSessionToken()
  const headers = { Authorization: `Bearer ${token}` }

  async function loadData() {
    if (!repoPath) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ repoPath })
      const [branchesRes, statusRes, logRes] = await Promise.all([
        fetch(`${apiUrl}/api/git/${workspaceId}/branches?${params}`, { headers }),
        fetch(`${apiUrl}/api/git/${workspaceId}/status?${params}`, { headers }),
        fetch(`${apiUrl}/api/git/${workspaceId}/log?${params}&limit=30`, { headers }),
      ])

      if (branchesRes.ok) {
        const data = await branchesRes.json() as { branches: string[] }
        const statusData = statusRes.ok ? await statusRes.json() as { branch: string } : null
        setBranches(data.branches, statusData?.branch ?? 'main')
      }
      if (statusRes.ok) {
        const data = await statusRes.json() as {
          branch: string
          staged: string[]
          modified: string[]
          untracked: string[]
        }
        setStatus(data)
      }
      if (logRes.ok) {
        const data = await logRes.json() as { commits: Array<{
          hash: string
          date: string
          message: string
          author_name: string
          author_email?: string
          refs: string
        }> }
        setCommits(data.commits)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [workspaceId, repoPath])

  async function switchBranch(branch: string) {
    if (!repoPath || branch === currentBranch) return
    try {
      const res = await fetch(`${apiUrl}/api/git/${workspaceId}/branch`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath, branchName: branch }),
      })
      if (res.ok) {
        void loadData()
      }
    } catch {
      // non-fatal
    }
  }

  async function createBranch() {
    if (!repoPath || !newBranchName.trim()) return
    try {
      const res = await fetch(`${apiUrl}/api/git/${workspaceId}/branch`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath, branchName: newBranchName.trim(), fromBranch: currentBranch }),
      })
      if (res.ok) {
        setNewBranchName('')
        void loadData()
      }
    } catch {
      // non-fatal
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-ghost-overlay shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-ghost-green text-xs">⎇</span>
          <span className="text-xs font-semibold text-ghost-text truncate max-w-[120px]">
            {currentBranch}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('branches')}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${view === 'branches' ? 'bg-ghost-blue text-ghost-bg' : 'text-ghost-muted hover:text-ghost-text'}`}
          >
            Branches
          </button>
          <button
            onClick={() => setView('log')}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${view === 'log' ? 'bg-ghost-blue text-ghost-bg' : 'text-ghost-muted hover:text-ghost-text'}`}
          >
            Log
          </button>
          <button
            onClick={() => void loadData()}
            className="text-[10px] text-ghost-muted hover:text-ghost-text transition-colors ml-1"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Status bar */}
      {status && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-ghost-overlay text-[10px] text-ghost-muted">
          {status.staged.length > 0 && (
            <span className="text-green-400">+{status.staged.length} staged</span>
          )}
          {status.modified.length > 0 && (
            <span className="text-yellow-400">~{status.modified.length} modified</span>
          )}
          {status.untracked.length > 0 && (
            <span className="text-ghost-muted">?{status.untracked.length} untracked</span>
          )}
          {status.staged.length === 0 && status.modified.length === 0 && status.untracked.length === 0 && (
            <span className="text-green-400">✓ Clean</span>
          )}
        </div>
      )}

      {loading && (
        <div className="px-3 py-2 text-xs text-ghost-muted animate-pulse">Loading...</div>
      )}
      {error && !repoPath && (
        <div className="px-3 py-2 text-xs text-ghost-muted opacity-60">
          Connect a repository to use git features.
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {view === 'branches' ? (
          <BranchList
            branches={branches}
            currentBranch={currentBranch}
            onSwitch={switchBranch}
            newBranchName={newBranchName}
            onNewBranchChange={setNewBranchName}
            onCreateBranch={createBranch}
          />
        ) : (
          <CommitLog commits={commits} />
        )}
      </div>
    </div>
  )
}

// ─── Branch List ──────────────────────────────────────────────────────────────

function BranchList({
  branches,
  currentBranch,
  onSwitch,
  newBranchName,
  onNewBranchChange,
  onCreateBranch,
}: {
  branches: string[]
  currentBranch: string
  onSwitch: (branch: string) => void
  newBranchName: string
  onNewBranchChange: (v: string) => void
  onCreateBranch: () => void
}) {
  return (
    <div className="py-1">
      {branches.map(branch => (
        <button
          key={branch}
          onClick={() => onSwitch(branch)}
          className={[
            'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-ghost-overlay',
            branch === currentBranch ? 'text-ghost-text' : 'text-ghost-muted',
          ].join(' ')}
        >
          <span className={`text-[10px] ${branch === currentBranch ? 'text-green-400' : 'opacity-0'}`}>
            ●
          </span>
          <span className="truncate">{branch}</span>
          {branch === currentBranch && (
            <span className="ml-auto text-[9px] text-ghost-muted">current</span>
          )}
        </button>
      ))}

      {branches.length === 0 && (
        <div className="px-3 py-3 text-xs text-ghost-muted opacity-60">No branches found</div>
      )}

      {/* New branch */}
      <div className="px-3 py-2 border-t border-ghost-overlay mt-1">
        <div className="text-[10px] uppercase tracking-widest text-ghost-muted mb-1.5">
          New Branch
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="feature/my-branch"
            value={newBranchName}
            onChange={e => onNewBranchChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onCreateBranch()}
            className="flex-1 bg-ghost-overlay text-xs text-ghost-text placeholder-ghost-muted px-2 py-1 rounded outline-none focus:ring-1 focus:ring-ghost-blue"
          />
          <button
            onClick={onCreateBranch}
            disabled={!newBranchName.trim()}
            className="px-2 py-1 bg-ghost-blue text-ghost-bg text-xs font-semibold rounded disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Commit Log ───────────────────────────────────────────────────────────────

function CommitLog({ commits }: { commits: Array<{
  hash: string
  date: string
  message: string
  author_name: string
  refs: string
}> }) {
  if (commits.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-ghost-muted opacity-60">No commits found</div>
    )
  }

  return (
    <div className="py-1">
      {commits.map((commit, i) => (
        <div key={commit.hash} className="flex gap-2 px-3 py-2 hover:bg-ghost-overlay group">
          {/* Graph line */}
          <div className="flex flex-col items-center shrink-0 w-4">
            <div className="w-2 h-2 rounded-full bg-ghost-blue shrink-0" />
            {i < commits.length - 1 && (
              <div className="w-px flex-1 bg-ghost-overlay mt-0.5" />
            )}
          </div>

          <div className="flex-1 min-w-0 pb-2">
            <div className="text-xs text-ghost-text truncate">{commit.message}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-ghost-muted">
                {commit.hash.slice(0, 7)}
              </span>
              <span className="text-[10px] text-ghost-muted truncate">{commit.author_name}</span>
              {commit.refs && (
                <span className="text-[10px] text-ghost-green truncate">{commit.refs}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
