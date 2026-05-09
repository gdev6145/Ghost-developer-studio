import type { Socket } from 'socket.io-client'
import type {
  WsDocumentUpdate,
  WsDocumentSync,
  WsPresenceUpdate,
  WsPresenceCursor,
  WsPresenceSelection,
  WsWorkspaceJoin,
  WsWorkspaceLeave,
  WsChatMessage,
  WsRuntimeStatus,
  WsRuntimeLogs,
  WsPreviewRefresh,
  WsBranchSwitch,
  WsFileCreated,
  WsFileDeleted,
  WsFileRenamed,
  WsTerminalOutput,
  WsTerminalClosed,
  WsDebugState,
  WsAiSuggestion,
} from '@ghost/protocol'
import { DocumentManager } from './document-manager'
import { AwarenessManager } from './awareness'
import type { CursorPosition, TextSelection } from '@ghost/protocol'

export type CollabClientOptions = {
  userId: string
  displayName: string
  workspaceId: string
  socket: Socket
}

export type CollabEventMap = {
  'document:updated': (fileId: string) => void
  'presence:updated': (userId: string, state: Record<string, unknown>) => void
  'runtime:status': (payload: WsRuntimeStatus['payload']) => void
  'runtime:logs': (payload: WsRuntimeLogs['payload']) => void
  'preview:refresh': (payload: WsPreviewRefresh['payload']) => void
  'chat:message': (payload: WsChatMessage['payload']) => void
  'file:created': (payload: WsFileCreated['payload']) => void
  'file:deleted': (payload: WsFileDeleted['payload']) => void
  'file:renamed': (payload: WsFileRenamed['payload']) => void
  'branch:switched': (payload: WsBranchSwitch['payload']) => void
  'member:joined': (payload: WsWorkspaceJoin['payload']) => void
  'member:left': (payload: WsWorkspaceLeave['payload']) => void
  'terminal:output': (payload: WsTerminalOutput['payload']) => void
  'terminal:closed': (payload: WsTerminalClosed['payload']) => void
  'debug:state': (payload: WsDebugState['payload']) => void
  'ai:suggestion': (payload: WsAiSuggestion['payload']) => void
  'connection:state': (state: ConnectionState) => void
  reconnect: () => void
  disconnect: () => void
}

type EventHandler<K extends keyof CollabEventMap> = CollabEventMap[K]

/**
 * CollaborationClient — central realtime collaboration client.
 *
 * Manages:
 *  - Socket.IO connection lifecycle
 *  - Yjs document synchronization
 *  - Awareness / presence
 *  - Reconnect logic (exponential back-off)
 *
 * Architecture:
 *   React Component
 *     → CollaborationClient
 *       → DocumentManager (Yjs docs)
 *       → AwarenessManager (presence)
 *       → Socket.IO
 *         → Server collaboration handler
 */
export type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected'

export class CollaborationClient {
  public readonly documents: DocumentManager
  public readonly awareness: AwarenessManager
  /** Exposed for direct socket.emit calls from UI (e.g., chat typing) */
  public readonly socket: Socket

  private readonly workspaceId: string
  private readonly userId: string
  private readonly actorId: string
  private displayName = ''

  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _connectionState: ConnectionState = 'connecting'

  /** Ops emitted while offline — flushed on reconnect */
  private pendingOps: Array<Record<string, unknown>> = []

  constructor(options: CollabClientOptions) {
    this.socket = options.socket
    this.workspaceId = options.workspaceId
    this.userId = options.userId
    this.actorId = options.userId
    this.displayName = options.displayName

    this.documents = new DocumentManager()
    this.awareness = new AwarenessManager(options.userId, options.displayName)

    // Wire awareness broadcast to socket
    this.awareness.setOnBroadcast((_fileId, _encoded) => {
      // Presence broadcast is handled via updateCursor / updateSelection
    })

    this.attachSocketListeners()
  }

