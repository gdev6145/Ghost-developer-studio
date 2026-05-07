/**
 * @ghost/collaboration
 *
 * Yjs collaboration engine, presence awareness, and websocket sync.
 *
 * Key exports:
 *  - CollaborationClient: main entry point for realtime collaboration
 *  - DocumentManager: per-file Yjs document management
 *  - AwarenessManager: presence and cursor tracking
 */
export * from './client'
export * from './document-manager'
export * from './awareness'
