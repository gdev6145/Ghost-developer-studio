/**
 * Domain event contracts for the Ghost event system.
 *
 * These events flow through the internal event bus (not websocket).
 * They represent meaningful state changes that should be persisted,
 * audited, and potentially replayed.
 */

// ─── Base Event ──────────────────────────────────────────────────────────────

export interface GhostEvent {
  id: string
  type: GhostEventType
  workspaceId: string
  actorId?: string
  timestamp: string
  payload: Record<string, unknown>
}

export type GhostEventType =
  // Files
  | 'file.created'
  | 'file.deleted'
  | 'file.updated'
  | 'file.renamed'
  | 'file.moved'
  // Collaboration detail
  | 'presence.cursor'
  | 'presence.selection'
  | 'document.updated'
  // Workspace
  | 'workspace.created'
  | 'workspace.updated'
  | 'workspace.deleted'
  // Users
  | 'user.joined'
  | 'user.left'
  | 'user.role_changed'
  // Branches
  | 'branch.created'
  | 'branch.deleted'
  | 'branch.merged'
  | 'branch.switched'
  // Terminal / Debug / AI
  | 'terminal.created'
  | 'terminal.command'
  | 'terminal.closed'
  | 'debug.breakpoint_set'
  | 'debug.breakpoint_clear'
  | 'ai.suggestion'
  // Durable memory records
  | 'memory.decision'
  | 'memory.bug_fix'
  | 'memory.failed_experiment'
  | 'memory.convention'
  | 'memory.incident'
  | 'memory.code_owner'
  // Runtime
  | 'runtime.started'
  | 'runtime.stopped'
  | 'runtime.error'
  | 'runtime.build_started'
  | 'runtime.build_completed'
  | 'runtime.build_failed'
  // Preview
  | 'preview.updated'
  | 'preview.refreshed'
  // Chat
  | 'chat.sent'
  | 'chat.deleted'
  // Sessions
  | 'session.started'
  | 'session.ended'

// ─── Typed Event Payloads ────────────────────────────────────────────────────

export interface FileCreatedEvent extends GhostEvent {
  type: 'file.created'
  payload: {
    fileId: string
    path: string
    fileType: 'file' | 'directory'
  }
}

export interface FileUpdatedEvent extends GhostEvent {
  type: 'file.updated'
  payload: {
    fileId: string
    path: string
    contentLength: number
  }
}

export interface RuntimeStartedEvent extends GhostEvent {
  type: 'runtime.started'
  payload: {
    containerId: string
    image: string
    previewUrl?: string
  }
}

export interface RuntimeBuildFailedEvent extends GhostEvent {
  type: 'runtime.build_failed'
  payload: {
    containerId?: string
    exitCode: number
    logs: string[]
  }
}

export interface ChatSentEvent extends GhostEvent {
  type: 'chat.sent'
  payload: {
    messageId: string
    authorId: string
    content: string
  }
}

export interface UserJoinedEvent extends GhostEvent {
  type: 'user.joined'
  payload: {
    userId: string
    displayName: string
    role: string
  }
}

export interface UserLeftEvent extends GhostEvent {
  type: 'user.left'
  payload: {
    userId: string
  }
}

export interface BranchCreatedEvent extends GhostEvent {
  type: 'branch.created'
  payload: {
    branchName: string
    fromBranch: string
  }
}

export interface BranchMergedEvent extends GhostEvent {
  type: 'branch.merged'
  payload: {
    sourceBranch: string
    targetBranch: string
    commitSha?: string
  }
}
