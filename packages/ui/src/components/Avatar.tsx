import React from 'react'

// ─── Avatar ───────────────────────────────────────────────────────────────────

interface AvatarProps {
  src?: string
  displayName: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
  showBadge?: boolean
  badgeColor?: string
  className?: string
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  displayName,
  color,
  size = 'md',
  showBadge = false,
  badgeColor,
  className = '',
}) => {
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={`relative inline-flex shrink-0 ${sizeClasses[size]} ${className}`}>
      {src ? (
        <img
          src={src}
          alt={displayName}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-medium"
          style={{ backgroundColor: color ?? '#6B7280' }}
        >
          <span className="text-white leading-none">{initials}</span>
        </div>
      )}
      {showBadge && (
        <span
          className="absolute bottom-0 right-0 w-2 h-2 rounded-full border border-[#1E1E2E]"
          style={{ backgroundColor: badgeColor ?? '#22C55E' }}
        />
      )}
    </div>
  )
}

// ─── AvatarGroup ──────────────────────────────────────────────────────────────

interface AvatarGroupProps {
  users: Array<{ userId: string; displayName: string; avatarUrl?: string; color?: string }>
  max?: number
  size?: 'sm' | 'md' | 'lg'
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({ users, max = 4, size = 'sm' }) => {
  const visible = users.slice(0, max)
  const overflow = users.length - max

  return (
    <div className="flex -space-x-2">
      {visible.map(user => (
        <div key={user.userId} className="ring-2 ring-[#1E1E2E] rounded-full">
          <Avatar
            src={user.avatarUrl}
            displayName={user.displayName}
            color={user.color}
            size={size}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={`${sizeClasses[size]} ring-2 ring-[#1E1E2E] rounded-full bg-[#45475A] flex items-center justify-center`}
        >
          <span className="text-[10px] text-[#CDD6F4] font-medium">+{overflow}</span>
        </div>
      )}
    </div>
  )
}
