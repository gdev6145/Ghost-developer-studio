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
  // Terminal (multiplayer PTY)
  | 'terminal.create'
  | 'terminal.input'
  | 'terminal.output'
  | 'terminal.resize'
  | 'terminal.close'
  // Collaborative debugging
  | 'debug.breakpoint.set'
  | 'debug.breakpoint.remove'
  | 'debug.breakpoint.sync'
  | 'debug.session.start'
  | 'debug.session.end'
  // Session replay
  | 'replay.start'
  | 'replay.tick'
  | 'replay.end'
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

// ─── Terminal Events (Multiplayer PTY) ───────────────────────────────────────

export interface WsTerminalCreate extends WsEnvelope {
  type: 'terminal.create'
  payload: {
    terminalId: string
    cols: number
    rows: number
    shell?: string
  }
}

export interface WsTerminalInput extends WsEnvelope {
  type: 'terminal.input'
  payload: {
    terminalId: string
    data: string
  }
}

export interface WsTerminalOutput extends WsEnvelope {
  type: 'terminal.output'
  payload: {
    terminalId: string
    data: string
  }
}

export interface WsTerminalResize extends WsEnvelope {
  type: 'terminal.resize'
  payload: {
    terminalId: string
    cols: number
    rows: number
  }
}

export interface WsTerminalClose extends WsEnvelope {
  type: 'terminal.close'
  payload: {
    terminalId: string
  }
}

// ─── Collaborative Debugging Events ──────────────────────────────────────────

export interface DebugBreakpoint {
  id: string
  fileId: string
  filePath: string
  line: number
  condition?: string
  enabled: boolean
  authorId: string
}

export interface WsDebugBreakpointSet extends WsEnvelope {
  type: 'debug.breakpoint.set'
  payload: {
    breakpoint: DebugBreakpoint
  }
}

export interface WsDebugBreakpointRemove extends WsEnvelope {
  type: 'debug.breakpoint.remove'
  payload: {
    breakpointId: string
    fileId: string
  }
}

export interface WsDebugBreakpointSync extends WsEnvelope {
  type: 'debug.breakpoint.sync'
  payload: {
    breakpoints: DebugBreakpoint[]
  }
}

export interface WsDebugSessionStart extends WsEnvelope {
  type: 'debug.session.start'
  payload: {
    sessionId: string
    fileId?: string
    configuration: Record<string, unknown>
  }
}

export interface WsDebugSessionEnd extends WsEnvelope {
  type: 'debug.session.end'
  payload: {
    sessionId: string
  }
}

// ─── Session Replay Events ────────────────────────────────────────────────────

export interface WsReplayStart extends WsEnvelope {
  type: 'replay.start'
  payload: {
    replayId: string
    fromTimestamp: string
    toTimestamp: string
    speed: number
  }
}

export interface WsReplayTick extends WsEnvelope {
  type: 'replay.tick'
  payload: {
    replayId: string
    eventId: string
    eventType: string
    timestamp: string
    actorId?: string
    data: Record<string, unknown>
  }
}

export interface WsReplayEnd extends WsEnvelope {
  type: 'replay.end'
  payload: {
    replayId: string
    totalEvents: number
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
  | WsTerminalCreate
  | WsTerminalInput
  | WsTerminalOutput
  | WsTerminalResize
  | WsTerminalClose
  | WsDebugBreakpointSet
  | WsDebugBreakpointRemove
  | WsDebugBreakpointSync
  | WsDebugSessionStart
  | WsDebugSessionEnd
  | WsReplayStart
  | WsReplayTick
  | WsReplayEnd
  | WsError
