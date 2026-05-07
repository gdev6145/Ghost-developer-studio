import Link from 'next/link'

/**
 * Workspace listing page.
 * In a real app this would fetch from the API.
 */
export default function WorkspacePage() {
  return (
    <main className="flex flex-col min-h-screen bg-ghost-bg p-8">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-ghost-text">Workspaces</h1>
          <Link
            href="/"
            className="text-sm text-ghost-muted hover:text-ghost-text transition-colors"
          >
            ← Home
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Demo workspace card */}
          <Link
            href="/workspace/demo"
            className="flex flex-col gap-2 p-4 rounded-xl border border-ghost-overlay bg-ghost-surface hover:bg-ghost-overlay transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-ghost-purple flex items-center justify-center text-ghost-bg font-bold">
                D
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ghost-text group-hover:text-ghost-purple transition-colors">
                  Demo Workspace
                </h2>
                <p className="text-xs text-ghost-muted">Collaborative editing demo</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-ghost-muted">Live</span>
            </div>
          </Link>
        </div>

        <p className="mt-8 text-sm text-ghost-muted">
          Create new workspaces via the API:{' '}
          <code className="text-ghost-blue font-mono text-xs">
            POST /api/workspaces
          </code>
        </p>
      </div>
    </main>
  )
}
