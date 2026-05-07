/**
 * Minimal interface for a node-pty IPty instance.
 *
 * node-pty ships its own type definitions, but we declare this minimal
 * interface here so the terminal handler compiles in environments where
 * the native module is unavailable (e.g., test runners, lightweight CI),
 * and to avoid importing from the top-level 'node-pty' which would fail
 * if the native bindings are not compiled.
 */
export interface IPty {
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => void
  onData: (cb: (data: string) => void) => void
  onExit: (cb: (e: { exitCode: number }) => void) => void
}

export interface NodePtyModule {
  spawn: (
    shell: string,
    args: string[],
    opts: Record<string, unknown>
  ) => IPty
}
