import { motion, AnimatePresence } from 'motion/react'
import type { GameNotification } from '@undercover/shared'

interface NotificationPanelProps {
  notifications: GameNotification[]
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  info: {
    bg: 'bg-blue-50/60 dark:bg-blue-950/30',
    border: 'border-blue-200/60 dark:border-blue-800/40',
    text: 'text-blue-800 dark:text-blue-200',
  },
  warning: {
    bg: 'bg-amber-50/60 dark:bg-amber-950/30',
    border: 'border-amber-200/60 dark:border-amber-800/40',
    text: 'text-amber-800 dark:text-amber-200',
  },
  danger: {
    bg: 'bg-red-50/60 dark:bg-red-950/30',
    border: 'border-red-200/60 dark:border-red-800/40',
    text: 'text-red-800 dark:text-red-200',
  },
  success: {
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/30',
    border: 'border-emerald-200/60 dark:border-emerald-800/40',
    text: 'text-emerald-800 dark:text-emerald-200',
  },
}

export function NotificationPanel({ notifications }: NotificationPanelProps) {
  const unread = notifications.filter((n) => !n.read)
  if (unread.length === 0) return null

  return (
    <div className="space-y-1.5">
      <AnimatePresence>
        {unread.slice(0, 5).map((notif) => {
          const style = SEVERITY_STYLES[notif.severity] ?? SEVERITY_STYLES.info
          return (
            <motion.div
              key={notif.id}
              className={`flex items-start gap-2 rounded-xl p-2.5 border ${style.bg} ${style.border}`}
              initial={{ opacity: 0, x: 20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <span className="text-sm shrink-0">{notif.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${style.text}`}>{notif.title}</p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400">{notif.message}</p>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
