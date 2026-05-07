import type { Server as SocketIOServer } from 'socket.io'
import type { EventDispatcher } from '@ghost/events'
import { now } from '@ghost/shared'

/**
 * AI Pair Programming agent scaffold.
 *
 * Architecture:
 *   LLM agents subscribe to the event bus (onAny) and react to code changes.
 *   They emit suggestions back through the workspace socket room.
 *
 * This file provides the wiring and message types. Plug in any LLM provider
 * (OpenAI, Anthropic, Ollama, etc.) by implementing the `AiProvider` interface.
 *
 * Environment variables:
 *   AI_ENABLED=true                  — enable/disable AI agent
 *   AI_PROVIDER=openai|anthropic     — provider selection (extend as needed)
 *   OPENAI_API_KEY=...               — required for openai provider
 */

export interface AiSuggestion {
  suggestionId: string
  workspaceId: string
  fileId?: string
  content: string
  explanation?: string
  range?: { startLine: number; endLine: number }
  confidence: number
  createdAt: string
}

export interface AiProvider {
  /**
   * Given an event (e.g., file.updated with diff), return zero or more suggestions.
   * Return empty array to emit no suggestion.
   */
  suggest(context: AiContext): Promise<AiSuggestion[]>
}

export interface AiContext {
  workspaceId: string
  eventType: string
  payload: Record<string, unknown>
  actorId?: string
}

/**
 * Set up the AI pair programming agent.
 *
 * Pass an AiProvider implementation (e.g., OpenAiProvider) to enable
 * actual LLM-powered suggestions. When no provider is given, the agent
 * runs in scaffold-only mode (logs events but emits no suggestions).
 */
export function setupAiAgent(
  io: SocketIOServer,
  events: EventDispatcher,
  provider?: AiProvider
): void {
  if (!provider) {
    // Scaffold mode – log that the agent is wired but inactive
    events.on('file.updated', event => {
      io.to(`workspace:${event.workspaceId}`).emit('message', {
        type: 'chat.message',
        workspaceId: event.workspaceId,
        actorId: 'ai-agent',
        timestamp: now(),
        payload: {
          messageId: `ai-${Date.now()}`,
          authorId: 'ai-agent',
          authorName: 'Ghost AI',
          content: `📝 I noticed a file was updated. Connect an AI provider to enable pair programming suggestions.`,
          createdAt: now(),
        },
      })
    })
    return
  }

  // React to file update events with LLM suggestions
  events.on('file.updated', async event => {
    try {
      const suggestions = await provider.suggest({
        workspaceId: event.workspaceId,
        eventType: event.type,
        payload: event.payload,
        actorId: event.actorId,
      })

      for (const suggestion of suggestions) {
        io.to(`workspace:${event.workspaceId}`).emit('message', {
          type: 'chat.message',
          workspaceId: event.workspaceId,
          actorId: 'ai-agent',
          timestamp: now(),
          payload: {
            messageId: suggestion.suggestionId,
            authorId: 'ai-agent',
            authorName: 'Ghost AI',
            content: suggestion.content,
            createdAt: suggestion.createdAt,
          },
        })
      }
    } catch {
      // AI failures are non-fatal
    }
  })

  // React to runtime errors with AI debugging hints
  events.on('runtime.error', async event => {
    try {
      const suggestions = await provider.suggest({
        workspaceId: event.workspaceId,
        eventType: event.type,
        payload: event.payload,
        actorId: event.actorId,
      })
      for (const suggestion of suggestions) {
        io.to(`workspace:${event.workspaceId}`).emit('message', {
          type: 'chat.message',
          workspaceId: event.workspaceId,
          actorId: 'ai-agent',
          timestamp: now(),
          payload: {
            messageId: suggestion.suggestionId,
            authorId: 'ai-agent',
            authorName: 'Ghost AI',
            content: `🔍 ${suggestion.content}`,
            createdAt: suggestion.createdAt,
          },
        })
      }
    } catch {
      // AI failures are non-fatal
    }
  })
}
