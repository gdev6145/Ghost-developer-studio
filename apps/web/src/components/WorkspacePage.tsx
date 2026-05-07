'use client'

import React, { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { CollaborationClient } from '@ghost/collaboration'
import { useWorkspaceStore } from '@ghost/state'
import { useEditorStore } from '@ghost/state'
import { usePresenceStore } from '@ghost/state'
import { useChatStore } from '@ghost/state'
import { useRuntimeStore } from '@ghost/state'
import { useDebugStore } from '@ghost/state'
import { useReplayStore } from '@ghost/state'
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout'
import { FileExplorer } from '@/components/files/FileExplorer'
import { EditorPane } from '@/components/editor/EditorPane'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { PresenceSidebar } from '@/components/presence/PresenceSidebar'
import { StatusBar } from '@/components/layout/StatusBar'
import { TerminalPane } from '@/components/terminal/TerminalPane'
import { BranchGraph } from '@/components/git/BranchGraph'
import { ReplayPanel } from '@/components/replay/ReplayPanel'
import { DebugPanel } from '@/components/debug/DebugPanel'
import type { Workspace, FileNode, ChatMessage } from '@ghost/protocol'
import { getCurrentUserId, getCurrentDisplayName, getSessionToken } from '@/lib/session'

interface WorkspacePageProps {
  workspaceId: string
}

type LeftPanel = 'files' | 'git'
type RightPanel = 'chat' | 'debug' | 'replay'
type BottomPanel = 'terminal' | null

/**
 * Main workspace page – the primary Ghost Developer Studio experience.
 *
 * Layout:
 * ┌─────────────────────────────────────┐
 * │  Status / Navigation Bar            │
 * ├──────────┬──────────────┬───────────┤
 * │ Files /  │   Editor     │  Chat /   │
 * │ Git      │   + Preview  │  Debug /  │
 * ├──────────┤              │  Replay   │
 * │ Terminal │              │           │
 * └──────────┴──────────────┴───────────┘
 */
export function WorkspacePage({ workspaceId }: WorkspacePageProps) {
  const collabRef = useRef<CollaborationClient | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const [leftPanel, setLeftPanel] = useState<LeftPanel>('files')
  const [rightPanel, setRightPanel] = useState<RightPanel>('chat')
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>(null)

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

  // Debug + replay stores
  const setBreakpoint = useDebugStore(s => s.setBreakpoint)
  const removeBreakpoint = useDebugStore(s => s.removeBreakpoint)
  const syncBreakpoints = useDebugStore(s => s.syncBreakpoints)
  const startDebugSession = useDebugStore(s => s.startSession)
  const endDebugSession = useDebugStore(s => s.endSession)

  const startReplay = useReplayStore(s => s.startReplay)
  const appendReplayEvent = useReplayStore(s => s.appendEvent)
  const endReplay = useReplayStore(s => s.endReplay)

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

    // ─── Collaborative Debugging ────────────────────────────────────────────

    collab.on('debug:breakpoint:set', payload => {
      setBreakpoint(payload.breakpoint)
    })

    collab.on('debug:breakpoint:remove', payload => {
      removeBreakpoint(payload.breakpointId)
    })

    collab.on('debug:breakpoint:sync', payload => {
      syncBreakpoints(payload.breakpoints)
    })

    collab.on('debug:session:start', payload => {
      startDebugSession({
        sessionId: payload.sessionId,
        fileId: payload.fileId,
        isActive: true,
        startedAt: new Date().toISOString(),
      })
    })

    collab.on('debug:session:end', () => {
      endDebugSession()
    })

    // ─── Session Replay ────────────────────────────────────────────────────

    collab.on('replay:start', payload => {
      startReplay(payload.replayId, payload.speed)
    })

    collab.on('replay:tick', payload => {
      appendReplayEvent({
        eventId: payload.eventId,
        eventType: payload.eventType,
        timestamp: payload.timestamp,
        actorId: payload.actorId,
        data: payload.data,
      })
    })

    collab.on('replay:end', payload => {
      endReplay(payload.totalEvents)
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

      {/* Panel selector toolbars */}
      <div className="flex items-center gap-0 border-b border-ghost-overlay bg-ghost-surface shrink-0">
        {/* Left panel selector */}
        <div className="flex items-center border-r border-ghost-overlay">
          {(['files', 'git'] as LeftPanel[]).map(p => (
            <button
              key={p}
              onClick={() => setLeftPanel(p)}
              className={[
                'px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors',
                leftPanel === p
                  ? 'text-ghost-text bg-ghost-overlay'
                  : 'text-ghost-muted hover:text-ghost-text',
              ].join(' ')}
            >
              {p === 'files' ? '📁 Files' : '⎇ Git'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Right panel selector */}
        <div className="flex items-center border-l border-ghost-overlay">
          {(['chat', 'debug', 'replay'] as RightPanel[]).map(p => (
            <button
              key={p}
              onClick={() => setRightPanel(p)}
              className={[
                'px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors',
                rightPanel === p
                  ? 'text-ghost-text bg-ghost-overlay'
                  : 'text-ghost-muted hover:text-ghost-text',
              ].join(' ')}
            >
              {p === 'chat' ? '💬 Chat' : p === 'debug' ? '🐛 Debug' : '⏪ Replay'}
            </button>
          ))}
        </div>

        {/* Terminal toggle */}
        <button
          onClick={() => setBottomPanel(v => v === 'terminal' ? null : 'terminal')}
          className={[
            'px-3 py-1.5 text-[10px] uppercase tracking-widest border-l border-ghost-overlay transition-colors',
            bottomPanel === 'terminal'
              ? 'text-ghost-green bg-ghost-overlay'
              : 'text-ghost-muted hover:text-ghost-text',
          ].join(' ')}
        >
          ⌘ Terminal
        </button>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-56 shrink-0 border-r border-ghost-overlay flex flex-col overflow-hidden">
          {leftPanel === 'files' ? (
            <FileExplorer workspaceId={workspaceId} collab={collabRef} />
          ) : (
            <BranchGraph workspaceId={workspaceId} />
          )}
        </div>

        {/* Center: editor + optional terminal */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <EditorPane workspaceId={workspaceId} collab={collabRef} />
          </div>
          {bottomPanel === 'terminal' && (
            <div className="h-56 border-t border-ghost-overlay shrink-0">
              <TerminalPane workspaceId={workspaceId} collab={collabRef} />
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="w-72 shrink-0 border-l border-ghost-overlay flex flex-col overflow-hidden">
          <PresenceSidebar />
          <div className="flex-1 overflow-hidden">
            {rightPanel === 'chat' ? (
              <ChatSidebar workspaceId={workspaceId} collab={collabRef} />
            ) : rightPanel === 'debug' ? (
              <DebugPanel workspaceId={workspaceId} collab={collabRef} />
            ) : (
              <ReplayPanel workspaceId={workspaceId} collab={collabRef} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadWorkspaceData(
  workspaceId: string,
  setWorkspace: (w: Workspace | null) => void,
  setFiles: (f: FileNode[]) => void,
  setMessages: (m: ChatMessage[]) => void
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
