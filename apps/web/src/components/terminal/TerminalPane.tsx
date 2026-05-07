'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import type { CollaborationClient } from '@ghost/collaboration'
import { useTerminalStore } from '@ghost/state'
import { generateId } from '@ghost/shared'
import { getCurrentUserId } from '@/lib/session'

interface TerminalPaneProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
}

/**
 * TerminalPane — multiplayer PTY terminal over Socket.IO.
 *
 * Uses xterm.js (loaded dynamically to avoid SSR issues) to render a
 * full terminal emulator. PTY processes run on the server via node-pty.
 *
 * Multiple terminal sessions can be open simultaneously (tabbed).
 * All output is visible only to the session owner — terminals are not
 * shared by default (unlike editors), though the feature can be extended.
 */
export function TerminalPane({ workspaceId, collab }: TerminalPaneProps) {
  const { terminals, activeTerminalId, isOpen, addTerminal, removeTerminal, setActiveTerminal, setOpen } =
    useTerminalStore()

  const termContainerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xtermRef = useRef<Map<string, any>>(new Map())
  const cleanupRef = useRef<(() => void) | null>(null)

  // ─── Create new terminal session ────────────────────────────────────────

  const createTerminal = useCallback(() => {
    const socket = collab.current?.socket
    if (!socket) return
    const terminalId = generateId()
    const cols = 120
    const rows = 30

    socket.emit('terminal', {
      type: 'terminal.create',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: new Date().toISOString(),
      payload: { terminalId, cols, rows },
    })

    addTerminal({
      id: terminalId,
      workspaceId,
      userId: getCurrentUserId(),
      cols,
      rows,
      shell: '/bin/bash',
      createdAt: new Date().toISOString(),
    })
  }, [collab, workspaceId, addTerminal])

  // ─── Attach xterm.js to the active terminal ──────────────────────────────

  useEffect(() => {
    if (!activeTerminalId || !termContainerRef.current || !isOpen) return

    // Clean up previous xterm instance for this terminal if any
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    // Clear container
    termContainerRef.current.innerHTML = ''

    // Dynamic import to avoid SSR issues
    let disposed = false
    void (async () => {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')

      if (disposed || !termContainerRef.current) return

      const term = new Terminal({
        cols: 120,
        rows: 30,
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        fontSize: 13,
        theme: {
          background: '#1E1E2E',
          foreground: '#CDD6F4',
          cursor: '#89B4FA',
          cursorAccent: '#1E1E2E',
          black: '#45475A',
          red: '#F38BA8',
          green: '#A6E3A1',
          yellow: '#F9E2AF',
          blue: '#89B4FA',
          magenta: '#CBA6F7',
          cyan: '#94E2D5',
          white: '#BAC2DE',
          brightBlack: '#585B70',
          brightRed: '#F38BA8',
          brightGreen: '#A6E3A1',
          brightYellow: '#F9E2AF',
          brightBlue: '#89B4FA',
          brightMagenta: '#CBA6F7',
          brightCyan: '#94E2D5',
          brightWhite: '#A6ADC8',
        },
        cursorBlink: true,
        allowTransparency: false,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(termContainerRef.current)
      fitAddon.fit()

      // Store the xterm instance
      xtermRef.current.set(activeTerminalId, { term, fitAddon })

      // User input → send to server PTY
      term.onData((data: string) => {
        const socket = collab.current?.socket
        if (!socket) return
        socket.emit('terminal', {
          type: 'terminal.data',
          workspaceId,
          actorId: getCurrentUserId(),
          timestamp: new Date().toISOString(),
          payload: { terminalId: activeTerminalId, data },
        })
      })

      // Resize → send to server PTY
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        const socket = collab.current?.socket
        if (!socket) return
        socket.emit('terminal', {
          type: 'terminal.resize',
          workspaceId,
          actorId: getCurrentUserId(),
          timestamp: new Date().toISOString(),
          payload: { terminalId: activeTerminalId, cols, rows },
        })
      })

      // Resize observer to auto-fit
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit()
        } catch {
          // Container may be hidden
        }
      })
      if (termContainerRef.current) {
        resizeObserver.observe(termContainerRef.current)
      }

      // Server output → write to xterm
      const handleTerminalMessage = (msg: Record<string, unknown>) => {
        const type = msg['type'] as string
        const payload = msg['payload'] as Record<string, unknown>

        if (payload?.['terminalId'] !== activeTerminalId) return

        if (type === 'terminal.data') {
          const data = Buffer.from(payload['data'] as string, 'base64').toString('utf-8')
          term.write(data)
        } else if (type === 'terminal.exit') {
          term.write('\r\n\x1b[33m[Process exited]\x1b[0m\r\n')
          removeTerminal(activeTerminalId)
        }
      }

      const socket = collab.current?.socket
      socket?.on('terminal', handleTerminalMessage as (msg: unknown) => void)

      cleanupRef.current = () => {
        disposed = true
        resizeObserver.disconnect()
        collab.current?.socket?.off('terminal', handleTerminalMessage as (msg: unknown) => void)
        term.dispose()
        xtermRef.current.delete(activeTerminalId)
      }
    })()

    return () => {
      disposed = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTerminalId, isOpen])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  if (!isOpen) {
    return (
      <div className="flex items-center justify-center h-32 text-ghost-muted text-xs gap-2">
        <span>No terminal open.</span>
        <button
          onClick={createTerminal}
          className="px-2 py-1 rounded bg-ghost-overlay hover:bg-ghost-blue hover:text-ghost-bg transition-colors"
        >
          + New Terminal
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center h-8 bg-ghost-surface border-b border-ghost-overlay shrink-0 overflow-x-auto">
        {terminals.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTerminal(t.id)}
            className={[
              'flex items-center gap-1.5 px-3 h-full text-xs shrink-0 border-r border-ghost-overlay transition-colors',
              t.id === activeTerminalId
                ? 'bg-ghost-bg text-ghost-text'
                : 'text-ghost-muted hover:bg-ghost-overlay hover:text-ghost-text',
            ].join(' ')}
          >
            <span className="font-mono">$</span>
            <span>{t.id.slice(0, 6)}</span>
            <span
              className="ml-1 opacity-50 hover:opacity-100"
              onClick={e => {
                e.stopPropagation()
                const socket = collab.current?.socket
                if (socket) {
                  socket.emit('terminal', {
                    type: 'terminal.close',
                    workspaceId,
                    actorId: getCurrentUserId(),
                    timestamp: new Date().toISOString(),
                    payload: { terminalId: t.id },
                  })
                }
                removeTerminal(t.id)
              }}
            >
              ×
            </span>
          </button>
        ))}
        <button
          onClick={createTerminal}
          className="px-3 h-full text-ghost-muted hover:text-ghost-text text-xs shrink-0 hover:bg-ghost-overlay transition-colors"
          title="New terminal"
        >
          +
        </button>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto px-3 h-full text-ghost-muted hover:text-ghost-text text-xs transition-colors"
          title="Close terminal panel"
        >
          ✕
        </button>
      </div>

      {/* xterm.js container */}
      <div
        ref={termContainerRef}
        className="flex-1 overflow-hidden p-1"
        style={{ background: '#1E1E2E' }}
      />
    </div>
  )
}

