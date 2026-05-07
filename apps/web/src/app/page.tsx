import Link from 'next/link'

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function GhostIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor">
      <path d="M16 2C9.373 2 4 7.373 4 14v14l4-4 4 4 4-4 4 4 4-4V14C24 7.373 18.627 2 16 2zm-4 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm8 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
    </svg>
  )
}

function SparkleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  )
}

function UsersIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function RocketIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  )
}

function BrainIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z" />
    </svg>
  )
}

function GitForkIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
      <line x1="12" y1="12" x2="12" y2="15" />
    </svg>
  )
}

function BarChartIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function ClockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function LayoutIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  )
}

function BellIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function CheckCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function ChevronRightIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ChevronDownIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ─── Dashboard Mock ────────────────────────────────────────────────────────────

function DashboardMock() {
  const recentProjects = [
    { name: 'SaaS Landing Page', tech: 'Next.js · Tailwind CSS', time: '2h ago', initial: 'N', color: '#4F46E5' },
    { name: 'AI Chat Dashboard', tech: 'Next.js · TypeScript', time: '5h ago', initial: 'A', color: '#7C3AED' },
    { name: 'E-commerce Store', tech: 'Next.js · Stripe', time: '1d ago', initial: 'E', color: '#0F766E' },
    { name: 'Task Management App', tech: 'React · Firebase', time: '2d ago', initial: 'T', color: '#B45309' },
  ]

  const recentActivity = [
    { text: 'AI Improved Checkout Flow', time: '2h ago' },
    { text: 'Updated pricing section', time: '5h ago' },
    { text: 'Fixed login redirect issue', time: '1d ago' },
    { text: 'Optimized database queries', time: '2d ago' },
  ]

  const navItems = [
    { icon: '⊞', label: 'Dashboard', active: true },
    { icon: '◫', label: 'Projects' },
    { icon: '⧉', label: 'Templates' },
    { icon: '⑂', label: 'Forks' },
    { icon: '⬆', label: 'Deployments' },
    { icon: '⎊', label: 'Analytics' },
    { icon: '✦', label: 'AI Insights' },
    { icon: '⁂', label: 'Team' },
    { icon: '⚙', label: 'Settings' },
  ]

  return (
    <div className="bg-[#0C0C16] rounded-xl border border-[#1E1E30] overflow-hidden shadow-2xl text-[10px] leading-tight">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1A1A2A] bg-[#090910]">
        <div className="flex items-center gap-1.5">
          <GhostIcon className="w-3 h-3 text-purple-400" />
          <span className="text-[9px] font-bold text-white">GHOST</span>
          <span className="text-[9px] font-light text-purple-400">DEV STUDIO</span>
        </div>
        <div className="flex items-center gap-1.5 flex-1 mx-3">
          <div className="flex items-center gap-1 bg-[#13131F] border border-[#252535] rounded px-2 py-0.5 flex-1 max-w-32">
            <SearchIcon className="w-2.5 h-2.5 text-gray-500" />
            <span className="text-[9px] text-gray-500">Search projects...</span>
            <span className="ml-auto text-[8px] text-gray-600 bg-[#1E1E2E] px-1 rounded">⌘K</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BellIcon className="w-3 h-3 text-gray-500" />
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
          <ChevronRightIcon className="w-2.5 h-2.5 text-gray-500" />
        </div>
      </div>

      <div className="flex" style={{ height: '340px' }}>
        {/* Sidebar */}
        <div className="w-28 border-r border-[#1A1A2A] bg-[#090910] flex flex-col py-2 gap-0.5 flex-shrink-0">
          {navItems.map(item => (
            <div
              key={item.label}
              className={`flex items-center gap-2 px-3 py-1.5 mx-1 rounded cursor-pointer transition-colors ${
                item.active
                  ? 'bg-[#1E1040] text-purple-300'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="text-[10px]">{item.icon}</span>
              <span className="text-[9px]">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Main area + Right panel */}
          <div className="flex flex-1 overflow-hidden">
            {/* Center */}
            <div className="flex-1 p-3 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[11px] font-semibold text-white">Welcome back, Alex 👋</div>
                  <div className="text-[9px] text-gray-500">Here&apos;s what&apos;s happening with your projects.</div>
                </div>
                <button className="flex items-center gap-1 bg-[#7C3AED] text-white px-2 py-1 rounded text-[9px] font-medium">
                  <PlusIcon className="w-2.5 h-2.5" />
                  New Project
                </button>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {[
                  { label: 'Projects', value: '24', change: '+12%', icon: '◫' },
                  { label: 'Deployments', value: '56', change: '+23%', icon: '⬆' },
                  { label: 'AI Improvements', value: '142', change: '+45%', icon: '✦' },
                  { label: 'Active Users', value: '2.1K', change: '+18%', icon: '⁂' },
                ].map(stat => (
                  <div key={stat.label} className="bg-[#111120] border border-[#1E1E30] rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[8px] text-gray-500">{stat.label}</span>
                      <span className="text-[10px] text-gray-500">{stat.icon}</span>
                    </div>
                    <div className="text-[14px] font-bold text-white">{stat.value}</div>
                    <div className="text-[8px] text-green-400">{stat.change} this month</div>
                  </div>
                ))}
              </div>

              {/* Recent Projects */}
              <div className="bg-[#0E0E1A] border border-[#1A1A2A] rounded overflow-hidden">
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#1A1A2A]">
                  <span className="text-[10px] font-semibold text-white">Recent Projects</span>
                  <span className="text-[9px] text-purple-400 cursor-pointer">View all</span>
                </div>
                {recentProjects.map((p, i) => (
                  <div
                    key={p.name}
                    className={`flex items-center gap-2 px-2 py-1.5 ${i < recentProjects.length - 1 ? 'border-b border-[#1A1A2A]' : ''}`}
                  >
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: p.color, fontSize: '7px', fontWeight: 700 }}
                    >
                      {p.initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] text-white font-medium truncate">{p.name}</div>
                      <div className="text-[8px] text-gray-500 truncate">{p.tech}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[8px] text-green-400 flex items-center gap-0.5">
                        <CheckCircleIcon className="w-2 h-2" /> Deployed
                      </span>
                      <span className="text-[8px] text-gray-600">{p.time}</span>
                      <ChevronRightIcon className="w-2 h-2 text-gray-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel */}
            <div className="w-36 border-l border-[#1A1A2A] p-2 flex flex-col gap-2 flex-shrink-0 overflow-hidden">
              {/* AI Evolution Status */}
              <div className="bg-[#0E0E1A] border border-[#1A1A2A] rounded p-2">
                <div className="text-[9px] font-semibold text-white mb-0.5">AI Evolution Status</div>
                <div className="text-[8px] text-gray-500 mb-2">Your apps are getting smarter</div>
                <div className="flex items-center justify-center mb-1">
                  {/* Donut chart */}
                  <div className="relative w-14 h-14">
                    <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                      <circle cx="28" cy="28" r="20" fill="none" stroke="#1E1E30" strokeWidth="6" />
                      <circle
                        cx="28" cy="28" r="20" fill="none"
                        stroke="#7C3AED" strokeWidth="6"
                        strokeDasharray={`${0.78 * 125.7} ${125.7}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[11px] font-bold text-white">78%</span>
                      <span className="text-[6px] text-gray-500 text-center leading-tight">Improvement<br/>Score</span>
                    </div>
                  </div>
                </div>
                {/* Sparkline */}
                <svg viewBox="0 0 100 20" className="w-full h-4">
                  <polyline
                    points="0,16 20,12 35,14 50,8 65,10 80,4 100,6"
                    fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Recent Activity */}
              <div>
                <div className="text-[9px] font-semibold text-white mb-1.5">Recent Activity</div>
                <div className="flex flex-col gap-1.5">
                  {recentActivity.map((a, i) => {
                    const icons = ['⬆', '✎', '✓', '⚡']
                    return (
                      <div key={i} className="flex items-start gap-1">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#1A1030] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[6px] text-purple-400">{icons[i]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[8px] text-gray-300 leading-tight truncate">{a.text}</div>
                          <div className="text-[7px] text-gray-600">{a.time}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Feature Card: AI-Powered Development ─────────────────────────────────────

function AIPoweredCard() {
  return (
    <div className="bg-[#0E0E1A] border border-[#1A1A2A] rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-bold text-white mb-1">AI-Powered Development</h3>
        <p className="text-sm text-gray-500">Write, edit, and improve your code with AI in real-time.</p>
      </div>
      <div className="bg-[#080810] rounded-xl border border-[#1A1A2A] overflow-hidden text-[10px] leading-tight flex-1">
        {/* Tab bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1A1A2A] bg-[#090910]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <span className="text-[10px] text-gray-400 bg-[#111120] px-2 py-0.5 rounded border border-[#1E1E30]">page.tsx</span>
          <span className="text-gray-600 text-[10px] ml-1">×</span>
        </div>
        {/* Code area */}
        <div className="flex" style={{ minHeight: '140px' }}>
          <div className="px-2 py-2 text-[9px] text-gray-700 select-none border-r border-[#1A1A2A] flex flex-col gap-1">
            {Array.from({ length: 13 }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <div className="p-2 flex-1 font-mono text-[9px]">
            <div><span className="text-purple-400">export default function</span> <span className="text-yellow-300">Home</span><span className="text-white">() {'{'}</span></div>
            <div><span className="text-white pl-4">return (</span></div>
            <div><span className="text-blue-300 pl-8">&lt;div</span> <span className="text-green-300">className</span><span className="text-white">=</span><span className="text-orange-300">&quot;min-h-screen flex</span></div>
            <div><span className="text-blue-300 pl-10">&lt;h1</span> <span className="text-green-300">className</span><span className="text-white">=</span><span className="text-orange-300">&quot;text-4xl font-bold</span></div>
            <div><span className="text-gray-400 pl-12">Welcome to Ghost Dev Studio</span></div>
            <div><span className="text-blue-300 pl-10">&lt;/h1&gt;</span></div>
            <div><span className="text-blue-300 pl-10">&lt;p</span> <span className="text-green-300">className</span><span className="text-white">=</span><span className="text-orange-300">&quot;mt-4 text-gray-400&quot;</span><span className="text-blue-300">&gt;</span></div>
            <div><span className="text-gray-400 pl-12">Build something amazing.</span></div>
            <div><span className="text-blue-300 pl-10">&lt;/p&gt;</span></div>
            <div><span className="text-blue-300 pl-8">&lt;/div&gt;</span></div>
            <div><span className="text-white pl-4">)</span></div>
            <div><span className="text-white">{'}'}</span></div>
          </div>
          {/* AI Chat overlay */}
          <div className="absolute-ish m-2 w-40 bg-[#0E0E1A] border border-[#2D1B69] rounded-lg p-2 shadow-xl self-end" style={{ alignSelf: 'flex-end', margin: '8px' }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1">
                <GhostIcon className="w-3 h-3 text-purple-400" />
                <span className="text-[9px] font-semibold text-white">Ghost AI</span>
              </div>
              <span className="text-gray-600 text-[9px]">×</span>
            </div>
            <div className="text-[8px] text-gray-400 mb-1.5">How can I improve this landing page?</div>
            <div className="text-[8px] text-gray-300 mb-2">I&apos;ll help you improve this landing page. Here are some suggestions:</div>
            <button className="w-full bg-[#1A1030] border border-[#3D2280] text-purple-300 text-[8px] py-1 px-2 rounded mb-1.5">
              Add gradient background
            </button>
            <div className="flex items-center gap-1 bg-[#111120] border border-[#1E1E30] rounded px-1.5 py-1">
              <span className="text-[8px] text-gray-500 flex-1">Ask anything...</span>
              <div className="w-3.5 h-3.5 bg-purple-600 rounded flex items-center justify-center">
                <span className="text-[6px] text-white">→</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Feature Card: Real-time Preview ─────────────────────────────────────────

function RealtimePreviewCard() {
  return (
    <div className="bg-[#0E0E1A] border border-[#1A1A2A] rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-bold text-white mb-1" style={{ color: '#A78BFA' }}>Real-time Preview</h3>
        <p className="text-sm text-gray-500">See changes instantly as you build.</p>
      </div>
      <div className="bg-[#080810] rounded-xl border border-[#1A1A2A] overflow-hidden flex-1">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#1A1A2A] bg-[#090910]">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
          <div className="flex-1 bg-[#111120] border border-[#1E1E30] rounded text-[8px] text-gray-500 px-2 py-0.5 text-center">
            https://preview.ghost.run/saas-landing
          </div>
          <div className="flex items-center gap-1 bg-green-900/40 border border-green-700/40 px-1.5 py-0.5 rounded">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[8px] text-green-400">Live</span>
          </div>
        </div>
        {/* Preview content */}
        <div className="relative overflow-hidden" style={{ minHeight: '160px' }}>
          <div className="bg-gradient-to-br from-[#0D0520] via-[#110B2E] to-[#060612] absolute inset-0" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-900 to-indigo-900 mb-3 flex items-center justify-center opacity-80">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-700 to-indigo-700" />
            </div>
            <h2 className="text-sm font-bold text-white leading-tight">Build Smarter.<br/>Ship Faster.<br/><span className="text-purple-400">Evolve Forever.</span></h2>
            <p className="text-[9px] text-gray-400 mt-1 max-w-28">The modern development platform for AI-powered teams.</p>
            <div className="flex gap-1.5 mt-2">
              <button className="bg-purple-700 text-white text-[8px] px-2.5 py-1 rounded font-medium">Get Started</button>
              <button className="border border-gray-600 text-gray-300 text-[8px] px-2.5 py-1 rounded">Learn More</button>
            </div>
          </div>
        </div>
        {/* Device toggles */}
        <div className="flex justify-center gap-3 py-1.5 border-t border-[#1A1A2A]">
          {['⊠', '⊟', '⊡', '⊞'].map((icon, i) => (
            <button key={i} className={`text-[10px] ${i === 0 ? 'text-purple-400' : 'text-gray-600'}`}>{icon}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Feature Card: One-Click Deploy ──────────────────────────────────────────

function OneClickDeployCard() {
  return (
    <div className="bg-[#0E0E1A] border border-[#1A1A2A] rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-bold mb-1" style={{ color: '#60A5FA' }}>One-Click Deploy</h3>
        <p className="text-sm text-gray-500">Deploy your app globally in seconds.</p>
      </div>
      <div className="bg-[#080810] rounded-xl border border-[#1A1A2A] p-4 flex flex-col gap-3 flex-1">
        <div className="text-sm font-semibold text-white">Deploy</div>
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Environment</label>
            <div className="flex items-center justify-between bg-[#0E0E1A] border border-[#1E1E30] rounded px-2.5 py-1.5">
              <span className="text-xs text-gray-300">Production</span>
              <ChevronDownIcon className="w-3 h-3 text-gray-500" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Domains</label>
            <div className="bg-[#0E0E1A] border border-[#1E1E30] rounded px-2.5 py-1.5 flex items-center justify-between">
              <span className="text-xs text-gray-300">saas-landing.ghost.app</span>
              <span className="text-[9px] bg-green-900/40 text-green-400 border border-green-700/40 px-1.5 py-0.5 rounded">Primary</span>
            </div>
            <button className="flex items-center gap-1 text-[10px] text-gray-500 mt-1.5 hover:text-gray-300 transition-colors">
              <PlusIcon className="w-3 h-3" /> Add Domain
            </button>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Region</label>
            <div className="flex items-center justify-between bg-[#0E0E1A] border border-[#1E1E30] rounded px-2.5 py-1.5">
              <span className="text-xs text-gray-300">Global (Edge)</span>
              <ChevronDownIcon className="w-3 h-3 text-gray-500" />
            </div>
          </div>
        </div>
        <button className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors text-white font-semibold text-sm py-2 rounded-lg flex items-center justify-center gap-2">
          Deploy Now 🚀
        </button>
      </div>
    </div>
  )
}

// ─── Feature Card: Self-Evolving Apps ─────────────────────────────────────────

function SelfEvolvingCard() {
  return (
    <div className="bg-[#0E0E1A] border border-[#1A1A2A] rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-bold mb-1" style={{ color: '#F472B6' }}>Self-Evolving Apps</h3>
        <p className="text-sm text-gray-500">Your apps continuously improve based on real usage.</p>
      </div>
      <div className="bg-[#080810] rounded-xl border border-[#1A1A2A] p-3 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">AI Insights</span>
          <span className="flex items-center gap-1 text-[9px] text-green-400 bg-green-900/30 border border-green-700/30 px-1.5 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Improving
          </span>
        </div>
        {/* Main insight */}
        <div className="bg-[#0E0E1A] border border-[#1A1A2A] rounded-lg p-2.5">
          <div className="text-xs font-semibold text-white mb-0.5">Checkout Flow Improved</div>
          <div className="text-[10px] text-gray-500 mb-2">AI reduced drop-off rate by 24%</div>
          <div className="flex items-center justify-between text-[9px] text-gray-600 mb-1">
            <span>Drop-off Rate</span>
            <span className="text-green-400 font-semibold">-24%</span>
          </div>
          {/* Chart */}
          <div className="relative" style={{ height: '40px' }}>
            <svg viewBox="0 0 200 40" className="w-full h-full">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,30 C20,28 40,25 60,22 C80,19 100,20 120,18 C140,16 160,10 200,8" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M0,30 C20,28 40,25 60,22 C80,19 100,20 120,18 C140,16 160,10 200,8 L200,40 L0,40 Z" fill="url(#chartGrad)" />
            </svg>
            <div className="absolute right-1 top-1 bg-green-900/80 border border-green-600/50 text-green-400 text-[8px] px-1 py-0.5 rounded">-24%</div>
          </div>
          <div className="flex justify-between text-[8px] text-gray-700 mt-1">
            <span>May 1</span><span>May 15</span><span>May 31</span>
          </div>
        </div>
        {/* Other insights */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-purple-900/50 flex items-center justify-center">
                <SparkleIcon className="w-2.5 h-2.5 text-purple-400" />
              </div>
              <span className="text-[10px] text-gray-300">UI/UX Enhancement</span>
            </div>
            <span className="text-[9px] text-purple-400 font-medium">+18% engagement</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-green-900/50 flex items-center justify-center">
                <CheckCircleIcon className="w-2.5 h-2.5 text-green-400" />
              </div>
              <span className="text-[10px] text-gray-300">Performance Optimization</span>
            </div>
            <span className="text-[9px] text-green-400 font-medium">+32% faster load time</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const bottomFeatures = [
    {
      icon: <GitForkIcon className="w-6 h-6" />,
      title: 'Fork & Remix',
      desc: 'Fork any app and make it your own.',
    },
    {
      icon: <UsersIcon className="w-6 h-6" />,
      title: 'Collaborate',
      desc: 'Work together in real-time.',
    },
    {
      icon: <LayoutIcon className="w-6 h-6" />,
      title: 'Templates',
      desc: 'Start with beautiful, production-ready templates.',
    },
    {
      icon: <BarChartIcon className="w-6 h-6" />,
      title: 'Analytics',
      desc: 'Track performance and user behavior.',
    },
    {
      icon: <SparkleIcon className="w-6 h-6" />,
      title: 'AI Insights',
      desc: 'Get AI-powered suggestions to improve your app.',
    },
    {
      icon: <ClockIcon className="w-6 h-6" />,
      title: 'Version History',
      desc: 'Every change is saved. Roll back anytime.',
    },
  ]

  return (
    <div className="min-h-screen bg-[#080810] text-white font-sans">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="flex flex-col lg:flex-row min-h-screen">
        {/* Left: marketing */}
        <div className="relative flex flex-col justify-center px-10 py-16 lg:w-5/12 bg-gradient-to-br from-[#050508] via-[#0B0518] to-[#080810] overflow-hidden">
          {/* Background glow */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />

          {/* Logo */}
          <div className="flex items-center gap-2 mb-12 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-purple-700 flex items-center justify-center">
              <GhostIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xs font-extrabold text-white tracking-widest">GHOST</span>
              <span className="text-[9px] font-light text-purple-400 tracking-widest">DEV STUDIO</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-extrabold leading-tight mb-6 relative z-10">
            Build Smarter.<br />
            Ship Faster.<br />
            <span className="text-purple-400">Evolve Forever.</span>
          </h1>

          <p className="text-gray-400 text-base mb-8 max-w-sm relative z-10">
            The self-evolving development platform powered by AI. Build, deploy, and let your apps improve themselves.
          </p>

          <div className="flex gap-3 mb-12 relative z-10">
            <Link
              href="/workspace"
              className="px-5 py-2.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-semibold text-sm transition-colors"
            >
              Start Building
            </Link>
            <Link
              href="/workspace"
              className="px-5 py-2.5 rounded-lg border border-[#2A2A3E] text-gray-300 hover:bg-[#111120] font-semibold text-sm transition-colors"
            >
              Explore Apps
            </Link>
          </div>

          {/* Feature icons */}
          <div className="grid grid-cols-2 gap-4 relative z-10">
            {[
              { icon: <BrainIcon className="w-5 h-5 text-purple-400" />, label: 'AI-Powered Development' },
              { icon: <UsersIcon className="w-5 h-5 text-purple-400" />, label: 'Real-time Collaboration' },
              { icon: <RocketIcon className="w-5 h-5 text-purple-400" />, label: 'One-Click Deploy' },
              { icon: <SparkleIcon className="w-5 h-5 text-purple-400" />, label: 'Self-Evolving Apps' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#1A0A3A] border border-[#2D1B69] flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </div>
                <span className="text-xs text-gray-400 leading-tight">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: dashboard preview */}
        <div className="flex-1 bg-[#0A0A14] flex items-center justify-center p-6 lg:p-10 border-l border-[#111120]">
          <div className="w-full max-w-2xl">
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* ── Feature Cards ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-10 bg-[#060609]">
        <AIPoweredCard />
        <RealtimePreviewCard />
        <OneClickDeployCard />
        <SelfEvolvingCard />
      </section>

      {/* ── Bottom Feature Grid ────────────────────────────────────────────── */}
      <section className="bg-[#080810] border-t border-[#111120] px-6 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 max-w-6xl mx-auto">
          {bottomFeatures.map(f => (
            <div key={f.title} className="flex flex-col items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#110B2E] border border-[#2D1B69] flex items-center justify-center text-purple-400">
                {f.icon}
              </div>
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{f.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#111120] bg-[#060609] px-6 py-5">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-purple-700 flex items-center justify-center">
              <GhostIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">GHOST</span>
            <span className="text-sm font-light text-purple-400">DEV STUDIO</span>
          </div>
          <p className="text-xs text-gray-600">The future of software development is self-evolving.</p>
          <span className="text-xs text-gray-600">ghostdev.studio</span>
        </div>
      </footer>
    </div>
  )
}

