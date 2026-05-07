import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Workspace, WorkspaceMember, FileNode, Branch, RuntimeState } from '@ghost/protocol'

// ─── Workspace Store ─────────────────────────────────────────────────────────

interface WorkspaceState {
  // Current workspace
  workspace: Workspace | null
  isLoading: boolean
  error: string | null

  // File tree
  files: FileNode[]

  // Active branch
  activeBranch: Branch | null
  branches: Branch[]

  // Actions
  setWorkspace: (workspace: Workspace | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setFiles: (files: FileNode[]) => void
  addFile: (file: FileNode) => void
  removeFile: (fileId: string) => void
  updateFile: (fileId: string, patch: Partial<FileNode>) => void
  setActiveBranch: (branch: Branch) => void
  setBranches: (branches: Branch[]) => void
  addMember: (member: WorkspaceMember) => void
  removeMember: (userId: string) => void
  updateRuntimeState: (runtime: Partial<RuntimeState>) => void
  reset: () => void
}

const initialState = {
  workspace: null as Workspace | null,
  isLoading: false,
  error: null as string | null,
  files: [] as FileNode[],
  activeBranch: null as Branch | null,
  branches: [] as Branch[],
}

export const useWorkspaceStore = create<WorkspaceState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setWorkspace: workspace => set({ workspace }),
    setLoading: isLoading => set({ isLoading }),
    setError: error => set({ error }),
    setFiles: files => set({ files }),

    addFile: file =>
      set(state => ({
        files: [...state.files, file],
      })),

    removeFile: fileId =>
      set(state => ({
        files: state.files.filter(f => f.id !== fileId),
      })),

    updateFile: (fileId, patch) =>
      set(state => ({
        files: state.files.map(f => (f.id === fileId ? { ...f, ...patch } : f)),
      })),

    setActiveBranch: activeBranch => set({ activeBranch }),
    setBranches: branches => set({ branches }),

    addMember: member =>
      set(state => {
        if (!state.workspace) return {}
        const exists = state.workspace.members.some(m => m.userId === member.userId)
        if (exists) return {}
        return {
          workspace: {
            ...state.workspace,
            members: [...state.workspace.members, member],
          },
        }
      }),

    removeMember: userId =>
      set(state => {
        if (!state.workspace) return {}
        return {
          workspace: {
            ...state.workspace,
            members: state.workspace.members.filter(m => m.userId !== userId),
          },
        }
      }),

    updateRuntimeState: (runtimePatch: Partial<RuntimeState>) =>
      set(state => {
        if (!state.workspace) return {}
        return {
          workspace: {
            ...state.workspace,
            runtime: { ...state.workspace.runtime, ...runtimePatch },
          },
        }
      }),

    reset: () => set(initialState),
  }))
)
