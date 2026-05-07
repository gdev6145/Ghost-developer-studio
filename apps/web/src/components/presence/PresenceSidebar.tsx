'use client'

import React from 'react'
import { usePresenceStore } from '@ghost/state'
import { useWorkspaceStore } from '@ghost/state'
import { Avatar } from '@ghost/ui'
import { StatusBadge } from '@ghost/ui'
import { getCollaboratorColor } from '@ghost/shared'

/**
 * PresenceSidebar — shows all workspace members with live status indicators.
 *
 * Displays:
 * - Member avatar and name
 * - Online/idle/offline status
 * - Active file (if any)
 * - Live cursor activity indicator
 */
export function PresenceSidebar() {
  const workspace = useWorkspaceStore(s => s.workspace)
  const presenceMap = usePresenceStore(s => s.presenceMap)
  const onlineUsers = usePresenceStore(s => s.onlineUsers)

  const members = workspace?.members ?? []

  // Sort: online first, then by name
  const sorted = [...members].sort((a, b) => {
    const aOnline = onlineUsers.includes(a.userId)
    const bOnline = onlineUsers.includes(b.userId)
    if (aOnline && !bOnline) return -1
    if (!aOnline && bOnline) return 1
    return a.user.displayName.localeCompare(b.user.displayName)
  })

  return (
    <div className="flex flex-col shrink-0" style={{ maxHeight: '40%' }}>
      {/* Header */}
      <div className="flex items-center px-3 h-9 border-b border-ghost-overlay shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
          Members
        </span>
        <span className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-ghost-muted">{onlineUsers.length}</span>
        </span>
      </div>

      {/* Member list */}
      <div className="overflow-y-auto">
        {sorted.map(member => {
          const presence = presenceMap.get(member.userId)
          const status = presence?.status ?? 'offline'
          const color = presence?.color ?? getCollaboratorColor(member.userId)
          const isOnline = status !== 'offline'

          return (
            <div
              key={member.userId}
              className="flex items-center gap-2 px-3 py-2 hover:bg-ghost-overlay transition-colors"
            >
              <Avatar
                src={member.user.avatarUrl}
                displayName={member.user.displayName}
                color={color}
                size="sm"
                showBadge
                badgeColor={
                  status === 'online' ? '#22C55E' : status === 'idle' ? '#F59E0B' : '#6B7280'
                }
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-medium truncate ${isOnline ? 'text-ghost-text' : 'text-ghost-muted'}`}
                  >
                    {member.user.displayName}
                  </span>
                  {member.role === 'owner' && (
                    <span className="text-[9px] px-1 rounded bg-ghost-purple text-ghost-bg font-semibold">
                      owner
                    </span>
                  )}
                </div>
                {presence?.activeFile && (
                  <div className="text-[10px] text-ghost-muted truncate">
                    📄 {presence.activeFile.split('/').pop()}
                  </div>
                )}
              </div>
              <StatusBadge status={status} />
            </div>
          )
        })}

        {members.length === 0 && (
          <div className="px-3 py-3 text-xs text-ghost-muted opacity-60">
            No members yet
          </div>
        )}
      </div>
    </div>
  )
}
