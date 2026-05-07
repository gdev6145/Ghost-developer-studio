import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { EventDispatcher } from '@ghost/events'
import type {
  WsDebugBreakpointSet,
  WsDebugBreakpointCleared,
  WsDebugPaused,
  WsDebugResumed,
  WsDebugStep,
} from '@ghost/protocol'
import { now } from '@ghost/shared'

/**
 * Debug handler — broadcasts collaborative debugging events across the workspace.
 *
 * Each workspace maintains a shared set of breakpoints. When a user sets a
 * breakpoint, it is broadcast to all members so they see the same breakpoints
 * (with the color of the user who set it).
 *
 * When execution pauses (e.g., from an attached debugger), all members are
 * notified so they can see the current execution point.
 */
export function setupDebugHandlers(
  io: SocketIOServer,
  events: EventDispatcher
): void {
  io.on('connection', (socket: Socket) => {
    socket.on('debug', (msg: Record<string, unknown>) => {
      void handleDebugMessage(socket, msg, io, events)
    })
  })
}

async function handleDebugMessage(
  socket: Socket,
  msg: Record<string, unknown>,
  io: SocketIOServer,
  events: EventDispatcher
): Promise<void> {
  const type = msg['type'] as string
  const workspaceId = msg['workspaceId'] as string
  const actorId = msg['actorId'] as string

  switch (type) {
    case 'debug.breakpoint_set': {
      const bpMsg = msg as WsDebugBreakpointSet
      // Broadcast to entire workspace (including sender for confirmation)
      io.to(`workspace:${workspaceId}`).emit('debug', bpMsg)
      await events.dispatch('debug.breakpoint_set', workspaceId, bpMsg.payload as Record<string, unknown>, actorId)
      break
    }

    case 'debug.breakpoint_cleared': {
      const bpMsg = msg as WsDebugBreakpointCleared
      io.to(`workspace:${workspaceId}`).emit('debug', bpMsg)
      await events.dispatch('debug.breakpoint_cleared', workspaceId, bpMsg.payload as Record<string, unknown>, actorId)
      break
    }

    case 'debug.paused': {
      const pauseMsg = msg as WsDebugPaused
      // Broadcast pause state to all workspace members
      io.to(`workspace:${workspaceId}`).emit('debug', pauseMsg)
      await events.dispatch('debug.paused', workspaceId, pauseMsg.payload as Record<string, unknown>, actorId)
      break
    }

    case 'debug.resumed': {
      const resumeMsg = msg as WsDebugResumed
      io.to(`workspace:${workspaceId}`).emit('debug', resumeMsg)
      await events.dispatch('debug.resumed', workspaceId, resumeMsg.payload as Record<string, unknown>, actorId)
      break
    }

    case 'debug.step': {
      const stepMsg = msg as WsDebugStep
      // Step commands are broadcast to allow all users to see execution flow
      io.to(`workspace:${workspaceId}`).emit('debug', stepMsg)
      break
    }

    default:
      break
  }
}
