'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { CollaborationClient } from '@ghost/collaboration'
import { useTerminalStore } from '@ghost/state'
import { generateId } from '@ghost/shared'

interface TerminalPaneProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
}

/**
 * TerminalPane — multiplayer PTY terminal over Socket.IO.
 *
 * Each terminal tab maps to a server-side PTY process (node-pty).
 * Output is broadcast to all workspace members so everyone can view
 * what's happening in the shared terminal.
 *
 * Uses xterm.js for rendering; loaded dynamically to avoid SSR issues.
 */
export function TerminalPane({ workspaceId, collab }: TerminalPaneProps) {
  const terminals = useTerminalStore(s => s.terminals)
  const activeTerminalId = useTerminalStore(s => s.activeTerminalId)
  const addTerminal = useTerminalStore(s => s.addTerminal)
  const removeTerminal = useTerminalStore(s => s.removeTerminal)
  const setActiveTerminal = useTerminalStore(s => s.setActiveTerminal)

  function handleNewTerminal() {
    const terminalId = generateId()
    const socket = collab.current?.socket
    if (!socket) return

    socket.emit('terminal', {
      type: 'terminal.create',
      workspaceId,
      actorId: socket.id ?? 'client',
      timestamp: new Date().toISOString(),
      payload: { terminalId, cols: 80, rows: 24 },
    })

    addTerminal({ terminalId, title: `Terminal ${terminals.length + 1}`, isActive: true })
  }

  function handleCloseTerminal(terminalId: string) {
    const socket = collab.current?.socket
    if (socket) {
      socket.emit('terminal', {
        type: 'terminal.close',
        workspaceId,
        actorId: socket.id ?? 'client',
        timestamp: new Date().toISOString(),
        payload: { terminalId },
      })
    }
    removeTerminal(terminalId)
  }

  return (
    <div className="flex flex-col h-full bg-ghost-bg text-ghost-text overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center h-9 bg-ghost-surface border-b border-ghost-overlay shrink-0 overflow-x-auto">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted px-3">
          Terminal
        </span>
        {terminals.map(t => (
          <button
            key={t.terminalId}
            onClick={() => setActiveTerminal(t.terminalId)}
            className={[
              'flex items-center gap-1.5 px-3 h-full text-xs shrink-0 border-r border-ghost-overlay transition-colors',
              t.terminalId === activeTerminalId
                ? 'bg-ghost-bg text-ghost-text'
                : 'text-ghost-muted hover:bg-ghost-overlay hover:text-ghost-text',
            ].join(' ')}
          >
            <span className="text-ghost-green">⊙</span>
            <span>{t.title}</span>
            <span
              className="ml-1 opacity-50 hover:opacity-100 hover:text-red-400"
              onClick={e => {
                e.stopPropagation()
                handleCloseTerminal(t.terminalId)
              }}
            >
              ×
            </span>
          </button>
        ))}
        <button
          onClick={handleNewTerminal}
          className="px-3 h-full text-xs text-ghost-muted hover:text-ghost-text hover:bg-ghost-overlay transition-colors"
          title="New terminal"
        >
          +
        </button>
      </div>

      {/* Terminal area */}
      <div className="flex-1 overflow-hidden">
        {terminals.length === 0 ? (
          <EmptyTerminal onNew={handleNewTerminal} />
        ) : (
          terminals.map(t => (
            <XTermInstance
              key={t.terminalId}
              terminalId={t.terminalId}
              workspaceId={workspaceId}
              collab={collab}
              isActive={t.terminalId === activeTerminalId}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── XTerm Instance ───────────────────────────────────────────────────────────

interface XTermInstanceProps {
  terminalId: string
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
  isActive: boolean
}

function XTermInstance({ terminalId, workspaceId, collab, isActive }: XTermInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null)
  const fitAddonRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let terminal: import('@xterm/xterm').Terminal
    let fitAddon: import('@xterm/addon-fit').FitAddon
    let cleanup: (() => void) | undefined

    async function init() {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')

      terminal = new Terminal({
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          selectionBackground: '#388bfd33',
          black: '#484f58',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#b1bac4',
        },
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        fontSize: 13,
        cursorBlink: true,
        convertEol: true,
      })

      fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(containerRef.current!)
      fitAddon.fit()

      termRef.current = terminal
      fitAddonRef.current = fitAddon

      // Send user input to server
      terminal.onData(data => {
        const socket = collab.current?.socket
        if (!socket) return
        socket.emit('terminal', {
          type: 'terminal.input',
          workspaceId,
          actorId: socket.id ?? 'client',
          timestamp: new Date().toISOString(),
          payload: { terminalId, data },
        })
      })

      // Listen for terminal output from server
      const socket = collab.current?.socket
      if (socket) {
        const onTerminal = (msg: { type: string; payload: { terminalId: string; data: string } }) => {
          if (msg.type === 'terminal.output' && msg.payload.terminalId === terminalId) {
            terminal.write(msg.payload.data)
          }
        }
        socket.on('terminal', onTerminal)
        cleanup = () => socket.off('terminal', onTerminal)
      }

      // Resize observer
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit()
        const socket = collab.current?.socket
        if (socket) {
          socket.emit('terminal', {
            type: 'terminal.resize',
            workspaceId,
            actorId: socket.id ?? 'client',
            timestamp: new Date().toISOString(),
            payload: { terminalId, cols: terminal.cols, rows: terminal.rows },
          })
        }
      })
      if (containerRef.current) resizeObserver.observe(containerRef.current)
    }

    void init()

    return () => {
      cleanup?.()
      termRef.current?.dispose()
    }
  }, [terminalId])

  // Fit when activated
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      fitAddonRef.current.fit()
    }
  }, [isActive])

  return (
    <div
      ref={containerRef}
      className="h-full w-full p-1"
      style={{ display: isActive ? 'block' : 'none' }}
    />
  )
}

function EmptyTerminal({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-ghost-muted">
      <div className="text-4xl opacity-20">⌘</div>
      <div className="text-sm">No active terminals</div>
      <button
        onClick={onNew}
        className="px-4 py-1.5 bg-ghost-green text-ghost-bg text-xs rounded hover:opacity-90 transition-opacity"
      >
        New Terminal
      </button>
    </div>
  )
}
