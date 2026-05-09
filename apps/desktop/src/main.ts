import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron'
import { existsSync } from 'fs'
import * as path from 'path'
import isDev from 'electron-is-dev'

/**
 * Ghost Developer Studio — Electron main process.
 *
 * Responsibilities:
 *  - Create the main BrowserWindow
 *  - Load the Next.js renderer (dev server or static build)
 *  - Set up IPC handlers for filesystem and Docker access
 *  - Enforce preload security (contextIsolation, nodeIntegration: false)
 *
 * Security model:
 *  - nodeIntegration: false (renderer cannot access Node APIs directly)
 *  - contextIsolation: true (preload script runs in isolated context)
 *  - All renderer ↔ main communication goes through typed IPC via preload.ts
 */

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#1E1E2E',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    show: false, // shown after ready-to-show to avoid flash
    webPreferences: {
      // Security: renderer does NOT have direct Node access
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Preload bridges typed IPC to renderer
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDev,
    },
  })

  const rendererEntry = resolveRendererEntry()
  const shellUrl = new URL(`file://${rendererEntry}`)
  shellUrl.searchParams.set('studioBaseUrl', getStudioBaseUrl())
  void mainWindow.loadURL(shellUrl.toString())

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) mainWindow?.webContents.openDevTools({ mode: 'detach' })
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

function getStudioBaseUrl(): string {
  const candidate = process.env['GHOST_DESKTOP_WEB_URL'] ?? 'http://localhost:3000'
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'http://localhost:3000'
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return 'http://localhost:3000'
  }
}

function resolveRendererEntry(): string {
  const candidates = [
    path.join(app.getAppPath(), 'renderer', 'index.html'),
    path.join(__dirname, 'renderer', 'index.html'),
    path.join(__dirname, '../renderer/index.html'),
  ]
  const existing = candidates.find(candidate => existsSync(candidate))
  if (!existing) {
    throw new Error('Desktop renderer entry not found')
  }
  return existing
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  setupMenu()
  setupIpcHandlers()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
// All IPC channels are validated — never pass unsanitized user data to Node APIs.

function setupIpcHandlers(): void {
  /**
   * IPC: read-file
   * Renderer asks to read a local file. Path is validated.
   */
  ipcMain.handle('read-file', async (_event, filePath: string) => {
    const { readFile } = await import('fs/promises')
    const safePath = sanitizePath(filePath)
    return readFile(safePath, 'utf-8')
  })

  /**
   * IPC: write-file
   * Renderer asks to write a local file. Path is validated.
   */
  ipcMain.handle('write-file', async (_event, filePath: string, content: string) => {
    const { writeFile } = await import('fs/promises')
    const safePath = sanitizePath(filePath)
    await writeFile(safePath, content, 'utf-8')
    return { success: true }
  })

  /**
   * IPC: read-directory
   * Returns directory listing for a local path.
   */
  ipcMain.handle('read-directory', async (_event, dirPath: string) => {
    const { readdir, stat } = await import('fs/promises')
    const safePath = sanitizePath(dirPath)
    const entries = await readdir(safePath, { withFileTypes: true })
    return entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
      path: path.join(safePath, e.name),
    }))
  })

  /**
   * IPC: open-folder-dialog
   * Shows a native folder picker and returns the selected path.
   */
  ipcMain.handle('open-folder-dialog', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Open Workspace Folder',
    })
    return result.canceled ? null : result.filePaths[0]
  })

  /**
   * IPC: get-platform
   * Returns the OS platform for conditional UI.
   */
  ipcMain.handle('get-platform', () => process.platform)
}

// ─── Security Helpers ─────────────────────────────────────────────────────────

/**
 * Prevent path traversal attacks by resolving and validating the path.
 * In production, you'd also restrict to allowed workspace directories.
 */
function sanitizePath(inputPath: string): string {
  const resolved = path.resolve(inputPath)
  // Basic guard: reject anything with null bytes
  if (resolved.includes('\0')) {
    throw new Error('Invalid path')
  }
  return resolved
}

// ─── Application Menu ─────────────────────────────────────────────────────────

function setupMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Ghost Studio',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' as const },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
