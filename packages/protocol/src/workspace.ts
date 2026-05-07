/**
 * Core workspace model interfaces.
 * These are the central data structures shared across all packages.
 */

// ─── User & Auth ─────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  userId: string
  workspaceId: string
  socketId?: string
  connectedAt: string
  lastSeenAt: string
}

// ─── Workspace ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
  ownerId: string
  members: WorkspaceMember[]
  activeSessions: Session[]
  runtime: RuntimeState
  createdAt: string
  updatedAt: string
}

export interface WorkspaceMember {
  userId: string
  workspaceId: string
  role: WorkspaceRole
  user: User
  joinedAt: string
}

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'

// ─── Files & Filesystem ──────────────────────────────────────────────────────

export interface FileNode {
  id: string
  workspaceId: string
  path: string
  name: string
  type: 'file' | 'directory'
  content?: string
  language?: string
  parentId?: string
  children?: FileNode[]
  createdAt: string
  updatedAt: string
}

export interface FileChange {
  fileId: string
  path: string
  content: string
  actorId: string
  timestamp: string
}

// ─── Runtime ─────────────────────────────────────────────────────────────────

export interface RuntimeState {
  workspaceId: string
  status: RuntimeStatus
  containerId?: string
  previewUrl?: string
  buildLogs: string[]
  startedAt?: string
  stoppedAt?: string
}

export type RuntimeStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'building'
  | 'error'
  | 'stopped'

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  workspaceId: string
  authorId: string
  author: User
  content: string
  createdAt: string
  editedAt?: string
}

// ─── Git / Branch ────────────────────────────────────────────────────────────

export interface Branch {
  id: string
  workspaceId: string
  name: string
  isDefault: boolean
  createdFromBranch?: string
  createdAt: string
  updatedAt: string
}

export interface GitCommit {
  sha: string
  shortSha: string
  message: string
  authorName: string
  authorEmail: string
  authorDate: string
  parents: string[]
  refs: string[]
}

// ─── Presence ────────────────────────────────────────────────────────────────

export interface PresenceState {
  userId: string
  workspaceId: string
  activeFile?: string
  cursor?: CursorPosition
  selection?: TextSelection
  status: UserStatus
  lastSeenAt: string
  color: string
}

export interface CursorPosition {
  line: number
  column: number
  /** Flat character offset for Yjs awareness */
  offset: number
}

export interface TextSelection {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  startOffset: number
  endOffset: number
}

export type UserStatus = 'online' | 'idle' | 'offline'

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: string
  workspaceId: string
  userId: string
  type: NotificationType
  title: string
  message?: string
  read: boolean
  metadata?: Record<string, unknown>
  createdAt: string
}

export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'mention'
  | 'runtime'
  | 'git'
