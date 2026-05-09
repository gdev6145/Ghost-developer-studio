import { create } from 'zustand'

export interface TerminalSession {
  terminalId: string
  workspaceId: string
  /** Output lines accumulated from PTY */
  outputBuffer: string
  createdAt: string
  closed: boolean
  exitCode?: number
}

interface TerminalStore {
  sessions: Map<string, TerminalSession>

  // Actions
  createSession: (terminalId: string, workspaceId: string) => void
  appendOutput: (terminalId: string, data: string) => void
  closeSession: (terminalId: string, exitCode?: number) => void
  removeSession: (terminalId: string) => void
  activeTerminalId: string | null
  setActiveTerminal: (terminalId: string | null) => void
}

export const useTerminalStore = create<TerminalStore>((set, _get) => ({
  sessions: new Map(),
  activeTerminalId: null,

  createSession: (terminalId, workspaceId) => {
    set(state => {
      const next = new Map(state.sessions)
      next.set(terminalId, {
        terminalId,
        workspaceId,
        outputBuffer: '',
        createdAt: new Date().toISOString(),
        closed: false,
      })
      return { sessions: next, activeTerminalId: terminalId }
    })
  },

  appendOutput: (terminalId, data) => {
    set(state => {
      const session = state.sessions.get(terminalId)
      if (!session) return state
      const next = new Map(state.sessions)
      next.set(terminalId, { ...session, outputBuffer: session.outputBuffer + data })
      return { sessions: next }
    })
  },

    closeSession: (terminalId, exitCode) => {
      set(state => {
        const session = state.sessions.get(terminalId)
        if (!session) return state
        const next = new Map(state.sessions)
        const updatedSession: TerminalSession =
          exitCode === undefined ? { ...session, closed: true } : { ...session, closed: true, exitCode }
        next.set(terminalId, updatedSession)
        return { sessions: next }
      })
    },

  removeSession: (terminalId) => {
    set(state => {
      const next = new Map(state.sessions)
      next.delete(terminalId)

      let active = state.activeTerminalId
      if (active === terminalId) {
        active = next.size > 0 ? ([...next.keys()][0] ?? null) : null
      }

      return { sessions: next, activeTerminalId: active }
    })
  },

  setActiveTerminal: (terminalId) => set({ activeTerminalId: terminalId }),
}))
