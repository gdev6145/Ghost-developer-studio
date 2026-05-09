import { create } from 'zustand'

export interface Breakpoint {
  breakpointId: string
  fileId: string
  path: string
  line: number
  condition?: string
}

interface DebugStore {
  breakpoints: Map<string, Breakpoint>

  // Actions
  setBreakpoints: (breakpoints: Breakpoint[]) => void
  addBreakpoint: (bp: Breakpoint) => void
  removeBreakpoint: (breakpointId: string) => void
  clearAll: () => void
}

export const useDebugStore = create<DebugStore>(set => ({
  breakpoints: new Map(),

  setBreakpoints: (breakpoints) => {
    const next = new Map<string, Breakpoint>()
    breakpoints.forEach(bp => next.set(bp.breakpointId, bp))
    set({ breakpoints: next })
  },

  addBreakpoint: (bp) => {
    set(state => {
      const next = new Map(state.breakpoints)
      next.set(bp.breakpointId, bp)
      return { breakpoints: next }
    })
  },

  removeBreakpoint: (breakpointId) => {
    set(state => {
      const next = new Map(state.breakpoints)
      next.delete(breakpointId)
      return { breakpoints: next }
    })
  },

  clearAll: () => set({ breakpoints: new Map() }),
}))
