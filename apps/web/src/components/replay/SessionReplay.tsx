'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getSessionToken } from '@/lib/session'
import type { ReplayEvent } from '@ghost/protocol'

interface SessionReplayProps {
  workspaceId: string
}

interface ReplayData {
  events: ReplayEvent[]
  pagination: {
    total: number
    totalPages: number
    page: number
    pageSize: number
  }
}

type PlaybackSpeed = 0.5 | 1 | 2 | 4

const EVENT_TYPE_COLORS: Record<string, string> = {
  'file.created': '#A6E3A1',
  'file.deleted': '#F38BA8',
  'file.updated': '#89B4FA',
  'chat.sent': '#CBA6F7',
  'user.joined': '#A6E3A1',
  'user.left': '#F38BA8',
  'branch.created': '#FAB387',
  'branch.switched': '#F9E2AF',
  'runtime.started': '#94E2D5',
  'runtime.stopped': '#6C7086',
}

/**
 * SessionReplay — replay workspace event history as a timeline.
 *
 * Features:
 *  - Fetches all events from the replay API
 *  - Timeline scrubber to jump to any point in time
 *  - Play/pause/speed controls
 *  - Event feed shows what happened at each step
 *  - Color-coded event types
 */
export function SessionReplay({ workspaceId }: SessionReplayProps) {
  const [data, setData] = useState<ReplayData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'

  // ─── Fetch events ────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/replay/${workspaceId}?pageSize=500`, {
        headers: { Authorization: `Bearer ${getSessionToken()}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as ReplayData
      setData(json)
      setCurrentIndex(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setIsLoading(false)
    }
  }, [apiUrl, workspaceId])

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  // ─── Playback ────────────────────────────────────────────────────────────

  const events = data?.events ?? []
  const total = events.length

  const play = useCallback(() => {
    if (currentIndex >= total - 1) {
      setCurrentIndex(0)
    }
    setIsPlaying(true)
  }, [currentIndex, total])

  const pause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
        playIntervalRef.current = null
      }
      return
    }

    const intervalMs = 800 / speed

    playIntervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= total - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, intervalMs)

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
        playIntervalRef.current = null
      }
    }
  }, [isPlaying, speed, total])

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-ghost-muted text-xs animate-pulse">
        Loading session history…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-ghost-muted text-xs">
        <span className="text-ghost-red">Failed to load replay</span>
        <button onClick={() => void fetchEvents()} className="underline hover:text-ghost-text">
          Retry
        </button>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-ghost-muted text-xs">
        <span className="text-2xl opacity-20">📼</span>
        <span>No events recorded yet.</span>
        <span className="opacity-60">Activity in this workspace will appear here.</span>
      </div>
    )
  }

  const visibleEvents = events.slice(0, currentIndex + 1)
  const currentEvent = events[currentIndex]

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center px-3 h-9 border-b border-ghost-overlay shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
          Session Replay
        </span>
        <span className="ml-auto text-ghost-muted">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {/* Timeline scrubber */}
      <div className="px-3 py-2 border-b border-ghost-overlay shrink-0">
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={currentIndex}
          onChange={e => {
            setCurrentIndex(parseInt(e.target.value, 10))
            setIsPlaying(false)
          }}
          className="w-full accent-ghost-blue"
        />
        <div className="flex items-center gap-2 mt-1.5">
          {/* Play/Pause */}
          {isPlaying ? (
            <button
              onClick={pause}
              className="px-2 py-0.5 rounded bg-ghost-yellow text-ghost-bg font-semibold text-[10px] hover:opacity-90"
            >
              ⏸
            </button>
          ) : (
            <button
              onClick={play}
              className="px-2 py-0.5 rounded bg-ghost-green text-ghost-bg font-semibold text-[10px] hover:opacity-90"
            >
              ▶
            </button>
          )}

          {/* Reset */}
          <button
            onClick={() => { setCurrentIndex(0); setIsPlaying(false) }}
            className="px-2 py-0.5 rounded bg-ghost-overlay text-ghost-muted hover:text-ghost-text text-[10px]"
          >
            ↩
          </button>

          {/* Speed selector */}
          <span className="text-ghost-muted ml-1">Speed:</span>
          {([0.5, 1, 2, 4] as PlaybackSpeed[]).map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={[
                'px-1.5 py-0.5 rounded text-[10px] transition-colors',
                speed === s
                  ? 'bg-ghost-blue text-ghost-bg'
                  : 'text-ghost-muted hover:text-ghost-text',
              ].join(' ')}
            >
              {s}×
            </button>
          ))}

          {/* Current time */}
          {currentEvent && (
            <span className="ml-auto text-ghost-muted font-mono">
              {new Date(currentEvent.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Event feed */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {[...visibleEvents].reverse().map((event, i) => {
          const color = EVENT_TYPE_COLORS[event.type] ?? '#6C7086'
          const isLatest = i === 0

          return (
            <div
              key={event.id}
              className={[
                'flex items-start gap-2 px-2 py-1.5 rounded-lg transition-all',
                isLatest ? 'bg-ghost-overlay ring-1 ring-ghost-overlay' : 'opacity-70',
              ].join(' ')}
            >
              {/* Event type badge */}
              <span
                className="shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono mt-0.5"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {event.type}
              </span>

              {/* Payload summary */}
              <div className="flex-1 min-w-0">
                <div className="text-ghost-text truncate">
                  {summarizePayload(event)}
                </div>
                <div className="text-ghost-muted text-[10px] mt-0.5">
                  {event.actorId ? `by ${event.actorId.slice(0, 8)} · ` : ''}
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function summarizePayload(event: ReplayEvent): string {
  const p = event.payload
  switch (event.type) {
    case 'file.created':
      return `Created ${String(p['path'] ?? p['fileId'] ?? '')}`
    case 'file.deleted':
      return `Deleted ${String(p['path'] ?? p['fileId'] ?? '')}`
    case 'file.updated':
      return `Updated ${String(p['path'] ?? p['fileId'] ?? '')}`
    case 'file.renamed':
      return `Renamed ${String(p['oldPath'] ?? '')} → ${String(p['newPath'] ?? '')}`
    case 'chat.sent':
      return `Message: "${String(p['content'] ?? '').slice(0, 50)}"`
    case 'user.joined':
      return `${String(p['displayName'] ?? p['userId'] ?? '')} joined`
    case 'user.left':
      return `${String(p['userId'] ?? '')} left`
    case 'branch.created':
      return `Branch created: ${String(p['branchName'] ?? '')}`
    case 'branch.switched':
      return `Switched to ${String(p['branchName'] ?? '')}`
    case 'runtime.started':
      return `Runtime started (${String(p['image'] ?? 'unknown')})`
    case 'runtime.stopped':
      return 'Runtime stopped'
    default:
      return JSON.stringify(p).slice(0, 80)
  }
}
