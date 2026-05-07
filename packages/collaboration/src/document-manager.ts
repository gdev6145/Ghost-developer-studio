import * as Y from 'yjs'
import { uint8ArrayToBase64, base64ToUint8Array } from '@ghost/shared'

/**
 * DocumentManager manages per-file Yjs documents on the client.
 *
 * Each open file gets its own Y.Doc. This class:
 *  - creates and caches Y.Docs
 *  - applies incoming Yjs binary updates
 *  - produces outgoing binary updates for transmission
 *  - persists document state locally (IndexedDB via y-indexeddb in browser)
 *
 * Architecture:
 *   Monaco Editor ↔ Y.Doc ↔ DocumentManager ↔ CollaborationClient (socket)
 */
export class DocumentManager {
  private readonly docs = new Map<string, Y.Doc>()

  /**
   * Get or create a Y.Doc for a given file ID.
   */
  getDoc(fileId: string): Y.Doc {
    if (!this.docs.has(fileId)) {
      const doc = new Y.Doc({ guid: fileId })
      this.docs.set(fileId, doc)
    }
    return this.docs.get(fileId)!
  }

  /**
   * Get the Y.Text content type for a file doc.
   * All file contents are stored in a Text type named 'content'.
   */
  getText(fileId: string): Y.Text {
    return this.getDoc(fileId).getText('content')
  }

  /**
   * Apply a binary update (received from server/peer) to a file doc.
   * `origin` is set to 'remote' so local observers can ignore these.
   */
  applyUpdate(fileId: string, updateBase64: string): void {
    const doc = this.getDoc(fileId)
    const update = base64ToUint8Array(updateBase64)
    Y.applyUpdate(doc, update, 'remote')
  }

  /**
   * Get the current encoded state of a document (for sync requests).
   */
  encodeStateAsUpdate(fileId: string): string {
    const doc = this.getDoc(fileId)
    return uint8ArrayToBase64(Y.encodeStateAsUpdate(doc))
  }

  /**
   * Get the state vector for a document (for differential sync).
   */
  encodeStateVector(fileId: string): string {
    const doc = this.getDoc(fileId)
    return uint8ArrayToBase64(Y.encodeStateVector(doc))
  }

  /**
   * Compute the diff between local state and a remote state vector.
   * Send this diff to a peer who provided their state vector.
   */
  encodeDiff(fileId: string, remoteStateVectorBase64: string): string {
    const doc = this.getDoc(fileId)
    const remoteVector = base64ToUint8Array(remoteStateVectorBase64)
    const diff = Y.encodeStateAsUpdate(doc, remoteVector)
    return uint8ArrayToBase64(diff)
  }

  /**
   * Subscribe to updates for a specific document.
   * The callback receives a base64-encoded binary Yjs update.
   * Returns an unsubscribe function.
   */
  onUpdate(
    fileId: string,
    callback: (updateBase64: string, origin: unknown) => void
  ): () => void {
    const doc = this.getDoc(fileId)
    const handler = (update: Uint8Array, origin: unknown) => {
      // Only forward local changes (not updates we applied from remote)
      if (origin !== 'remote') {
        callback(uint8ArrayToBase64(update), origin)
      }
    }
    doc.on('update', handler)
    return () => doc.off('update', handler)
  }

  /**
   * Destroy a document and free its memory.
   * Call when a file tab is closed.
   */
  closeDoc(fileId: string): void {
    const doc = this.docs.get(fileId)
    if (doc) {
      doc.destroy()
      this.docs.delete(fileId)
    }
  }

  /**
   * Destroy all documents. Call on workspace disconnect.
   */
  destroyAll(): void {
    this.docs.forEach(doc => doc.destroy())
    this.docs.clear()
  }
}
