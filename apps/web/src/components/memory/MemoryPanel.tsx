'use client'

import { useCallback, useEffect, useState } from 'react'

type MemoryCategory =
  | 'decision'
  | 'bug_fix'
  | 'failed_experiment'
  | 'convention'
  | 'incident'
  | 'code_owner'

interface MemoryEntry {
  id: string
  category: MemoryCategory
  actorId: string | null
  title: string
  detail: string
  tags: string[]
  relatedEntity: string | null
  severity: 'low' | 'medium' | 'high' | null
  timestamp: string
}

interface MemoryPanelProps {
  workspaceId: string
  apiUrl: string
  token: string
}

const categories: MemoryCategory[] = [
  'decision',
  'bug_fix',
  'failed_experiment',
  'convention',
  'incident',
  'code_owner',
]

export function MemoryPanel({ workspaceId, apiUrl, token }: MemoryPanelProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [category, setCategory] = useState<MemoryCategory>('decision')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await fetch(`${apiUrl}/api/memory/${workspaceId}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { entries: MemoryEntry[] }
      setEntries(data.entries)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, categoryFilter, token, workspaceId])

  useEffect(() => {
    void fetchEntries()
  }, [fetchEntries])

  const handleAdd = async () => {
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/memory/${workspaceId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          title,
          detail,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setTitle('')
      setDetail('')
      setTags('')
      await fetchEntries()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Workspace Memory</h2>
        <button
          type="button"
          onClick={() => void fetchEntries()}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2">
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void fetchEntries()}
          className="rounded bg-violet-700 px-2 py-1 text-xs text-white hover:bg-violet-600"
        >
          Apply
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded border border-zinc-800 bg-zinc-900/40 p-2">
        <select
          value={category}
          onChange={e => setCategory(e.target.value as MemoryCategory)}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
        >
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
        />
        <textarea
          value={detail}
          onChange={e => setDetail(e.target.value)}
          placeholder="Details"
          rows={3}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
        />
        <input
          type="text"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="Tags (comma separated)"
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600"
        >
          Add Memory
        </button>
      </div>

      {error && <p className="rounded bg-red-900/40 px-2 py-1 text-xs text-red-300">{error}</p>}

      <div className="flex-1 overflow-y-auto">
        {loading && <p className="py-8 text-center text-xs text-zinc-500">Loading…</p>}
        <ul className="space-y-px">
          {entries.map(entry => (
            <li key={entry.id} className="rounded px-2 py-2 hover:bg-zinc-800/60">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-300">{entry.category}</span>
                <span className="text-zinc-300">{entry.title}</span>
                <span className="ml-auto text-zinc-600">{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">{entry.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
