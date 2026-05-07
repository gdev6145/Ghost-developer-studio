import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'ioredis'
import { validateServerEnv } from '@ghost/config'
import { eventBus } from '@ghost/events'
import { db } from '@ghost/database'

import { registerAuthRoutes } from './routes/auth'
import { registerWorkspaceRoutes } from './routes/workspaces'
import { registerChatRoutes } from './routes/chat'
import { registerFileRoutes } from './routes/files'
import { registerGitRoutes } from './routes/git'
import { registerReplayRoutes } from './routes/replay'
import { registerAIRoutes } from './routes/ai'
import { setupCollaborationHandlers } from './handlers/collaboration'
import { setupRuntimeHandlers } from './handlers/runtime'
import { setupTerminalHandlers } from './handlers/terminal'
import { setupDebugHandlers } from './handlers/debug'
import { authMiddleware } from './middleware/auth'
import { WorkspaceMemoryService } from './services/memory'

/**
 * Bootstrap the Ghost server.
 *
 * Architecture:
 *   Fastify (HTTP)  ─────────────────────── REST API routes
 *   Socket.IO       ─────────────────────── Realtime collaboration
 *   Redis Adapter   ─────────────────────── Socket.IO horizontal scaling
 *   Event Bus       ─────────────────────── Internal domain events
 *   Prisma          ─────────────────────── PostgreSQL persistence
 *   WorkspaceMemory ─────────────────────── Rolling event window for AI
 */
async function bootstrap(): Promise<void> {
  const env = validateServerEnv()

  // ─── Fastify ─────────────────────────────────────────────────────────────

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
      // Structured JSON logging in production
      ...(env.NODE_ENV === 'production' && { transport: undefined }),
    },
  })

  await app.register(cors, {
    origin: true, // Configurable per-env in production
    credentials: true,
  })

  // ─── HTTP Routes ─────────────────────────────────────────────────────────

  await app.register(registerAuthRoutes, { prefix: '/auth' })
  await app.register(registerWorkspaceRoutes, { prefix: '/api/workspaces' })
  await app.register(registerChatRoutes, { prefix: '/api/chat' })
  await app.register(registerFileRoutes, { prefix: '/api/files' })
  await app.register(registerGitRoutes, { prefix: '/api/git' })
  await app.register(registerReplayRoutes, { prefix: '/api/replay' })

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // ─── Redis ───────────────────────────────────────────────────────────────

  const pubClient = createClient(env.REDIS_URL)
  const subClient = pubClient.duplicate()

  await Promise.all([pubClient.connect(), subClient.connect()])
  app.log.info('Redis connected')

  // ─── Workspace Memory Service ─────────────────────────────────────────────

  const memoryService = new WorkspaceMemoryService(pubClient, eventBus)
  memoryService.start()
  app.log.info('Workspace memory service started')

  // Register AI routes (requires memoryService)
  await app.register(registerAIRoutes, { prefix: '/api/ai', memoryService })

  // ─── Socket.IO ───────────────────────────────────────────────────────────

  const io = new SocketIOServer(app.server, {
    adapter: createAdapter(pubClient, subClient) as Parameters<typeof io.adapter>[0],
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  // Auth middleware for Socket.IO
  io.use(authMiddleware(env.JWT_SECRET))

  // Register collaboration and runtime event handlers
  setupCollaborationHandlers(io, pubClient, eventBus)
  setupRuntimeHandlers(io, eventBus)
  setupTerminalHandlers(io, eventBus)
  setupDebugHandlers(io, eventBus)

  // ─── Start ───────────────────────────────────────────────────────────────

  const address = await app.listen({ port: env.PORT, host: '0.0.0.0' })
  app.log.info(`Ghost server listening at ${address}`)

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info('Shutting down...')
    await app.close()
    await db.$disconnect()
    await pubClient.quit()
    await subClient.quit()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown())
  process.on('SIGINT', () => void shutdown())
}

void bootstrap()
