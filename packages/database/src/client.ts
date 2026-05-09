import { Prisma, PrismaClient } from '../generated'

// ─── Singleton Prisma Client ─────────────────────────────────────────────────
// In development, a module-level singleton prevents creating too many
// connections during hot-reloads.

type GlobalWithPrisma = typeof globalThis & {
  __prisma?: PrismaClient
}

const globalForPrisma = globalThis as GlobalWithPrisma

const prismaLogLevels: Prisma.LogLevel[] =
  process.env['NODE_ENV'] === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error']

export const db: PrismaClient =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: prismaLogLevels,
  })

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.__prisma = db
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
} from '../generated'
