/**
 * Ghost editor theme – dark multiplayer-native color scheme.
 *
 * Based on VS Code dark+ with Ghost-specific collaboration colors.
 */
export const ghostDarkTheme = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: '', foreground: 'D4D4D4', background: '1E1E2E' },
    { token: 'comment', foreground: '6A9955' },
    { token: 'keyword', foreground: 'C586C0' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'class', foreground: '4EC9B0' },
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'operator', foreground: 'D4D4D4' },
  ],
  colors: {
    // Editor
    'editor.background': '#1E1E2E',
    'editor.foreground': '#CDD6F4',
    'editor.lineHighlightBackground': '#313244',
    'editor.selectionBackground': '#45475A88',
    'editor.inactiveSelectionBackground': '#45475A44',
    // Cursor
    'editorCursor.foreground': '#CDD6F4',
    // Gutter
    'editorLineNumber.foreground': '#6C7086',
    'editorLineNumber.activeForeground': '#BAC2DE',
    // Indent guides
    'editorIndentGuide.background': '#313244',
    'editorIndentGuide.activeBackground': '#45475A',
    // Sidebar background match
    'sideBar.background': '#181825',
    // Minimap
    'minimap.background': '#181825',
  },
}

/**
 * Apply the Ghost dark theme to a Monaco instance.
 */
export function applyGhostTheme(monaco: {
  editor: {
    defineTheme: (name: string, theme: typeof ghostDarkTheme) => void
    setTheme: (name: string) => void
  }
}): void {
  monaco.editor.defineTheme('ghost-dark', ghostDarkTheme)
  monaco.editor.setTheme('ghost-dark')
}
