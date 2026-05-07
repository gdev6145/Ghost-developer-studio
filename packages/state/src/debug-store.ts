import { create } from 'zustand'
import type { DebugBreakpoint } from '@ghost/protocol'

// ─── Debug Store ─────────────────────────────────────────────────────────────

export interface DebugSession {
  sessionId: string
  fileId?: string
  isActive: boolean
  startedAt: string
}

interface DebugState {
  breakpoints: DebugBreakpoint[]
  activeSession: DebugSession | null

  // Actions
  setBreakpoint: (bp: DebugBreakpoint) => void
  removeBreakpoint: (breakpointId: string) => void
  syncBreakpoints: (breakpoints: DebugBreakpoint[]) => void
  startSession: (session: DebugSession) => void
  endSession: () => void
  toggleBreakpoint: (breakpointId: string) => void
  reset: () => void
}

export const useDebugStore = create<DebugState>()((set, get) => ({
  breakpoints: [],
  activeSession: null,

  setBreakpoint: bp =>
    set(state => {
      const idx = state.breakpoints.findIndex(b => b.id === bp.id)
      if (idx >= 0) {
        const updated = [...state.breakpoints]
        updated[idx] = bp
        return { breakpoints: updated }
      }
      return { breakpoints: [...state.breakpoints, bp] }
    }),

  removeBreakpoint: breakpointId =>
    set(state => ({
      breakpoints: state.breakpoints.filter(b => b.id !== breakpointId),
    })),

  syncBreakpoints: breakpoints => set({ breakpoints }),

  startSession: session => set({ activeSession: session }),

  endSession: () => set({ activeSession: null }),

  toggleBreakpoint: breakpointId =>
    set(state => ({
      breakpoints: state.breakpoints.map(b =>
        b.id === breakpointId ? { ...b, enabled: !b.enabled } : b
      ),
    })),

  reset: () => set({ breakpoints: [], activeSession: null }),
}))
