import React from 'react'

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  children: React.ReactNode
  side?: 'left' | 'right'
  width?: string
  className?: string
}

export const Sidebar: React.FC<SidebarProps> = ({
  children,
  side = 'left',
  width = 'w-64',
  className = '',
}) => {
  const border = side === 'left' ? 'border-r' : 'border-l'
  return (
    <aside
      className={`flex flex-col h-full ${width} bg-[#181825] border-[#313244] ${border} overflow-hidden shrink-0 ${className}`}
    >
      {children}
    </aside>
  )
}

// ─── SidebarSection ──────────────────────────────────────────────────────────

interface SidebarSectionProps {
  title?: string
  children: React.ReactNode
  className?: string
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  children,
  className = '',
}) => (
  <div className={`flex flex-col ${className}`}>
    {title && (
      <div className="px-3 py-2 flex items-center">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-[#6C7086]">
          {title}
        </span>
      </div>
    )}
    <div className="flex-1 overflow-y-auto">{children}</div>
  </div>
)

// ─── Panel ───────────────────────────────────────────────────────────────────

interface PanelProps {
  children: React.ReactNode
  className?: string
}

export const Panel: React.FC<PanelProps> = ({ children, className = '' }) => (
  <div className={`flex flex-col h-full overflow-hidden ${className}`}>{children}</div>
)

// ─── PanelHeader ─────────────────────────────────────────────────────────────

interface PanelHeaderProps {
  children: React.ReactNode
  className?: string
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ children, className = '' }) => (
  <div
    className={`flex items-center px-3 h-10 shrink-0 border-b border-[#313244] bg-[#181825] ${className}`}
  >
    {children}
  </div>
)
