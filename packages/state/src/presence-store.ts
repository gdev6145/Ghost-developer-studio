import { create } from 'zustand'
import type { PresenceState } from '@ghost/protocol'

// ─── Presence Store ──────────────────────────────────────────────────────────

interface PresenceStoreState {
  /** Map of userId → presence state */
  presenceMap: Map<string, PresenceState>
  /** Ordered list of online user IDs */
  onlineUsers: string[]

  // Actions
  updatePresence: (userId: string, state: Partial<PresenceState>) => void
  removePresence: (userId: string) => void
  getPresence: (userId: string) => PresenceState | undefined
  reset: () => void
}

export const usePresenceStore = create<PresenceStoreState>()((set, get) => ({
  presenceMap: new Map(),
  onlineUsers: [],

  updatePresence: (userId, partial) =>
    set(state => {
      const next = new Map(state.presenceMap)
      const existing = next.get(userId)
      const updated: PresenceState = {
        ...(existing ?? {
          userId,
          workspaceId: '',
          status: 'online',
          color: '#FF6B6B',
          lastSeenAt: new Date().toISOString(),
        }),
        ...partial,
      }
      next.set(userId, updated)
      const onlineUsers = [...next.entries()]
        .filter(([, p]) => p.status !== 'offline')
        .map(([id]) => id)
      return { presenceMap: next, onlineUsers }
    }),

  removePresence: userId =>
    set(state => {
      const next = new Map(state.presenceMap)
      next.delete(userId)
      return {
        presenceMap: next,
        onlineUsers: state.onlineUsers.filter(id => id !== userId),
      }
    }),

  getPresence: (userId: string) => get().presenceMap.get(userId),
  reset: () => set({ presenceMap: new Map(), onlineUsers: [] }),
}))
