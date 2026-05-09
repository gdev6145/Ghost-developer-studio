/**
 * @ghost/plugins — Plugin SDK type definitions.
 *
 * A Ghost plugin is a named, versioned module that hooks into the platform
 * via well-defined extension points:
 *   - UI panels (React components injected into the workspace layout)
 *   - Server hooks (event listeners, route providers)
 *   - Command providers (commands added to the command palette)
 *   - Event subscribers (react to workspace domain events)
 */

// ─── Core Plugin Manifest ────────────────────────────────────────────────────

export interface PluginManifest {
  /** Unique plugin identifier, e.g. "github-issues" */
  id: string
  /** Human-readable name */
  name: string
  version: string
  description: string
  author: string
  /** Minimum Ghost Developer Studio version required */
  minGhostVersion?: string
  /** Extension points this plugin provides */
  extensions: PluginExtensionTypes[]
}

export type PluginExtensionTypes = 'ui' | 'command' | 'event' | 'route' | 'editor'

// ─── Extension Point: Commands ───────────────────────────────────────────────

export interface PluginCommand {
  /** Unique command ID, e.g. "github-issues.open-pr" */
  id: string
  /** Displayed in command palette */
  label: string
  /** Optional keyboard shortcut */
  keybinding?: string
  /** Category shown in command palette */
  category?: string
  handler(): void | Promise<void>
}

// ─── Extension Point: UI Panels ──────────────────────────────────────────────

export type PanelPosition = 'sidebar-left' | 'sidebar-right' | 'bottom' | 'statusbar'

export interface PluginPanel {
  /** Unique panel ID */
  id: string
  title: string
  icon?: string
  position: PanelPosition
  /** Render function returning JSX (React component factory) */
  render(): unknown
}

// ─── Extension Point: Event Subscribers ──────────────────────────────────────

export interface PluginEventSubscriber {
  /** Event type to subscribe to, e.g. "file.updated" */
  eventType: string
  handler(payload: unknown, context: PluginContext): void | Promise<void>
}

// ─── Extension Point: Route Providers ────────────────────────────────────────

export interface PluginRouteProvider {
  /** URL prefix for this plugin's routes, e.g. "/api/plugins/github-issues" */
  prefix: string
  /** Fastify plugin function */
  register(app: unknown): Promise<void>
}

// ─── Extension Point: Editor Extensions ──────────────────────────────────────

export type EditorExtensionKind = 'action' | 'hover' | 'completion' | 'decorator'

export interface PluginEditorExtension {
  kind: EditorExtensionKind
  /** Monaco editor language selector */
  language?: string
  handler(context: EditorContext): unknown
}

export interface EditorContext {
  fileId: string
  language: string
  selectedText: string
  cursorOffset: number
}

// ─── Plugin Context ───────────────────────────────────────────────────────────

export interface PluginContext {
  workspaceId: string
  userId: string
  /** Emit a Ghost domain event */
  emit(type: string, payload: Record<string, unknown>): void
  /** Read from workspace memory */
  getMemory(key: string): Promise<string | null>
  /** Write to workspace memory */
  setMemory(key: string, value: string, ttlSeconds?: number): Promise<void>
}

// ─── Plugin Registration ──────────────────────────────────────────────────────

export interface GhostPlugin {
  manifest: PluginManifest
  commands?: PluginCommand[]
  panels?: PluginPanel[]
  events?: PluginEventSubscriber[]
  routes?: PluginRouteProvider[]
  editorExtensions?: PluginEditorExtension[]
  /** Called when the plugin is loaded */
  onLoad?(context: PluginContext): void | Promise<void>
  /** Called when the plugin is unloaded */
  onUnload?(): void | Promise<void>
}
