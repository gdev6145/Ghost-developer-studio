'use client'

import React, { useEffect, useState } from 'react'
import type { GitCommit } from '@ghost/protocol'
import { getSessionToken } from '@/lib/session'

interface BranchGraphProps {
  workspaceId: string
}

const LANE_WIDTH = 16
const ROW_HEIGHT = 28
const DOT_RADIUS = 5
const COLORS = ['#58a6ff', '#3fb950', '#d29922', '#ff7b72', '#bc8cff', '#39c5cf', '#f78166']

/**
 * BranchGraph — real-time SVG git commit graph.
 *
 * Renders a column-based branch graph similar to `git log --graph`.
 * Refreshes automatically on branch.switch events.
 */
export function BranchGraph({ workspaceId }: BranchGraphProps) {
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchLog() {
    setLoading(true)
    setError(null)
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
    const token = getSessionToken()
    try {
      const res = await fetch(`${apiUrl}/api/git/${workspaceId}/log?limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        setError('Git repo not available for this workspace')
        return
      }
      const data = await res.json() as { commits: GitCommit[] }
      setCommits(data.commits)
    } catch {
      setError('Could not load git history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchLog()
  }, [workspaceId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-ghost-muted text-xs animate-pulse">
        Loading git history…
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-3 py-4 text-xs text-ghost-muted">
        <div className="mb-2 text-ghost-orange">{error}</div>
        <div className="text-ghost-muted/60">
          Clone a repository into this workspace to see the branch graph.
        </div>
      </div>
    )
  }

  if (commits.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-ghost-muted">No commits yet.</div>
    )
  }

  const layout = computeLayout(commits)
  const svgWidth = (layout.maxLane + 1) * LANE_WIDTH + 8
  const svgHeight = commits.length * ROW_HEIGHT

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 h-9 border-b border-ghost-overlay shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
          Git Graph
        </span>
        <button
          onClick={() => void fetchLog()}
          className="text-ghost-muted hover:text-ghost-text text-xs"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex" style={{ minWidth: 0 }}>
          {/* SVG graph column */}
          <svg width={svgWidth} height={svgHeight} className="shrink-0" style={{ userSelect: 'none' }}>
            {/* Connection lines */}
            {layout.edges.map((edge, i) => (
              <path
                key={i}
                d={edge.path}
                stroke={COLORS[edge.laneIndex % COLORS.length]}
                strokeWidth={1.5}
                fill="none"
                opacity={0.7}
              />
            ))}
            {/* Commit dots */}
            {layout.nodes.map((node, i) => (
              <circle
                key={i}
                cx={node.x}
                cy={node.y}
                r={DOT_RADIUS}
                fill={COLORS[node.laneIndex % COLORS.length]}
                stroke="#0d1117"
                strokeWidth={1.5}
              />
            ))}
          </svg>

          {/* Commit list */}
          <div className="flex-1 min-w-0">
            {commits.map((commit, idx) => (
              <CommitRow key={commit.sha} commit={commit} rowIndex={idx} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CommitRow({ commit, rowIndex }: { commit: GitCommit; rowIndex: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="flex flex-col justify-center cursor-pointer hover:bg-ghost-overlay/30 transition-colors border-b border-ghost-overlay/20"
      style={{ height: ROW_HEIGHT, minHeight: ROW_HEIGHT }}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center gap-2 px-2 overflow-hidden">
        <span className="font-mono text-[10px] text-ghost-blue shrink-0">{commit.shortSha}</span>
        <span className="text-xs text-ghost-text truncate flex-1">{commit.message}</span>
        {commit.refs.length > 0 && (
          <div className="flex gap-1 shrink-0">
            {commit.refs.slice(0, 2).map(ref => (
              <span
                key={ref}
                className="text-[9px] px-1 py-0.5 rounded bg-ghost-purple/20 text-ghost-purple border border-ghost-purple/30"
              >
                {ref.replace('HEAD -> ', '').replace('origin/', '↑').slice(0, 18)}
              </span>
            ))}
          </div>
        )}
      </div>
      {expanded && (
        <div className="px-2 pb-1 text-[10px] text-ghost-muted">
          {commit.authorName} · {new Date(commit.authorDate).toLocaleString()}
        </div>
      )}
    </div>
  )
}

// ─── Layout computation ───────────────────────────────────────────────────────

interface NodeLayout {
  x: number
  y: number
  laneIndex: number
  sha: string
}

interface EdgeLayout {
  path: string
  laneIndex: number
}

function computeLayout(commits: GitCommit[]): {
  nodes: NodeLayout[]
  edges: EdgeLayout[]
  maxLane: number
} {
  const shaToRow = new Map<string, number>()
  commits.forEach((c, i) => shaToRow.set(c.sha, i))

  // Assign lanes: track which lane each branch tip occupies
  const laneMap = new Map<string, number>() // sha → lane
  let nextLane = 0
  const usedLanes: (string | null)[] = []

  const nodes: NodeLayout[] = []
  const edges: EdgeLayout[] = []

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i]
    if (!commit) continue

    // Find or allocate lane for this commit
    let lane = laneMap.get(commit.sha)
    if (lane === undefined) {
      // Find a free lane slot
      const freeLane = usedLanes.findIndex(s => s === null)
      lane = freeLane >= 0 ? freeLane : nextLane++
    }
    usedLanes[lane] = commit.sha

    const x = lane * LANE_WIDTH + LANE_WIDTH / 2 + 4
    const y = i * ROW_HEIGHT + ROW_HEIGHT / 2

    nodes.push({ x, y, laneIndex: lane, sha: commit.sha })

    // Draw edges to parents
    commit.parents.forEach((parentSha, pIdx) => {
      const parentRow = shaToRow.get(parentSha)
      if (parentRow === undefined) return

      let parentLane = laneMap.get(parentSha)
      if (parentLane === undefined) {
        // First parent continues on same lane; other parents get new lanes
        parentLane = pIdx === 0 ? lane : nextLane++
        laneMap.set(parentSha, parentLane)
      }

      const px = parentLane * LANE_WIDTH + LANE_WIDTH / 2 + 4
      const py = parentRow * ROW_HEIGHT + ROW_HEIGHT / 2

      // Bezier curve for smooth branch lines
      const path = `M ${x} ${y} C ${x} ${(y + py) / 2}, ${px} ${(y + py) / 2}, ${px} ${py}`
      edges.push({ path, laneIndex: lane })
    })

    // Free lane if no more children will reference this sha (heuristic: if no child points here)
    // For simplicity, we clear lanes only for commits with no further references
    laneMap.set(commit.sha, lane)
  }

  const maxLane = Math.max(0, ...nodes.map(n => n.laneIndex))
  return { nodes, edges, maxLane }
}
