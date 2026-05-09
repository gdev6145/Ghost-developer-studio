'use client'

import { useState, useCallback, useMemo } from 'react'

type TaskStatus = 'running' | 'awaiting_approval' | 'completed' | 'cancelled' | 'failed'
type StepStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'skipped'

interface TaskStep {
  stepId: string
  description: string
  status: StepStatus
  createdAt: string
  updatedAt: string
}

interface OrchestratedTask {
  taskId: string
  goal: string
  status: TaskStatus
  steps: TaskStep[]
  createdAt: string
  updatedAt: string
}

interface TaskOrchestratorPanelProps {
  workspaceId: string
  apiUrl: string
  token: string
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  running: 'text-sky-400',
  awaiting_approval: 'text-amber-400',
  completed: 'text-green-400',
  cancelled: 'text-zinc-500',
  failed: 'text-red-400',
}

const STEP_ICONS: Record<StepStatus, string> = {
  pending: '⏳',
  approved: '✅',
  rejected: '❌',
  completed: '✅',
  skipped: '⏭',
}

/**
 * TaskOrchestratorPanel — AI-driven multi-step task planning and execution.
 *
 * Users describe a goal in natural language. The AI breaks it into steps.
 * Steps requiring approval pause and wait for the user to approve or reject.
 */
export function TaskOrchestratorPanel({
  workspaceId,
  apiUrl,
  token,
}: TaskOrchestratorPanelProps) {
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [currentTask, setCurrentTask] = useState<OrchestratedTask | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token]
  )

  const startTask = useCallback(async () => {
    if (!goal.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/tasks/${workspaceId}/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ goal: goal.trim(), context: context.trim() || undefined }),
      })
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)
      const task = await res.json() as OrchestratedTask
      setCurrentTask(task)
      setGoal('')
      setContext('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [goal, context, workspaceId, apiUrl, headers])

  const approveStep = useCallback(async () => {
    if (!currentTask) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${apiUrl}/api/tasks/${workspaceId}/${currentTask.taskId}/approve`,
        { method: 'POST', headers }
      )
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)
      setCurrentTask(await res.json() as OrchestratedTask)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [currentTask, workspaceId, apiUrl, headers])

  const rejectStep = useCallback(async () => {
    if (!currentTask) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${apiUrl}/api/tasks/${workspaceId}/${currentTask.taskId}/reject`,
        { method: 'POST', headers, body: JSON.stringify({}) }
      )
      if (!res.ok) throw new Error((await res.json() as { error: string }).error)
      setCurrentTask(await res.json() as OrchestratedTask)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [currentTask, workspaceId, apiUrl, headers])

  const cancelTask = useCallback(async () => {
    if (!currentTask) return
    setLoading(true)
    try {
      await fetch(`${apiUrl}/api/tasks/${workspaceId}/${currentTask.taskId}`, {
        method: 'DELETE',
        headers,
      })
      setCurrentTask(null)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [currentTask, workspaceId, apiUrl, headers])

  const pendingStep = currentTask?.steps.find(s => s.status === 'pending')
  const isTerminal =
    currentTask?.status === 'completed' ||
    currentTask?.status === 'cancelled' ||
    currentTask?.status === 'failed'

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-zinc-950 p-4">
      {/* Header */}
      <h2 className="text-sm font-semibold text-zinc-200">AI Task Orchestrator</h2>
      <p className="text-xs text-zinc-500">
        Describe a development goal. The AI will plan steps and ask for your approval before
        taking actions with side-effects.
      </p>

      {/* Goal input — shown when no active task */}
      {!currentTask && (
        <div className="flex flex-col gap-2">
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="e.g. Add pagination to the user list API, including tests"
            rows={3}
            className="w-full resize-none rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Optional: additional context (tech stack, constraints, …)"
            rows={2}
            className="w-full resize-none rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            type="button"
            onClick={startTask}
            disabled={loading || !goal.trim()}
            className="self-end rounded-lg bg-violet-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Planning…' : 'Plan task'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded bg-red-900/40 px-2 py-1 text-xs text-red-300">{error}</p>
      )}

      {/* Active task */}
      {currentTask && (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          {/* Task header */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-zinc-200">{currentTask.goal}</p>
                <p className={`mt-0.5 text-xs font-medium ${STATUS_COLORS[currentTask.status]}`}>
                  {currentTask.status.replace('_', ' ')}
                </p>
              </div>
              {!isTerminal && (
                <button
                  type="button"
                  onClick={cancelTask}
                  className="shrink-0 rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-red-900"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Steps */}
          <div className="flex-1 overflow-y-auto">
            <ol className="space-y-2">
              {currentTask.steps.map((step, idx) => (
                <li
                  key={step.stepId}
                  className={`flex gap-3 rounded-lg border px-3 py-2 text-xs ${
                    step.status === 'pending'
                      ? 'border-amber-700 bg-amber-950/30'
                      : step.status === 'rejected'
                        ? 'border-red-800 bg-red-950/30'
                        : step.status === 'completed'
                          ? 'border-zinc-700 bg-zinc-800/30'
                          : 'border-zinc-800 bg-zinc-900/30'
                  }`}
                >
                  <span className="shrink-0 text-sm">{STEP_ICONS[step.status]}</span>
                  <div className="flex-1">
                    <span className="mr-1 text-zinc-400">{idx + 1}.</span>
                    <span className="text-zinc-200">{step.description}</span>
                  </div>
                  <span className="shrink-0 text-zinc-600">{step.status}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Approval actions */}
          {pendingStep && (
            <div className="rounded-lg border border-amber-700 bg-amber-950/20 p-3">
              <p className="mb-2 text-xs font-medium text-amber-300">
                ⚠ Approval required for next step:
              </p>
              <p className="mb-3 text-xs text-zinc-300">{pendingStep.description}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={approveStep}
                  disabled={loading}
                  className="rounded bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={rejectStep}
                  disabled={loading}
                  className="rounded bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  Reject & cancel
                </button>
              </div>
            </div>
          )}

          {/* Start new task when terminal */}
          {isTerminal && (
            <button
              type="button"
              onClick={() => setCurrentTask(null)}
              className="rounded-lg bg-zinc-800 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              Start new task
            </button>
          )}
        </div>
      )}
    </div>
  )
}
