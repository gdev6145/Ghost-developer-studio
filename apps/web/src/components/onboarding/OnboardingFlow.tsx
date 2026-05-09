'use client'

import { useState } from 'react'
import { getSessionToken } from '@/lib/session'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: string
  actionLabel: string
  completed: boolean
}

interface OnboardingFlowProps {
  workspaceId: string
  apiUrl: string
  onComplete: () => void
}

const TEMPLATE_CHOICES = [
  { id: 'node-api', label: 'Node.js REST API', icon: '🟩', desc: 'Fastify + TypeScript + Prisma' },
  { id: 'next-app', label: 'Next.js Web App', icon: '▲', desc: 'Next.js 15 + Tailwind CSS' },
  { id: 'python-service', label: 'Python FastAPI', icon: '🐍', desc: 'FastAPI + Pydantic + pytest' },
  { id: 'blank', label: 'Blank workspace', icon: '📄', desc: 'Start from scratch' },
]

/**
 * OnboardingFlow — guided setup wizard for new workspace members.
 *
 * Steps:
 *  1. Choose a workspace template (seeds starter files)
 *  2. Invite collaborators
 *  3. Tour key features (AI, terminal, git, live preview)
 *  4. Launch
 */
export function OnboardingFlow({ workspaceId, apiUrl, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitedEmails, setInvitedEmails] = useState<string[]>([])
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const token = getSessionToken() ?? ''
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const applyTemplate = async () => {
    if (!selectedTemplate || selectedTemplate === 'blank') {
      setStep(s => s + 1)
      return
    }
    setApplying(true)
    setError(null)
    try {
      const res = await fetch(
        `${apiUrl}/api/templates/${selectedTemplate}/apply/${workspaceId}`,
        { method: 'POST', headers }
      )
      if (!res.ok) throw new Error(await res.text())
      setStep(s => s + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  const addInvite = () => {
    if (!inviteEmail.trim() || invitedEmails.includes(inviteEmail)) return
    setInvitedEmails(prev => [...prev, inviteEmail.trim()])
    setInviteEmail('')
  }

  const steps = [
    'Choose template',
    'Invite team',
    'Feature tour',
    'Ready',
  ]

  const featureTourItems = [
    { icon: '✦', title: 'AI Pair Programmer', desc: 'Use the AI tab to get code completions, explanations, reviews, and task orchestration.' },
    { icon: '⚡', title: 'Collaborative Terminal', desc: 'Share terminals with your team in real-time from the Terminal panel.' },
    { icon: '⎇', title: 'Git Branch Visualization', desc: 'Manage branches and see a visual history from the Git tab.' },
    { icon: '🔴', title: 'Collaborative Debugging', desc: 'Share breakpoints and debug state with teammates in the Debug panel.' },
    { icon: '📋', title: 'Audit Log', desc: 'Every action is logged — use the Audit tab to review workspace activity.' },
    { icon: '⚙', title: 'Task Orchestrator', desc: 'Describe a goal and let AI plan and execute multi-step development tasks.' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Progress header */}
        <div className="border-b border-zinc-700 bg-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-semibold text-white">Set up your workspace</h1>
            <span className="text-xs text-zinc-400">Step {step + 1} of {steps.length}</span>
          </div>
          <div className="flex gap-1">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-violet-500' : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            {steps.map((s, i) => (
              <span
                key={s}
                className={`flex-1 text-center text-[10px] ${
                  i === step ? 'text-violet-300 font-medium' : 'text-zinc-600'
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="p-6">
          {/* Step 0: Template chooser */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-zinc-400">
                Start with a template to seed your workspace with starter files, or begin blank.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATE_CHOICES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-all ${
                      selectedTemplate === t.id
                        ? 'border-violet-500 bg-violet-950/30'
                        : 'border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span className="text-sm font-medium text-white">{t.label}</span>
                    <span className="text-xs text-zinc-400">{t.desc}</span>
                  </button>
                ))}
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          )}

          {/* Step 1: Invite teammates */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-zinc-400">
                Ghost Studio is built for teams. Invite collaborators to your workspace.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addInvite()}
                  className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={addInvite}
                  className="rounded-lg bg-zinc-700 px-3 py-2 text-sm text-white hover:bg-zinc-600"
                >
                  Add
                </button>
              </div>
              {invitedEmails.length > 0 && (
                <ul className="space-y-1">
                  {invitedEmails.map(email => (
                    <li key={email} className="flex items-center gap-2 text-sm text-zinc-300">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      {email}
                      <button
                        type="button"
                        onClick={() => setInvitedEmails(prev => prev.filter(e => e !== email))}
                        className="ml-auto text-zinc-500 hover:text-white"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-zinc-600">
                Invitations will be sent via email. You can always invite more people later from the Members tab.
              </p>
            </div>
          )}

          {/* Step 2: Feature tour */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-zinc-400">
                Here&apos;s what makes Ghost Developer Studio powerful:
              </p>
              <ul className="space-y-3">
                {featureTourItems.map(item => (
                  <li key={item.title} className="flex gap-3">
                    <span className="text-lg shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-zinc-400">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step 3: Ready */}
          {step === 3 && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-4xl">
                👻
              </div>
              <h2 className="text-xl font-semibold text-white">You&apos;re all set!</h2>
              <p className="text-sm text-zinc-400 max-w-sm">
                Your workspace is ready. Start coding, invite your team, and use AI to ship faster.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-zinc-700 px-6 py-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="text-sm text-zinc-400 hover:text-white"
            >
              ← Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onComplete}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Skip setup
            </button>
          )}

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={step === 0 ? applyTemplate : () => setStep(s => s + 1)}
              disabled={step === 0 && !selectedTemplate || applying}
              className="rounded-lg bg-violet-700 px-5 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {applying ? 'Applying…' : 'Continue →'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onComplete}
              className="rounded-lg bg-violet-700 px-5 py-2 text-sm font-medium text-white hover:bg-violet-600"
            >
              Open workspace →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
