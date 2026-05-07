import type { Redis } from 'ioredis'
import type { GhostEvent, GhostEventType } from '@ghost/protocol'
import type { EventDispatcher } from '@ghost/events'
import { db } from '@ghost/database'

/**
 * WorkspaceMemoryService — rolling event window for AI context.
 *
 * Architecture:
 *   All GhostEvents are persisted to PostgreSQL (Event table) AND
 *   mirrored to Redis as a capped list (last WINDOW_SIZE events per workspace).
 *   The AI endpoint reads from Redis for low-latency context retrieval.
 *
 *   Redis key: ghost:memory:{workspaceId}
 *   Value: JSON-serialized GhostEvent[]
 */
const WINDOW_SIZE = 50
const REDIS_TTL_SECONDS = 60 * 60 * 24 // 24 hours

/**
 * Event types that are meaningful for AI context (filter noise).
 */
const MEMORABLE_EVENT_TYPES = new Set<GhostEventType>([
  'file.created',
  'file.deleted',
  'file.updated',
  'file.renamed',
  'chat.sent',
  'user.joined',
  'user.left',
  'branch.created',
  'branch.merged',
  'branch.switched',
  'runtime.started',
  'runtime.stopped',
  'runtime.build_completed',
  'runtime.build_failed',
])

export class WorkspaceMemoryService {
  constructor(
    private readonly redis: Redis,
    private readonly events: EventDispatcher
  ) {}

  /**
   * Start listening to all events and persisting them.
   * Call once during server bootstrap.
   */
  start(): void {
    this.events.onAny(async (event: GhostEvent) => {
      try {
        // Always persist to PostgreSQL for session replay
        await this.persistEvent(event)

        // Only push memorable events to Redis context window
        if (MEMORABLE_EVENT_TYPES.has(event.type)) {
          await this.pushToMemory(event)
        }
      } catch {
        // Non-fatal — memory/persistence should not break primary flows
      }
    })
  }

  /**
   * Retrieve recent context events for a workspace (from Redis).
   * Falls back to PostgreSQL if Redis is empty.
   */
  async getContext(workspaceId: string, limit = 20): Promise<GhostEvent[]> {
    const key = redisKey(workspaceId)
    const items = await this.redis.lrange(key, 0, limit - 1)
    if (items.length > 0) {
      return items.map(item => JSON.parse(item) as GhostEvent)
    }

    // Fallback to database
    const dbEvents = await db.event.findMany({
      where: { workspaceId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })
    return dbEvents.map((e: { id: string; type: string; workspaceId: string; actorId: string | null; timestamp: Date; payload: unknown }) => ({
      id: e.id,
      type: e.type as GhostEventType,
      workspaceId: e.workspaceId,
      actorId: e.actorId ?? undefined,
      timestamp: e.timestamp.toISOString(),
      payload: e.payload as Record<string, unknown>,
    }))
  }

  private async persistEvent(event: GhostEvent): Promise<void> {
    await db.event.create({
      data: {
        id: event.id,
        type: event.type,
        workspaceId: event.workspaceId,
        actorId: event.actorId,
        payload: event.payload,
        timestamp: new Date(event.timestamp),
      },
    })
  }

  private async pushToMemory(event: GhostEvent): Promise<void> {
    const key = redisKey(event.workspaceId)
    await this.redis.lpush(key, JSON.stringify(event))
    await this.redis.ltrim(key, 0, WINDOW_SIZE - 1)
    await this.redis.expire(key, REDIS_TTL_SECONDS)
  }
}

function redisKey(workspaceId: string): string {
  return `ghost:memory:${workspaceId}`
}
