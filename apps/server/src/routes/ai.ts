import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from '@ghost/auth'
import type { WorkspaceMemoryService } from '../services/memory'

/**
 * AI Pair Programming routes — code assistance powered by OpenAI.
 *
 * The workspace memory service provides recent event context so the model
 * is aware of what the team has been working on.
 *
 * Routes:
 *   POST /api/ai/:workspaceId/complete  — code completion / continuation
 *   POST /api/ai/:workspaceId/explain   — explain selected code
 *   POST /api/ai/:workspaceId/review    — review code for issues
 *   POST /api/ai/:workspaceId/chat      — freeform AI chat in workspace context
 *
 * Requires environment variable: OPENAI_API_KEY
 */

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
const DEFAULT_MODEL = 'gpt-4o-mini'
const AI_CONTEXT_MAX_EVENTS = 10
const AI_CHAT_CONTEXT_MAX_EVENTS = 20
const AI_PAYLOAD_SUMMARY_MAX_LEN = 80

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI error ${response.status}: ${text}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices[0]?.message?.content ?? ''
}

function buildContextSummary(events: Array<{ type: string; payload: unknown }>): string {
  if (events.length === 0) return 'No recent workspace activity.'
  const lines = events.slice(-AI_CONTEXT_MAX_EVENTS).map(e => `- [${e.type}] ${JSON.stringify(e.payload).slice(0, AI_PAYLOAD_SUMMARY_MAX_LEN)}`)
  return `Recent workspace activity:\n${lines.join('\n')}`
}

export function createAiRoutes(memory: WorkspaceMemoryService) {
  return async function registerAiRoutes(app: FastifyInstance): Promise<void> {
    const apiKey = process.env['OPENAI_API_KEY']

    function requireApiKey(reply: FastifyReply): boolean {
      if (!apiKey) {
        void reply.status(503).send({ error: 'AI features require OPENAI_API_KEY to be configured' })
        return false
      }
      return true
    }

    /**
     * POST /api/ai/:workspaceId/complete
     * Continue or complete code at the cursor.
     * Body: { code: string, language: string, cursor?: number }
     */
    app.post(
      '/:workspaceId/complete',
      async (
        req: FastifyRequest<{
          Params: { workspaceId: string }
          Body: { code: string; language: string; cursor?: number }
        }>,
        reply: FastifyReply
      ) => {
        const userId = getUserId(req)
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
        if (!requireApiKey(reply)) return

        const { workspaceId } = req.params
        const { code, language } = req.body

        const context = await memory.getContext(workspaceId, AI_CONTEXT_MAX_EVENTS)
        const contextSummary = buildContextSummary(context)

        const systemPrompt = [
          `You are an expert ${language} developer assisting a team via Ghost Developer Studio.`,
          contextSummary,
          'Provide only the completion code, no explanation. Match the existing code style.',
        ].join('\n')

        try {
          const suggestion = await callOpenAI(systemPrompt, code, apiKey!)
          return reply.send({ suggestion })
        } catch (err) {
          return reply.status(502).send({ error: (err as Error).message })
        }
      }
    )

    /**
     * POST /api/ai/:workspaceId/explain
     * Explain selected code in plain language.
     * Body: { code: string, language: string }
     */
    app.post(
      '/:workspaceId/explain',
      async (
        req: FastifyRequest<{
          Params: { workspaceId: string }
          Body: { code: string; language: string }
        }>,
        reply: FastifyReply
      ) => {
        const userId = getUserId(req)
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
        if (!requireApiKey(reply)) return

        const { code, language } = req.body

        const systemPrompt = `You are an expert ${language} developer. Explain the following code clearly and concisely for a developer audience. Be brief.`

        try {
          const explanation = await callOpenAI(systemPrompt, code, apiKey!)
          return reply.send({ explanation })
        } catch (err) {
          return reply.status(502).send({ error: (err as Error).message })
        }
      }
    )

    /**
     * POST /api/ai/:workspaceId/review
     * Review code and suggest improvements.
     * Body: { code: string, language: string }
     */
    app.post(
      '/:workspaceId/review',
      async (
        req: FastifyRequest<{
          Params: { workspaceId: string }
          Body: { code: string; language: string }
        }>,
        reply: FastifyReply
      ) => {
        const userId = getUserId(req)
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
        if (!requireApiKey(reply)) return

        const { code, language } = req.body

        const systemPrompt = `You are a senior ${language} engineer performing a code review. Identify bugs, security issues, and style problems. Be concise. Format as a numbered list.`

        try {
          const review = await callOpenAI(systemPrompt, code, apiKey!)
          return reply.send({ review })
        } catch (err) {
          return reply.status(502).send({ error: (err as Error).message })
        }
      }
    )

    /**
     * POST /api/ai/:workspaceId/chat
     * Freeform AI chat with workspace context.
     * Body: { message: string }
     */
    app.post(
      '/:workspaceId/chat',
      async (
        req: FastifyRequest<{
          Params: { workspaceId: string }
          Body: { message: string }
        }>,
        reply: FastifyReply
      ) => {
        const userId = getUserId(req)
        if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
        if (!requireApiKey(reply)) return

        const { workspaceId } = req.params
        const { message } = req.body

        const context = await memory.getContext(workspaceId, AI_CHAT_CONTEXT_MAX_EVENTS)
        const contextSummary = buildContextSummary(context)

        const systemPrompt = [
          'You are an expert software engineer embedded in Ghost Developer Studio, a collaborative coding platform.',
          'You help the team with code questions, architecture decisions, debugging, and best practices.',
          contextSummary,
        ].join('\n')

        try {
          const response = await callOpenAI(systemPrompt, message, apiKey!)
          return reply.send({ response })
        } catch (err) {
          return reply.status(502).send({ error: (err as Error).message })
        }
      }
    )
  }
}
