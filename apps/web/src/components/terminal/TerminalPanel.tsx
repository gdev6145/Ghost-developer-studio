'use client'

import React, { useEffect, useRef } from 'react'
import type { FitAddon } from '@xterm/addon-fit'
import type { Terminal as XTermTerminal } from '@xterm/xterm'
import type { CollaborationClient } from '@ghost/collaboration'
import { useTerminalStore } from '@ghost/state'
import { generateId } from '@ghost/shared'
import { getCurrentUserId } from '@/lib/session'

interface TerminalPanelProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
}

/**
 * TerminalPanel — multiplayer xterm.js terminal.
 *
 * Multiple workspace members share the same PTY session:
 *  - Any member can type and send input
 *  - All members see the same output stream in real time
 *
 * Uses xterm.js (@xterm/xterm) with FitAddon for responsive sizing.
 * PTY is managed server-side via node-pty, streamed over Socket.IO.
 */
export function TerminalPanel({ workspaceId, collab }: TerminalPanelProps) {
  const sessions = useTerminalStore(s => s.sessions)
  const activeTerminalId = useTerminalStore(s => s.activeTerminalId)
  const createSession = useTerminalStore(s => s.createSession)
  const appendOutput = useTerminalStore(s => s.appendOutput)
  const closeSession = useTerminalStore(s => s.closeSession)
  const setActiveTerminal = useTerminalStore(s => s.setActiveTerminal)
  const removeSession = useTerminalStore(s => s.removeSession)

  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTermTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Mount xterm when active terminal changes
  useEffect(() => {
    if (!activeTerminalId || !terminalRef.current) return

    let isMounted = true

    void (async () => {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')

      if (!isMounted || !terminalRef.current) return

      // Dispose previous instance
      xtermRef.current?.dispose()

      const xterm = new Terminal({
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          selectionBackground: '#264f78',
        },
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        fontSize: 13,
        lineHeight: 1.3,
        cursorBlink: true,
        scrollback: 5000,
      })

      const fitAddon = new FitAddon()
      xterm.loadAddon(fitAddon)
      xterm.open(terminalRef.current)
      fitAddon.fit()

      xtermRef.current = xterm
      fitAddonRef.current = fitAddon

      // Write buffered output to the terminal
      const session = sessions.get(activeTerminalId)
      if (session?.outputBuffer) {
        xterm.write(session.outputBuffer)
      }

      // Handle user input → send to server via Socket.IO
      xterm.onData(data => {
        collab.current?.socket?.emit('message', {
          type: 'terminal.input',
          workspaceId,
          actorId: getCurrentUserId(),
          timestamp: new Date().toISOString(),
          payload: { terminalId: activeTerminalId, data },
        })
      })

      // Handle resize
      xterm.onResize(({ cols, rows }) => {
        collab.current?.socket?.emit('message', {
          type: 'terminal.resize',
          workspaceId,
          actorId: getCurrentUserId(),
          timestamp: new Date().toISOString(),
          payload: { terminalId: activeTerminalId, cols, rows },
        })
      })
    })()

    return () => {
      isMounted = false
    }
  }, [activeTerminalId])

  // Wire collaboration events to xterm writes
  useEffect(() => {
    const collab_ = collab.current
    if (!collab_) return

    const offOutput = collab_.on('terminal:output', payload => {
      appendOutput(payload.terminalId, payload.data)
      if (payload.terminalId === activeTerminalId && xtermRef.current) {
        xtermRef.current.write(payload.data)
      }
    })

    const offClosed = collab_.on('terminal:closed', payload => {
      closeSession(payload.terminalId, payload.exitCode)
      if (xtermRef.current && payload.terminalId === activeTerminalId) {
        xtermRef.current.writeln(`\r\n[Process exited with code ${payload.exitCode ?? 0}]`)
      }
    })

    return () => {
      offOutput()
      offClosed()
    }
  }, [activeTerminalId, collab.current])

  // Resize fit when panel resizes
  useEffect(() => {
    if (!terminalRef.current) return
    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit()
    })
    observer.observe(terminalRef.current)
    return () => observer.disconnect()
  }, [activeTerminalId])

  function newTerminal() {
    const terminalId = generateId()
    createSession(terminalId, workspaceId)
    collab.current?.socket?.emit('message', {
      type: 'terminal.create',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: new Date().toISOString(),
      payload: { terminalId, cols: 80, rows: 24 },
    })
  }

  function closeTerminal(terminalId: string) {
    collab.current?.socket?.emit('message', {
      type: 'terminal.close',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: new Date().toISOString(),
      payload: { terminalId },
    })
    removeSession(terminalId)
    if (xtermRef.current && terminalId === activeTerminalId) {
      xtermRef.current.dispose()
      xtermRef.current = null
    }
  }

  const sessionList = [...sessions.values()]

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-ghost-text">
      {/* Tab bar */}
      <div className="flex items-center h-9 bg-ghost-surface border-b border-ghost-overlay shrink-0 overflow-x-auto">
        {sessionList.map(session => (
          <button
            key={session.terminalId}
            onClick={() => setActiveTerminal(session.terminalId)}
            className={[
              'flex items-center gap-1.5 px-3 h-full text-xs shrink-0 border-r border-ghost-overlay transition-colors',
              session.terminalId === activeTerminalId
                ? 'bg-[#0d1117] text-ghost-text'
                : 'text-ghost-muted hover:bg-ghost-overlay hover:text-ghost-text',
            ].join(' ')}
          >
            <span>⚡</span>
            <span className="font-mono">{session.terminalId.slice(0, 6)}</span>
            {session.closed && <span className="text-ghost-muted">[closed]</span>}
            <span
              className="ml-1 opacity-50 hover:opacity-100 w-3 h-3 flex items-center justify-center rounded hover:bg-ghost-overlay"
              onClick={e => {
                e.stopPropagation()
                closeTerminal(session.terminalId)
              }}
            >
              ×
            </span>
          </button>
        ))}

        <button
          onClick={newTerminal}
          className="flex items-center gap-1 px-3 h-full text-xs text-ghost-muted hover:text-ghost-text hover:bg-ghost-overlay transition-colors shrink-0"
          title="New Terminal"
        >
          <span>+</span>
        </button>
      </div>

      {/* Terminal canvas */}
      {activeTerminalId ? (
        <div
          ref={terminalRef}
          className="flex-1 overflow-hidden p-1"
          style={{ minHeight: 0 }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-ghost-muted">
          <div className="text-4xl opacity-10">⚡</div>
          <div className="text-sm">No terminal open</div>
          <button
            onClick={newTerminal}
            className="px-3 py-1.5 rounded bg-ghost-blue text-ghost-bg text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            New Terminal
          </button>
        </div>
      )}
    </div>
  )
}
