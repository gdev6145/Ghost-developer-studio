'use client'

import React from 'react'
import { useWorkspaceStore } from '@ghost/state'
import { usePresenceStore } from '@ghost/state'
import { useRuntimeStore } from '@ghost/state'
import { RuntimeBadge } from '@ghost/ui'
import { AvatarGroup } from '@ghost/ui'

interface StatusBarProps {
  workspaceId: string
  collab: React.MutableRefObject<unknown>
}

/**
 * Bottom status bar showing:
 * - Workspace name
 * - Active branch
 * - Runtime status
 * - Online collaborators
 * - Connection status
 */
export function StatusBar({ workspaceId }: StatusBarProps) {
  const workspace = useWorkspaceStore(s => s.workspace)
  const activeBranch = useWorkspaceStore(s => s.activeBranch)
  const status = useRuntimeStore(s => s.status)
  const { onlineUsers, presenceMap } = usePresenceStore()

  const onlineAvatars = onlineUsers.map(uid => {
    const p = presenceMap.get(uid)
    return {
      userId: uid,
      displayName: uid.slice(0, 8),
      color: p?.color ?? '#6B7280',
    }
  })

  return (
    <div className="h-9 flex items-center px-3 gap-4 bg-ghost-surface border-b border-ghost-overlay shrink-0 text-xs text-ghost-muted">
      {/* Workspace name */}
      <span className="font-semibold text-ghost-text truncate max-w-[160px]">
        {workspace?.name ?? 'Ghost Studio'}
      </span>

      <span className="text-ghost-overlay">|</span>

      {/* Branch */}
      <div className="flex items-center gap-1">
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.75 2.5a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0zm.75 2.25A2.25 2.25 0 1 1 9.25 2.5a.75.75 0 0 0-1.5 0A3.75 3.75 0 1 0 12.5 6.25V8.5a.75.75 0 0 0 1.5 0V4.75a.75.75 0 0 0-.75-.75H12a.75.75 0 0 0 0 1.5h.5v.25z" />
        </svg>
        <span>{activeBranch?.name ?? 'main'}</span>
      </div>

      <span className="text-ghost-overlay">|</span>

      {/* Runtime status */}
      <RuntimeBadge status={status} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Online collaborators */}
      {onlineAvatars.length > 0 && (
        <div className="flex items-center gap-2">
          <AvatarGroup users={onlineAvatars} max={5} size="sm" />
          <span className="text-ghost-muted">{onlineAvatars.length} online</span>
        </div>
      )}

      <span className="text-ghost-overlay">|</span>

      {/* Workspace ID */}
      <span className="font-mono opacity-50">{workspaceId.slice(0, 8)}</span>
    </div>
  )
}
