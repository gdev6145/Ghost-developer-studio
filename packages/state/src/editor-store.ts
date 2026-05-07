import { create } from 'zustand'

// ─── Editor Store ─────────────────────────────────────────────────────────────

export interface EditorTab {
  fileId: string
  path: string
  name: string
  language: string
  isDirty: boolean
}

interface EditorState {
  /** Currently open tabs */
  tabs: EditorTab[]
  /** The tab currently visible in the editor pane */
  activeTabId: string | null
  /** Font size preference */
  fontSize: number
  /** Word wrap toggle */
  wordWrap: boolean

  // Actions
  openTab: (tab: EditorTab) => void
  closeTab: (fileId: string) => void
  setActiveTab: (fileId: string) => void
  markDirty: (fileId: string, dirty: boolean) => void
  setFontSize: (size: number) => void
  setWordWrap: (wrap: boolean) => void
  reset: () => void
}

export const useEditorStore = create<EditorState>()(set => ({
  tabs: [],
  activeTabId: null,
  fontSize: 14,
  wordWrap: false,

  openTab: tab =>
    set(state => {
      const exists = state.tabs.some(t => t.fileId === tab.fileId)
      return {
        tabs: exists ? state.tabs : [...state.tabs, tab],
        activeTabId: tab.fileId,
      }
    }),

  closeTab: fileId =>
    set(state => {
      const newTabs = state.tabs.filter(t => t.fileId !== fileId)
      const wasActive = state.activeTabId === fileId
      const newActiveId = wasActive
        ? (newTabs[newTabs.length - 1]?.fileId ?? null)
        : state.activeTabId
      return { tabs: newTabs, activeTabId: newActiveId }
    }),

  setActiveTab: fileId => set({ activeTabId: fileId }),

  markDirty: (fileId, dirty) =>
    set(state => ({
      tabs: state.tabs.map(t => (t.fileId === fileId ? { ...t, isDirty: dirty } : t)),
    })),

  setFontSize: fontSize => set({ fontSize }),
  setWordWrap: wordWrap => set({ wordWrap }),
  reset: () => set({ tabs: [], activeTabId: null }),
}))
