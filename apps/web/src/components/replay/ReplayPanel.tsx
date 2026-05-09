'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

interface ReplayEvent {
  id: string
  type: string
  category: string
  actorId: string | null
  payload: unknown
  timestamp: string
}

interface ReplayPanelProps {
  workspaceId: string
  apiUrl: string
  token: string
}

export function ReplayPanel({ workspaceId, apiUrl, token }: ReplayPanelProps) {
  const [events, setEvents] = useState<ReplayEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [type, setType] = useState('')
  const [actorId, setActorId] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [jumpAt, setJumpAt] = useState('')
  const [jumpState, setJumpState] = useState<Record<string, unknown> | null>(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: '100' })
    if (type) params.set('type', type)
    if (actorId) params.set('actorId', actorId)
    if (category) params.set('category', category)
    if (search) params.set('search', search)
    return params.toString()
  }, [type, actorId, category, search])

  const fetchEvents = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams(queryString)
        if (cursor) params.set('cursor', cursor)
        const res = await fetch(`${apiUrl}/api/replay/${workspaceId}/query?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(await res.text())
        const data = (await res.json()) as { events: ReplayEvent[]; nextCursor: string | null }
        setEvents(prev => (cursor ? [...prev, ...data.events] : data.events))
        setNextCursor(data.nextCursor)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [apiUrl, queryString, token, workspaceId]
  )

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  const handleJump = async () => {
    setError(null)
    setJumpState(null)
    try {
      const params = new URLSearchParams()
      if (jumpAt) params.set('at', jumpAt)
      const res = await fetch(`${apiUrl}/api/replay/${workspaceId}/state?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as Record<string, unknown>
      setJumpState(data)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleShare = async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      if (actorId) params.set('actorId', actorId)
      if (category) params.set('category', category)
      if (search) params.set('search', search)
      const res = await fetch(`${apiUrl}/api/replay/${workspaceId}/share?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { link: string }
      const absolute = `${window.location.origin}${data.link}`
      await navigator.clipboard.writeText(absolute)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Ghost Replay™</h2>
        <button
          type="button"
          onClick={handleShare}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          Copy Share Link
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="type (file.updated)"
          value={type}
          onChange={e => setType(e.target.value)}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
        />
        <input
          type="text"
          placeholder="actor id"
          value={actorId}
          onChange={e => setActorId(e.target.value)}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
        />
        <input
          type="text"
          placeholder="category (code, terminal, ai)"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
        />
        <input
          type="text"
          placeholder="search payload"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void fetchEvents()}
          className="rounded bg-violet-700 px-2 py-1 text-xs text-white hover:bg-violet-600"
        >
          Filter
        </button>
        <input
          type="datetime-local"
          value={jumpAt}
          onChange={e => setJumpAt(e.target.value)}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
        />
        <button
          type="button"
          onClick={() => void handleJump()}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          Jump to State
        </button>
      </div>

      {jumpState && (
        <pre className="max-h-24 overflow-auto rounded bg-zinc-900 p-2 text-xs text-zinc-400">
          {JSON.stringify(jumpState, null, 2)}
        </pre>
      )}

      {error && <p className="rounded bg-red-900/40 px-2 py-1 text-xs text-red-300">{error}</p>}

      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-px">
          {events.map(event => (
            <li key={event.id} className="rounded px-2 py-2 hover:bg-zinc-800/60">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-violet-300">{event.type}</span>
                <span className="text-zinc-500">{event.category}</span>
                {event.actorId && <span className="text-zinc-500">by {event.actorId}</span>}
                <span className="ml-auto text-zinc-600">{new Date(event.timestamp).toLocaleString()}</span>
              </div>
              <pre className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-zinc-500">
                {JSON.stringify(event.payload)}
              </pre>
            </li>
          ))}
        </ul>
        {nextCursor && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void fetchEvents(nextCursor)}
            className="mt-3 w-full rounded bg-zinc-800 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}
