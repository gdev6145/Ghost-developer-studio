import { create } from 'zustand'
import type { ChatMessage } from '@ghost/protocol'

// ─── Chat Store ───────────────────────────────────────────────────────────────

interface ChatStoreState {
  messages: ChatMessage[]
  /** Set of userIds currently typing */
  typingUsers: Set<string>
  isOpen: boolean

  // Actions
  addMessage: (message: ChatMessage) => void
  setMessages: (messages: ChatMessage[]) => void
  setTyping: (userId: string, isTyping: boolean) => void
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  reset: () => void
}

export const useChatStore = create<ChatStoreState>()(set => ({
  messages: [],
  typingUsers: new Set(),
  isOpen: false,

  addMessage: message =>
    set(state => ({
      messages: [...state.messages, message],
    })),

  setMessages: messages => set({ messages }),

  setTyping: (userId, isTyping) =>
    set(state => {
      const next = new Set(state.typingUsers)
      if (isTyping) {
        next.add(userId)
      } else {
        next.delete(userId)
      }
      return { typingUsers: next }
    }),

  toggleChat: () => set(state => ({ isOpen: !state.isOpen })),
  setChatOpen: isOpen => set({ isOpen }),
  reset: () => set({ messages: [], typingUsers: new Set(), isOpen: false }),
}))
