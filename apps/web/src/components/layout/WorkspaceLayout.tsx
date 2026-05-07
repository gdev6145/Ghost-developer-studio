'use client'

import React, { useState } from 'react'

type RightTab = 'chat' | 'presence' | 'debug' | 'ai' | 'replay' | 'git'

interface WorkspaceLayoutProps {
  fileExplorer: React.ReactNode
  editor: React.ReactNode
  rightPanel: React.ReactNode
  /** Optional: rendered in a bottom drawer when open */
  bottomPanel?: React.ReactNode
  bottomPanelOpen?: boolean
}

/**
 * Three-column workspace layout with optional bottom panel:
 * ┌───────────┬─────────────────┬──────────┐
 * │ Files/Git │  Editor/Preview │Chat/Users│
 * ├───────────┴─────────────────┴──────────┤
 * │          Terminal (optional)            │
 * └─────────────────────────────────────────┘
 */
export function WorkspaceLayout({
  fileExplorer,
  editor,
  rightPanel,
  bottomPanel,
  bottomPanelOpen = false,
}: WorkspaceLayoutProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left sidebar – file explorer */}
        <aside className="w-56 shrink-0 flex flex-col border-r border-ghost-overlay bg-ghost-surface overflow-hidden">
          {fileExplorer}
        </aside>

        {/* Center – editor + preview */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {editor}
        </main>

        {/* Right sidebar – presence + chat + new panels */}
        <aside className="w-72 shrink-0 flex flex-col border-l border-ghost-overlay bg-ghost-surface overflow-hidden">
          {rightPanel}
        </aside>
      </div>

      {/* Bottom panel – terminal */}
      {bottomPanelOpen && bottomPanel && (
        <div className="h-64 shrink-0 border-t border-ghost-overlay bg-ghost-surface overflow-hidden">
          {bottomPanel}
        </div>
      )}
    </div>
  )
}

/**
 * Tabbed right panel container for all right-sidebar panels.
 */
export function TabbedRightPanel({
  chatPanel,
  presencePanel,
  debugPanel,
  aiPanel,
  replayPanel,
  gitPanel,
}: {
  chatPanel: React.ReactNode
  presencePanel: React.ReactNode
  debugPanel?: React.ReactNode
  aiPanel?: React.ReactNode
  replayPanel?: React.ReactNode
  gitPanel?: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<RightTab>('chat')

  const tabs: Array<{ id: RightTab; label: string; icon: string; panel: React.ReactNode }> = [
    { id: 'chat', label: 'Chat', icon: '💬', panel: chatPanel },
    { id: 'presence', label: 'Users', icon: '👥', panel: presencePanel },
    { id: 'ai', label: 'AI', icon: '✦', panel: aiPanel },
    { id: 'debug', label: 'Debug', icon: '🔴', panel: debugPanel },
    { id: 'git', label: 'Git', icon: '⎇', panel: gitPanel },
    { id: 'replay', label: 'Replay', icon: '📼', panel: replayPanel },
  ]

  const active = tabs.find(t => t.id === activeTab)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab strip */}
      <div className="flex border-b border-ghost-overlay shrink-0 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-1 px-2.5 py-1.5 text-[10px] shrink-0 transition-colors border-b-2',
              activeTab === tab.id
                ? 'border-ghost-blue text-ghost-text'
                : 'border-transparent text-ghost-muted hover:text-ghost-text',
            ].join(' ')}
            title={tab.label}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div className="flex-1 overflow-hidden">
        {active?.panel}
      </div>
    </div>
  )
}
