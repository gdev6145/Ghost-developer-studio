'use client'

import React, { useState } from 'react'
import type { CollaborationClient } from '@ghost/collaboration'
import { useDebugStore } from '@ghost/state'
import { useEditorStore } from '@ghost/state'
import { useWorkspaceStore } from '@ghost/state'
import type { DebugBreakpoint } from '@ghost/protocol'
import { generateId } from '@ghost/shared'
import { getCurrentUserId } from '@/lib/session'

interface DebugPanelProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
}

/**
 * DebugPanel — collaborative debugging with shared breakpoints.
 *
 * All breakpoints are broadcast to the workspace room so every
 * collaborator sees the same set of breakpoints in real time.
 *
 * Integration points:
 *  - Breakpoints are shown in this panel (list view)
 *  - Monaco editor glyph margin decorations are controlled via the
 *    CollaborativeEditorBinding (future: listen to debug store changes)
 */
export function DebugPanel({ workspaceId, collab }: DebugPanelProps) {
  const breakpoints = useDebugStore(s => s.breakpoints)
  const activeSession = useDebugStore(s => s.activeSession)
  const setBreakpoint = useDebugStore(s => s.setBreakpoint)
  const removeBreakpoint = useDebugStore(s => s.removeBreakpoint)
  const toggleBreakpoint = useDebugStore(s => s.toggleBreakpoint)
  const startSession = useDebugStore(s => s.startSession)
  const endSession = useDebugStore(s => s.endSession)

  const activeTabId = useEditorStore(s => s.activeTabId)
  const tabs = useEditorStore(s => s.tabs)
  const activeTab = tabs.find(t => t.fileId === activeTabId)

  const [newLine, setNewLine] = useState('')
  const [newCondition, setNewCondition] = useState('')

  function emitBreakpoint(bp: DebugBreakpoint) {
    collab.current?.socket.emit('message', {
      type: 'debug.breakpoint.set',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: new Date().toISOString(),
      payload: { breakpoint: bp },
    })
    setBreakpoint(bp)
  }

  function handleAddBreakpoint() {
    const line = parseInt(newLine, 10)
    if (!activeTab || isNaN(line) || line < 1) return

    const bp: DebugBreakpoint = {
      id: generateId(),
      fileId: activeTab.fileId,
      filePath: activeTab.path,
      line,
      condition: newCondition || undefined,
      enabled: true,
      authorId: getCurrentUserId(),
    }
    emitBreakpoint(bp)
    setNewLine('')
    setNewCondition('')
  }

  function handleRemove(bp: DebugBreakpoint) {
    collab.current?.socket.emit('message', {
      type: 'debug.breakpoint.remove',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: new Date().toISOString(),
      payload: { breakpointId: bp.id, fileId: bp.fileId },
    })
    removeBreakpoint(bp.id)
  }

  function handleToggle(bp: DebugBreakpoint) {
    const updated = { ...bp, enabled: !bp.enabled }
    emitBreakpoint(updated)
    toggleBreakpoint(bp.id)
  }

  function handleStartSession() {
    const sessionId = generateId()
    collab.current?.socket.emit('message', {
      type: 'debug.session.start',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: new Date().toISOString(),
      payload: { sessionId, fileId: activeTabId ?? undefined, configuration: {} },
    })
    startSession({
      sessionId,
      fileId: activeTabId ?? undefined,
      isActive: true,
      startedAt: new Date().toISOString(),
    })
  }

  function handleEndSession() {
    if (!activeSession) return
    collab.current?.socket.emit('message', {
      type: 'debug.session.end',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: new Date().toISOString(),
      payload: { sessionId: activeSession.sessionId },
    })
    endSession()
  }

  return (
    <div className="flex flex-col h-full bg-ghost-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-ghost-overlay shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
          Debug
        </span>
        {activeSession && (
          <span className="text-[10px] text-ghost-green animate-pulse font-semibold">
            ● SESSION ACTIVE
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Session control */}
        <div className="space-y-1">
          <div className="text-[10px] text-ghost-muted uppercase tracking-widest mb-1">
            Debug Session
          </div>
          {!activeSession ? (
            <button
              onClick={handleStartSession}
              className="w-full py-1.5 bg-ghost-green/20 hover:bg-ghost-green/30 border border-ghost-green/30 text-ghost-green text-xs rounded transition-colors"
            >
              ▶ Start Debug Session
            </button>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-ghost-muted">
                Session: <span className="font-mono text-ghost-text">{activeSession.sessionId.slice(0, 8)}</span>
              </div>
              <button
                onClick={handleEndSession}
                className="w-full py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs rounded transition-colors"
              >
                ■ End Session
              </button>
            </div>
          )}
        </div>

        {/* Add breakpoint */}
        <div className="space-y-1">
          <div className="text-[10px] text-ghost-muted uppercase tracking-widest">
            Add Breakpoint
          </div>
          <div className="text-[10px] text-ghost-muted mb-1">
            File: {activeTab?.name ?? <span className="italic">no file open</span>}
          </div>
          <div className="flex gap-1">
            <input
              type="number"
              placeholder="Line"
              value={newLine}
              onChange={e => setNewLine(e.target.value)}
              min={1}
              className="w-16 bg-ghost-surface border border-ghost-overlay rounded px-2 py-1 text-xs text-ghost-text focus:outline-none focus:border-ghost-blue"
            />
            <input
              type="text"
              placeholder="Condition (optional)"
              value={newCondition}
              onChange={e => setNewCondition(e.target.value)}
              className="flex-1 bg-ghost-surface border border-ghost-overlay rounded px-2 py-1 text-xs text-ghost-text focus:outline-none focus:border-ghost-blue"
            />
            <button
              onClick={handleAddBreakpoint}
              disabled={!activeTab || !newLine}
              className="px-2 py-1 bg-ghost-red/20 hover:bg-ghost-red/30 border border-ghost-red/30 text-ghost-red text-xs rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
        </div>

        {/* Breakpoints list */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-ghost-muted uppercase tracking-widest">
              Breakpoints
            </div>
            <span className="text-[10px] text-ghost-muted">{breakpoints.length}</span>
          </div>

          {breakpoints.length === 0 ? (
            <div className="text-xs text-ghost-muted/60 py-2">
              No breakpoints set. Add one above or click on the editor gutter.
            </div>
          ) : (
            <div className="space-y-0.5">
              {breakpoints.map(bp => (
                <BreakpointRow
                  key={bp.id}
                  bp={bp}
                  onToggle={() => handleToggle(bp)}
                  onRemove={() => handleRemove(bp)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BreakpointRow({
  bp,
  onToggle,
  onRemove,
}: {
  bp: DebugBreakpoint
  onToggle: () => void
  onRemove: () => void
}) {
  const fileName = bp.filePath.split('/').pop() ?? bp.filePath

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-ghost-overlay/30 group text-xs">
      {/* Enable toggle */}
      <button
        onClick={onToggle}
        className="shrink-0"
        title={bp.enabled ? 'Disable breakpoint' : 'Enable breakpoint'}
      >
        <span className={bp.enabled ? 'text-ghost-red' : 'text-ghost-muted'}>◉</span>
      </button>

      {/* File + line */}
      <span className="text-ghost-muted truncate flex-1">
        {fileName}
        <span className="text-ghost-text ml-1">:{bp.line}</span>
        {bp.condition && (
          <span className="text-ghost-yellow ml-1 truncate"> if {bp.condition}</span>
        )}
      </span>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-ghost-muted hover:text-red-400 transition-all shrink-0"
        title="Remove breakpoint"
      >
        ×
      </button>
    </div>
  )
}
