'use client'

import React, { useEffect, useCallback } from 'react'
import type { CollaborationClient } from '@ghost/collaboration'
import { useDebugStore } from '@ghost/state'
import { usePresenceStore } from '@ghost/state'
import { useEditorStore } from '@ghost/state'
import { generateId } from '@ghost/shared'
import { getCurrentUserId } from '@/lib/session'
import { getCollaboratorColor } from '@ghost/shared'
import type { Breakpoint } from '@ghost/protocol'

interface DebugPanelProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
}

/**
 * DebugPanel — collaborative debugging with shared breakpoints.
 *
 * Features:
 *  - View all breakpoints set by any team member (color-coded by user)
 *  - Click to navigate to a breakpoint's file and line
 *  - Clear your own breakpoints
 *  - See when execution is paused and where
 *  - Broadcast debug state (paused/resumed) to all collaborators
 */
export function DebugPanel({ workspaceId, collab }: DebugPanelProps) {
  const {
    breakpoints,
    isPaused,
    pausedFileId,
    pausedLine,
    pausedReason,
    setBreakpoint,
    clearBreakpoint,
    setPaused,
    setResumed,
  } = useDebugStore()

  const { presenceMap } = usePresenceStore()
  const openTab = useEditorStore(s => s.openTab)
  const userId = getCurrentUserId()

  // ─── Socket event listeners ──────────────────────────────────────────────

  useEffect(() => {
    const socket = collab.current?.socket
    if (!socket) return

    const handleDebugMessage = (msg: Record<string, unknown>) => {
      const type = msg['type'] as string
      const payload = msg['payload'] as Record<string, unknown>

      switch (type) {
        case 'debug.breakpoint_set': {
          setBreakpoint(payload as unknown as Breakpoint)
          break
        }
        case 'debug.breakpoint_cleared': {
          clearBreakpoint(payload['breakpointId'] as string)
          break
        }
        case 'debug.paused': {
          setPaused(
            payload['fileId'] as string,
            payload['line'] as number,
            payload['reason'] as 'breakpoint' | 'step' | 'exception'
          )
          break
        }
        case 'debug.resumed': {
          setResumed()
          break
        }
        default:
          break
      }
    }

    socket.on('debug', handleDebugMessage as (msg: unknown) => void)
    return () => {
      socket.off('debug', handleDebugMessage as (msg: unknown) => void)
    }
  }, [collab, setBreakpoint, clearBreakpoint, setPaused, setResumed])

  // ─── Actions ─────────────────────────────────────────────────────────────

  const sendBreakpointCleared = useCallback(
    (breakpointId: string, fileId: string, line: number) => {
      clearBreakpoint(breakpointId)
      collab.current?.socket?.emit('debug', {
        type: 'debug.breakpoint_cleared',
        workspaceId,
        actorId: userId,
        timestamp: new Date().toISOString(),
        payload: { breakpointId, fileId, line },
      })
    },
    [collab, workspaceId, userId, clearBreakpoint]
  )

  const sendResume = useCallback(() => {
    setResumed()
    collab.current?.socket?.emit('debug', {
      type: 'debug.resumed',
      workspaceId,
      actorId: userId,
      timestamp: new Date().toISOString(),
      payload: {},
    })
  }, [collab, workspaceId, userId, setResumed])

  const navigateToBreakpoint = useCallback(
    (bp: Breakpoint) => {
      openTab({
        fileId: bp.fileId,
        path: bp.filePath,
        name: bp.filePath.split('/').pop() ?? bp.filePath,
        language: '',
        isDirty: false,
      })
    },
    [openTab]
  )

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center px-3 h-9 border-b border-ghost-overlay shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
          Debug
        </span>
        {isPaused && (
          <span className="ml-2 text-ghost-yellow font-semibold animate-pulse">⏸ Paused</span>
        )}
        <span className="ml-auto text-ghost-muted">{breakpoints.length} bp</span>
      </div>

      {/* Paused state banner */}
      {isPaused && pausedFileId && (
        <div className="mx-2 mt-2 px-3 py-2 rounded-lg bg-ghost-yellow/10 border border-ghost-yellow/30 shrink-0">
          <div className="font-semibold text-ghost-yellow mb-1">
            Execution paused · {pausedReason}
          </div>
          <div className="text-ghost-muted">
            Line {pausedLine} — {pausedFileId.slice(0, 20)}…
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={sendResume}
              className="px-2 py-0.5 rounded bg-ghost-green text-ghost-bg font-semibold hover:opacity-90 transition-opacity"
            >
              ▶ Resume
            </button>
          </div>
        </div>
      )}

      {/* Breakpoints list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {breakpoints.length === 0 ? (
          <div className="text-center text-ghost-muted py-6 opacity-60 text-xs">
            No breakpoints set.<br />
            <span className="opacity-70">Click on a line number in the editor</span>
          </div>
        ) : (
          breakpoints.map(bp => {
            const isOwn = bp.userId === userId
            const presenceInfo = presenceMap.get(bp.userId)
            const color = presenceInfo?.color ?? getCollaboratorColor(bp.userId)
            const isPausedHere = isPaused && pausedFileId === bp.fileId && pausedLine === bp.line

            return (
              <div
                key={bp.id}
                className={[
                  'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-ghost-overlay transition-colors group',
                  isPausedHere ? 'bg-ghost-yellow/10 border border-ghost-yellow/30' : '',
                ].join(' ')}
                onClick={() => navigateToBreakpoint(bp)}
              >
                {/* Breakpoint dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />

                {/* File + line */}
                <div className="flex-1 min-w-0">
                  <div className="text-ghost-text truncate">
                    {bp.filePath.split('/').pop()}
                    <span className="text-ghost-muted ml-1">:{bp.line}</span>
                  </div>
                  {bp.condition && (
                    <div className="text-ghost-muted opacity-70 truncate">if {bp.condition}</div>
                  )}
                </div>

                {/* User indicator */}
                <div
                  className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {isOwn ? 'you' : bp.userId.slice(0, 4)}
                </div>

                {/* Clear button (own breakpoints only) */}
                {isOwn && (
                  <button
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-ghost-muted hover:text-ghost-red transition-opacity"
                    onClick={e => {
                      e.stopPropagation()
                      sendBreakpointCleared(bp.id, bp.fileId, bp.line)
                    }}
                    title="Clear breakpoint"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Debug toolbar */}
      <div className="px-2 py-2 border-t border-ghost-overlay shrink-0 flex gap-1.5">
        <DebugToolbarButton
          label="Clear mine"
          onClick={() => {
            breakpoints
              .filter(bp => bp.userId === userId)
              .forEach(bp => sendBreakpointCleared(bp.id, bp.fileId, bp.line))
          }}
          disabled={!breakpoints.some(bp => bp.userId === userId)}
        />
      </div>
    </div>
  )
}

function DebugToolbarButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-1 rounded text-[10px] bg-ghost-overlay text-ghost-muted hover:text-ghost-text disabled:opacity-30 transition-colors"
    >
      {label}
    </button>
  )
}

/**
 * Hook to expose the sendBreakpoint function for use in EditorPane.
 * The EditorPane calls this when user clicks on the glyph margin.
 */
export function useSendBreakpoint(
  workspaceId: string,
  collab: React.MutableRefObject<CollaborationClient | null>
) {
  const { setBreakpoint } = useDebugStore()
  const userId = getCurrentUserId()

  return useCallback(
    (fileId: string, filePath: string, line: number, condition?: string) => {
      const bp: Breakpoint = {
        id: generateId(),
        fileId,
        filePath,
        line,
        column: 0,
        condition,
        userId,
        color: getCollaboratorColor(userId),
        createdAt: new Date().toISOString(),
      }

      setBreakpoint(bp)
      collab.current?.socket?.emit('debug', {
        type: 'debug.breakpoint_set',
        workspaceId,
        actorId: userId,
        timestamp: new Date().toISOString(),
        payload: bp,
      })
    },
    [collab, workspaceId, userId, setBreakpoint]
  )
}
