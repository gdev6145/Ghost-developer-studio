import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { IPty } from 'node-pty'
import { now } from '@ghost/shared'

/**
 * Terminal handler — multiplayer PTY sessions over Socket.IO.
 *
 * Each workspace can have multiple named terminal sessions.
 * All workspace members share the same PTY streams:
 *  - Any member can send input
 *  - Output is broadcast to the whole workspace room
 *
 * Sessions map key: `<workspaceId>:<terminalId>`
 *
 * Requires the `node-pty` native module (must be compiled for the
 * host platform with `npm rebuild node-pty`).
 */

// Map from sessionKey → IPty instance
const ptySessions = new Map<string, IPty>()

function sessionKey(workspaceId: string, terminalId: string): string {
  return `${workspaceId}:${terminalId}`
}

export function setupTerminalHandlers(io: SocketIOServer): void {
  io.on('connection', (socket: Socket) => {
    socket.on('message', (msg: Record<string, unknown>) => {
      const type = msg['type'] as string | undefined
      if (!type?.startsWith('terminal.')) return
      void handleTerminalMessage(socket, msg, io)
    })

    socket.on('disconnect', () => {
      // Terminal sessions persist after disconnect so others can reconnect.
      // Sessions are only cleaned up on explicit terminal.close.
    })
  })
}

async function handleTerminalMessage(
  socket: Socket,
  msg: Record<string, unknown>,
  io: SocketIOServer
): Promise<void> {
  const type = msg['type'] as string
  const workspaceId = msg['workspaceId'] as string
  const payload = (msg['payload'] ?? {}) as Record<string, unknown>

  switch (type) {
    case 'terminal.create': {
      const terminalId = payload['terminalId'] as string
      const cols = (payload['cols'] as number | undefined) ?? 80
      const rows = (payload['rows'] as number | undefined) ?? 24
      const shell = (payload['shell'] as string | undefined) ?? detectDefaultShell()
      const key = sessionKey(workspaceId, terminalId)

      if (ptySessions.has(key)) {
        // Reconnect: send nothing, client will receive subsequent output
        break
      }

      let pty: IPty
      try {
        // Dynamic import to gracefully degrade if node-pty is not compiled
        const nodePty = await import('node-pty')
        pty = nodePty.spawn(shell, [], {
          name: 'xterm-256color',
          cols,
          rows,
          cwd: process.cwd(),
          env: process.env as Record<string, string>,
        })
      } catch {
        socket.emit('message', {
          type: 'terminal.closed',
          workspaceId,
          actorId: 'server',
          timestamp: now(),
          payload: { terminalId, exitCode: -1 },
        })
        break
      }

      ptySessions.set(key, pty)

      // Broadcast PTY output to entire workspace room
      pty.onData((data: string) => {
        io.to(`workspace:${workspaceId}`).emit('message', {
          type: 'terminal.output',
          workspaceId,
          actorId: 'server',
          timestamp: now(),
          payload: { terminalId, data },
        })
      })

      pty.onExit(({ exitCode }: { exitCode: number }) => {
        ptySessions.delete(key)
        io.to(`workspace:${workspaceId}`).emit('message', {
          type: 'terminal.closed',
          workspaceId,
          actorId: 'server',
          timestamp: now(),
          payload: { terminalId, exitCode },
        })
      })

      break
    }

    case 'terminal.input': {
      const terminalId = payload['terminalId'] as string
      const data = payload['data'] as string
      const pty = ptySessions.get(sessionKey(workspaceId, terminalId))
      pty?.write(data)
      break
    }

    case 'terminal.resize': {
      const terminalId = payload['terminalId'] as string
      const cols = payload['cols'] as number
      const rows = payload['rows'] as number
      const pty = ptySessions.get(sessionKey(workspaceId, terminalId))
      pty?.resize(cols, rows)
      break
    }

    case 'terminal.close': {
      const terminalId = payload['terminalId'] as string
      const pty = ptySessions.get(sessionKey(workspaceId, terminalId))
      if (pty) {
        pty.kill()
        ptySessions.delete(sessionKey(workspaceId, terminalId))
      }
      break
    }

    default:
      break
  }
}

function detectDefaultShell(): string {
  if (process.platform === 'win32') return 'powershell.exe'
  return process.env['SHELL'] ?? '/bin/bash'
}
