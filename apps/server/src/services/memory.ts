import type { Redis } from 'ioredis'
import type { GhostEvent } from '@ghost/protocol'
import { db } from '@ghost/database'

/**
 * WorkspaceMemoryService — rolling event window stored in Redis.
 *
 * Each workspace gets a sorted set keyed by `memory:<workspaceId>`.
 * Events are stored as JSON values scored by Unix timestamp (ms).
 * The window is capped at MEMORY_WINDOW entries; older events are pruned.
 * A 24-hour TTL prevents memory from accumulating for inactive workspaces.
 *
 * This context window is consumed by the AI pair programming feature to give
 * the model awareness of recent workspace activity (file edits, chat, etc.).
 */

/** Maximum events retained per workspace in the rolling window */
const MAX_MEMORY_WINDOW_EVENTS = Number(process.env['MAX_MEMORY_WINDOW_EVENTS'] ?? '100')
const MEMORY_TTL_SECONDS = Number(process.env['MEMORY_TTL_SECONDS'] ?? '86400') // 24 hours
const DURABLE_MEMORY_CONTEXT_LIMIT = Number(process.env['DURABLE_MEMORY_CONTEXT_LIMIT'] ?? '20')

const DURABLE_MEMORY_TYPES = [
  'memory.decision',
  'memory.bug_fix',
  'memory.failed_experiment',
  'memory.convention',
  'memory.incident',
  'memory.code_owner',
] as const

export type WorkspaceMemoryCategory =
  | 'decision'
  | 'bug_fix'
  | 'failed_experiment'
  | 'convention'
  | 'incident'
  | 'code_owner'

function categoryToEventType(category: WorkspaceMemoryCategory): (typeof DURABLE_MEMORY_TYPES)[number] {
  return `memory.${category}` as (typeof DURABLE_MEMORY_TYPES)[number]
}

function eventTypeToCategory(type: string): WorkspaceMemoryCategory | null {
  if (!type.startsWith('memory.')) return null
  const category = type.replace('memory.', '')
  if (
    category === 'decision' ||
    category === 'bug_fix' ||
    category === 'failed_experiment' ||
    category === 'convention' ||
    category === 'incident' ||
    category === 'code_owner'
  ) {
    return category
  }
  return null
}

function redisKey(workspaceId: string): string {
  return `memory:${workspaceId}`
}

export class WorkspaceMemoryService {
  constructor(private readonly redis: Redis) {}

  /**
   * Persist an event to the workspace rolling window.
   * Automatically prunes entries beyond the window size.
   */
  async push(event: GhostEvent): Promise<void> {
    const key = redisKey(event.workspaceId)
    const score = Date.now()
    const value = JSON.stringify(event)

    const pipeline = this.redis.pipeline()
    pipeline.zadd(key, score, value)
    // Keep only the newest MEMORY_WINDOW entries
    pipeline.zremrangebyrank(key, 0, -(MAX_MEMORY_WINDOW_EVENTS + 1))
    pipeline.expire(key, MEMORY_TTL_SECONDS)
    await pipeline.exec()
  }

  /**
   * Retrieve the most recent `limit` events for a workspace.
   * Returns events in ascending chronological order.
   */
  async getContext(workspaceId: string, limit = 20): Promise<GhostEvent[]> {
    const key = redisKey(workspaceId)
    const [items, durableEntries] = await Promise.all([
      this.redis.zrange(key, -limit, -1),
      db.event.findMany({
        where: {
          workspaceId,
          type: { in: [...DURABLE_MEMORY_TYPES] },
        },
        orderBy: { timestamp: 'desc' },
        take: Math.min(limit, DURABLE_MEMORY_CONTEXT_LIMIT),
      }),
    ])

    const redisEvents = items.map(item => JSON.parse(item) as GhostEvent)
    const durableEvents = durableEntries
      .map(event => ({
        id: event.id,
        type: event.type as GhostEvent['type'],
        workspaceId: event.workspaceId,
        actorId: event.actorId ?? undefined,
        timestamp: event.timestamp.toISOString(),
        payload: event.payload as Record<string, unknown>,
      }))
      .reverse()

    return [...durableEvents, ...redisEvents].slice(-limit)
  }

  /**
   * Remove all memory for a workspace (e.g. on workspace deletion).
   */
  async clear(workspaceId: string): Promise<void> {
    await this.redis.del(redisKey(workspaceId))
  }

  async addKnowledge(
    workspaceId: string,
    actorId: string,
    input: {
      category: WorkspaceMemoryCategory
      title: string
      detail: string
      tags?: string[]
      relatedEntity?: string
      severity?: 'low' | 'medium' | 'high'
    }
  ): Promise<{ id: string }> {
    const event = await db.event.create({
      data: {
        workspaceId,
        actorId,
        type: categoryToEventType(input.category),
        payload: {
          title: input.title,
          detail: input.detail,
          tags: input.tags ?? [],
          relatedEntity: input.relatedEntity ?? null,
          severity: input.severity ?? null,
        },
      },
    })
    return { id: event.id }
  }

  async getKnowledge(
    workspaceId: string,
    options: { category?: WorkspaceMemoryCategory; limit?: number } = {}
  ): Promise<
    Array<{
      id: string
      category: WorkspaceMemoryCategory
      actorId: string | null
      title: string
      detail: string
      tags: string[]
      relatedEntity: string | null
      severity: 'low' | 'medium' | 'high' | null
      timestamp: string
    }>
  > {
    const events = await db.event.findMany({
      where: {
        workspaceId,
        type: options.category
          ? categoryToEventType(options.category)
          : { in: [...DURABLE_MEMORY_TYPES] },
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(options.limit ?? 50, 200),
    })

    return events
      .map(event => {
        const payload = event.payload as Record<string, unknown>
        const category = eventTypeToCategory(event.type)
        if (!category) return null
        return {
          id: event.id,
          category,
          actorId: event.actorId,
          title: String(payload['title'] ?? ''),
          detail: String(payload['detail'] ?? ''),
          tags: Array.isArray(payload['tags']) ? payload['tags'].map(t => String(t)) : [],
          relatedEntity: payload['relatedEntity'] ? String(payload['relatedEntity']) : null,
          severity:
            payload['severity'] === 'low' ||
            payload['severity'] === 'medium' ||
            payload['severity'] === 'high'
              ? payload['severity']
              : null,
          timestamp: event.timestamp.toISOString(),
        }
      })
      .filter((value): value is NonNullable<typeof value> => value !== null)
  }

  getPolicy(): { maxWindowEvents: number; ttlSeconds: number; durableMemoryLimit: number } {
    return {
      maxWindowEvents: MAX_MEMORY_WINDOW_EVENTS,
      ttlSeconds: MEMORY_TTL_SECONDS,
      durableMemoryLimit: DURABLE_MEMORY_CONTEXT_LIMIT,
    }
  }
}
