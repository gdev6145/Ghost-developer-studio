import type { GhostEvent, GhostEventType } from '@ghost/protocol'
import { generateId, now } from '@ghost/shared'

type EventHandler<T extends GhostEvent = GhostEvent> = (event: T) => void | Promise<void>

/**
 * Internal event dispatcher (typed pub/sub).
 *
 * This bus handles events within a single process. For multi-process
 * fan-out, a Redis adapter should forward events from this bus to Redis
 * pub/sub so other instances can react.
 *
 * Architecture:
 *   Domain action
 *   → emits GhostEvent on EventDispatcher
 *   → local handlers run synchronously
 *   → RedisForwarder picks up & publishes to Redis channel
 *   → other server instances subscribe & re-emit locally
 */
export class EventDispatcher {
  private readonly handlers = new Map<GhostEventType, Set<EventHandler>>()
  private readonly wildcardHandlers = new Set<EventHandler>()

  /**
   * Subscribe to a specific event type.
   * Returns an unsubscribe function.
   */
  on<T extends GhostEvent>(type: GhostEventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    // Cast is safe – callers constrain T to match `type`
    this.handlers.get(type)!.add(handler as EventHandler)
    return () => this.off(type, handler as EventHandler)
  }

  /**
   * Subscribe to ALL events (wildcard).
   */
  onAny(handler: EventHandler): () => void {
    this.wildcardHandlers.add(handler)
    return () => this.wildcardHandlers.delete(handler)
  }

  /**
   * Remove a specific handler.
   */
  off(type: GhostEventType, handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler)
  }

  /**
   * Emit an event. Handlers are called in parallel.
   */
  async emit(event: GhostEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? new Set()
    const all = [...handlers, ...this.wildcardHandlers]
    await Promise.allSettled(all.map(h => h(event)))
  }

  /**
   * Convenience method: create and emit a typed event.
   */
  async dispatch(
    type: GhostEventType,
    workspaceId: string,
    payload: Record<string, unknown>,
    actorId?: string
  ): Promise<GhostEvent> {
    const event: GhostEvent = {
      id: generateId(),
      type,
      workspaceId,
      actorId,
      timestamp: now(),
      payload,
    }
    await this.emit(event)
    return event
  }

  /**
   * Remove all handlers (useful in tests).
   */
  removeAllListeners(): void {
    this.handlers.clear()
    this.wildcardHandlers.clear()
  }
}

/**
 * Singleton event dispatcher for the server process.
 * Packages should import and use this instance.
 */
export const eventBus = new EventDispatcher()
