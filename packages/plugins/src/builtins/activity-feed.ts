/**
 * Built-in Activity Feed plugin.
 *
 * Demonstrates the Ghost Plugin SDK by subscribing to workspace events and
 * providing a command to open a summarized activity feed.
 *
 * This plugin ships with Ghost Developer Studio as a reference implementation.
 */

import type { GhostPlugin, PluginContext } from '../types'

const MEMORY_KEY = 'activity-feed:recent'
const MAX_FEED_ITEMS = 50

export const activityFeedPlugin: GhostPlugin = {
  manifest: {
    id: 'ghost.activity-feed',
    name: 'Activity Feed',
    version: '1.0.0',
    description: 'Tracks and summarises workspace activity from domain events.',
    author: 'Ghost Developer Studio',
    extensions: ['event', 'command'],
  },

  events: [
    {
      eventType: 'chat.sent',
      async handler(payload, ctx: PluginContext) {
        await appendActivity(ctx, { type: 'chat', summary: 'Message sent in chat' })
      },
    },
    {
      eventType: 'file.updated',
      async handler(payload, ctx: PluginContext) {
        const p = payload as { path?: string }
        await appendActivity(ctx, { type: 'file', summary: `File edited: ${p.path ?? 'unknown'}` })
      },
    },
    {
      eventType: 'runtime.started',
      async handler(_payload, ctx: PluginContext) {
        await appendActivity(ctx, { type: 'runtime', summary: 'Runtime started' })
      },
    },
    {
      eventType: 'runtime.stopped',
      async handler(_payload, ctx: PluginContext) {
        await appendActivity(ctx, { type: 'runtime', summary: 'Runtime stopped' })
      },
    },
    {
      eventType: 'user.joined',
      async handler(payload, ctx: PluginContext) {
        const p = payload as { displayName?: string }
        await appendActivity(ctx, { type: 'presence', summary: `${p.displayName ?? 'Someone'} joined` })
      },
    },
  ],

  commands: [
    {
      id: 'ghost.activity-feed.show',
      label: 'Activity Feed: Show Recent Activity',
      category: 'Workspace',
      handler() {
        // In a real UI integration this would open the Activity Feed panel.
        console.log('[activity-feed] Open activity feed panel')
      },
    },
  ],

  async onLoad(ctx: PluginContext) {
    const existing = await ctx.getMemory(`${MEMORY_KEY}:${ctx.workspaceId}`)
    if (!existing) {
      await ctx.setMemory(`${MEMORY_KEY}:${ctx.workspaceId}`, JSON.stringify([]))
    }
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ActivityItem {
  type: string
  summary: string
  at: string
}

async function appendActivity(ctx: PluginContext, item: Omit<ActivityItem, 'at'>): Promise<void> {
  const key = `${MEMORY_KEY}:${ctx.workspaceId}`
  const raw = await ctx.getMemory(key)
  const feed: ActivityItem[] = raw ? (JSON.parse(raw) as ActivityItem[]) : []
  feed.push({ ...item, at: new Date().toISOString() })
  // Keep only the last N items
  const trimmed = feed.slice(-MAX_FEED_ITEMS)
  await ctx.setMemory(key, JSON.stringify(trimmed), 60 * 60 * 24) // 24h TTL
}
