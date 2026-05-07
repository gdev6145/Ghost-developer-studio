import React from 'react'

// ─── StatusBadge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: 'online' | 'idle' | 'offline' | 'building' | 'error' | 'running'
  label?: string
  showLabel?: boolean
  className?: string
}

const statusConfig = {
  online: { color: '#22C55E', label: 'Online', pulse: true },
  idle: { color: '#F59E0B', label: 'Idle', pulse: false },
  offline: { color: '#6B7280', label: 'Offline', pulse: false },
  building: { color: '#3B82F6', label: 'Building', pulse: true },
  error: { color: '#EF4444', label: 'Error', pulse: false },
  running: { color: '#22C55E', label: 'Running', pulse: true },
} as const

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  showLabel = false,
  className = '',
}) => {
  const config = statusConfig[status]
  const displayLabel = label ?? config.label

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: config.color }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: config.color }}
        />
      </span>
      {showLabel && (
        <span className="text-xs font-medium" style={{ color: config.color }}>
          {displayLabel}
        </span>
      )}
    </div>
  )
}

// ─── RuntimeBadge ────────────────────────────────────────────────────────────

interface RuntimeBadgeProps {
  status: 'idle' | 'starting' | 'running' | 'building' | 'error' | 'stopped'
}

export const RuntimeBadge: React.FC<RuntimeBadgeProps> = ({ status }) => {
  const map: Record<string, { color: string; label: string }> = {
    idle: { color: '#6B7280', label: 'Idle' },
    starting: { color: '#3B82F6', label: 'Starting...' },
    running: { color: '#22C55E', label: 'Running' },
    building: { color: '#F59E0B', label: 'Building...' },
    error: { color: '#EF4444', label: 'Error' },
    stopped: { color: '#6B7280', label: 'Stopped' },
  }
  const cfg = map[status] ?? map['idle']!
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: cfg.color }}
      />
      {cfg.label}
    </span>
  )
}
