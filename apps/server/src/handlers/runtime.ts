import type { Server as SocketIOServer } from 'socket.io'
import type { EventDispatcher } from '@ghost/events'
import { RuntimeManager } from '@ghost/runtime'
import { now } from '@ghost/shared'
import type { RuntimeState } from '@ghost/protocol'

/**
 * Runtime handler — wires EventDispatcher events to Socket.IO broadcasts.
 *
 * When a runtime event fires (e.g., 'runtime.started'), this broadcasts
 * a typed websocket message to the relevant workspace room.
 */
export function setupRuntimeHandlers(io: SocketIOServer, events: EventDispatcher): void {
  // Broadcast runtime status changes
  events.on('runtime.started', async event => {
    io.to(`workspace:${event.workspaceId}`).emit('message', {
      type: 'runtime.status',
      workspaceId: event.workspaceId,
      actorId: 'server',
      timestamp: now(),
      payload: {
        status: 'running' as RuntimeState['status'],
        containerId: event.payload['containerId'],
        previewUrl: event.payload['previewUrl'],
      },
    })

    io.to(`workspace:${event.workspaceId}`).emit('message', {
      type: 'preview.url',
      workspaceId: event.workspaceId,
      actorId: 'server',
      timestamp: now(),
      payload: { url: event.payload['previewUrl'] as string },
    })
  })

  events.on('runtime.stopped', async event => {
    io.to(`workspace:${event.workspaceId}`).emit('message', {
      type: 'runtime.status',
      workspaceId: event.workspaceId,
      actorId: 'server',
      timestamp: now(),
      payload: { status: 'stopped' as RuntimeState['status'] },
    })
  })

  events.on('runtime.error', async event => {
    io.to(`workspace:${event.workspaceId}`).emit('message', {
      type: 'runtime.status',
      workspaceId: event.workspaceId,
      actorId: 'server',
      timestamp: now(),
      payload: { status: 'error' as RuntimeState['status'] },
    })
  })

  events.on('runtime.build_started', async event => {
    io.to(`workspace:${event.workspaceId}`).emit('message', {
      type: 'runtime.status',
      workspaceId: event.workspaceId,
      actorId: 'server',
      timestamp: now(),
      payload: { status: 'building' as RuntimeState['status'] },
    })
  })

  // When a file is updated, optionally trigger a container rebuild
  // This is triggered by the collaboration handler when a file save occurs.
  // The rebuild logic lives in the RuntimeManager; this handler just wires events.
  events.on('file.updated', async event => {
    // Rebuild is opt-in per workspace (configured via workspace settings)
    // For now, we emit a preview refresh signal
    io.to(`workspace:${event.workspaceId}`).emit('message', {
      type: 'preview.refresh',
      workspaceId: event.workspaceId,
      actorId: 'server',
      timestamp: now(),
      payload: {},
    })
  })
}
