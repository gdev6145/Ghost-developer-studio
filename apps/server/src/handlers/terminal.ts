import type { Server as SocketIOServer, Socket } from 'socket.io'
import * as pty from 'node-pty'
import type {
  WsTerminalCreate,
  WsTerminalInput,
  WsTerminalResize,
  WsTerminalClose,
} from '@ghost/protocol'
import { generateId, now } from '@ghost/shared'

interface ManagedTerminal {
  ptyProcess: pty.IPty
  terminalId: string
  workspaceId: string
  ownerSocketId: string
}

/**
 * Terminal handler — multiplayer PTY over Socket.IO.
 *
 * Each terminal is owned by one socket but its output is broadcast
 * to the full workspace room so all collaborators can view it.
 *
 * Security note: PTY processes are killed when the owning socket disconnects.
 * Input is only accepted from the workspace room members (auth enforced upstream).
 */
export function setupTerminalHandlers(io: SocketIOServer): void {
  const terminals = new Map<string, ManagedTerminal>()

  io.on('connection', (socket: Socket) => {
    socket.on('terminal', (msg: WsTerminalCreate | WsTerminalInput | WsTerminalResize | WsTerminalClose) => {
      void handleTerminalMessage(socket, msg, io, terminals)
    })

    socket.on('disconnect', () => {
      cleanupSocketTerminals(socket.id, terminals, io)
    })
  })
}

async function handleTerminalMessage(
  socket: Socket,
  msg: WsTerminalCreate | WsTerminalInput | WsTerminalResize | WsTerminalClose,
  io: SocketIOServer,
  terminals: Map<string, ManagedTerminal>
): Promise<void> {
  const { workspaceId } = msg

  switch (msg.type) {
    case 'terminal.create': {
      const payload = (msg as WsTerminalCreate).payload
      const terminalId = payload.terminalId || generateId()
      const shell = payload.shell ?? (process.platform === 'win32' ? 'cmd.exe' : 'bash')

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: payload.cols,
        rows: payload.rows,
        cwd: process.env['WORKSPACE_ROOT'] ? `${process.env['WORKSPACE_ROOT']}/${workspaceId}` : process.cwd(),
        env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
      })

      terminals.set(terminalId, {
        ptyProcess,
        terminalId,
        workspaceId,
        ownerSocketId: socket.id,
      })

      // Stream PTY output to entire workspace room
      ptyProcess.onData(data => {
        io.to(`workspace:${workspaceId}`).emit('terminal', {
          type: 'terminal.output',
          workspaceId,
          actorId: 'server',
          timestamp: now(),
          payload: { terminalId, data },
        })
      })

      ptyProcess.onExit(() => {
        terminals.delete(terminalId)
        io.to(`workspace:${workspaceId}`).emit('terminal', {
          type: 'terminal.close',
          workspaceId,
          actorId: 'server',
          timestamp: now(),
          payload: { terminalId },
        })
      })

      // Confirm creation back to the workspace
      io.to(`workspace:${workspaceId}`).emit('terminal', {
        type: 'terminal.create',
        workspaceId,
        actorId: socket.data['userId'] as string,
        timestamp: now(),
        payload: { terminalId, cols: payload.cols, rows: payload.rows },
      })
      break
    }

    case 'terminal.input': {
      const payload = (msg as WsTerminalInput).payload
      const term = terminals.get(payload.terminalId)
      if (term) {
        term.ptyProcess.write(payload.data)
      }
      break
    }

    case 'terminal.resize': {
      const payload = (msg as WsTerminalResize).payload
      const term = terminals.get(payload.terminalId)
      if (term) {
        term.ptyProcess.resize(payload.cols, payload.rows)
        // Broadcast resize to room so all viewers can adapt
        socket.to(`workspace:${workspaceId}`).emit('terminal', {
          type: 'terminal.resize',
          workspaceId,
          actorId: socket.data['userId'] as string,
          timestamp: now(),
          payload,
        })
      }
      break
    }

    case 'terminal.close': {
      const payload = (msg as WsTerminalClose).payload
      const term = terminals.get(payload.terminalId)
      if (term) {
        term.ptyProcess.kill()
        terminals.delete(payload.terminalId)
      }
      break
    }
  }
}

function cleanupSocketTerminals(
  socketId: string,
  terminals: Map<string, ManagedTerminal>,
  io: SocketIOServer
): void {
  for (const [terminalId, term] of terminals) {
    if (term.ownerSocketId === socketId) {
      try {
        term.ptyProcess.kill()
      } catch {
        // PTY may already be dead
      }
      terminals.delete(terminalId)
      io.to(`workspace:${term.workspaceId}`).emit('terminal', {
        type: 'terminal.close',
        workspaceId: term.workspaceId,
        actorId: 'server',
        timestamp: now(),
        payload: { terminalId },
      })
    }
  }
}
