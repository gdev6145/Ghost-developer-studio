import { create } from 'zustand'
import type { RuntimeState } from '@ghost/protocol'

// ─── Runtime Store ────────────────────────────────────────────────────────────

interface RuntimeStoreState {
  status: RuntimeState['status']
  previewUrl: string | null
  buildLogs: string[]
  containerId: string | null
  isPreviewVisible: boolean

  // Actions
  setStatus: (status: RuntimeState['status']) => void
  setPreviewUrl: (url: string | null) => void
  appendLog: (line: string) => void
  clearLogs: () => void
  setContainerId: (id: string | null) => void
  togglePreview: () => void
  setPreviewVisible: (visible: boolean) => void
  applyRuntimeState: (state: Partial<RuntimeState>) => void
  reset: () => void
}

export const useRuntimeStore = create<RuntimeStoreState>()(set => ({
  status: 'idle',
  previewUrl: null,
  buildLogs: [],
  containerId: null,
  isPreviewVisible: false,

  setStatus: status => set({ status }),
  setPreviewUrl: previewUrl => set({ previewUrl }),

  appendLog: line =>
    set(state => ({
      buildLogs: [...state.buildLogs.slice(-999), line], // cap at 1000 lines
    })),

  clearLogs: () => set({ buildLogs: [] }),
  setContainerId: containerId => set({ containerId }),
  togglePreview: () => set(state => ({ isPreviewVisible: !state.isPreviewVisible })),
  setPreviewVisible: isPreviewVisible => set({ isPreviewVisible }),

  applyRuntimeState: runtimeState =>
    set(state => ({
      status: runtimeState.status ?? state.status,
      previewUrl: runtimeState.previewUrl ?? state.previewUrl,
      containerId: runtimeState.containerId ?? state.containerId,
    })),

  reset: () =>
    set({
      status: 'idle',
      previewUrl: null,
      buildLogs: [],
      containerId: null,
      isPreviewVisible: false,
    }),
}))