  /** Current connection state */
  get connectionState(): ConnectionState {
    return this._connectionState
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Join the workspace room. Must be called after socket connects.
   */
  joinWorkspace(displayName: string, avatarUrl?: string): void {
    const msg: WsWorkspaceJoin = {
      type: 'workspace.join',
      workspaceId: this.workspaceId,
      actorId: this.actorId,
      timestamp: new Date().toISOString(),
      payload: { userId: this.userId, displayName, avatarUrl },
    }
    this.socket.emit('message', msg)
  }

  /**
   * Leave the workspace room.
   */
  leaveWorkspace(): void {
    const msg: WsWorkspaceLeave = {
      type: 'workspace.leave',
      workspaceId: this.workspaceId,
      actorId: this.actorId,
      timestamp: new Date().toISOString(),
      payload: { userId: this.userId },
    }
    this.socket.emit('message', msg)
    this.awareness.setOffline()
  }

  /**
   * Open a file for collaborative editing.
   * Sends sync request to server.
   */
  openFile(fileId: string): void {
    const stateVector = this.documents.encodeStateVector(fileId)
    this.socket.emit('message', {
      type: 'document.open',
      workspaceId: this.workspaceId,
      actorId: this.actorId,
      timestamp: new Date().toISOString(),
      payload: { fileId, stateVector },
    })
    this.awareness.setActiveFile(fileId)
  }

  /**
   * Close a file tab.
   */
  closeFile(fileId: string): void {
    this.socket.emit('message', {
      type: 'document.close',
      workspaceId: this.workspaceId,
      actorId: this.actorId,
      timestamp: new Date().toISOString(),
      payload: { fileId },
    })
    this.documents.closeDoc(fileId)
    this.awareness.closeFile(fileId)
  }

  /**
   * Broadcast a cursor position update.
   */
  updateCursor(fileId: string, cursor: CursorPosition): void {
    this.awareness.updateCursor(fileId, cursor)
    const msg: WsPresenceCursor = {
      type: 'presence.cursor',
      workspaceId: this.workspaceId,
      actorId: this.actorId,
      timestamp: new Date().toISOString(),
      payload: {
        userId: this.userId,
        fileId,
        ...cursor,
      },
    }
    this.socket.emit('message', msg)
  }

  /**
   * Broadcast a text selection.
   */
  updateSelection(fileId: string, selection: TextSelection): void {
    this.awareness.updateSelection(fileId, selection)
    const msg: WsPresenceSelection = {
      type: 'presence.selection',
      workspaceId: this.workspaceId,
      actorId: this.actorId,
      timestamp: new Date().toISOString(),
      payload: {
        userId: this.userId,
        fileId,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
      },
    }
    this.socket.emit('message', msg)
  }

  /**
   * Send a Yjs document update (called by Monaco binding on change).
   * Ops are queued if the socket is not currently connected and flushed on reconnect.
   */
  sendDocumentUpdate(fileId: string, updateBase64: string): void {
    const msg: WsDocumentUpdate = {
      type: 'document.update',
      workspaceId: this.workspaceId,
      actorId: this.actorId,
      timestamp: new Date().toISOString(),
      payload: { fileId, update: updateBase64 },
    }
    if (!this.socket.connected) {
      this.pendingOps.push(msg as unknown as Record<string, unknown>)
      return
    }
    this.socket.emit('message', msg)
  }

  // ─── Typed Event Emitter ──────────────────────────────────────────────────

  on<K extends keyof CollabEventMap>(event: K, handler: EventHandler<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as (...args: unknown[]) => void)
    return () => this.off(event, handler)
  }

  off<K extends keyof CollabEventMap>(event: K, handler: EventHandler<K>): void {
    this.listeners.get(event)?.delete(handler as (...args: unknown[]) => void)
  }

  private emit<K extends keyof CollabEventMap>(
    event: K,
    ...args: Parameters<EventHandler<K>>
  ): void {
    this.listeners.get(event)?.forEach(h => (h as (...a: unknown[]) => void)(...args))
  }

  // ─── Socket Listener Setup ────────────────────────────────────────────────

