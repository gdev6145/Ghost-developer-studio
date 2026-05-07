'use client'

import React, { useRef, useEffect, useState } from 'react'
import type { CollaborationClient } from '@ghost/collaboration'
import { useEditorStore } from '@ghost/state'
import { applyGhostTheme } from '@ghost/editor'
import { CollaborativeEditorBinding } from '@ghost/editor'
import { getLanguageFromPath } from '@ghost/shared'
import { PreviewPane } from '@/components/preview/PreviewPane'
import { getCurrentUserId } from '@/lib/session'
import type * as monaco from 'monaco-editor'

type MonacoEditorInstance = monaco.editor.IStandaloneCodeEditor
type MonacoInstance = typeof monaco

// Dynamic import for Monaco (client-side only)
const MonacoEditor = React.lazy(() =>
  import('@monaco-editor/react').then(m => ({ default: m.default }))
)

interface EditorPaneProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
}

/**
 * EditorPane — Monaco editor with Yjs collaborative bindings.
 *
 * - Tabs for open files
 * - Collaborative editing via CollaborativeEditorBinding
 * - Split view with live preview (optional)
 * - Ghost dark theme
 */
export function EditorPane({ workspaceId, collab }: EditorPaneProps) {
  const tabs = useEditorStore(s => s.tabs)
  const activeTabId = useEditorStore(s => s.activeTabId)
  const setActiveTab = useEditorStore(s => s.setActiveTab)
  const closeTab = useEditorStore(s => s.closeTab)
  const fontSize = useEditorStore(s => s.fontSize)

  const bindingRef = useRef<CollaborativeEditorBinding | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const activeTab = tabs.find(t => t.fileId === activeTabId)

  function handleEditorMount(editor: MonacoEditorInstance, monaco: MonacoInstance) {
    // Apply Ghost dark theme
    applyGhostTheme(monaco)

    if (!activeTab || !collab.current) return

    // Create the collaborative binding for this file
    const model = editor.getModel()
    if (!model) return

    // Dispose previous binding
    bindingRef.current?.dispose()

    // Initialize Yjs document with existing content if available
    const collab_ = collab.current
    collab_.openFile(activeTab.fileId)

    bindingRef.current = new CollaborativeEditorBinding(
      editor,
      model,
      activeTab.fileId,
      collab_,
      getCurrentUserId()
    )
  }

  // Clean up binding when tab changes
  useEffect(() => {
    return () => {
      bindingRef.current?.dispose()
      bindingRef.current = null
    }
  }, [activeTabId])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center h-9 bg-ghost-surface border-b border-ghost-overlay overflow-x-auto shrink-0">
        {tabs.length === 0 ? (
          <div className="px-4 text-ghost-muted text-xs flex items-center h-full">
            No files open — click a file in the explorer to start editing
          </div>
        ) : (
          tabs.map(tab => (
            <button
              key={tab.fileId}
              onClick={() => setActiveTab(tab.fileId)}
              className={[
                'flex items-center gap-1.5 px-3 h-full text-xs shrink-0 border-r border-ghost-overlay transition-colors',
                tab.fileId === activeTabId
                  ? 'bg-ghost-bg text-ghost-text'
                  : 'text-ghost-muted hover:bg-ghost-overlay hover:text-ghost-text',
              ].join(' ')}
            >
              {tab.isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-ghost-blue" />
              )}
              <span className="max-w-[120px] truncate">{tab.name}</span>
              <span
                className="ml-1 opacity-50 hover:opacity-100 w-3 h-3 flex items-center justify-center rounded hover:bg-ghost-overlay"
                onClick={e => {
                  e.stopPropagation()
                  closeTab(tab.fileId)
                }}
              >
                ×
              </span>
            </button>
          ))
        )}

        {/* Preview toggle */}
        <div className="ml-auto pr-2 flex items-center">
          <button
            onClick={() => setShowPreview(v => !v)}
            className={[
              'text-xs px-2 py-1 rounded transition-colors',
              showPreview
                ? 'bg-ghost-purple text-ghost-bg'
                : 'text-ghost-muted hover:text-ghost-text',
            ].join(' ')}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Editor + Preview split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Monaco Editor */}
        <div className={showPreview ? 'w-1/2' : 'w-full'}>
          {activeTab ? (
            <React.Suspense fallback={<EditorSkeleton />}>
              <MonacoEditor
                height="100%"
                language={activeTab.language}
                theme="ghost-dark"
                options={{
                  fontSize,
                  fontFamily: 'JetBrains Mono, Fira Code, monospace',
                  fontLigatures: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  renderWhitespace: 'selection',
                  lineNumbers: 'on',
                  glyphMargin: true,
                  folding: true,
                  wordWrap: 'off',
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  padding: { top: 8, bottom: 8 },
                  fixedOverflowWidgets: true,
                }}
                onMount={handleEditorMount}
              />
            </React.Suspense>
          ) : (
            <EmptyEditor />
          )}
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div className="w-1/2 border-l border-ghost-overlay">
            <PreviewPane />
          </div>
        )}
      </div>
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="flex items-center justify-center h-full bg-ghost-bg">
      <div className="text-ghost-muted text-sm animate-pulse">Loading editor...</div>
    </div>
  )
}

function EmptyEditor() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-ghost-bg gap-4 text-ghost-muted">
      <div className="text-5xl opacity-10">⌨</div>
      <div className="text-sm">Open a file from the explorer to start editing</div>
    </div>
  )
}
