'use client'

import React, { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { CollaborationClient } from '@ghost/collaboration'
import { useWorkspaceStore } from '@ghost/state'
import { useEditorStore } from '@ghost/state'
import { usePresenceStore } from '@ghost/state'
import { useChatStore } from '@ghost/state'
import { useRuntimeStore } from '@ghost/state'
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout'
import { FileExplorer } from '@/components/files/FileExplorer'
import { EditorPane } from '@/components/editor/EditorPane'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { PresenceSidebar } from '@/components/presence/PresenceSidebar'
import { StatusBar } from '@/components/layout/StatusBar'
import { getCurrentUserId, getCurrentDisplayName, getSessionToken } from '@/lib/session'

interface WorkspacePageProps {
  workspaceId: string
}

/**
 * Main workspace page – the primary Ghost Developer Studio experience.
 *
 * Layout:
 * ┌─────────────────────────────────────┐
 * │  Status / Navigation Bar            │
 * ├──────────┬──────────────┬───────────┤
 * │ Files /  │   Editor     │  Chat /   │
 * │ Git      │   + Preview  │  Users    │
 * └──────────┴──────────────┴───────────┘
 */
export function WorkspacePage({ workspaceId }: WorkspacePageProps) {
  const collabRef = useRef<CollaborationClient | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const setWorkspace = useWorkspaceStore(s => s.setWorkspace)
  const setFiles = useWorkspaceStore(s => s.setFiles)
  const addMember = useWorkspaceStore(s => s.addMember)
  const removeMember = useWorkspaceStore(s => s.removeMember)
  const updateRuntimeState = useWorkspaceStore(s => s.updateRuntimeState)

  const updatePresence = usePresenceStore(s => s.updatePresence)
  const removePresence = usePresenceStore(s => s.removePresence)

  const addMessage = useChatStore(s => s.addMessage)
  const setMessages = useChatStore(s => s.setMessages)

  const applyRuntimeState = useRuntimeStore(s => s.applyRuntimeState)
  const appendLog = useRuntimeStore(s => s.appendLog)
  const setPreviewUrl = useRuntimeStore(s => s.setPreviewUrl)

  // ─── Bootstrap Collaboration ─────────────────────────────────────────────

  useEffect(() => {
    const wsUrl = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:4000'
    const token = getSessionToken()

    const socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    })
    socketRef.current = socket

    const collab = new CollaborationClient({
      userId: getCurrentUserId(),
      displayName: getCurrentDisplayName(),
      workspaceId,
      socket,
    })
    collabRef.current = collab

    // Wire collaboration events to Zustand stores
    collab.on('member:joined', payload => {
      addMember({
        userId: payload.userId,
        workspaceId,
        role: 'editor',
        user: {
          id: payload.userId,
          email: '',
          username: payload.userId,
          displayName: payload.displayName,
          avatarUrl: payload.avatarUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        joinedAt: new Date().toISOString(),
      })
    })

    collab.on('member:left', payload => {
      removeMember(payload.userId)
      removePresence(payload.userId)
    })

    collab.on('presence:updated', (userId, state) => {
      updatePresence(userId, {
        userId,
        workspaceId,
        activeFile: state['activeFile'] as string | undefined,
        status: (state['status'] as 'online' | 'idle' | 'offline') ?? 'online',
        color: state['color'] as string ?? '#6B7280',
        lastSeenAt: new Date().toISOString(),
      })
    })

    collab.on('chat:message', payload => {
      // Map to ChatMessage shape expected by the store
      addMessage({
        id: payload.messageId,
        workspaceId,
        authorId: payload.authorId,
        author: {
          id: payload.authorId,
          email: '',
          username: payload.authorId,
          displayName: payload.authorName,
          avatarUrl: payload.authorAvatar,
          createdAt: payload.createdAt,
          updatedAt: payload.createdAt,
        },
        content: payload.content,
        createdAt: payload.createdAt,
      })
    })

    collab.on('runtime:status', payload => {
      applyRuntimeState({
        status: payload.status,
        containerId: payload.containerId,
        previewUrl: payload.previewUrl,
      })
      if (payload.previewUrl) setPreviewUrl(payload.previewUrl)
    })

    collab.on('runtime:logs', payload => {
      payload.lines.forEach(line => appendLog(line))
    })

    collab.on('preview:refresh', payload => {
      if (payload.url) setPreviewUrl(payload.url)
    })

    // Connect
    socket.on('connect', () => {
      collab.joinWorkspace(getCurrentDisplayName())
    })

    // Load workspace data
    void loadWorkspaceData(workspaceId, setWorkspace, setFiles, setMessages)

    return () => {
      collab.destroy()
      socket.disconnect()
    }
  }, [workspaceId])

  return (
    <div className="flex flex-col h-screen bg-ghost-bg text-ghost-text overflow-hidden">
      <StatusBar workspaceId={workspaceId} collab={collabRef} />
      <WorkspaceLayout
        fileExplorer={<FileExplorer workspaceId={workspaceId} collab={collabRef} />}
        editor={<EditorPane workspaceId={workspaceId} collab={collabRef} />}
        rightPanel={
          <div className="flex flex-col h-full">
            <PresenceSidebar />
            <ChatSidebar workspaceId={workspaceId} collab={collabRef} />
          </div>
        }
      />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadWorkspaceData(
  workspaceId: string,
  setWorkspace: (w: Parameters<typeof setWorkspace>[0]) => void,
  setFiles: (f: Parameters<typeof setFiles>[0]) => void,
  setMessages: (m: Parameters<typeof setMessages>[0]) => void
): Promise<void> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
  const token = getSessionToken()
  const headers = { Authorization: `Bearer ${token}` }

  try {
    const [workspaceRes, filesRes, chatRes] = await Promise.all([
      fetch(`${apiUrl}/api/workspaces/${workspaceId}`, { headers }),
      fetch(`${apiUrl}/api/files/${workspaceId}`, { headers }),
      fetch(`${apiUrl}/api/chat/${workspaceId}/messages`, { headers }),
    ])

    if (workspaceRes.ok) {
      const ws = await workspaceRes.json() as Parameters<typeof setWorkspace>[0]
      setWorkspace(ws)
    }
    if (filesRes.ok) {
      const files = await filesRes.json() as Parameters<typeof setFiles>[0]
      setFiles(files)
    }
    if (chatRes.ok) {
      const messages = await chatRes.json() as Parameters<typeof setMessages>[0]
      setMessages(messages)
    }
  } catch {
    // Graceful degradation – workspace still works offline
  }
}