/**
 * Toggle button shown in the bottom status bar / toolbar.
 */
export function TerminalToggleButton({ workspaceId, collab }: TerminalPaneProps) {
  const { isOpen, setOpen, terminals, addTerminal } = useTerminalStore()

  function openOrCreate() {
    if (isOpen) {
      setOpen(false)
    } else {
      setOpen(true)
      if (terminals.length === 0) {
        const socket = collab.current?.socket
        if (socket) {
          const terminalId = generateId()
          socket.emit('terminal', {
            type: 'terminal.create',
            workspaceId,
            actorId: getCurrentUserId(),
            timestamp: new Date().toISOString(),
            payload: { terminalId, cols: 120, rows: 30 },
          })
          addTerminal({
            id: terminalId,
            workspaceId,
            userId: getCurrentUserId(),
            cols: 120,
            rows: 30,
            shell: '/bin/bash',
            createdAt: new Date().toISOString(),
          })
        }
      }
    }
  }

  return (
    <button
      onClick={openOrCreate}
      className={[
        'flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors',
        isOpen
          ? 'bg-ghost-blue text-ghost-bg'
          : 'text-ghost-muted hover:text-ghost-text hover:bg-ghost-overlay',
      ].join(' ')}
      title={isOpen ? 'Hide terminal' : 'Open terminal'}
    >
      <span className="font-mono text-[10px]">⌘</span>
      <span>Terminal</span>
    </button>
  )
}
