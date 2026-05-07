'use client'

import React, { useState } from 'react'
import type { CollaborationClient } from '@ghost/collaboration'
import { useReplayStore } from '@ghost/state'
import { getSessionToken } from '@/lib/session'

interface ReplayPanelProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
}

/**
 * ReplayPanel — session replay controls.
 *
 * Allows users to select a time window and replay all persisted workspace
 * events at configurable speed. Events are fed back through the same
 * websocket channel as live events, so the UI updates exactly as it did
 * during the original session.
 */
export function ReplayPanel({ workspaceId, collab }: ReplayPanelProps) {
  const status = useReplayStore(s => s.status)
  const events = useReplayStore(s => s.events)
  const totalEvents = useReplayStore(s => s.totalEvents)
  const currentIndex = useReplayStore(s => s.currentIndex)
  const speed = useReplayStore(s => s.speed)
  const replayId = useReplayStore(s => s.replayId)
  const setSpeed = useReplayStore(s => s.setSpeed)
  const reset = useReplayStore(s => s.reset)

  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() - 1)
    return d.toISOString().slice(0, 16)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 16))
  const [error, setError] = useState<string | null>(null)

  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'

  async function handleStart() {
    setError(null)
    const token = getSessionToken()

    try {
      const res = await fetch(`${apiUrl}/api/events/${workspaceId}/replay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ from: new Date(from).toISOString(), to: new Date(to).toISOString(), speed }),
      })

      if (!res.ok) {
        const err = await res.json() as { message?: string }
        setError(err.message ?? 'Failed to start replay')
        return
      }
    } catch {
      setError('Could not connect to server')
    }
  }

  function handleStop() {
    reset()
  }

  const isRunning = status === 'playing' || status === 'paused'
  const progress = totalEvents > 0 ? Math.round((currentIndex / totalEvents) * 100) : 0

  return (
    <div className="flex flex-col h-full bg-ghost-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-ghost-overlay shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
          Session Replay
        </span>
        {isRunning && (
          <span className="text-[10px] text-ghost-orange animate-pulse font-semibold">
            ● REPLAYING
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Time range */}
        <div className="space-y-2">
          <label className="block text-[10px] text-ghost-muted uppercase tracking-widest">
            From
          </label>
          <input
            type="datetime-local"
            value={from}
            onChange={e => setFrom(e.target.value)}
            disabled={isRunning}
            className="w-full bg-ghost-surface border border-ghost-overlay rounded px-2 py-1 text-xs text-ghost-text focus:outline-none focus:border-ghost-blue disabled:opacity-50"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] text-ghost-muted uppercase tracking-widest">
            To
          </label>
          <input
            type="datetime-local"
            value={to}
            onChange={e => setTo(e.target.value)}
            disabled={isRunning}
            className="w-full bg-ghost-surface border border-ghost-overlay rounded px-2 py-1 text-xs text-ghost-text focus:outline-none focus:border-ghost-blue disabled:opacity-50"
          />
        </div>

        {/* Speed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-ghost-muted uppercase tracking-widest">
              Playback Speed
            </label>
            <span className="text-xs text-ghost-blue font-mono">{speed}×</span>
          </div>
          <input
            type="range"
            min={0.25}
            max={10}
            step={0.25}
            value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            disabled={isRunning}
            className="w-full accent-ghost-blue disabled:opacity-50"
          />
          <div className="flex justify-between text-[10px] text-ghost-muted">
            <span>0.25×</span>
            <span>10×</span>
          </div>
        </div>

        {/* Progress */}
        {isRunning && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-ghost-muted">
              <span>Progress</span>
              <span>{currentIndex} / {totalEvents} events ({progress}%)</span>
            </div>
            <div className="w-full h-1.5 bg-ghost-overlay rounded-full overflow-hidden">
              <div
                className="h-full bg-ghost-blue transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Status = finished */}
        {status === 'finished' && (
          <div className="text-xs text-ghost-green">
            ✓ Replay complete — {totalEvents} events replayed
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
            {error}
          </div>
        )}

        {/* Controls */}
        {!isRunning ? (
          <button
            onClick={() => void handleStart()}
            className="w-full py-2 bg-ghost-blue/20 hover:bg-ghost-blue/30 border border-ghost-blue/30 text-ghost-blue text-xs rounded transition-colors"
          >
            ▶ Start Replay
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs rounded transition-colors"
          >
            ■ Stop Replay
          </button>
        )}

        {/* Recent replay events */}
        {events.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] text-ghost-muted uppercase tracking-widest">
              Recent Events
            </div>
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {events.slice(-20).reverse().map(ev => (
                <div key={ev.eventId} className="flex items-center gap-2 text-[10px]">
                  <span className="text-ghost-muted font-mono w-16 shrink-0 truncate">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-ghost-blue">{ev.eventType}</span>
                  {ev.actorId && (
                    <span className="text-ghost-muted truncate">{ev.actorId.slice(0, 8)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
