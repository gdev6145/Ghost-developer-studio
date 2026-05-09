import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'ioredis'
import { validateServerEnv } from '@ghost/config'
import { eventBus } from '@ghost/events'
import { db } from '@ghost/database'
import {
  httpRequestsTotal,
  httpRequestDuration,
  wsConnectionsActive,
  errorTotal,
  registry,
} from '@ghost/observability'
import { evaluateSlos } from '@ghost/observability'
import { pluginRegistry } from '@ghost/plugins'
import { activityFeedPlugin } from '@ghost/plugins'

import { registerAuthRoutes } from './routes/auth'
import { registerWorkspaceRoutes } from './routes/workspaces'
import { registerChatRoutes } from './routes/chat'
import { registerFileRoutes } from './routes/files'
import { registerGitRoutes } from './routes/git'
import { registerReplayRoutes } from './routes/replay'
import { createAiRoutes } from './routes/ai'
import { createTaskRoutes } from './routes/tasks'
import { registerAuditRoutes } from './routes/audit'
import { registerPluginRoutes } from './routes/plugins'
import { registerSafeEditRoutes } from './routes/safe-edits'
import { registerPreviewRoutes } from './routes/previews'
import { registerTemplateRoutes } from './routes/templates'
import { setupCollaborationHandlers } from './handlers/collaboration'
import { setupRuntimeHandlers } from './handlers/runtime'
import { setupTerminalHandlers } from './handlers/terminal'
import { setupDebugHandlers } from './handlers/debug'
import { authMiddleware } from './middleware/auth'
import { WorkspaceMemoryService } from './services/memory'

// ─── Process-level error tracking ────────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
  errorTotal.inc({ type: 'unhandledRejection' })
  console.error('[ghost] Unhandled promise rejection:', reason)
})

