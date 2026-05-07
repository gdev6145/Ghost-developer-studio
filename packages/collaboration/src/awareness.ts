import * as Y from 'yjs'
import { getCollaboratorColor, throttle } from '@ghost/shared'
import type { PresenceState, CursorPosition, TextSelection } from '@ghost/protocol'

/**
 * AwarenessManager wraps the Yjs awareness protocol for presence.
 *
 * Awareness updates are throttled before being broadcast to reduce
 * websocket traffic. Each connected user has their own awareness state
 * keyed by their Yjs client ID.
 *
 * Presence data tracked:
 *  - userId
 *  - displayName
 *  - color (deterministic per userId)
 *  - activeFile
 *  - cursor position
 *  - selection
 *  - status (online/idle/offline)
 */
export class AwarenessManager {
  private readonly awarenessMap = new Map<string, Y.Doc>()
  private idleTimer: ReturnType<typeof setTimeout> | null = null

  // Throttled broadcast – 80ms is smooth while keeping traffic low
  private readonly throttledBroadcast: (
    fileId: string,
    state: Partial<PresenceState>
  ) => void

  private onBroadcast?: (fileId: string, awarenessUpdate: Uint8Array) => void

  constructor(
    private readonly userId: string,
    private readonly displayName: string
  ) {
    this.throttledBroadcast = throttle(
      (fileId: string, state: Partial<PresenceState>) => {
        this.broadcastPresence(fileId, state)
      },
      80
    )
  }

  /**
   * Register a callback to send awareness updates over the wire.
   */
  setOnBroadcast(cb: (fileId: string, awarenessUpdate: Uint8Array) => void): void {
    this.onBroadcast = cb
  }

  /**
   * Get or create awareness state attached to a specific file's Y.Doc.
   */
  private getAwarenessDoc(fileId: string): Y.Doc {
    if (!this.awarenessMap.has(fileId)) {
      this.awarenessMap.set(fileId, new Y.Doc())
    }
    return this.awarenessMap.get(fileId)!
  }

  /**
   * Update the local user's cursor position.
   */
  updateCursor(fileId: string, cursor: CursorPosition): void {
    this.resetIdleTimer()
    this.throttledBroadcast(fileId, {
      userId: this.userId,
      activeFile: fileId,
      cursor,
      status: 'online',
      color: getCollaboratorColor(this.userId),
      workspaceId: '',
      lastSeenAt: new Date().toISOString(),
    })
  }

  /**
   * Update the local user's text selection.
   */
  updateSelection(fileId: string, selection: TextSelection): void {
    this.resetIdleTimer()
    this.throttledBroadcast(fileId, {
      userId: this.userId,
      activeFile: fileId,
      selection,
      status: 'online',
      color: getCollaboratorColor(this.userId),
      workspaceId: '',
      lastSeenAt: new Date().toISOString(),
    })
  }

  /**
   * Set the active file (user switched tabs).
   */
  setActiveFile(fileId: string): void {
    this.throttledBroadcast(fileId, {
      userId: this.userId,
      activeFile: fileId,
      status: 'online',
      color: getCollaboratorColor(this.userId),
      workspaceId: '',
      lastSeenAt: new Date().toISOString(),
    })
  }

  /**
   * Mark the local user as offline (called on disconnect).
   */
  setOffline(): void {
    // Broadcast empty/offline state on all tracked files
    this.awarenessMap.forEach((_, fileId) => {
      this.broadcastPresence(fileId, {
        userId: this.userId,
        status: 'offline',
        color: getCollaboratorColor(this.userId),
        workspaceId: '',
        lastSeenAt: new Date().toISOString(),
      })
    })
  }

  private broadcastPresence(fileId: string, state: Partial<PresenceState>): void {
    if (!this.onBroadcast) return
    const doc = this.getAwarenessDoc(fileId)
    // Encode as a simple Yjs update payload
    const encoded = new TextEncoder().encode(JSON.stringify(state))
    this.onBroadcast(fileId, encoded)
  }

  /**
   * Start/reset idle detection. After 30s without activity, go idle.
   */
  private resetIdleTimer(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => {
      // Transition to idle on all files
      this.awarenessMap.forEach((_, fileId) => {
        this.broadcastPresence(fileId, {
          userId: this.userId,
          status: 'idle',
          color: getCollaboratorColor(this.userId),
          workspaceId: '',
          lastSeenAt: new Date().toISOString(),
        })
      })
    }, 30_000)
  }

  /**
   * Clean up file-level awareness state.
   */
  closeFile(fileId: string): void {
    const doc = this.awarenessMap.get(fileId)
    if (doc) {
      doc.destroy()
      this.awarenessMap.delete(fileId)
    }
  }

  destroy(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer)
    this.awarenessMap.forEach(doc => doc.destroy())
    this.awarenessMap.clear()
  }
}
