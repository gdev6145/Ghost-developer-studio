'use client'

import React, { useRef, useEffect, useState } from 'react'
import { useRuntimeStore } from '@ghost/state'

/**
 * PreviewPane — live iframe preview of the running workspace container.
 *
 * Features:
 * - Auto-refreshes when runtime sends preview.refresh event
 * - Shows build status overlay
 * - Loading indicator
 * - Error state
 */
export function PreviewPane() {
  const previewUrl = useRuntimeStore(s => s.previewUrl)
  const status = useRuntimeStore(s => s.status)
  const buildLogs = useRuntimeStore(s => s.buildLogs)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showLogs, setShowLogs] = useState(false)

  // Refresh iframe when URL changes
  useEffect(() => {
    if (previewUrl && iframeRef.current) {
      setIsLoading(true)
      iframeRef.current.src = previewUrl
    }
  }, [previewUrl])

  const isBuilding = status === 'building' || status === 'starting'
  const hasError = status === 'error'

  return (
    <div className="flex flex-col h-full bg-ghost-bg">
      {/* Preview toolbar */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-ghost-overlay bg-ghost-surface shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
          Preview
        </span>

        {previewUrl && (
          <span className="text-xs text-ghost-muted font-mono truncate max-w-[180px]">
            {previewUrl}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Refresh button */}
          <button
            onClick={() => {
              if (iframeRef.current) {
                iframeRef.current.contentWindow?.location.reload()
                setIsLoading(true)
              }
            }}
            className="text-ghost-muted hover:text-ghost-text transition-colors text-xs"
            title="Refresh preview"
          >
            ↺
          </button>

          {/* Logs toggle */}
          <button
            onClick={() => setShowLogs(v => !v)}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
              showLogs
                ? 'bg-ghost-overlay text-ghost-text'
                : 'text-ghost-muted hover:text-ghost-text'
            }`}
          >
            Logs
          </button>
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Building overlay */}
        {isBuilding && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ghost-bg z-10 gap-3">
            <div className="w-8 h-8 border-2 border-ghost-blue border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-ghost-muted">
              {status === 'building' ? 'Building...' : 'Starting container...'}
            </span>
          </div>
        )}

        {/* Error overlay */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ghost-bg z-10 gap-2">
            <span className="text-2xl">⚠️</span>
            <span className="text-sm text-ghost-red">Build failed</span>
            <span className="text-xs text-ghost-muted">Check logs below</span>
          </div>
        )}

        {/* No URL state */}
        {!previewUrl && !isBuilding && !hasError && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-ghost-muted">
            <span className="text-4xl opacity-20">🖥</span>
            <span className="text-sm">No preview available</span>
            <span className="text-xs opacity-60">Start the runtime to see a preview</span>
          </div>
        )}

        {/* Iframe */}
        {previewUrl && (
          <>
            {isLoading && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-ghost-blue animate-pulse z-10" />
            )}
            <iframe
              ref={iframeRef}
              className="w-full h-full border-none bg-white"
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onLoad={() => setIsLoading(false)}
            />
          </>
        )}
      </div>

      {/* Build logs panel */}
      {showLogs && (
        <div className="h-40 border-t border-ghost-overlay bg-ghost-surface overflow-y-auto font-mono text-[11px] text-ghost-muted p-2 shrink-0">
          {buildLogs.length === 0 ? (
            <span className="opacity-50">No logs yet...</span>
          ) : (
            buildLogs.map((line, i) => (
              <div key={i} className="leading-5">
                {line}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
