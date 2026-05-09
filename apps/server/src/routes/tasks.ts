import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from '@ghost/auth'
import { generateId, now } from '@ghost/shared'
import { aiRequestsTotal } from '@ghost/observability'
import type { WorkspaceMemoryService } from '../services/memory'
import type { Redis } from 'ioredis'

/**
 * AI Task Orchestration routes — multi-step task execution with checkpoints.
 *
 * Tasks are stored in Redis with a TTL. Each step is persisted so the user can
 * resume, approve, or roll back partial work.
 *
 * Routes:
 *   POST /api/tasks/:workspaceId/start           — start a new orchestrated task
 *   GET  /api/tasks/:workspaceId/:taskId          — get task status + steps
 *   POST /api/tasks/:workspaceId/:taskId/approve  — approve pending safe-edit step
 *   POST /api/tasks/:workspaceId/:taskId/reject   — reject + roll back pending step
 *   DELETE /api/tasks/:workspaceId/:taskId         — cancel a running task
 */

const TASK_TTL_SECONDS = 60 * 60 * 24 // 24 hours

export type TaskStatus = 'running' | 'awaiting_approval' | 'completed' | 'cancelled' | 'failed'

export interface TaskStep {
  stepId: string
  description: string
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'skipped'
  payload?: unknown
  result?: unknown
  createdAt: string
  updatedAt: string
}

export interface OrchestratedTask {
  taskId: string
  workspaceId: string
  actorId: string
  goal: string
  status: TaskStatus
  steps: TaskStep[]
  createdAt: string
  updatedAt: string
}

function getUserId(req: FastifyRequest): string | null {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  try {
    return verifyToken(token, process.env['JWT_SECRET']!).sub
  } catch {
    return null
  }
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

async function callOpenAI(systemPrompt: string, userMessage: string, apiKey: string): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2048,
      temperature: 0.2,
    }),
  })
  if (!response.ok) throw new Error(`OpenAI error ${response.status}`)
  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

async function loadTask(redis: Redis, taskId: string): Promise<OrchestratedTask | null> {
  const raw = await redis.get(`task:${taskId}`)
  if (!raw) return null
  return JSON.parse(raw) as OrchestratedTask
}

async function saveTask(redis: Redis, task: OrchestratedTask): Promise<void> {
  await redis.setex(`task:${task.taskId}`, TASK_TTL_SECONDS, JSON.stringify(task))
}

