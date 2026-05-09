import { PrismaClient } from '@prisma/client'

// ─── Singleton Prisma Client ─────────────────────────────────────────────────
// In development, a module-level singleton prevents creating too many
// connections during hot-reloads.

type PrismaLogLevel = 'query' | 'warn' | 'error'

const prismaLogLevels: PrismaLogLevel[] =
  process.env['NODE_ENV'] === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error']

export const db: PrismaClient = new PrismaClient({
  log: prismaLogLevels,
})

export { PrismaClient }

export type WorkspaceRole = 'viewer' | 'editor' | 'admin' | 'owner'
