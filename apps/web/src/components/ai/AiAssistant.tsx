'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { getSessionToken, getCurrentUserId } from '@/lib/session'
import type { AIMessage } from '@ghost/protocol'
import { generateId } from '@ghost/shared'
import { useEditorStore } from '@ghost/state'

interface AiAssistantProps {
  workspaceId: string
}

/**
 * AiAssistant — AI pair programming panel.
 *
 * Features:
 *  - Chat interface with AI assistant
 *  - Sends current file content as context with each request
 *  - Conversation history maintained for multi-turn interaction
 *  - Code block rendering with syntax highlighting
 *  - Graceful degradation when OPENAI_API_KEY is not configured
 *
 * Architecture:
 *   User input → POST /api/ai/:workspaceId/complete
 *   Server reads workspace memory + file content → builds system prompt
 *   → calls OpenAI → returns response
 */
export function AiAssistant({ workspaceId }: AiAssistantProps) {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeTabId = useEditorStore(s => s.activeTabId)
  const tabs = useEditorStore(s => s.tabs)
  const activeTab = tabs.find(t => t.fileId === activeTabId)

  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    const content = input.trim()
    if (!content || isLoading) return

    const userMsg: AIMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      ...(activeTabId !== null ? { contextFileId: activeTabId } : {}),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const res = await fetch(`${apiUrl}/api/ai/${workspaceId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getSessionToken()}`,
        },
        body: JSON.stringify({
          prompt: content,
          filePath: activeTab?.name,
          conversationHistory,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { message: string; usage?: Record<string, number> }

      const assistantMsg: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, workspaceId, activeTabId, activeTab, apiUrl])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  function clearConversation() {
    setMessages([])
  }

  const suggestedPrompts = [
    'Explain the current file',
    'Find potential bugs',
    'Suggest improvements',
    'Write tests for this code',
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center px-3 h-9 border-b border-ghost-overlay shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-ghost-purple text-sm">✦</span>
          <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
            AI Assistant
          </span>
        </div>
        {activeTab && (
          <span className="ml-2 text-ghost-muted opacity-70 truncate max-w-[80px]">
            · {activeTab.name}
          </span>
        )}
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="ml-auto text-ghost-muted hover:text-ghost-text text-[10px] opacity-60 hover:opacity-100"
            title="Clear conversation"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 py-2">
            <div className="text-center text-ghost-muted opacity-60 text-xs py-2">
              <div className="text-2xl mb-2 opacity-30">✦</div>
              Ask me anything about your code
            </div>

            {/* Suggested prompts */}
            <div className="space-y-1">
              {suggestedPrompts.map(p => (
                <button
                  key={p}
                  onClick={() => {
                    setInput(p)
                    textareaRef.current?.focus()
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg bg-ghost-overlay hover:bg-ghost-overlay/80 text-ghost-muted hover:text-ghost-text transition-colors text-xs"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <AIMessageBubble key={msg.id} message={msg} />
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 px-2">
            <span className="text-ghost-purple text-sm animate-pulse">✦</span>
            <div className="flex gap-0.5">
              {[0, 150, 300].map(delay => (
                <span
                  key={delay}
                  className="w-1 h-1 rounded-full bg-ghost-purple animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-2 pb-2 shrink-0">
        {activeTab && (
          <div className="flex items-center gap-1 mb-1.5 text-[10px] text-ghost-muted">
            <span className="text-ghost-purple opacity-60">context:</span>
            <span className="font-mono opacity-80">{activeTab.name}</span>
          </div>
        )}
        <div className="flex gap-1.5 items-end bg-ghost-overlay rounded-lg border border-ghost-overlay focus-within:border-ghost-purple transition-colors">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent text-xs text-ghost-text placeholder-ghost-muted resize-none p-2 outline-none leading-relaxed min-h-[36px] max-h-[120px]"
            placeholder="Ask about your code… (Enter to send)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isLoading}
            className="mb-1.5 mr-1.5 px-2 py-1 rounded-md bg-ghost-purple text-ghost-bg text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Message bubble component ─────────────────────────────────────────────────

function AIMessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={[
          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5',
          isUser ? 'bg-ghost-blue text-ghost-bg' : 'bg-ghost-purple text-ghost-bg',
        ].join(' ')}
      >
        {isUser ? 'U' : '✦'}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={[
            'rounded-lg px-3 py-2 text-xs leading-relaxed',
            isUser
              ? 'bg-ghost-blue/20 text-ghost-text'
              : 'bg-ghost-surface border border-ghost-overlay text-ghost-text',
          ].join(' ')}
        >
          <MarkdownContent content={message.content} />
        </div>
        <span className="text-[10px] text-ghost-muted mt-0.5 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

/**
 * Minimal markdown renderer for AI responses.
 * Handles code blocks, bold, and inline code.
 */
function MarkdownContent({ content }: { content: string }) {
  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          // Extract language hint and code
          const lines = part.slice(3, -3).split('\n')
          const lang = lines[0]?.trim() ?? ''
          const code = lines.slice(1).join('\n')
          return (
            <pre
              key={i}
              className="my-1.5 p-2 rounded bg-ghost-bg border border-ghost-overlay overflow-x-auto text-[11px] font-mono text-ghost-text"
            >
              {lang && (
                <div className="text-ghost-muted text-[9px] mb-1 uppercase">{lang}</div>
              )}
              <code>{code}</code>
            </pre>
          )
        }

        // Render inline with basic formatting
        return (
          <span key={i}>
            {part.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((segment, j) => {
              if (segment.startsWith('`') && segment.endsWith('`')) {
                return (
                  <code key={j} className="px-1 py-0.5 rounded bg-ghost-bg font-mono text-ghost-blue">
                    {segment.slice(1, -1)}
                  </code>
                )
              }
              if (segment.startsWith('**') && segment.endsWith('**')) {
                return <strong key={j} className="font-semibold text-ghost-text">{segment.slice(2, -2)}</strong>
              }
              return <React.Fragment key={j}>{segment}</React.Fragment>
            })}
          </span>
        )
      })}
    </>
  )
}
