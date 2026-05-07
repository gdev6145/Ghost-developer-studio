import { create } from 'zustand'
import type { TerminalSession } from '@ghost/protocol'

// ─── Terminal Store ───────────────────────────────────────────────────────────

interface TerminalState {
  /** Active terminal sessions */
  terminals: TerminalSession[]
  /** Currently focused terminal ID */
  activeTerminalId: string | null
  /** Whether the terminal panel is visible */
  isOpen: boolean

  // Actions
  addTerminal: (terminal: TerminalSession) => void
  removeTerminal: (terminalId: string) => void
  setActiveTerminal: (terminalId: string | null) => void
  setOpen: (open: boolean) => void
  reset: () => void
}

const initialState = {
  terminals: [] as TerminalSession[],
  activeTerminalId: null as string | null,
  isOpen: false,
}

export const useTerminalStore = create<TerminalState>()((set, get) => ({
  ...initialState,

  addTerminal: terminal =>
    set(state => {
      const exists = state.terminals.some(t => t.id === terminal.id)
      if (exists) return {}
      return {
        terminals: [...state.terminals, terminal],
        activeTerminalId: terminal.id,
        isOpen: true,
      }
    }),

  removeTerminal: terminalId =>
    set(state => {
      const remaining = state.terminals.filter(t => t.id !== terminalId)
      const newActive =
        state.activeTerminalId === terminalId
          ? (remaining[remaining.length - 1]?.id ?? null)
          : state.activeTerminalId
      return {
        terminals: remaining,
        activeTerminalId: newActive,
        isOpen: remaining.length > 0 ? state.isOpen : false,
      }
    }),

  setActiveTerminal: terminalId => set({ activeTerminalId: terminalId }),

  setOpen: isOpen => set({ isOpen }),

  reset: () => set(initialState),
}))
