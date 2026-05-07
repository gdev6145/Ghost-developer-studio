/**
 * Typed WebSocket protocol contracts.
 *
 * All messages flowing over Socket.IO must conform to these types.
 * The base envelope ensures every message carries workspace context
 * and can be attributed to an actor for auditing / replay.
 */

// ─── Base Envelope ───────────────────────────────────────────────────────────

/**
 * Every websocket message MUST include these fields.
 */
export interface WsEnvelope {
  /** Discriminator – maps to a specific handler */
  type: WsEventType
  workspaceId: string
  actorId: string
  timestamp: string
}

// ─── Event Type Registry ─────────────────────────────────────────────────────

export type WsEventType =
  // Workspace lifecycle
  | 'workspace.join'
  | 'workspace.leave'
  | 'workspace.state'
  // Document collaboration
  | 'document.open'
  | 'document.update'
  | 'document.close'
  | 'document.sync'
  // Presence
  | 'presence.update'
  | 'presence.cursor'
  | 'presence.selection'
  // Runtime
  | 'runtime.status'
  | 'runtime.logs'
  | 'runtime.start'
  | 'runtime.stop'
  // Preview
  | 'preview.refresh'
  | 'preview.url'
  // Chat
  | 'chat.message'
  | 'chat.typing'
  // Git / Branch
  | 'branch.switch'
  | 'branch.created'
  | 'branch.merged'
  // Files
  | 'file.created'
  | 'file.deleted'
  | 'file.renamed'
  // System
  | 'error'
  | 'ping'
  | 'pong'

// ─── Workspace Events ────────────────────────────────────────────────────────

export interface WsWorkspaceJoin extends WsEnvelope {
  type: 'workspace.join'
  payload: {
    userId: string
    displayName: string
    avatarUrl?: string
  }
}

export interface WsWorkspaceLeave extends WsEnvelope {
  type: 'workspace.leave'
  payload: {
    userId: string
  }
}

export interface WsWorkspaceState extends WsEnvelope {
  type: 'workspace.state'
  payload: {
    members: Array<{ userId: string; displayName: string; avatarUrl?: string }>
    files: Array<{ id: string; path: string; type: 'file' | 'directory' }>
    runtimeStatus: string
  }
}

// ─── Document Events ─────────────────────────────────────────────────────────

export interface WsDocumentOpen extends WsEnvelope {
  type: 'document.open'
  payload: {
    fileId: string
    path: string
  }
}

export interface WsDocumentUpdate extends WsEnvelope {
  type: 'document.update'
  payload: {
    fileId: string
    /** Base64-encoded Yjs binary update */
    update: string
    origin?: string
  }
}

export interface WsDocumentClose extends WsEnvelope {
  type: 'document.close'
  payload: {
    fileId: string
  }
}

export interface WsDocumentSync extends WsEnvelope {
  type: 'document.sync'
  payload: {
    fileId: string
    /** Base64-encoded full Yjs document state vector */
    stateVector: string
    /** Base64-encoded Yjs diff */
    update: string
  }
}

// ─── Presence Events ─────────────────────────────────────────────────────────

export interface WsPresenceUpdate extends WsEnvelope {
  type: 'presence.update'
  payload: {
    userId: string
    activeFile?: string
    status: 'online' | 'idle' | 'offline'
    color: string
  }
}

export interface WsPresenceCursor extends WsEnvelope {
  type: 'presence.cursor'
  payload: {
    userId: string
    fileId: string
    line: number
    column: number
    offset: number
  }
}

export interface WsPresenceSelection extends WsEnvelope {
  type: 'presence.selection'
  payload: {
    userId: string
    fileId: string
    startOffset: number
    endOffset: number
  }
}

// ─── Runtime Events ──────────────────────────────────────────────────────────

export interface WsRuntimeStatus extends WsEnvelope {
  type: 'runtime.status'
  payload: {
    status: 'idle' | 'starting' | 'running' | 'building' | 'error' | 'stopped'
    previewUrl?: string
    containerId?: string
  }
}

export interface WsRuntimeLogs extends WsEnvelope {
  type: 'runtime.logs'
  payload: {
    lines: string[]
    stream: 'stdout' | 'stderr'
  }
}

export interface WsRuntimeStart extends WsEnvelope {
  type: 'runtime.start'
  payload: {
    image?: string
    command?: string
    env?: Record<string, string>
  }
}

export interface WsRuntimeStop extends WsEnvelope {
  type: 'runtime.stop'
  payload: Record<string, never>
}

// ─── Preview Events ──────────────────────────────────────────────────────────

export interface WsPreviewRefresh extends WsEnvelope {
  type: 'preview.refresh'
  payload: {
    url?: string
    buildId?: string
  }
}

export interface WsPreviewUrl extends WsEnvelope {
  type: 'preview.url'
  payload: {
    url: string
  }
}

// ─── Chat Events ─────────────────────────────────────────────────────────────

export interface WsChatMessage extends WsEnvelope {
  type: 'chat.message'
  payload: {
    messageId: string
    authorId: string
    authorName: string
    authorAvatar?: string
    content: string
    createdAt: string
  }
}

export interface WsChatTyping extends WsEnvelope {
  type: 'chat.typing'
  payload: {
    userId: string
    isTyping: boolean
  }
}

// ─── Branch Events ───────────────────────────────────────────────────────────

export interface WsBranchSwitch extends WsEnvelope {
  type: 'branch.switch'
  payload: {
    branchName: string
    previousBranch: string
  }
}

export interface WsBranchCreated extends WsEnvelope {
  type: 'branch.created'
  payload: {
    branchName: string
    fromBranch: string
  }
}

// ─── File Events ─────────────────────────────────────────────────────────────

export interface WsFileCreated extends WsEnvelope {
  type: 'file.created'
  payload: {
    fileId: string
    path: string
    type: 'file' | 'directory'
  }
}

export interface WsFileDeleted extends WsEnvelope {
  type: 'file.deleted'
  payload: {
    fileId: string
    path: string
  }
}

export interface WsFileRenamed extends WsEnvelope {
  type: 'file.renamed'
  payload: {
    fileId: string
    oldPath: string
    newPath: string
  }
}

// ─── System Events ───────────────────────────────────────────────────────────

export interface WsError extends WsEnvelope {
  type: 'error'
  payload: {
    code: string
    message: string
  }
}

// ─── Union Type ──────────────────────────────────────────────────────────────

export type WsMessage =
  | WsWorkspaceJoin
  | WsWorkspaceLeave
  | WsWorkspaceState
  | WsDocumentOpen
  | WsDocumentUpdate
  | WsDocumentClose
  | WsDocumentSync
  | WsPresenceUpdate
  | WsPresenceCursor
  | WsPresenceSelection
  | WsRuntimeStatus
  | WsRuntimeLogs
  | WsRuntimeStart
  | WsRuntimeStop
  | WsPreviewRefresh
  | WsPreviewUrl
  | WsChatMessage
  | WsChatTyping
  | WsBranchSwitch
  | WsBranchCreated
  | WsFileCreated
  | WsFileDeleted
  | WsFileRenamed
  | WsError