process.on('uncaughtException', (err) => {
  errorTotal.inc({ type: 'uncaughtException' })
  console.error('[ghost] Uncaught exception:', err)
  process.exit(1)
})

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
      level: env.LOG_LEVEL ?? (env.NODE_ENV === 'development' ? 'debug' : 'info'),
      // In production emit structured JSON; in development use a readable serializer
      ...(env.NODE_ENV !== 'production' && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }),
    },
    // Attach a unique request ID to every request for correlation
    genReqId: (req) => {
      return (req.headers['x-request-id'] as string) ?? crypto.randomUUID()
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  })

  // ─── CORS ────────────────────────────────────────────────────────────────

  const corsOrigin = env.CORS_ORIGIN ?? (env.NODE_ENV === 'production' ? false : true)
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  })

  // ─── Rate Limiting ───────────────────────────────────────────────────────

  await app.register(rateLimit, {
    max: 200,
    timeWindow: 60_000,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  })

  // ─── Request / Response metrics hook ─────────────────────────────────────

  app.addHook('onRequest', async (req) => {
    ;(req as Record<string, unknown>)['_startTime'] = Date.now()
  })

  app.addHook('onResponse', async (req, reply) => {
    const startTime = (req as Record<string, unknown>)['_startTime'] as number | undefined
    const durationMs = startTime ? Date.now() - startTime : 0
    const route = req.routeOptions?.url ?? req.url ?? 'unknown'
    const method = req.method
    const statusCode = String(reply.statusCode)

    httpRequestsTotal.inc({ method, route, status_code: statusCode })
    httpRequestDuration.observe(durationMs, { method, route })
  })

  // ─── HTTP Routes ─────────────────────────────────────────────────────────

  await app.register(registerAuthRoutes, { prefix: '/auth' })
  await app.register(registerWorkspaceRoutes, { prefix: '/api/workspaces' })
  await app.register(registerChatRoutes, { prefix: '/api/chat' })
  await app.register(registerFileRoutes, { prefix: '/api/files' })
  await app.register(registerGitRoutes, { prefix: '/api/git' })
  await app.register(registerReplayRoutes, { prefix: '/api/replay' })
  await app.register(registerAuditRoutes, { prefix: '/api/audit' })
  await app.register(registerPluginRoutes, { prefix: '/api/plugins' })
  await app.register(registerSafeEditRoutes, { prefix: '/api/safe-edits' })
  await app.register(registerPreviewRoutes, { prefix: '/api/previews' })
  await app.register(registerTemplateRoutes, { prefix: '/api/templates' })

  // ─── Health check (enriched) ──────────────────────────────────────────────

  app.get('/health', async () => {
    const slos = evaluateSlos()
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '0.1.0',
      environment: env.NODE_ENV,
      slos,
    }
  })

  // ─── Metrics endpoint (Prometheus exposition format) ──────────────────────

  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    return registry.prometheusFormat()
  })

  // ─── Redis ───────────────────────────────────────────────────────────────

  const pubClient = createClient(env.REDIS_URL)
  const subClient = pubClient.duplicate()

  await Promise.all([pubClient.connect(), subClient.connect()])
  app.log.info('Redis connected')

  // ─── Workspace Memory ────────────────────────────────────────────────────

  const memory = new WorkspaceMemoryService(pubClient)

  // Persist all domain events into the rolling Redis window + event log
  // and dispatch to plugin event subscribers
  eventBus.onAny(event => {
    void memory.push(event)
    // Dispatch to plugin subscribers
    void pluginRegistry.dispatch(event.type, event.payload, {
      workspaceId: event.workspaceId,
      userId: event.actorId ?? 'system',
      emit: (type, payload) => void eventBus.dispatch(type, event.workspaceId, payload),
      getMemory: async (key) => pubClient.get(`plugin:mem:${key}`),
      setMemory: async (key, value, ttl) => {
        if (ttl) {
          await pubClient.setex(`plugin:mem:${key}`, ttl, value)
        } else {
          await pubClient.set(`plugin:mem:${key}`, value)
        }
      },
    }).catch(err => {
      app.log.error({ err, eventType: event.type }, 'Plugin event dispatch error')
    })
    // Persist to PostgreSQL event log for replay
    void db.event.create({
      data: {
        id: event.id,
        workspaceId: event.workspaceId,
        actorId: event.actorId ?? null,
        type: event.type,
        payload: event.payload as Record<string, unknown>,
        timestamp: new Date(event.timestamp),
      },
    }).catch(err => {
      app.log.error({ err, eventId: event.id }, 'Failed to persist event to database')
    })
  })

  // Register AI routes (needs memory service reference)
  await app.register(createAiRoutes(memory), { prefix: '/api/ai' })
  await app.register(createTaskRoutes(memory, pubClient), { prefix: '/api/tasks' })

  // ─── Plugin Registry — register built-in plugins ─────────────────────────

  await pluginRegistry.register(activityFeedPlugin, {
    workspaceId: 'system',
    userId: 'system',
    emit: (type, payload) => void eventBus.dispatch(type, 'system', payload),
    getMemory: async (key) => pubClient.get(`plugin:mem:${key}`),
    setMemory: async (key, value, ttl) => {
      if (ttl) {
        await pubClient.setex(`plugin:mem:${key}`, ttl, value)
      } else {
        await pubClient.set(`plugin:mem:${key}`, value)
      }
    },
  })
  app.log.info('Built-in plugins registered')

  // ─── Socket.IO ───────────────────────────────────────────────────────────

  const io = new SocketIOServer(app.server, {
    adapter: createAdapter(pubClient, subClient) as Parameters<typeof io.adapter>[0],
    cors: {
      origin: corsOrigin === true ? '*' : corsOrigin,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  // Auth middleware for Socket.IO
  io.use(authMiddleware(env.JWT_SECRET))

  // Track active WebSocket connections
  io.on('connection', () => {
    wsConnectionsActive.inc()
  })
  io.on('disconnect', () => {
    wsConnectionsActive.dec()
  })

  // Register collaboration and runtime event handlers
  setupCollaborationHandlers(io, pubClient, eventBus)
  setupRuntimeHandlers(io, eventBus)
  setupTerminalHandlers(io)
  setupDebugHandlers(io)

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
