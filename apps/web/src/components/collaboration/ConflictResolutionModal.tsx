'use client'

import { useState } from 'react'

export interface ConflictEntry {
  fileId: string
  filePath: string
  localContent: string
  remoteContent: string
  baseContent?: string
}

interface ConflictResolutionModalProps {
  conflict: ConflictEntry | null
  onResolve: (fileId: string, resolution: 'local' | 'remote' | 'merged', mergedContent?: string) => void
  onDismiss: () => void
}

/**
 * ConflictResolutionModal — presents a conflict between local (pending)
 * edits and remote (server) state and lets the user choose a resolution.
 *
 * Resolution options:
 *   local  — keep the user's local version
 *   remote — accept the remote version (discard local changes)
 *   merged — the user manually edits a merged result
 */
export function ConflictResolutionModal({
  conflict,
  onResolve,
  onDismiss,
}: ConflictResolutionModalProps) {
  const [mergedContent, setMergedContent] = useState('')
  const [tab, setTab] = useState<'diff' | 'merge'>('diff')

  if (!conflict) return null

  const handleResolve = (resolution: 'local' | 'remote' | 'merged') => {
    if (resolution === 'merged' && !mergedContent.trim()) return
    onResolve(conflict.fileId, resolution, resolution === 'merged' ? mergedContent : undefined)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="flex w-full max-w-4xl flex-col gap-4 rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 id="conflict-title" className="text-base font-semibold text-white">
              Merge Conflict
            </h2>
            <p className="mt-0.5 text-sm text-zinc-400">
              <span className="font-mono text-zinc-300">{conflict.filePath}</span> has conflicting
              changes between your edits and incoming remote changes.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="rounded p-1 text-zinc-400 hover:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-zinc-700">
          {(['diff', 'merge'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t)
                if (t === 'merge' && !mergedContent) setMergedContent(conflict.localContent)
              }}
              className={`px-3 pb-2 text-sm capitalize transition-colors ${
                tab === t
                  ? 'border-b-2 border-violet-500 text-violet-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t === 'diff' ? 'Side-by-side diff' : 'Manual merge'}
            </button>
          ))}
        </div>

        {tab === 'diff' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-amber-400">⬅ Your local changes</span>
              <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-800 p-3 text-xs text-zinc-200">
                {conflict.localContent}
              </pre>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-sky-400">Remote / incoming ➡</span>
              <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-800 p-3 text-xs text-zinc-200">
                {conflict.remoteContent}
              </pre>
            </div>
          </div>
        )}

        {tab === 'merge' && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-400">
              Edit the merged result below:
            </span>
            <textarea
              value={mergedContent}
              onChange={e => setMergedContent(e.target.value)}
              spellCheck={false}
              className="h-64 w-full resize-none rounded-lg bg-zinc-800 p-3 font-mono text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-700 pt-4">
          <p className="text-xs text-zinc-500">
            Choosing a resolution will update the shared document for all collaborators.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleResolve('local')}
              className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
            >
              Keep mine
            </button>
            <button
              type="button"
              onClick={() => handleResolve('remote')}
              className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600"
            >
              Accept remote
            </button>
            <button
              type="button"
              onClick={() => handleResolve('merged')}
              disabled={tab !== 'merge' || !mergedContent.trim()}
              className="rounded-lg bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Use merged
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