  private attachSocketListeners(): void {
    this.socket.on('message', (msg: Record<string, unknown>) => {
      this.handleMessage(msg)
    })

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
      this.setConnectionState('connected')
      this.flushPendingOps()
      // Re-join workspace after reconnect to restore room membership
      this.joinWorkspace(this.displayName)
      this.emit('reconnect')
    })

    this.socket.on('disconnect', (reason: string) => {
      this.awareness.setOffline()
      this.setConnectionState('disconnected')
      this.emit('disconnect')

      // Socket.IO handles its own reconnect for transport errors;
      // for server-initiated disconnects we schedule a manual reconnect.
      if (reason === 'io server disconnect') {
        this.scheduleReconnect()
      }
    })

    this.socket.on('connect_error', () => {
      this.setConnectionState('reconnecting')
      this.scheduleReconnect()
    })
  }

  private setConnectionState(state: ConnectionState): void {
    if (this._connectionState !== state) {
      this._connectionState = state
      this.emit('connection:state', state)
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    if (this.reconnectTimer) return

    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000)
    this.reconnectAttempts++
    this.setConnectionState('reconnecting')

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.socket.connect()
    }, backoffMs)
  }

  /** Flush queued ops accumulated during disconnection. */
  private flushPendingOps(): void {
    const ops = this.pendingOps.splice(0)
    for (const op of ops) {
      this.socket.emit('message', op)
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg['type'] as string

    switch (type) {
      case 'document.update':
      case 'document.sync': {
        const payload = msg['payload'] as WsDocumentUpdate['payload']
        this.documents.applyUpdate(payload.fileId, payload.update)
        this.emit('document:updated', payload.fileId)
        break
      }
      case 'presence.cursor': {
        const payload = msg['payload'] as WsPresenceCursor['payload']
        this.emit('presence:updated', payload.userId, payload as Record<string, unknown>)
        break
      }
      case 'presence.update': {
        const payload = msg['payload'] as WsPresenceUpdate['payload']
        this.emit('presence:updated', payload.userId, payload as Record<string, unknown>)
        break
      }
      case 'runtime.status': {
        const payload = msg['payload'] as WsRuntimeStatus['payload']
        this.emit('runtime:status', payload)
        break
      }
      case 'runtime.logs': {
        const payload = msg['payload'] as WsRuntimeLogs['payload']
        this.emit('runtime:logs', payload)
        break
      }
      case 'preview.refresh': {
        const payload = msg['payload'] as WsPreviewRefresh['payload']
        this.emit('preview:refresh', payload)
        break
      }
      case 'chat.message': {
        const payload = msg['payload'] as WsChatMessage['payload']
        this.emit('chat:message', payload)
        break
      }
      case 'file.created': {
        const payload = msg['payload'] as WsFileCreated['payload']
        this.emit('file:created', payload)
        break
      }
      case 'file.deleted': {
        const payload = msg['payload'] as WsFileDeleted['payload']
        this.emit('file:deleted', payload)
        break
      }
      case 'file.renamed': {
        const payload = msg['payload'] as WsFileRenamed['payload']
        this.emit('file:renamed', payload)
        break
      }
      case 'branch.switch': {
        const payload = msg['payload'] as WsBranchSwitch['payload']
        this.emit('branch:switched', payload)
        break
      }
      case 'workspace.join': {
        const payload = msg['payload'] as WsWorkspaceJoin['payload']
        this.emit('member:joined', payload)
        break
      }
      case 'workspace.leave': {
        const payload = msg['payload'] as WsWorkspaceLeave['payload']
        this.emit('member:left', payload)
        break
      }
      case 'terminal.output': {
        const payload = msg['payload'] as WsTerminalOutput['payload']
        this.emit('terminal:output', payload)
        break
      }
      case 'terminal.closed': {
        const payload = msg['payload'] as WsTerminalClosed['payload']
        this.emit('terminal:closed', payload)
        break
      }
      case 'debug.state': {
        const payload = msg['payload'] as WsDebugState['payload']
        this.emit('debug:state', payload)
        break
      }
      case 'ai.suggestion': {
        const payload = msg['payload'] as WsAiSuggestion['payload']
        this.emit('ai:suggestion', payload)
        break
      }
      default:
        break
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.leaveWorkspace()
    this.documents.destroyAll()
    this.awareness.destroy()
    this.socket.removeAllListeners()
    this.listeners.clear()
  }
}
