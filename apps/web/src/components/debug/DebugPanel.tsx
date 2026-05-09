'use client'

import React from 'react'
import type { CollaborationClient } from '@ghost/collaboration'
import { useDebugStore } from '@ghost/state'
import { useEditorStore } from '@ghost/state'
import { generateId } from '@ghost/shared'
import { getCurrentUserId } from '@/lib/session'

interface DebugPanelProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
}

/**
 * DebugPanel — collaborative debugging with shared breakpoints.
 *
 * All workspace members see the same breakpoints in real time.
 * Adding or removing a breakpoint broadcasts the change via Socket.IO
 * and the server rebroadcasts the canonical `debug.state` to everyone.
 *
 * Features:
 *  - View all shared breakpoints across files
 *  - Click a breakpoint to navigate to that file/line
 *  - Remove breakpoints from any file
 */
export function DebugPanel({ workspaceId, collab }: DebugPanelProps) {
  const breakpoints = useDebugStore(s => s.breakpoints)
  const openTab = useEditorStore(s => s.openTab)

  const bpList = [...breakpoints.values()]

  function removeBreakpoint(breakpointId: string) {
    collab.current?.socket?.emit('message', {
      type: 'debug.breakpoint.clear',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: new Date().toISOString(),
      payload: { breakpointId },
    })
  }

  function addBreakpoint(fileId: string, path: string, line: number) {
    const breakpointId = generateId()
    collab.current?.socket?.emit('message', {
      type: 'debug.breakpoint.set',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: new Date().toISOString(),
      payload: { breakpointId, fileId, path, line },
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-ghost-overlay shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
          Debug
        </span>
        <span className="text-xs text-ghost-muted">{bpList.length} breakpoints</span>
      </div>

      {/* Breakpoints section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 pb-1">
          <div className="text-[10px] uppercase tracking-widest text-ghost-muted mb-2">
            Shared Breakpoints
          </div>

          {bpList.length === 0 ? (
            <div className="text-xs text-ghost-muted opacity-60 py-2">
              No breakpoints set.
              <br />
              Right-click a line in the editor to add one.
            </div>
          ) : (
            <div className="space-y-1">
              {bpList.map(bp => (
                <div
                  key={bp.breakpointId}
                  className="flex items-start gap-2 group p-1.5 rounded hover:bg-ghost-overlay transition-colors"
                >
                  {/* Red dot */}
                  <div className="w-3 h-3 rounded-full bg-red-500 shrink-0 mt-0.5" />

                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() =>
                      openTab({
                        fileId: bp.fileId,
                        path: bp.path,
                        name: bp.path.split('/').pop() ?? bp.path,
                        language: 'typescript',
                        isDirty: false,
                      })
                    }
                  >
                    <div className="text-xs text-ghost-text truncate">
                      {bp.path.split('/').pop() ?? bp.path}
                      <span className="text-ghost-muted ml-1">:{bp.line}</span>
                    </div>
                    <div className="text-[10px] text-ghost-muted truncate">{bp.path}</div>
                    {bp.condition && (
                      <div className="text-[10px] text-ghost-purple mt-0.5 truncate">
                        if: {bp.condition}
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => removeBreakpoint(bp.breakpointId)}
                    className="opacity-0 group-hover:opacity-100 text-ghost-muted hover:text-red-400 transition-opacity text-xs shrink-0"
                    title="Remove breakpoint"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add breakpoint helper */}
        <div className="px-3 py-3 border-t border-ghost-overlay mt-2">
          <AddBreakpointForm workspaceId={workspaceId} onAdd={addBreakpoint} />
        </div>
      </div>
    </div>
  )
}

// ─── Add Breakpoint Form ──────────────────────────────────────────────────────

function AddBreakpointForm({
  workspaceId,
  onAdd,
}: {
  workspaceId: string
  onAdd: (fileId: string, path: string, line: number) => void
}) {
  const [path, setPath] = React.useState('')
  const [line, setLine] = React.useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const lineNum = parseInt(line, 10)
    if (!path.trim() || isNaN(lineNum) || lineNum < 1) return
    // Use path as fileId placeholder until linked to a real fileId
    onAdd(generateId(), path.trim(), lineNum)
    setPath('')
    setLine('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-widest text-ghost-muted mb-1.5">
        Add Breakpoint
      </div>
      <input
        type="text"
        placeholder="src/file.ts"
        value={path}
        onChange={e => setPath(e.target.value)}
        className="w-full bg-ghost-overlay text-xs text-ghost-text placeholder-ghost-muted px-2 py-1 rounded outline-none focus:ring-1 focus:ring-ghost-blue"
      />
      <div className="flex gap-1.5">
        <input
          type="number"
          placeholder="Line"
          value={line}
          onChange={e => setLine(e.target.value)}
          min={1}
          className="w-20 bg-ghost-overlay text-xs text-ghost-text placeholder-ghost-muted px-2 py-1 rounded outline-none focus:ring-1 focus:ring-ghost-blue"
        />
        <button
          type="submit"
          className="flex-1 bg-ghost-blue text-ghost-bg text-xs font-semibold px-2 py-1 rounded hover:opacity-90 transition-opacity disabled:opacity-40"
          disabled={!path.trim() || !line}
        >
          Add
        </button>
      </div>
    </form>
  )
}
