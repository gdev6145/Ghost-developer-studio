import { create } from 'zustand'

export interface GitCommit {
  hash: string
  date: string
  message: string
  author_name: string
  author_email: string
  refs: string
}

export interface GitStatus {
  branch: string
  staged: string[]
  modified: string[]
  untracked: string[]
}

interface GitStore {
  branches: string[]
  currentBranch: string
  commits: GitCommit[]
  status: GitStatus | null
  repoPath: string | null

  // Actions
  setBranches: (branches: string[], current: string) => void
  setCommits: (commits: GitCommit[]) => void
  setStatus: (status: GitStatus) => void
  setRepoPath: (path: string) => void
  setCurrentBranch: (branch: string) => void
}

export const useGitStore = create<GitStore>(set => ({
  branches: [],
  currentBranch: 'main',
  commits: [],
  status: null,
  repoPath: null,

  setBranches: (branches, current) => set({ branches, currentBranch: current }),
  setCommits: (commits) => set({ commits }),
  setStatus: (status) => set({ status }),
  setRepoPath: (path) => set({ repoPath: path }),
  setCurrentBranch: (branch) => set({ currentBranch: branch }),
}))
