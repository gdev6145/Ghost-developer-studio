import { contextBridge, ipcRenderer } from 'electron'

/**
 * Ghost Desktop — Preload Script
 *
 * This script runs in a privileged context and bridges typed IPC
 * between the renderer process and the main process.
 *
 * Security rules:
 *  - Only expose EXPLICITLY listed APIs (allowlist approach)
 *  - Validate inputs before forwarding to ipcRenderer
 *  - Never expose raw ipcRenderer to the renderer
 *  - Never expose require/process/Node globals
 */

export interface GhostDesktopAPI {
  /** Read a local file by path */
  readFile: (path: string) => Promise<string>
  /** Write content to a local file */
  writeFile: (path: string, content: string) => Promise<{ success: boolean }>
  /** List a directory */
  readDirectory: (
    path: string
  ) => Promise<Array<{ name: string; type: 'file' | 'directory'; path: string }>>
  /** Open a native folder picker */
  openFolderDialog: () => Promise<string | null>
  /** Get the OS platform */
  getPlatform: () => Promise<string>
}

const ghostAPI: GhostDesktopAPI = {
  readFile: (path: string) => {
    validatePath(path)
    return ipcRenderer.invoke('read-file', path) as Promise<string>
  },

  writeFile: (path: string, content: string) => {
    validatePath(path)
    return ipcRenderer.invoke('write-file', path, content) as Promise<{ success: boolean }>
  },

  readDirectory: (path: string) => {
    validatePath(path)
    return ipcRenderer.invoke('read-directory', path) as Promise<
      Array<{ name: string; type: 'file' | 'directory'; path: string }>
    >
  },

  openFolderDialog: () =>
    ipcRenderer.invoke('open-folder-dialog') as Promise<string | null>,

  getPlatform: () => ipcRenderer.invoke('get-platform') as Promise<string>,
}

// Expose Ghost API to renderer under window.ghostDesktop
contextBridge.exposeInMainWorld('ghostDesktop', ghostAPI)

// ─── Input Validation ─────────────────────────────────────────────────────────

function validatePath(path: string): void {
  if (typeof path !== 'string') throw new TypeError('Path must be a string')
  if (path.includes('\0')) throw new Error('Path contains null bytes')
  if (path.length > 4096) throw new Error('Path too long')
}
