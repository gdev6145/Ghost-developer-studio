import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { Redis } from 'ioredis'
import type { EventDispatcher } from '@ghost/events'
import type {
  WsMessage,
  WsDocumentUpdate,
  WsDocumentOpen,
  WsChatMessage,
} from '@ghost/protocol'
import { db } from '@ghost/database'
import { now } from '@ghost/shared'

/**
 * Collaboration WebSocket handler.
 *
 * All realtime messages flow through a single 'message' event to keep
 * the socket namespace clean and allow a unified type-narrowing switch.
 *
 * Message flow:
 *   Client emits 'message' with WsMessage payload
 *   → Handler narrows by type
 *   → Broadcasts to workspace room (excluding sender where appropriate)
 *   → Persists durable state (chat, files) to PostgreSQL
 *   → Emits domain events via eventBus
 */
export function setupCollaborationHandlers(
  io: SocketIOServer,
  redis: Redis,
  events: EventDispatcher
): void {
  io.on('connection', (socket: Socket) => {
    const userId = socket.data['userId'] as string

    socket.on('message', (msg: WsMessage) => {
      void handleMessage(socket, msg, userId, io, redis, events)
    })

    socket.on('disconnect', () => {
      void handleDisconnect(socket, userId, io, events)
    })
  })
}

async function handleMessage(
  socket: Socket,
  msg: WsMessage,
  userId: string,
  io: SocketIOServer,
  redis: Redis,
  events: EventDispatcher
): Promise<void> {
  const { workspaceId } = msg

  switch (msg.type) {
    // ─── Workspace Lifecycle ─────────────────────────────────────────────

    case 'workspace.join': {
      await socket.join(`workspace:${workspaceId}`)
      socket.data['workspaceId'] = workspaceId

      // Broadcast member join to room (excluding joiner)
      socket.to(`workspace:${workspaceId}`).emit('message', msg)

      // Send current workspace state to the joining client
      await sendWorkspaceState(socket, workspaceId)

      await events.dispatch('user.joined', workspaceId, msg.payload, userId)
      break
    }

    case 'workspace.leave': {
      await socket.leave(`workspace:${workspaceId}`)
      socket.to(`workspace:${workspaceId}`).emit('message', msg)
      await events.dispatch('user.left', workspaceId, msg.payload, userId)
      break
    }

    // ─── Document Collaboration ──────────────────────────────────────────

    case 'document.open': {
      const payload = msg.payload as WsDocumentOpen['payload']
      // Load Yjs state from database and send sync message back to client
      // Use fileId if present, otherwise fall back to path lookup
      const file = payload.fileId
        ? await db.file.findUnique({ where: { id: payload.fileId } })
        : await db.file.findUnique({
            where: { workspaceId_path: { workspaceId, path: payload.path } },
          })
      if (!file) {
        // Inform the client that the file was not found
        socket.emit('message', {
          type: 'error',
          workspaceId,
          actorId: 'server',
          timestamp: now(),
          payload: { code: 'FILE_NOT_FOUND', fileId: payload.fileId, path: payload.path },
        })
      } else if (file.content) {
        socket.emit('message', {
          type: 'document.sync',
          workspaceId,
          actorId: 'server',
          timestamp: now(),
          payload: {
            fileId: file.id,
            stateVector: '',
            update: Buffer.from(file.content).toString('base64'),
          },
        })
      }
      // Broadcast that user opened this file (for presence)
      socket.to(`workspace:${workspaceId}`).emit('message', msg)
      break
    }

    case 'document.update': {
      const updateMsg = msg as WsDocumentUpdate
      // Broadcast update to all other clients in the room
      socket.to(`workspace:${workspaceId}`).emit('message', updateMsg)

      // Persist Yjs binary update to database
      void persistDocumentUpdate(workspaceId, updateMsg.payload.fileId, updateMsg.payload.update)
      break
    }

    case 'document.close': {
      socket.to(`workspace:${workspaceId}`).emit('message', msg)
      break
    }

    // ─── Presence ────────────────────────────────────────────────────────

    case 'presence.cursor':
    case 'presence.selection':
    case 'presence.update': {
      // Broadcast to entire room including sender? No – clients update themselves.
      socket.to(`workspace:${workspaceId}`).emit('message', msg)
      break
    }

    // ─── Chat ────────────────────────────────────────────────────────────

    case 'chat.message': {
      const chatMsg = msg as WsChatMessage
      // Persist to database
      try {
        await db.chatMessage.create({
          data: {
            id: chatMsg.payload.messageId,
            workspaceId,
            authorId: userId,
            content: chatMsg.payload.content,
          },
        })
      } catch (e) {
        // Non-fatal – message still broadcasts
      }
      // Broadcast to room including sender (for confirmation)
      io.to(`workspace:${workspaceId}`).emit('message', chatMsg)
      await events.dispatch('chat.sent', workspaceId, chatMsg.payload, userId)
      break
    }

    case 'chat.typing': {
      socket.to(`workspace:${workspaceId}`).emit('message', msg)
      break
    }

    // ─── Runtime Control ─────────────────────────────────────────────────

    case 'runtime.start':
    case 'runtime.stop': {
      // Delegated to runtime handlers – re-emit as domain event
      await events.dispatch(
        msg.type === 'runtime.start' ? 'runtime.started' : 'runtime.stopped',
        workspaceId,
        msg.payload as Record<string, unknown>,
        userId
      )
      break
    }

    // ─── Branch / File ────────────────────────────────────────────────────

    case 'branch.switch':
    case 'file.created':
    case 'file.deleted':
    case 'file.renamed': {
      // Broadcast to all workspace members
      io.to(`workspace:${workspaceId}`).emit('message', msg)
      break
    }

    default:
      break
  }
}

async function handleDisconnect(
  socket: Socket,
  userId: string,
  io: SocketIOServer,
  events: EventDispatcher
): Promise<void> {
  const workspaceId = socket.data['workspaceId'] as string | undefined
  if (!workspaceId) return

  // Notify workspace that user went offline
  socket.to(`workspace:${workspaceId}`).emit('message', {
    type: 'presence.update',
    workspaceId,
    actorId: userId,
    timestamp: now(),
    payload: { userId, status: 'offline', color: '#6B7280' },
  })

  await events.dispatch('user.left', workspaceId, { userId }, userId)
}

async function sendWorkspaceState(socket: Socket, workspaceId: string): Promise<void> {
  const [workspace, files] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { include: { user: true } }, runtimeState: true },
    }),
    db.file.findMany({ where: { workspaceId }, select: { id: true, path: true, type: true } }),
  ])

  if (!workspace) return

  socket.emit('message', {
    type: 'workspace.state',
    workspaceId,
    actorId: 'server',
    timestamp: now(),
    payload: {
      members: workspace.members.map(m => ({
        userId: m.userId,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl ?? undefined,
      })),
      files,
      runtimeStatus: workspace.runtimeState?.status ?? 'idle',
    },
  })
}

async function persistDocumentUpdate(
  workspaceId: string,
  fileId: string,
  updateBase64: string
): Promise<void> {
  try {
    const binaryUpdate = Buffer.from(updateBase64, 'base64')
    await db.file.update({
      where: { id: fileId },
      data: { content: binaryUpdate, updatedAt: new Date() },
    })
  } catch {
    // File may not exist yet; create it
  }
}
