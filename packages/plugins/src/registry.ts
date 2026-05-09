/**
 * @ghost/plugins — Plugin Registry.
 *
 * Manages registration, lifecycle, and event routing for all installed plugins.
 * Plugins are registered at server startup and can be dynamically loaded/unloaded.
 */

import type { GhostPlugin, PluginContext, PluginEventSubscriber } from './types'

export class PluginRegistry {
  private readonly plugins = new Map<string, GhostPlugin>()
  private readonly eventSubscribers = new Map<string, Array<{ pluginId: string; subscriber: PluginEventSubscriber }>>()

  /**
   * Register a plugin. Calls its onLoad lifecycle hook if provided.
   */
  async register(plugin: GhostPlugin, context: PluginContext): Promise<void> {
    const { id } = plugin.manifest

    if (this.plugins.has(id)) {
      throw new Error(`Plugin "${id}" is already registered`)
    }

    this.plugins.set(id, plugin)

    // Wire event subscribers
    for (const subscriber of plugin.events ?? []) {
      if (!this.eventSubscribers.has(subscriber.eventType)) {
        this.eventSubscribers.set(subscriber.eventType, [])
      }
      this.eventSubscribers.get(subscriber.eventType)!.push({ pluginId: id, subscriber })
    }

    if (plugin.onLoad) {
      await plugin.onLoad(context)
    }
  }

  /**
   * Unregister a plugin and call its onUnload hook.
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    if (plugin.onUnload) {
      await plugin.onUnload()
    }

    // Remove event subscribers
    for (const [eventType, subs] of this.eventSubscribers.entries()) {
      const filtered = subs.filter(s => s.pluginId !== pluginId)
      if (filtered.length === 0) {
        this.eventSubscribers.delete(eventType)
      } else {
        this.eventSubscribers.set(eventType, filtered)
      }
    }

    this.plugins.delete(pluginId)
  }

  /**
   * Dispatch a domain event to all subscribed plugins.
   */
  async dispatch(eventType: string, payload: unknown, context: PluginContext): Promise<void> {
    const subs = this.eventSubscribers.get(eventType) ?? []
    await Promise.all(
      subs.map(({ subscriber }) =>
        Promise.resolve(subscriber.handler(payload, context)).catch(err => {
          console.error(`[plugin:${subscriber.eventType}] Error in handler:`, err)
        })
      )
    )
  }

  /**
   * List all registered plugins.
   */
  list(): Array<{ id: string; name: string; version: string; extensions: string[] }> {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      extensions: p.manifest.extensions,
    }))
  }

  /**
   * Get a specific registered plugin.
   */
  get(pluginId: string): GhostPlugin | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * Collect all commands from all registered plugins.
   */
  getAllCommands(): Array<{ pluginId: string; command: import('./types').PluginCommand }> {
    const result = []
    for (const plugin of this.plugins.values()) {
      for (const command of plugin.commands ?? []) {
        result.push({ pluginId: plugin.manifest.id, command })
      }
    }
    return result
  }

  /**
   * Collect all UI panels from all registered plugins.
   */
  getAllPanels(): Array<{ pluginId: string; panel: import('./types').PluginPanel }> {
    const result = []
    for (const plugin of this.plugins.values()) {
      for (const panel of plugin.panels ?? []) {
        result.push({ pluginId: plugin.manifest.id, panel })
      }
    }
    return result
  }
}

/** Shared singleton plugin registry */
export const pluginRegistry = new PluginRegistry()