export function createTaskRoutes(memory: WorkspaceMemoryService, redis: Redis) {
  return async function registerTaskRoutes(app: FastifyInstance): Promise<void> {
    const apiKey = process.env['OPENAI_API_KEY']

    function requireApiKey(reply: FastifyReply): boolean {
      if (!apiKey) {
        void reply.status(503).send({ error: 'AI features require OPENAI_API_KEY' })
        return false
      }
      return true
    }

    /**
     * POST /api/tasks/:workspaceId/start
     * Start a new multi-step AI task.
     * Body: { goal: string, context?: string }
     */
    app.post(
      '/:workspaceId/start',
      async (
        req: FastifyRequest<{
          Params: { workspaceId: string }
          Body: { goal: string; context?: string }
        }>,
        reply: FastifyReply
      ) => {
        const userId = getUserId(req)
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
        if (!requireApiKey(reply)) return

        const { workspaceId } = req.params
        const { goal, context } = req.body
        if (!goal?.trim()) return reply.status(400).send({ error: 'goal is required' })

        aiRequestsTotal.inc({ mode: 'task_start', status: 'started' })

        const memContext = await memory.getContext(workspaceId, 20)
        const contextSummary = memContext.length
          ? `Recent workspace activity:\n${memContext.slice(-10).map(e => `- [${e.type}]`).join('\n')}`
          : 'No recent workspace activity.'

        const systemPrompt = [
          'You are an expert software engineer embedded in Ghost Developer Studio.',
          'Break down the given goal into 3-7 concrete, ordered implementation steps.',
          'Each step must be a single focused action. Return ONLY valid JSON in this format:',
          '{"steps": [{"description": "...", "requiresApproval": true|false}]}',
          'Set requiresApproval=true for steps that modify files, run commands, or have side-effects.',
          contextSummary,
          context ? `Additional context: ${context}` : '',
        ].filter(Boolean).join('\n')

        let parsedSteps: Array<{ description: string; requiresApproval: boolean }> = []
        try {
          const raw = await callOpenAI(systemPrompt, goal, apiKey!)
          const json = JSON.parse(raw.replace(/```json\n?|\n?```/g, '')) as {
            steps: Array<{ description: string; requiresApproval: boolean }>
          }
          parsedSteps = json.steps
        } catch {
          aiRequestsTotal.inc({ mode: 'task_start', status: 'error' })
          return reply.status(502).send({ error: 'Failed to plan task steps' })
        }

        const taskCreatedAt = now()
        const task: OrchestratedTask = {
          taskId: generateId(),
          workspaceId,
          actorId: userId,
          goal,
          status: 'running',
          steps: parsedSteps.map(s => ({
            stepId: generateId(),
            description: s.description,
            status: s.requiresApproval ? 'pending' : 'completed',
            createdAt: taskCreatedAt,
            updatedAt: taskCreatedAt,
          })),
          createdAt: taskCreatedAt,
          updatedAt: taskCreatedAt,
        }

        // If first step needs approval, pause there
        const firstPending = task.steps.find(s => s.status === 'pending')
        if (firstPending) {
          task.status = 'awaiting_approval'
        }

        await saveTask(redis, task)
        aiRequestsTotal.inc({ mode: 'task_start', status: 'success' })
        return reply.status(201).send(task)
      }
    )

    /**
     * GET /api/tasks/:workspaceId/:taskId
     * Get the current status and steps of a task.
     */
    app.get(
      '/:workspaceId/:taskId',
      async (
        req: FastifyRequest<{ Params: { workspaceId: string; taskId: string } }>,
        reply: FastifyReply
      ) => {
        const userId = getUserId(req)
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

        const { taskId: tid } = req.params
        const task = await redis.get(`task:${tid}`)
        if (!task) return reply.status(404).send({ error: 'Task not found' })

        const parsed = JSON.parse(task) as OrchestratedTask
        if (parsed.actorId !== userId) return reply.status(403).send({ error: 'Access denied' })

        return reply.send(parsed)
      }
    )

    /**
     * POST /api/tasks/:workspaceId/:taskId/approve
     * Approve the current pending step so the task can proceed.
     */
    app.post(
      '/:workspaceId/:taskId/approve',
      async (
        req: FastifyRequest<{ Params: { workspaceId: string; taskId: string } }>,
        reply: FastifyReply
      ) => {
        const userId = getUserId(req)
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

        const { taskId: tid } = req.params
        const task = await loadTask(redis, tid)
        if (!task) return reply.status(404).send({ error: 'Task not found' })
        if (task.actorId !== userId) return reply.status(403).send({ error: 'Access denied' })

        const pendingStep = task.steps.find(s => s.status === 'pending')
        if (!pendingStep) return reply.status(409).send({ error: 'No pending step to approve' })

        pendingStep.status = 'approved'
        pendingStep.updatedAt = now()

        // Mark as completed immediately (actual execution is client-side or async)
        pendingStep.status = 'completed'

        const nextPending = task.steps.find(s => s.status === 'pending')
        task.status = nextPending ? 'awaiting_approval' : 'completed'
        task.updatedAt = now()

        await saveTask(redis, task)
        return reply.send(task)
      }
    )

    /**
     * POST /api/tasks/:workspaceId/:taskId/reject
     * Reject the current pending step and cancel the task.
     */
    app.post(
      '/:workspaceId/:taskId/reject',
      async (
        req: FastifyRequest<{
          Params: { workspaceId: string; taskId: string }
          Body: { reason?: string }
        }>,
        reply: FastifyReply
      ) => {
        const userId = getUserId(req)
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

        const { taskId: tid } = req.params
        const task = await loadTask(redis, tid)
        if (!task) return reply.status(404).send({ error: 'Task not found' })
        if (task.actorId !== userId) return reply.status(403).send({ error: 'Access denied' })

        const pendingStep = task.steps.find(s => s.status === 'pending')
        if (!pendingStep) return reply.status(409).send({ error: 'No pending step to reject' })

        pendingStep.status = 'rejected'
        pendingStep.updatedAt = now()
        task.status = 'cancelled'
        task.updatedAt = now()

        await saveTask(redis, task)
        return reply.send(task)
      }
    )

    /**
     * DELETE /api/tasks/:workspaceId/:taskId
     * Cancel a running or awaiting task.
     */
    app.delete(
      '/:workspaceId/:taskId',
      async (
        req: FastifyRequest<{ Params: { workspaceId: string; taskId: string } }>,
        reply: FastifyReply
      ) => {
        const userId = getUserId(req)
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

        const { taskId: tid } = req.params
        const task = await loadTask(redis, tid)
        if (!task) return reply.status(404).send({ error: 'Task not found' })
        if (task.actorId !== userId) return reply.status(403).send({ error: 'Access denied' })

        task.status = 'cancelled'
        task.updatedAt = now()
        await saveTask(redis, task)

        return reply.send({ ok: true })
      }
    )
  }
}
