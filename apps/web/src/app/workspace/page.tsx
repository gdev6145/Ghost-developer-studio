import Link from 'next/link'

/**
 * Workspace listing page.
 * In a real app this would fetch from the API.
 */
export default function WorkspacePage() {
  return (
    <main className="relative flex flex-col min-h-screen bg-[#07070f] px-4 py-8 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[42rem] h-[42rem] rounded-full bg-purple-900/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 right-0 w-96 h-96 rounded-full bg-blue-900/20 blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-pulse" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-purple-300">
                Repository Hub
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Workspaces</h1>
            <p className="text-sm text-gray-400 mt-2">
              Open active repositories, inspect status, and jump back into collaborative sessions.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors border border-[#232338] bg-[#10101a] rounded-lg px-3 py-2"
          >
            ← Home
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Active Repositories', value: '12', tone: 'text-purple-300' },
            { label: 'Live Sessions', value: '4', tone: 'text-green-300' },
            { label: 'Deploy Queue', value: '2', tone: 'text-blue-300' },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-xl border border-[#232338] bg-[#0e0e18]/90 px-4 py-3"
            >
              <p className="text-[11px] uppercase tracking-wide text-gray-500">{stat.label}</p>
              <p className={`text-xl font-semibold mt-1 ${stat.tone}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Demo workspace card */}
          <Link
            href="/workspace/demo"
            className="flex flex-col gap-3 p-4 rounded-xl border border-[#2a2a41] bg-gradient-to-br from-[#121225] to-[#0e0e1b] hover:border-purple-500/40 hover:shadow-[0_12px_30px_rgba(124,58,237,0.16)] transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-[#09090f] font-bold shadow-lg shadow-purple-900/40">
                D
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                    Demo Workspace
                  </h2>
                  <span className="text-[10px] text-gray-500">main</span>
                </div>
                <p className="text-xs text-gray-400">Collaborative editing demo</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] px-2 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300">
                Next.js
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300">
                TypeScript
              </span>
              <span className="text-[10px] px-2 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                Live Preview
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[#232338] bg-[#11111f] px-2.5 py-2">
                <p className="text-[10px] text-gray-500">Open PRs</p>
                <p className="text-sm font-semibold text-white mt-0.5">3</p>
              </div>
              <div className="rounded-lg border border-[#232338] bg-[#11111f] px-2.5 py-2">
                <p className="text-[10px] text-gray-500">Contributors</p>
                <p className="text-sm font-semibold text-white mt-0.5">6</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-0.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-gray-400">Live</span>
              </div>
              <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">
                Open workspace →
              </span>
            </div>
          </Link>

          <div className="flex flex-col gap-3 p-4 rounded-xl border border-dashed border-[#2a2a41] bg-[#0d0d17]">
            <div className="w-10 h-10 rounded-lg bg-[#181828] border border-[#2a2a41] flex items-center justify-center text-gray-500 text-xl">
              +
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Create Workspace</h2>
              <p className="text-xs text-gray-500 mt-1">
                Start a new repository with live collaboration and deployment preview.
              </p>
            </div>
            <button
              type="button"
              className="mt-auto text-xs font-medium rounded-lg border border-[#2a2a41] bg-[#141425] text-gray-300 px-3 py-2 hover:bg-[#1a1a31] hover:text-white transition-colors text-left"
            >
              Create via API →
            </button>
          </div>

          <div className="flex flex-col gap-3 p-4 rounded-xl border border-[#232338] bg-[#0f0f1a]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
              <span className="text-[10px] text-gray-500">last 24h</span>
            </div>
            <div className="space-y-2.5">
              {[
                { name: 'demo-ui-refresh', state: 'Deployed', time: '1h ago' },
                { name: 'auth-guard-fix', state: 'In review', time: '3h ago' },
                { name: 'presence-panel', state: 'Merged', time: '6h ago' },
              ].map(item => (
                <div key={item.name} className="rounded-lg border border-[#232338] bg-[#141422] px-2.5 py-2">
                  <p className="text-xs text-white truncate">{item.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-purple-300">{item.state}</p>
                    <p className="text-[10px] text-gray-500">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-8 text-sm text-gray-400">
          Create new workspaces via the API:{' '}
          <code className="text-blue-300 font-mono text-xs bg-[#0f0f1a] border border-[#232338] rounded px-1.5 py-0.5">
            POST /api/workspaces
          </code>
        </p>
      </div>
    </main>
  )
}
