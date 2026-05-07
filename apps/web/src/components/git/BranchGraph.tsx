'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { getSessionToken } from '@/lib/session'
import type { CommitNode } from '@ghost/protocol'

interface BranchGraphProps {
  workspaceId: string
}

interface BranchGraphData {
  commits: CommitNode[]
  branches: string[]
}

const BRANCH_COLORS = [
  '#89B4FA', // blue
  '#A6E3A1', // green
  '#CBA6F7', // purple
  '#F9E2AF', // yellow
  '#94E2D5', // teal
  '#F38BA8', // red
  '#FAB387', // orange
]

/**
 * BranchGraph — real-time git commit graph visualization.
 *
 * Fetches commit history from the server and renders an SVG graph
 * showing commits, branches, and their relationships.
 *
 * When no commits exist (repo not yet cloned), displays a helpful
 * placeholder with branch information from the database.
 */
export function BranchGraph({ workspaceId }: BranchGraphProps) {
  const [data, setData] = useState<BranchGraphData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCommit, setSelectedCommit] = useState<CommitNode | null>(null)

  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'

  const fetchGraph = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/git/${workspaceId}/log?limit=50`, {
        headers: { Authorization: `Bearer ${getSessionToken()}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as BranchGraphData
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load git graph')
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl, workspaceId])

  useEffect(() => {
    void fetchGraph()
  }, [fetchGraph])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-ghost-muted text-xs animate-pulse">
        Loading commit history…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-ghost-muted text-xs">
        <span className="text-ghost-red">Failed to load graph</span>
        <button onClick={() => void fetchGraph()} className="underline hover:text-ghost-text">
          Retry
        </button>
      </div>
    )
  }

  const commits = data?.commits ?? []
  const branches = data?.branches ?? []

  if (commits.length === 0) {
    return (
      <div className="flex flex-col px-3 py-4 gap-3">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted mb-1">
          Branches
        </div>
        {branches.length === 0 ? (
          <div className="text-ghost-muted text-xs opacity-60 text-center py-4">
            No branches yet. Repository may not be cloned.
          </div>
        ) : (
          <div className="space-y-1">
            {branches.map((b, i) => (
              <div key={b} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: BRANCH_COLORS[i % BRANCH_COLORS.length] }}
                />
                <span className="text-ghost-text">{b}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-ghost-muted text-xs opacity-60">
          Commit history appears after the repository is cloned.
        </p>
        <button
          onClick={() => void fetchGraph()}
          className="text-xs text-ghost-blue underline hover:opacity-80"
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-3 py-1.5 border-b border-ghost-overlay shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
          Commit History
        </span>
        <span className="ml-auto text-ghost-muted text-xs">{commits.length} commits</span>
        <button
          onClick={() => void fetchGraph()}
          className="ml-2 text-ghost-muted hover:text-ghost-text text-xs"
          title="Refresh"
        >
          ↺
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Commit list with graph lanes */}
        <div className="flex-1 overflow-y-auto">
          <CommitList
            commits={commits}
            branches={branches}
            onSelect={setSelectedCommit}
            selected={selectedCommit}
          />
        </div>

        {/* Commit detail panel */}
        {selectedCommit && (
          <div className="w-56 border-l border-ghost-overlay bg-ghost-surface p-3 text-xs overflow-y-auto shrink-0">
            <button
              className="text-ghost-muted hover:text-ghost-text mb-2"
              onClick={() => setSelectedCommit(null)}
            >
              ← Back
            </button>
            <div className="font-mono text-ghost-blue text-[10px] mb-1">
              {selectedCommit.shortSha}
            </div>
            <div className="text-ghost-text mb-2 leading-relaxed">{selectedCommit.message}</div>
            <div className="text-ghost-muted">
              <div>
                <span className="opacity-60">Author: </span>
                {selectedCommit.author}
              </div>
              <div>
                <span className="opacity-60">Date: </span>
                {new Date(selectedCommit.timestamp).toLocaleString()}
              </div>
              {selectedCommit.refs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedCommit.refs.map(r => (
                    <span
                      key={r}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-ghost-blue/20 text-ghost-blue"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Commit List with graph lanes ────────────────────────────────────────────

interface CommitListProps {
  commits: CommitNode[]
  branches: string[]
  onSelect: (c: CommitNode) => void
  selected: CommitNode | null
}

function CommitList({ commits, branches, onSelect, selected }: CommitListProps) {
  // Assign each unique branch ref a lane (column) for graph rendering
  const laneMap = buildLaneMap(commits)
  const maxLane = Math.max(0, ...Object.values(laneMap))

  const LANE_WIDTH = 14
  const DOT_RADIUS = 4
  const ROW_HEIGHT = 32
  const OFFSET_X = 8

  return (
    <div>
      {commits.map((commit, idx) => {
        const lane = laneMap[commit.sha] ?? 0
        const cx = OFFSET_X + lane * LANE_WIDTH
        const cy = ROW_HEIGHT / 2
        const color = BRANCH_COLORS[lane % BRANCH_COLORS.length]
        const isSelected = selected?.sha === commit.sha

        // Compute edges from this commit to its parents
        const edges: JSX.Element[] = []
        commit.parents.forEach(parentSha => {
          const parentLane = laneMap[parentSha] ?? lane
          const parentIdx = commits.findIndex(c => c.sha === parentSha)
          if (parentIdx < 0) return
          const rowDiff = parentIdx - idx
          const px = OFFSET_X + parentLane * LANE_WIDTH
          const pc = BRANCH_COLORS[parentLane % BRANCH_COLORS.length]

          edges.push(
            <line
              key={`${commit.sha}-${parentSha}`}
              x1={cx}
              y1={cy}
              x2={px}
              y2={cy + rowDiff * ROW_HEIGHT}
              stroke={pc}
              strokeWidth={1.5}
              strokeOpacity={0.6}
            />
          )
        })

        const svgWidth = OFFSET_X * 2 + (maxLane + 1) * LANE_WIDTH

        return (
          <button
            key={commit.sha}
            onClick={() => onSelect(commit)}
            className={[
              'flex items-center w-full text-left hover:bg-ghost-overlay transition-colors px-0',
              isSelected ? 'bg-ghost-overlay' : '',
            ].join(' ')}
            style={{ height: ROW_HEIGHT }}
          >
            {/* SVG lane + dot */}
            <svg
              width={svgWidth}
              height={ROW_HEIGHT}
              className="shrink-0"
              overflow="visible"
            >
              {/* Vertical lane line */}
              <line
                x1={cx}
                y1={0}
                x2={cx}
                y2={ROW_HEIGHT}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.4}
              />
              {/* Parent edges */}
              {edges}
              {/* Commit dot */}
              <circle
                cx={cx}
                cy={cy}
                r={DOT_RADIUS}
                fill={color}
                stroke="#1E1E2E"
                strokeWidth={1.5}
              />
            </svg>

            {/* Commit info */}
            <div className="flex-1 px-2 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-ghost-text text-xs truncate">{commit.message}</span>
                {commit.refs.filter(r => !r.startsWith('HEAD')).map(r => (
                  <span
                    key={r}
                    className="shrink-0 text-[9px] px-1 rounded"
                    style={{
                      backgroundColor: `${BRANCH_COLORS[0]}25`,
                      color: BRANCH_COLORS[0],
                    }}
                  >
                    {r.replace('origin/', '')}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-ghost-muted mt-0.5">
                <span className="font-mono">{commit.shortSha}</span>
                <span>{commit.author}</span>
                <span>{formatRelativeTime(commit.timestamp)}</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Assign git graph lanes to commits based on their branch refs.
 * Simple greedy algorithm — each unique branch gets a lane.
 */
function buildLaneMap(commits: CommitNode[]): Record<string, number> {
  const laneMap: Record<string, number> = {}
  const branchLanes: Record<string, number> = {}
  let nextLane = 0

  for (const commit of commits) {
    // Find a branch ref for this commit
    const branchRef = commit.refs.find(r => !r.includes('HEAD'))

    if (branchRef && branchLanes[branchRef] !== undefined) {
      laneMap[commit.sha] = branchLanes[branchRef]!
    } else if (branchRef) {
      const lane = nextLane++
      branchLanes[branchRef] = lane
      laneMap[commit.sha] = lane
    } else {
      // No branch ref — place on lane 0 or follow parent
      const parentSha = commit.parents[0]
      laneMap[commit.sha] = parentSha ? (laneMap[parentSha] ?? 0) : 0
    }
  }

  return laneMap
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
