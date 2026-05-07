import type { Server as SocketIOServer } from 'socket.io'
import type { EventDispatcher } from '@ghost/events'
import { db } from '@ghost/database'
import { now } from '@ghost/shared'

/**
 * Event persistence handler — subscribes to all domain events on the event bus
 * and writes them to the `events` table for session replay.
 *
 * This is the "events are persisted; replay is an event consumer" pattern
 * described in the future roadmap.
 *
 * Each event row captures: workspaceId, actorId, type, payload, timestamp.
 */
export function setupEventPersistence(events: EventDispatcher): void {
  events.onAny(async event => {
    try {
      await db.event.create({
        data: {
          id: event.id,
          workspaceId: event.workspaceId,
          actorId: event.actorId ?? null,
          type: event.type,
          payload: event.payload as object,
          timestamp: new Date(event.timestamp),
        },
      })
    } catch {
      // Non-fatal – persistence failure should not disrupt realtime flow
    }
  })
}

/**
 * Replay a workspace session.
 *
 * Fetches all events in the requested time window and emits them
 * via the `replay.tick` websocket message with the configured speed multiplier.
 *
 * @param io     Socket.IO server instance
 * @param workspaceId  Target workspace
 * @param replayId     Client-generated replay session ID
 * @param fromTs   ISO timestamp — start of replay window
 * @param toTs     ISO timestamp — end of replay window
 * @param speed    Playback speed multiplier (1 = real-time, 2 = 2× etc.)
 */
export async function replayWorkspaceSession(
  io: SocketIOServer,
  workspaceId: string,
  replayId: string,
  fromTs: string,
  toTs: string,
  speed: number
): Promise<void> {
  const events = await db.event.findMany({
    where: {
      workspaceId,
      timestamp: {
        gte: new Date(fromTs),
        lte: new Date(toTs),
      },
    },
    orderBy: { timestamp: 'asc' },
  })

  // Announce replay start
  io.to(`workspace:${workspaceId}`).emit('message', {
    type: 'replay.start',
    workspaceId,
    actorId: 'server',
    timestamp: now(),
    payload: { replayId, fromTimestamp: fromTs, toTimestamp: toTs, speed },
  })

  // Emit each event as a replay.tick, honouring inter-event delays scaled by speed
  let prevTimestamp: Date | null = null
  for (const event of events) {
    if (prevTimestamp) {
      const realDelay = event.timestamp.getTime() - prevTimestamp.getTime()
      const scaledDelay = Math.min(realDelay / speed, 5000) // cap at 5 s
      if (scaledDelay > 0) {
        await sleep(scaledDelay)
      }
    }
    prevTimestamp = event.timestamp

    io.to(`workspace:${workspaceId}`).emit('message', {
      type: 'replay.tick',
      workspaceId,
      actorId: 'server',
      timestamp: now(),
      payload: {
        replayId,
        eventId: event.id,
        eventType: event.type,
        timestamp: event.timestamp.toISOString(),
        actorId: event.actorId ?? undefined,
        data: event.payload as Record<string, unknown>,
      },
    })
  }

  // Announce replay end
  io.to(`workspace:${workspaceId}`).emit('message', {
    type: 'replay.end',
    workspaceId,
    actorId: 'server',
    timestamp: now(),
    payload: { replayId, totalEvents: events.length },
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
