import { PrismaClient } from '../generated'
import type {
  Branch,
  ChatMessage,
  Event,
  File,
  FileType,
  Notification,
  RuntimeState,
  RuntimeStatus,
  Session,
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '../generated'

// ─── Singleton Prisma Client ─────────────────────────────────────────────────
// In development, a module-level singleton prevents creating too many
// connections during hot-reloads.

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const db: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  })

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = db
}

export { PrismaClient }

// Re-export Prisma types so consumers don't need to add @prisma/client directly
export type {
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  Session,
  File,
  FileType,
  Branch,
  ChatMessage,
  Notification,
  Event,
  RuntimeState,
  RuntimeStatus,
}
