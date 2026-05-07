import { create } from 'zustand'

// ─── Terminal Store ───────────────────────────────────────────────────────────

export interface TerminalTab {
  terminalId: string
  title: string
  isActive: boolean
}

interface TerminalState {
  terminals: TerminalTab[]
  activeTerminalId: string | null

  // Actions
  addTerminal: (terminal: TerminalTab) => void
  removeTerminal: (terminalId: string) => void
  setActiveTerminal: (terminalId: string) => void
  reset: () => void
}

export const useTerminalStore = create<TerminalState>()((set, get) => ({
  terminals: [],
  activeTerminalId: null,

  addTerminal: terminal =>
    set(state => ({
      terminals: [...state.terminals, terminal],
      activeTerminalId: terminal.terminalId,
    })),

  removeTerminal: terminalId =>
    set(state => {
      const remaining = state.terminals.filter(t => t.terminalId !== terminalId)
      const activeId =
        state.activeTerminalId === terminalId
          ? (remaining[remaining.length - 1]?.terminalId ?? null)
          : state.activeTerminalId
      return { terminals: remaining, activeTerminalId: activeId }
    }),

  setActiveTerminal: terminalId => set({ activeTerminalId: terminalId }),

  reset: () => set({ terminals: [], activeTerminalId: null }),
}))
