import { create } from 'zustand'
import type { Breakpoint, DebugState } from '@ghost/protocol'

// ─── Debug Store ─────────────────────────────────────────────────────────────

interface DebugStoreState extends DebugState {
  // Actions
  setBreakpoint: (bp: Breakpoint) => void
  clearBreakpoint: (breakpointId: string) => void
  clearAllBreakpoints: (fileId?: string) => void
  setPaused: (fileId: string, line: number, reason: DebugState['pausedReason']) => void
  setResumed: () => void
  reset: () => void
}

const initialState: DebugState = {
  isPaused: false,
  pausedFileId: undefined,
  pausedLine: undefined,
  pausedReason: undefined,
  breakpoints: [],
}

export const useDebugStore = create<DebugStoreState>()((set, get) => ({
  ...initialState,

  setBreakpoint: bp =>
    set(state => {
      const existing = state.breakpoints.findIndex(b => b.id === bp.id)
      if (existing >= 0) {
        const updated = [...state.breakpoints]
        updated[existing] = bp
        return { breakpoints: updated }
      }
      return { breakpoints: [...state.breakpoints, bp] }
    }),

  clearBreakpoint: breakpointId =>
    set(state => ({
      breakpoints: state.breakpoints.filter(b => b.id !== breakpointId),
    })),

  clearAllBreakpoints: fileId =>
    set(state => ({
      breakpoints: fileId
        ? state.breakpoints.filter(b => b.fileId !== fileId)
        : [],
    })),

  setPaused: (pausedFileId, pausedLine, pausedReason) =>
    set({ isPaused: true, pausedFileId, pausedLine, pausedReason }),

  setResumed: () =>
    set({ isPaused: false, pausedFileId: undefined, pausedLine: undefined, pausedReason: undefined }),

  reset: () => set(initialState),
}))
