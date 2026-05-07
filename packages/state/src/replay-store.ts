import { create } from 'zustand'

// ─── Replay Store ─────────────────────────────────────────────────────────────

export interface ReplayEvent {
  eventId: string
  eventType: string
  timestamp: string
  actorId?: string
  data: Record<string, unknown>
}

export type ReplayStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'finished'

interface ReplayState {
  status: ReplayStatus
  replayId: string | null
  events: ReplayEvent[]
  currentIndex: number
  totalEvents: number
  speed: number

  // Actions
  startReplay: (replayId: string, speed: number) => void
  appendEvent: (event: ReplayEvent) => void
  endReplay: (totalEvents: number) => void
  setSpeed: (speed: number) => void
  pause: () => void
  resume: () => void
  reset: () => void
}

export const useReplayStore = create<ReplayState>()((set, get) => ({
  status: 'idle',
  replayId: null,
  events: [],
  currentIndex: 0,
  totalEvents: 0,
  speed: 1,

  startReplay: (replayId, speed) =>
    set({ status: 'playing', replayId, events: [], currentIndex: 0, totalEvents: 0, speed }),

  appendEvent: event =>
    set(state => ({
      events: [...state.events, event],
      currentIndex: state.events.length,
    })),

  endReplay: totalEvents => set({ status: 'finished', totalEvents }),

  setSpeed: speed => set({ speed }),

  pause: () => set({ status: 'paused' }),

  resume: () => set({ status: 'playing' }),

  reset: () =>
    set({ status: 'idle', replayId: null, events: [], currentIndex: 0, totalEvents: 0, speed: 1 }),
}))
