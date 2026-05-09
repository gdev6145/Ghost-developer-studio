import type * as Monaco from 'monaco-editor'
import { MonacoBinding } from 'y-monaco'
import type { CollaborationClient } from '@ghost/collaboration'
import { getCollaboratorColor } from '@ghost/shared'

export interface CollaboratorDecoration {
  userId: string
  displayName: string
  color: string
  line: number
  column: number
  fileId: string
}

/**
 * CollaborativeEditorBinding connects a Monaco editor instance to a Yjs
 * document, enabling realtime collaborative editing.
 *
 * Responsibilities:
 *  1. Bind Monaco model to Y.Text via y-monaco MonacoBinding
 *  2. Forward Monaco cursor/selection changes to CollaborationClient
 *  3. Apply remote presence updates as Monaco decorations (live cursors)
 *  4. Manage decoration lifecycle (add/update/remove)
 *
 * Usage:
 *   const binding = new CollaborativeEditorBinding(editor, model, fileId, collab)
 *   // ...user edits flow via Yjs...
 *   binding.dispose()
 */
export class CollaborativeEditorBinding {
  private readonly monacoBinding: MonacoBinding
  private decorationCollection: Monaco.editor.IEditorDecorationsCollection | null = null
  private readonly cursorDecorations = new Map<string, Monaco.editor.IModelDeltaDecoration>()
  private disposePresenceListener: (() => void) | null = null

  constructor(
    private readonly editor: Monaco.editor.IStandaloneCodeEditor,
    private readonly model: Monaco.editor.ITextModel,
    private readonly fileId: string,
    private readonly collab: CollaborationClient,
    private readonly currentUserId: string
  ) {
    const yText = collab.documents.getText(fileId)

    // y-monaco binding syncs Y.Text ↔ Monaco model content
    this.monacoBinding = new MonacoBinding(yText, model, new Set([editor]))

    // Attach Monaco cursor listener → forward to collaboration client
    this.attachCursorListener()

    // Subscribe to remote presence updates → render cursors
    this.disposePresenceListener = collab.on('presence:updated', (userId, state) => {
      if (userId === currentUserId) return
      const fileIdFromState = state['fileId'] as string | undefined
      if (fileIdFromState !== fileId) return
      this.updateRemoteCursor(userId, state)
    })
  }

  private attachCursorListener(): void {
    this.editor.onDidChangeCursorPosition(e => {
      this.collab.updateCursor(this.fileId, {
        line: e.position.lineNumber,
        column: e.position.column,
        offset: this.model.getOffsetAt(e.position),
      })
    })

    this.editor.onDidChangeCursorSelection(e => {
      const { selection } = e
      const startOffset = this.model.getOffsetAt({
        lineNumber: selection.startLineNumber,
        column: selection.startColumn,
      })
      const endOffset = this.model.getOffsetAt({
        lineNumber: selection.endLineNumber,
        column: selection.endColumn,
      })
      this.collab.updateSelection(this.fileId, {
        startLine: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLine: selection.endLineNumber,
        endColumn: selection.endColumn,
        startOffset,
        endOffset,
      })
    })
  }

  private updateRemoteCursor(userId: string, state: Record<string, unknown>): void {
    const line = state['line'] as number | undefined
    const column = state['column'] as number | undefined
    if (!line || !column) return

    getCollaboratorColor(userId)
    const displayName = (state['displayName'] as string | undefined) ?? userId.slice(0, 8)

    this.cursorDecorations.set(userId, {
      range: new (require('monaco-editor') as typeof Monaco).Range(line, column, line, column),
      options: {
        className: `ghost-cursor-${userId.slice(0, 8)}`,
        beforeContentClassName: `ghost-cursor-before`,
        afterContentClassName: `ghost-cursor-after`,
        hoverMessage: { value: displayName },
        stickiness: 1, // NeverGrowsWhenTypingAtEdges
      },
    })

    this.renderDecorations()
  }

  private renderDecorations(): void {
    if (!this.decorationCollection) {
      this.decorationCollection = this.editor.createDecorationsCollection([])
    }
    this.decorationCollection.set([...this.cursorDecorations.values()])
  }

  /**
   * Remove a specific user's cursor decoration (e.g. they closed the file).
   */
  removeRemoteCursor(userId: string): void {
    this.cursorDecorations.delete(userId)
    this.renderDecorations()
  }

  dispose(): void {
    this.monacoBinding.destroy()
    this.decorationCollection?.clear()
    this.disposePresenceListener?.()
  }
}
