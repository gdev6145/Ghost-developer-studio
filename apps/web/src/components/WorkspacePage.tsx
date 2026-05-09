'use client'

import React, { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { CollaborationClient } from '@ghost/collaboration'
import { useWorkspaceStore } from '@ghost/state'
import { usePresenceStore } from '@ghost/state'
import { useChatStore } from '@ghost/state'
import { useRuntimeStore } from '@ghost/state'
import { useTerminalStore } from '@ghost/state'
import { useDebugStore } from '@ghost/state'
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout'
import { FileExplorer } from '@/components/files/FileExplorer'
import { EditorPane } from '@/components/editor/EditorPane'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { PresenceSidebar } from '@/components/presence/PresenceSidebar'
import { StatusBar } from '@/components/layout/StatusBar'
import { TerminalPanel } from '@/components/terminal/TerminalPanel'
import { DebugPanel } from '@/components/debug/DebugPanel'
import { BranchPanel } from '@/components/git/BranchPanel'
import { AIPairPanel } from '@/components/ai/AIPairPanel'
import { getCurrentUserId, getCurrentDisplayName, getSessionToken } from '@/lib/session'

interface WorkspacePageProps {
  workspaceId: string
}

type RightPanelTab = 'members' | 'chat' | 'ai' | 'git'
type BottomPanelTab = 'terminal' | 'debug'

/**
 * Main workspace page – the primary Ghost Developer Studio experience.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────┐
 * │  Status / Navigation Bar                            │
 * ├──────────┬────────────────────────┬─────────────────┤
 * │ Explorer │   Editor + Preview     │  Right Panel    │
 * │          │                        │  (Members/Chat/ │
 * │          │                        │   AI/Git)       │
 * ├──────────┴────────────────────────┴─────────────────┤
 * │  Bottom Panel (Terminal / Debug)                    │
 * └─────────────────────────────────────────────────────┘
 */
export function WorkspacePage({ workspaceId }: WorkspacePageProps) {
  const collabRef = useRef<CollaborationClient | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const [rightTab, setRightTab] = useState<RightPanelTab>('chat')
  const [bottomTab, setBottomTab] = useState<BottomPanelTab>('terminal')
  const [showBottom, setShowBottom] = useState(false)

  const setWorkspace = useWorkspaceStore(s => s.setWorkspace)
  const setFiles = useWorkspaceStore(s => s.setFiles)
  const addMember = useWorkspaceStore(s => s.addMember)
  const removeMember = useWorkspaceStore(s => s.removeMember)

  const updatePresence = usePresenceStore(s => s.updatePresence)
  const removePresence = usePresenceStore(s => s.removePresence)

  const addMessage = useChatStore(s => s.addMessage)
  const setMessages = useChatStore(s => s.setMessages)

  const applyRuntimeState = useRuntimeStore(s => s.applyRuntimeState)
  const appendLog = useRuntimeStore(s => s.appendLog)
  const setPreviewUrl = useRuntimeStore(s => s.setPreviewUrl)

  const appendTerminalOutput = useTerminalStore(s => s.appendOutput)
  const closeTerminalSession = useTerminalStore(s => s.closeSession)

  const setDebugBreakpoints = useDebugStore(s => s.setBreakpoints)

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

    // Terminal events
    collab.on('terminal:output', payload => {
      appendTerminalOutput(payload.terminalId, payload.data)
    })

    collab.on('terminal:closed', payload => {
      closeTerminalSession(payload.terminalId, payload.exitCode)
    })

    // Debug events
    collab.on('debug:state', payload => {
      setDebugBreakpoints(payload.breakpoints)
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

  const rightTabs: { key: RightPanelTab; label: string }[] = [
    { key: 'members', label: 'Members' },
    { key: 'chat', label: 'Chat' },
    { key: 'ai', label: '✦ AI' },
    { key: 'git', label: '⎇ Git' },
  ]

  const bottomTabs: { key: BottomPanelTab; label: string }[] = [
    { key: 'terminal', label: '⚡ Terminal' },
    { key: 'debug', label: '🔴 Debug' },
  ]

  return (
    <div className="flex flex-col h-screen bg-ghost-bg text-ghost-text overflow-hidden">
      <StatusBar workspaceId={workspaceId} collab={collabRef} />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Main workspace area */}
        <WorkspaceLayout
          fileExplorer={<FileExplorer workspaceId={workspaceId} collab={collabRef} />}
          editor={<EditorPane workspaceId={workspaceId} collab={collabRef} />}
          rightPanel={
            <div className="flex flex-col h-full">
              {/* Right panel tabs */}
              <div className="flex items-center h-8 border-b border-ghost-overlay shrink-0 bg-ghost-surface">
                {rightTabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setRightTab(tab.key)}
                    className={[
                      'px-3 h-full text-[10px] font-semibold transition-colors border-r border-ghost-overlay',
                      rightTab === tab.key
                        ? 'text-ghost-text bg-ghost-bg'
                        : 'text-ghost-muted hover:text-ghost-text hover:bg-ghost-overlay',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-hidden">
                {rightTab === 'members' && <PresenceSidebar />}
                {rightTab === 'chat' && (
                  <ChatSidebar workspaceId={workspaceId} collab={collabRef} />
                )}
                {rightTab === 'ai' && (
                  <AIPairPanel workspaceId={workspaceId} collab={collabRef} />
                )}
                {rightTab === 'git' && (
                  <BranchPanel workspaceId={workspaceId} collab={collabRef} />
                )}
              </div>
            </div>
          }
        />

        {/* Bottom panel toggle bar */}
        <div className="flex items-center h-7 border-t border-ghost-overlay bg-ghost-surface shrink-0">
          {bottomTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                if (bottomTab === tab.key && showBottom) {
                  setShowBottom(false)
                } else {
                  setBottomTab(tab.key)
                  setShowBottom(true)
                }
              }}
              className={[
                'px-3 h-full text-[10px] font-semibold transition-colors border-r border-ghost-overlay',
                (showBottom && bottomTab === tab.key)
                  ? 'text-ghost-text bg-ghost-bg'
                  : 'text-ghost-muted hover:text-ghost-text hover:bg-ghost-overlay',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          {showBottom && (
            <button
              onClick={() => setShowBottom(false)}
              className="px-3 h-full text-ghost-muted hover:text-ghost-text text-xs transition-colors"
              title="Close panel"
            >
              ×
            </button>
          )}
        </div>

        {/* Bottom panel content */}
        {showBottom && (
          <div className="h-64 border-t border-ghost-overlay shrink-0 overflow-hidden">
            {bottomTab === 'terminal' && (
              <TerminalPanel workspaceId={workspaceId} collab={collabRef} />
            )}
            {bottomTab === 'debug' && (
              <DebugPanel workspaceId={workspaceId} collab={collabRef} />
            )}
          </div>
        )}
      </div>
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
