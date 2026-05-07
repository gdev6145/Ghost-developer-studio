import Fastify from 'fastify'
import cors from '@fastify/cors'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { Redis } from 'ioredis'
import { validateServerEnv } from '@ghost/config'
import { eventBus } from '@ghost/events'
import { db } from '@ghost/database'

import { registerAuthRoutes } from './routes/auth'
import { registerWorkspaceRoutes } from './routes/workspaces'
import { registerChatRoutes } from './routes/chat'
import { registerFileRoutes } from './routes/files'
import { registerGitRoutes } from './routes/git'
import { createEventsRoutes } from './routes/events'
import { setupCollaborationHandlers } from './handlers/collaboration'
import { setupRuntimeHandlers } from './handlers/runtime'
import { setupTerminalHandlers } from './handlers/terminal'
import { setupEventPersistence } from './handlers/event-persistence'
import { setupAiAgent } from './handlers/ai-agent'
import { authMiddleware } from './middleware/auth'

/**
 * Bootstrap the Ghost server.
 *
 * Architecture:
 *   Fastify (HTTP)  ─────────────────────── REST API routes
 *   Socket.IO       ─────────────────────── Realtime collaboration
 *   Redis Adapter   ─────────────────────── Socket.IO horizontal scaling
 *   Event Bus       ─────────────────────── Internal domain events
 *   Prisma          ─────────────────────── PostgreSQL persistence
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

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // ─── Redis ───────────────────────────────────────────────────────────────

  const pubClient = new Redis(env.REDIS_URL)
  const subClient = pubClient.duplicate()

  app.log.info('Redis connected')

  // ─── Socket.IO ───────────────────────────────────────────────────────────

  const io = new SocketIOServer(app.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  io.adapter(createAdapter(pubClient, subClient))

  // Auth middleware for Socket.IO
  io.use(authMiddleware(env.JWT_SECRET))

  // Register collaboration and runtime event handlers
  setupCollaborationHandlers(io, pubClient, eventBus)
  setupRuntimeHandlers(io, eventBus)
  setupTerminalHandlers(io)

  // Persist all domain events for session replay
  setupEventPersistence(eventBus)

  // AI pair programming agent (scaffold mode without provider; plug in AiProvider to activate)
  if (process.env['AI_ENABLED'] === 'true') {
    setupAiAgent(io, eventBus)
  }

  // Register events routes (needs io for replay broadcast)
  await app.register(createEventsRoutes(io), { prefix: '/api/events' })

  // ─── Start ───────────────────────────────────────────────────────────────

  const address = await app.listen({ port: env.PORT, host: '0.0.0.0' })
  app.log.info(`Ghost server listening at ${address}`)

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info('Shutting down...')
    await app.close()
    await db.$disconnect()
    pubClient.disconnect()
    subClient.disconnect()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown())
  process.on('SIGINT', () => void shutdown())
}

void bootstrap()
