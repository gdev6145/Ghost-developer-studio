'use client'

import { useEffect, useState } from 'react'
import type { ConnectionState } from '@ghost/collaboration'

interface ReconnectBannerProps {
  connectionState: ConnectionState
  reconnectAttempt?: number
  maxAttempts?: number
}

/**
 * ReconnectBanner — shows a dismissible banner when the collaboration
 * connection is degraded or being re-established.
 *
 * Connection states:
 *   connected    → hidden
 *   connecting   → subtle "Connecting…" indicator
 *   reconnecting → prominent amber banner with attempt counter
 *   disconnected → red banner with manual retry option
 */
export function ReconnectBanner({
  connectionState,
  reconnectAttempt = 0,
  maxAttempts = 10,
}: ReconnectBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed state whenever we transition to a degraded state
  useEffect(() => {
    if (connectionState !== 'connected') {
      setDismissed(false)
    }
  }, [connectionState])

  if (connectionState === 'connected' || dismissed) return null

  const isReconnecting = connectionState === 'reconnecting'
  const isDisconnected = connectionState === 'disconnected'
  const isConnecting = connectionState === 'connecting'

  const bgColor = isDisconnected
    ? 'bg-red-900/80 border-red-700'
    : isReconnecting
      ? 'bg-amber-900/80 border-amber-700'
      : 'bg-zinc-800/80 border-zinc-700'

  const textColor = isDisconnected
    ? 'text-red-200'
    : isReconnecting
      ? 'text-amber-200'
      : 'text-zinc-300'

  const message = isDisconnected
    ? 'Connection lost. Unable to reach the collaboration server.'
    : isReconnecting
      ? `Reconnecting… (attempt ${reconnectAttempt} of ${maxAttempts})`
      : 'Connecting to workspace…'

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 border-b px-4 py-2 text-sm ${bgColor} ${textColor}`}
    >
      <div className="flex items-center gap-2">
        {/* Spinner for connecting/reconnecting states */}
        {!isDisconnected && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {isDisconnected && (
          <svg
            className="h-4 w-4 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        )}
        <span>{message}</span>
        {isConnecting && (
          <span className="text-xs opacity-60">Edits made now will sync automatically once connected.</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notification"
        className="rounded p-1 opacity-60 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-current"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  )
}
