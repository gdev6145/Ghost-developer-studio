import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { EventDispatcher } from '@ghost/events'
import type { WsDebugBreakpoint } from '@ghost/protocol'
import { now } from '@ghost/shared'

/**
 * Collaborative debugging handler — shared breakpoints via workspace events.
 *
 * All workspace members see the same breakpoints in real time.
 * The server acts as the source of truth: it stores the current breakpoint
 * set and broadcasts it to joining clients.
 *
 * Message flow:
 *   Client emits  `debug.breakpoint.set` or `debug.breakpoint.clear`
 *   → Server updates workspace breakpoint state
 *   → Broadcasts `debug.state` to entire workspace room
 *
 * On join the server sends the current `debug.state` to the new socket.
 */

type Breakpoint = WsDebugBreakpoint & { breakpointId: string }

// Map from workspaceId → current set of breakpoints
const workspaceBreakpoints = new Map<string, Map<string, Breakpoint>>()

function getBreakpoints(workspaceId: string): Map<string, Breakpoint> {
  if (!workspaceBreakpoints.has(workspaceId)) {
    workspaceBreakpoints.set(workspaceId, new Map())
  }
  return workspaceBreakpoints.get(workspaceId)!
}

function broadcastDebugState(workspaceId: string, io: SocketIOServer): void {
  const breakpoints = Array.from(getBreakpoints(workspaceId).values())
  io.to(`workspace:${workspaceId}`).emit('message', {
    type: 'debug.state',
    workspaceId,
    actorId: 'server',
    timestamp: now(),
    payload: { breakpoints },
  })
}

export function setupDebugHandlers(io: SocketIOServer, events: EventDispatcher): void {
  io.on('connection', (socket: Socket) => {
    socket.on('message', (msg: Record<string, unknown>) => {
      const type = msg['type'] as string | undefined
      if (!type?.startsWith('debug.')) return
      void handleDebugMessage(socket, msg, io, events)
    })

    // When a client joins a workspace room, send them the current debug state
    socket.on('message', (msg: Record<string, unknown>) => {
      if (msg['type'] === 'workspace.join') {
        const workspaceId = msg['workspaceId'] as string
        const breakpoints = Array.from(getBreakpoints(workspaceId).values())
        socket.emit('message', {
          type: 'debug.state',
          workspaceId,
          actorId: 'server',
          timestamp: now(),
          payload: { breakpoints },
        })
      }
    })
  })
}

function handleDebugMessage(
  socket: Socket,
  msg: Record<string, unknown>,
  io: SocketIOServer,
  events: EventDispatcher
): Promise<void> {
  const type = msg['type'] as string
  const workspaceId = msg['workspaceId'] as string
  const payload = (msg['payload'] ?? {}) as Record<string, unknown>
  const actorId = socket.data['userId'] as string | undefined

  switch (type) {
    case 'debug.breakpoint.set': {
      const breakpointId = payload['breakpointId'] as string
      const bp: Breakpoint = {
        breakpointId,
        fileId: payload['fileId'] as string,
        path: payload['path'] as string,
        line: payload['line'] as number,
        ...(payload['condition'] ? { condition: payload['condition'] as string } : {}),
      }
      getBreakpoints(workspaceId).set(breakpointId, bp)
      broadcastDebugState(workspaceId, io)
      return events.dispatch('debug.breakpoint_set', workspaceId, bp, actorId)
    }

    case 'debug.breakpoint.clear': {
      const breakpointId = payload['breakpointId'] as string
      getBreakpoints(workspaceId).delete(breakpointId)
      broadcastDebugState(workspaceId, io)
      return events.dispatch('debug.breakpoint_clear', workspaceId, { breakpointId }, actorId)
    }

    default:
      return Promise.resolve()
  }
}
