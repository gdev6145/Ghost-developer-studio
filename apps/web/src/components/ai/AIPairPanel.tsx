'use client'

import React, { useState, useRef, useEffect } from 'react'
import type { CollaborationClient } from '@ghost/collaboration'
import { useEditorStore } from '@ghost/state'
import { generateId } from '@ghost/shared'
import { getSessionToken } from '@/lib/session'

interface AIPairPanelProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
}

type AiMode = 'chat' | 'complete' | 'explain' | 'review'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  mode: AiMode
}

/**
 * AIPairPanel — AI pair programming assistant.
 *
 * Modes:
 *  - Chat     : Freeform questions about the codebase
 *  - Complete : Get code completion for the current file
 *  - Explain  : Explain selected code
 *  - Review   : Review open file for issues
 *
 * Uses workspace memory context so the AI is aware of recent activity.
 */
export function AIPairPanel({ workspaceId, collab }: AIPairPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<AiMode>('chat')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const tabs = useEditorStore(s => s.tabs)
  const activeTabId = useEditorStore(s => s.activeTabId)
  const activeTab = tabs.find(t => t.fileId === activeTabId)

  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'
  const token = getSessionToken()
  const authHeader = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function addMessage(role: Message['role'], content: string) {
    setMessages(prev => [
      ...prev,
      {
        id: generateId(),
        role,
        content,
        timestamp: new Date().toISOString(),
        mode,
      },
    ])
  }

  async function sendRequest() {
    const text = input.trim()
    if ((!text && mode === 'chat') || loading) return

    addMessage('user', text || `[${mode} on ${activeTab?.name ?? 'current file'}]`)
    setInput('')
    setLoading(true)

    try {
      let endpoint: string
      let body: Record<string, unknown>

      switch (mode) {
        case 'chat':
          endpoint = 'chat'
          body = { message: text }
          break
        case 'complete':
          endpoint = 'complete'
          body = { code: text || `// ${activeTab?.name ?? 'file'}`, language: activeTab?.language ?? 'typescript' }
          break
        case 'explain':
          endpoint = 'explain'
          body = { code: text, language: activeTab?.language ?? 'typescript' }
          break
        case 'review':
          endpoint = 'review'
          body = { code: text, language: activeTab?.language ?? 'typescript' }
          break
      }

      const res = await fetch(`${apiUrl}/api/ai/${workspaceId}/${endpoint}`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json() as { error: string }
        addMessage('assistant', `⚠️ ${err.error}`)
        return
      }

      const data = await res.json() as Record<string, string>
      const responseText =
        data['response'] ?? data['suggestion'] ?? data['explanation'] ?? data['review'] ?? ''
      addMessage('assistant', responseText)
    } catch (err) {
      addMessage('assistant', `⚠️ ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendRequest()
    }
  }

  const modeButtons: { key: AiMode; label: string; title: string }[] = [
    { key: 'chat', label: '💬', title: 'Chat' },
    { key: 'complete', label: '⚡', title: 'Complete' },
    { key: 'explain', label: '📖', title: 'Explain' },
    { key: 'review', label: '🔍', title: 'Review' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-ghost-overlay shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-ghost-purple text-xs">✦</span>
          <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
            AI Pair
          </span>
        </div>
        {/* Mode selector */}
        <div className="flex items-center gap-0.5">
          {modeButtons.map(btn => (
            <button
              key={btn.key}
              onClick={() => setMode(btn.key)}
              title={btn.title}
              className={[
                'w-6 h-6 flex items-center justify-center rounded text-xs transition-colors',
                mode === btn.key ? 'bg-ghost-purple text-ghost-bg' : 'text-ghost-muted hover:text-ghost-text hover:bg-ghost-overlay',
              ].join(' ')}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-ghost-muted text-xs py-6 opacity-60">
            <div className="text-3xl mb-2 opacity-30">✦</div>
            <div>Ask the AI anything about your code.</div>
            <div className="mt-1 opacity-70">
              Switch modes: Chat · Complete · Explain · Review
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] ${
                msg.role === 'user' ? 'bg-ghost-blue text-ghost-bg' : 'bg-ghost-purple text-ghost-bg'
              }`}
            >
              {msg.role === 'user' ? 'U' : '✦'}
            </div>
            <div
              className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-ghost-blue text-ghost-bg'
                  : 'bg-ghost-surface text-ghost-text border border-ghost-overlay'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] bg-ghost-purple text-ghost-bg">
              ✦
            </div>
            <div className="bg-ghost-surface border border-ghost-overlay rounded-lg px-2.5 py-1.5">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-2 pb-2 shrink-0">
        {activeTab && mode !== 'chat' && (
          <div className="text-[10px] text-ghost-muted mb-1 px-1">
            Paste code below or leave empty to use open file ({activeTab.name})
          </div>
        )}
        <div className="flex gap-1.5 items-end bg-ghost-overlay rounded-lg border border-ghost-overlay focus-within:border-ghost-purple transition-colors">
          <textarea
            className="flex-1 bg-transparent text-xs text-ghost-text placeholder-ghost-muted resize-none p-2 outline-none leading-relaxed min-h-[36px] max-h-[120px]"
            placeholder={
              mode === 'chat'
                ? 'Ask the AI…'
                : mode === 'complete'
                ? 'Paste code to complete…'
                : mode === 'explain'
                ? 'Paste code to explain…'
                : 'Paste code to review…'
            }
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={() => void sendRequest()}
            disabled={loading || (!input.trim() && mode === 'chat')}
            className="mb-1.5 mr-1.5 px-2 py-1 rounded-md bg-ghost-purple text-ghost-bg text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            ✦
          </button>
        </div>
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex gap-0.5 items-center h-3">
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="w-1 h-1 rounded-full bg-ghost-purple animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}
