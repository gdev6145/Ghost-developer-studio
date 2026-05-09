'use client'

import { useEffect, useState, useCallback } from 'react'

interface AuditEvent {
  id: string
  type: string
  actorId: string | null
  payload: unknown
  timestamp: string
}

interface AuditPanelProps {
  workspaceId: string
  apiUrl: string
  token: string
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  'user.joined': 'text-green-400',
  'user.left': 'text-zinc-400',
  'chat.sent': 'text-sky-400',
  'file.updated': 'text-amber-400',
  'runtime.started': 'text-violet-400',
  'runtime.stopped': 'text-orange-400',
}

/**
 * AuditPanel — workspace event timeline with filter controls.
 *
 * Shows paginated audit events for a workspace. Supports filtering by
 * event type, actor, and date range. Allows admin/owner export.
 */
export function AuditPanel({ workspaceId, apiUrl, token }: AuditPanelProps) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const fetchEvents = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ limit: '50' })
        if (typeFilter) params.set('type', typeFilter)
        if (cursor) params.set('cursor', cursor)

        const res = await fetch(`${apiUrl}/api/audit/${workspaceId}?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(await res.text())
        const data = (await res.json()) as {
          events: AuditEvent[]
          nextCursor: string | null
        }
        setEvents(prev => (cursor ? [...prev, ...data.events] : data.events))
        setNextCursor(data.nextCursor)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [workspaceId, apiUrl, token, typeFilter]
  )

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`${apiUrl}/api/audit/${workspaceId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed — admin role required')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-${workspaceId}.ndjson`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-zinc-950 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Audit Log</h2>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export NDJSON'}
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Filter by event type (e.g. chat.sent)"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void fetchEvents()}
          className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="button"
          onClick={() => void fetchEvents()}
          className="rounded bg-violet-700 px-2 py-1 text-xs text-white hover:bg-violet-600"
        >
          Search
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded bg-red-900/40 px-2 py-1 text-xs text-red-300">{error}</p>
      )}

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 && !loading && (
          <p className="py-8 text-center text-xs text-zinc-500">No audit events found.</p>
        )}

        <ul className="space-y-px">
          {events.map(event => (
            <li key={event.id} className="group flex gap-3 rounded px-2 py-2 hover:bg-zinc-800/60">
              <div className="mt-0.5 shrink-0">
                <span
                  className={`text-xs font-mono ${EVENT_TYPE_COLORS[event.type] ?? 'text-zinc-400'}`}
                >
                  {event.type}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {event.actorId && (
                    <span className="truncate text-xs text-zinc-400">
                      by <span className="text-zinc-300">{event.actorId}</span>
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-xs text-zinc-600">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
                <pre className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-zinc-500 group-hover:whitespace-pre-wrap">
                  {JSON.stringify(event.payload)}
                </pre>
              </div>
            </li>
          ))}
        </ul>

        {/* Load more */}
        {nextCursor && (
          <button
            type="button"
            onClick={() => void fetchEvents(nextCursor)}
            disabled={loading}
            className="mt-3 w-full rounded bg-zinc-800 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
        {loading && events.length === 0 && (
          <p className="py-8 text-center text-xs text-zinc-500">Loading…</p>
        )}
      </div>
    </div>
  )
}
