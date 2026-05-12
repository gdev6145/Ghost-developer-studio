'use client'

import React, { useState, useRef, useEffect } from 'react'
import type { CollaborationClient } from '@ghost/collaboration'
import { useChatStore } from '@ghost/state'
import { usePresenceStore } from '@ghost/state'
import { Avatar } from '@ghost/ui'
import { getCollaboratorColor } from '@ghost/shared'
import { generateId } from '@ghost/shared'
import { getCurrentUserId, getCurrentDisplayName } from '@/lib/session'

interface ChatSidebarProps {
  workspaceId: string
  collab: React.MutableRefObject<CollaborationClient | null>
}

/**
 * ChatSidebar — realtime workspace chat.
 *
 * Features:
 * - Realtime messages via Socket.IO
 * - Typing indicators
 * - Timestamps
 * - Presence-aware avatars
 */
export function ChatSidebar({ workspaceId, collab }: ChatSidebarProps) {
  const messages = useChatStore(s => s.messages)
  const typingUsers = useChatStore(s => s.typingUsers)
  const setTyping = useChatStore(s => s.setTyping)
  const presenceMap = usePresenceStore(s => s.presenceMap)

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function sendMessage() {
    const content = input.trim()
    if (!content || !collab.current) return

    const messageId = generateId()
    const now = new Date().toISOString()

    collab.current.socket?.emit('message', {
      type: 'chat.message',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: now,
      payload: {
        messageId,
        authorId: getCurrentUserId(),
        authorName: getCurrentDisplayName(),
        content,
        createdAt: now,
      },
    })

    setInput('')
    stopTyping()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    startTyping()
  }

  function startTyping() {
    collab.current?.socket?.emit('message', {
      type: 'chat.typing',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: new Date().toISOString(),
      payload: { userId: getCurrentUserId(), isTyping: true },
    })
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(stopTyping, 3000)
  }

  function stopTyping() {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    collab.current?.socket?.emit('message', {
      type: 'chat.typing',
      workspaceId,
      actorId: getCurrentUserId(),
      timestamp: new Date().toISOString(),
      payload: { userId: getCurrentUserId(), isTyping: false },
    })
  }

  const typingArray = [...typingUsers].filter(id => id !== getCurrentUserId())

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center px-3 h-9 border-b border-ghost-overlay shrink-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-ghost-muted">
          Chat
        </span>
        <span className="ml-auto text-xs text-ghost-muted">{messages.length}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-ghost-muted text-xs py-4 opacity-60">
            No messages yet.<br />Say hello! 👋
          </div>
        ) : (
          messages.map(msg => {
            const color = getCollaboratorColor(msg.authorId)
            return (
              <div key={msg.id} className="flex gap-2 items-start group">
                <Avatar
                  displayName={msg.author.displayName}
                  color={color}
                  size="sm"
                  showBadge
                  badgeColor={presenceMap.get(msg.authorId)?.status === 'online' ? '#22C55E' : '#6B7280'}
                  {...(msg.author.avatarUrl !== undefined ? { src: msg.author.avatarUrl } : {})}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold" style={{ color }}>
                      {msg.author.displayName}
                    </span>
                    <span className="text-[10px] text-ghost-muted opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-ghost-text leading-relaxed break-words whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            )
          })
        )}

        {/* Typing indicators */}
        {typingArray.length > 0 && (
          <div className="flex items-center gap-1.5 text-ghost-muted text-xs">
            <TypingDots />
            <span>
              {typingArray.length === 1
                ? `${typingArray[0]} is typing…`
                : `${typingArray.length} people are typing…`}
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-2 pb-2 shrink-0">
        <div className="flex gap-1.5 items-end bg-ghost-overlay rounded-lg border border-ghost-overlay focus-within:border-ghost-blue transition-colors">
          <textarea
            className="flex-1 bg-transparent text-xs text-ghost-text placeholder-ghost-muted resize-none p-2 outline-none leading-relaxed min-h-[36px] max-h-[120px]"
            placeholder="Message workspace…"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="mb-1.5 mr-1.5 px-2 py-1 rounded-md bg-ghost-blue text-ghost-bg text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Send
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
          className="w-1 h-1 rounded-full bg-ghost-muted animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
