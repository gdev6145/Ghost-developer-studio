import { create } from 'zustand'
import type { Notification } from '@ghost/protocol'

// ─── Notification Store ───────────────────────────────────────────────────────

interface NotificationStoreState {
  notifications: Notification[]
  unreadCount: number

  // Actions
  addNotification: (notification: Notification) => void
  markRead: (id: string) => void
  markAllRead: () => void
  removeNotification: (id: string) => void
  reset: () => void
}

export const useNotificationStore = create<NotificationStoreState>()(set => ({
  notifications: [],
  unreadCount: 0,

  addNotification: notification =>
    set(state => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.read ? 0 : 1),
    })),

  markRead: id =>
    set(state => {
      const notifications = state.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      )
      const unreadCount = notifications.filter(n => !n.read).length
      return { notifications, unreadCount }
    }),

  markAllRead: () =>
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  removeNotification: id =>
    set(state => {
      const notifications = state.notifications.filter(n => n.id !== id)
      return {
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
      }
    }),

  reset: () => set({ notifications: [], unreadCount: 0 }),
}))
