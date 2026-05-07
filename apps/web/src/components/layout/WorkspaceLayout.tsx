'use client'

import React from 'react'

interface WorkspaceLayoutProps {
  fileExplorer: React.ReactNode
  editor: React.ReactNode
  rightPanel: React.ReactNode
}

/**
 * Three-column workspace layout:
 * ┌───────────┬─────────────────┬──────────┐
 * │ Files/Git │  Editor/Preview │Chat/Users│
 * └───────────┴─────────────────┴──────────┘
 */
export function WorkspaceLayout({ fileExplorer, editor, rightPanel }: WorkspaceLayoutProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar – file explorer */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-ghost-overlay bg-ghost-surface overflow-hidden">
        {fileExplorer}
      </aside>

      {/* Center – editor + preview */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {editor}
      </main>

      {/* Right sidebar – presence + chat */}
      <aside className="w-72 shrink-0 flex flex-col border-l border-ghost-overlay bg-ghost-surface overflow-hidden">
        {rightPanel}
      </aside>
    </div>
  )
}
