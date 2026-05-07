import Link from 'next/link'

/**
 * Landing page / workspace dashboard.
 * Users arrive here and can enter or create workspaces.
 */
export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen items-center justify-center bg-ghost-bg">
      <div className="text-center space-y-6 max-w-lg px-4">
        {/* Logo mark */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-ghost-purple flex items-center justify-center">
            <span className="text-2xl font-bold text-ghost-bg">G</span>
          </div>
          <h1 className="text-3xl font-bold text-ghost-text tracking-tight">
            Ghost Developer Studio
          </h1>
        </div>

        <p className="text-ghost-muted text-lg">
          Realtime collaborative developer operating system.
          <br />
          Multiple users. Same workspace. Live.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            '⚡ Live cursors',
            '🔄 Yjs sync',
            '💬 Workspace chat',
            '🐳 Docker previews',
            '🌿 Git integration',
          ].map(feature => (
            <span
              key={feature}
              className="px-3 py-1 rounded-full text-sm bg-ghost-overlay text-ghost-subtle border border-ghost-overlay"
            >
              {feature}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="flex gap-3 justify-center">
          <Link
            href="/workspace"
            className="px-6 py-3 rounded-lg bg-ghost-purple text-ghost-bg font-semibold hover:opacity-90 transition-opacity"
          >
            Open Studio
          </Link>
          <a
            href="https://github.com/gdev6145/Ghost-developer-studio"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 rounded-lg border border-ghost-overlay text-ghost-text hover:bg-ghost-overlay transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </main>
  )
}
