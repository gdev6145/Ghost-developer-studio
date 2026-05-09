import type { Redis } from 'ioredis'
import type { GhostEvent } from '@ghost/protocol'

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

const MEMORY_WINDOW = 100  // maximum events retained per workspace
const MEMORY_TTL_SECONDS = 86_400  // 24 hours

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
    pipeline.zremrangebyrank(key, 0, -(MEMORY_WINDOW + 1))
    pipeline.expire(key, MEMORY_TTL_SECONDS)
    await pipeline.exec()
  }

  /**
   * Retrieve the most recent `limit` events for a workspace.
   * Returns events in ascending chronological order.
   */
  async getContext(workspaceId: string, limit = 20): Promise<GhostEvent[]> {
    const key = redisKey(workspaceId)
    const items = await this.redis.zrange(key, -limit, -1)
    return items.map(item => JSON.parse(item) as GhostEvent)
  }

  /**
   * Remove all memory for a workspace (e.g. on workspace deletion).
   */
  async clear(workspaceId: string): Promise<void> {
    await this.redis.del(redisKey(workspaceId))
  }
}
