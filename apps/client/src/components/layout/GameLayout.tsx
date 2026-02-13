import type { ReactNode } from 'react'
import { ThemeToggle } from '../ui/ThemeToggle'

interface GameLayoutProps {
  children: ReactNode
}

/**
 * GameLayout wrapper component that provides consistent layout
 * with ThemeToggle for all game screens.
 */
export function GameLayout({ children }: GameLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <ThemeToggle />
      <div className="flex items-center justify-center min-h-screen p-4">
        {children}
      </div>
    </div>
  )
}
