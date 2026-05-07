'use client'

import React, { useState } from 'react'
import type { CollaborationClient } from '@ghost/collaboration'
import { useWorkspaceStore } from '@ghost/state'
import { useEditorStore } from '@ghost/state'
import { getLanguageFromPath } from '@ghost/shared'
import type { FileNode } from '@ghost/protocol'

interface FileExplorerProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
}

/**
 * FileExplorer — left sidebar file tree.
 *
 * Displays the workspace file tree, handles file selection (opens in editor),
 * and shows live presence indicators for files other users have open.
 */
export function FileExplorer({ workspaceId, collab }: FileExplorerProps) {
  const files = useWorkspaceStore(s => s.files)
  const openTab = useEditorStore(s => s.openTab)

  function handleFileClick(file: FileNode) {
    if (file.type !== 'file') return
    openTab({
      fileId: file.id,
      path: file.path,
      name: file.name,
      language: getLanguageFromPath(file.path),
      isDirty: false,
    })
    collab.current?.openFile(file.id)
  }

  // Build tree structure from flat list
  const tree = buildTree(files)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-ghost-overlay shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
          Explorer
        </span>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="px-3 py-4 text-xs text-ghost-muted">No files yet</div>
        ) : (
          tree.map(node => (
            <FileTreeNode key={node.id} node={node} depth={0} onClick={handleFileClick} />
          ))
        )}
      </div>
    </div>
  )
}

interface FileTreeNodeProps {
  node: FileNode & { children?: FileNode[] }
  depth: number
  onClick: (file: FileNode) => void
}

function FileTreeNode({ node, depth, onClick }: FileTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(true)
  const isDir = node.type === 'directory'
  const activeTabId = useEditorStore(s => s.activeTabId)
  const isActive = activeTabId === node.id

  return (
    <div>
      <button
        onClick={() => (isDir ? setIsOpen(v => !v) : onClick(node))}
        className={[
          'w-full flex items-center gap-1.5 px-2 py-0.5 text-xs transition-colors hover:bg-ghost-overlay',
          isActive ? 'bg-ghost-overlay text-ghost-text' : 'text-ghost-muted hover:text-ghost-text',
        ].join(' ')}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {/* Icon */}
        <span className="shrink-0 w-4 text-center">
          {isDir ? (isOpen ? '▾' : '▸') : getFileIcon(node.name)}
        </span>
        <span className="truncate">{node.name}</span>
      </button>

      {isDir && isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeNode key={child.id} node={child} depth={depth + 1} onClick={onClick} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTree(files: FileNode[]): (FileNode & { children?: FileNode[] })[] {
  const map = new Map<string, FileNode & { children?: FileNode[] }>()
  const roots: (FileNode & { children?: FileNode[] })[] = []

  files.forEach(f => map.set(f.id, { ...f, children: f.type === 'directory' ? [] : undefined }))

  files.forEach(f => {
    const node = map.get(f.id)!
    if (f.parentId) {
      const parent = map.get(f.parentId)
      if (parent?.children) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  return roots.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const icons: Record<string, string> = {
    ts: '🔷', tsx: '⚛', js: '🟡', jsx: '⚛', json: '📋',
    md: '📝', css: '🎨', html: '🌐', py: '🐍', rs: '🦀',
    go: '🐹', sh: '⚡', yaml: '⚙', yml: '⚙', dockerfile: '🐳',
  }
  return icons[ext] ?? '📄'
}
