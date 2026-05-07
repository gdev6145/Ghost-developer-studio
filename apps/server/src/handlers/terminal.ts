import type { Server as SocketIOServer, Socket } from 'socket.io'
import type { EventDispatcher } from '@ghost/events'
import type { WsTerminalCreate, WsTerminalData, WsTerminalResize, WsTerminalClose } from '@ghost/protocol'
import { generateId, now } from '@ghost/shared'

// node-pty is an optional native module — import lazily to avoid crashes when
// build tools are not present (e.g., during tests or lightweight CI).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IPty = { write: (data: string) => void; resize: (cols: number, rows: number) => void; kill: () => void; onData: (cb: (data: string) => void) => void; onExit: (cb: (e: { exitCode: number }) => void) => void }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodePty = { spawn: (shell: string, args: string[], opts: Record<string, unknown>) => IPty }

let pty: NodePty | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pty = require('node-pty') as NodePty
} catch {
  console.warn('[terminal] node-pty not available — terminal feature disabled')
}

/** Active PTY processes keyed by terminalId */
const activePtys = new Map<string, IPty>()

/**
 * Terminal handler — manages PTY processes over Socket.IO.
 *
 * One PTY per terminal session. The terminal session is owned by the socket
 * that created it and cleaned up on disconnect.
 *
 * Message flow:
 *   Client emits terminal.create → spawn PTY → send back terminal.data
 *   Client emits terminal.data  → write to PTY stdin
 *   Client emits terminal.resize → resize PTY
 *   Client emits terminal.close → kill PTY
 */
export function setupTerminalHandlers(
  io: SocketIOServer,
  events: EventDispatcher
): void {
  io.on('connection', (socket: Socket) => {
    /** Terminal IDs owned by this socket for cleanup on disconnect */
    const socketTerminals = new Set<string>()

    socket.on('terminal', (msg: Record<string, unknown>) => {
      void handleTerminalMessage(socket, msg, socketTerminals, events)
    })

    socket.on('disconnect', () => {
      for (const terminalId of socketTerminals) {
        killTerminal(terminalId, socket, events)
      }
      socketTerminals.clear()
    })
  })
}

async function handleTerminalMessage(
  socket: Socket,
  msg: Record<string, unknown>,
  socketTerminals: Set<string>,
  events: EventDispatcher
): Promise<void> {
  const type = msg['type'] as string
  const workspaceId = msg['workspaceId'] as string
  const actorId = msg['actorId'] as string

  switch (type) {
    case 'terminal.create': {
      if (!pty) {
        socket.emit('terminal', {
          type: 'error',
          workspaceId,
          actorId: 'server',
          timestamp: now(),
          payload: { code: 'TERMINAL_UNAVAILABLE', message: 'PTY not available on this server' },
        })
        return
      }

      const { terminalId, cols = 80, rows = 24, shell } = (msg as WsTerminalCreate).payload
      const resolvedShell = shell ?? (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash')

      try {
        const proc = pty.spawn(resolvedShell, [], {
          name: 'xterm-color',
          cols,
          rows,
          cwd: process.env['HOME'] ?? '/tmp',
          env: process.env,
        })

        activePtys.set(terminalId, proc)
        socketTerminals.add(terminalId)

        // Stream PTY output → client
        proc.onData((data: string) => {
          socket.emit('terminal', {
            type: 'terminal.data',
            workspaceId,
            actorId: 'server',
            timestamp: now(),
            payload: { terminalId, data: Buffer.from(data).toString('base64') },
          } satisfies WsTerminalData)
        })

        // PTY process exit → notify client
        proc.onExit(({ exitCode }: { exitCode: number }) => {
          activePtys.delete(terminalId)
          socketTerminals.delete(terminalId)
          socket.emit('terminal', {
            type: 'terminal.exit',
            workspaceId,
            actorId: 'server',
            timestamp: now(),
            payload: { terminalId, exitCode },
          })
        })

        await events.dispatch('terminal.created', workspaceId, { terminalId }, actorId)
      } catch (err) {
        socket.emit('terminal', {
          type: 'error',
          workspaceId,
          actorId: 'server',
          timestamp: now(),
          payload: { code: 'TERMINAL_SPAWN_FAILED', message: String(err) },
        })
      }
      break
    }

    case 'terminal.data': {
      const { terminalId, data } = (msg as WsTerminalData).payload
      const proc = activePtys.get(terminalId)
      if (proc) {
        // data is raw input from the user (not base64 for input)
        proc.write(data)
      }
      break
    }

    case 'terminal.resize': {
      const { terminalId, cols, rows } = (msg as WsTerminalResize).payload
      const proc = activePtys.get(terminalId)
      if (proc) {
        proc.resize(cols, rows)
      }
      break
    }

    case 'terminal.close': {
      const { terminalId } = (msg as WsTerminalClose).payload
      killTerminal(terminalId, socket, events)
      socketTerminals.delete(terminalId)
      break
    }

    default:
      break
  }
}

function killTerminal(terminalId: string, socket: Socket, events: EventDispatcher): void {
  const proc = activePtys.get(terminalId)
  if (!proc) return
  try {
    proc.kill()
  } catch {
    // Process may have already exited
  }
  activePtys.delete(terminalId)
  const workspaceId = socket.data['workspaceId'] as string | undefined
  if (workspaceId) {
    void events.dispatch('terminal.closed', workspaceId, { terminalId }, socket.data['userId'] as string)
  }
}
