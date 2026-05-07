import type { FastifyInstance } from 'fastify'
import type { WorkspaceMemoryService } from '../services/memory'
import OpenAI from 'openai'

/**
 * AI pair programming route.
 *
 * POST /api/ai/:workspaceId/complete
 *   → reads workspace memory context
 *   → calls OpenAI with context + current file
 *   → returns AI response
 *
 * If OPENAI_API_KEY is not set the endpoint returns a stub response, so
 * the feature degrades gracefully without any external dependency.
 */

interface AICompleteBody {
  prompt: string
  /** The content of the file currently open in the editor */
  fileContent?: string
  filePath?: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export async function registerAIRoutes(
  app: FastifyInstance,
  opts: { memoryService: WorkspaceMemoryService }
): Promise<void> {
  const openai = process.env['OPENAI_API_KEY']
    ? new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] })
    : null

  /**
   * POST /api/ai/:workspaceId/complete
   *
   * Request body:
   *   prompt: string           — user's question / instruction
   *   fileContent?: string     — current file content for context
   *   filePath?: string        — path hint for language detection
   *   conversationHistory?     — prior messages in this AI chat session
   *
   * Response:
   *   { message: string, usage: { promptTokens, completionTokens } }
   */
  app.post<{
    Params: { workspaceId: string }
    Body: AICompleteBody
  }>('/:workspaceId/complete', async (request, reply) => {
    const { workspaceId } = request.params
    const { prompt, fileContent, filePath, conversationHistory = [] } = request.body

    // Build workspace context from recent events
    const contextEvents = await opts.memoryService.getContext(workspaceId, 15)
    const contextSummary = contextEvents
      .map(e => `[${e.type}] ${JSON.stringify(e.payload)}`)
      .join('\n')

    const systemPrompt = buildSystemPrompt(contextSummary, fileContent, filePath)

    if (!openai) {
      // Graceful stub when no API key is configured
      const stubResponse = generateStubResponse(prompt)
      return reply.send({
        message: stubResponse,
        usage: { promptTokens: 0, completionTokens: 0 },
      })
    }

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(h => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user', content: prompt },
      ]

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 2048,
        temperature: 0.2,
      })

      const message = completion.choices[0]?.message?.content ?? ''
      const usage = completion.usage

      return reply.send({
        message,
        usage: {
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI request failed'
      return reply.status(500).send({ error: msg })
    }
  })

  /**
   * GET /api/ai/:workspaceId/context
   * Returns the current workspace memory context (for debugging / display).
   */
  app.get<{ Params: { workspaceId: string } }>(
    '/:workspaceId/context',
    async (request, reply) => {
      const events = await opts.memoryService.getContext(request.params.workspaceId, 20)
      return reply.send({ events })
    }
  )
}

function buildSystemPrompt(
  contextSummary: string,
  fileContent?: string,
  filePath?: string
): string {
  let prompt = `You are an expert AI programming assistant embedded in Ghost Developer Studio, a real-time collaborative coding platform.

You help developers write, review, debug, and understand code. Be concise and practical. Use markdown for code blocks.

## Current workspace activity:
${contextSummary || 'No recent activity.'}
`

  if (fileContent && filePath) {
    prompt += `\n## Currently open file: ${filePath}\n\`\`\`\n${fileContent.slice(0, 3000)}\n\`\`\`\n`
  } else if (fileContent) {
    prompt += `\n## Currently open file:\n\`\`\`\n${fileContent.slice(0, 3000)}\n\`\`\`\n`
  }

  return prompt
}

function generateStubResponse(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase()
  if (lowerPrompt.includes('explain') || lowerPrompt.includes('what')) {
    return `I can see you're asking about: **"${prompt}"**\n\nTo enable AI responses, configure \`OPENAI_API_KEY\` in your server environment. Once enabled, I'll provide detailed answers using your workspace context.`
  }
  if (lowerPrompt.includes('fix') || lowerPrompt.includes('bug') || lowerPrompt.includes('error')) {
    return `To debug this issue, I'd recommend:\n1. Check the error message and stack trace carefully\n2. Add console.log statements to trace the data flow\n3. Verify your input/output types match\n\n*Enable \`OPENAI_API_KEY\` for AI-powered debugging assistance.*`
  }
  return `AI pair programming is available! Configure \`OPENAI_API_KEY\` in your server environment to enable intelligent code assistance powered by GPT-4.\n\nYour question: **"${prompt}"**`
}
