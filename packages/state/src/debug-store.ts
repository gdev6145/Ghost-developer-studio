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

export const useDebugStore = create<DebugStoreState>()((set) => ({
  isPaused: false,
  breakpoints: [],

  setBreakpoint: bp =>
    set(state => {
      const existing = state.breakpoints.findIndex((b: Breakpoint) => b.id === bp.id)
      if (existing >= 0) {
        const updated = [...state.breakpoints]
        updated[existing] = bp
        return { breakpoints: updated }
      }
      return { breakpoints: [...state.breakpoints, bp] }
    }),

  clearBreakpoint: breakpointId =>
    set(state => ({
      breakpoints: state.breakpoints.filter((b: Breakpoint) => b.id !== breakpointId),
    })),

  clearAllBreakpoints: fileId =>
    set(state => ({
      breakpoints: fileId
        ? state.breakpoints.filter((b: Breakpoint) => b.fileId !== fileId)
        : [],
    })),

  setPaused: (pausedFileId, pausedLine, pausedReason) =>
    // exactOptionalPropertyTypes requires the cast since pausedReason may be undefined at callsite
    set({ isPaused: true, pausedFileId, pausedLine, ...(pausedReason !== undefined ? { pausedReason } : {}) } as Partial<DebugStoreState>),

  setResumed: () => {
    set(state => {
      const next = { ...state, isPaused: false }
      delete next.pausedFileId
      delete next.pausedLine
      delete next.pausedReason
      return next
    })
  },

  reset: () => {
    set(state => {
      const next = { ...state, isPaused: false, breakpoints: [] }
      delete next.pausedFileId
      delete next.pausedLine
      delete next.pausedReason
      return next
    })
  },
}))
