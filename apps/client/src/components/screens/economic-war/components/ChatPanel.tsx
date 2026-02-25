import { useState, useRef, useEffect } from 'react'
import { motion } from 'motion/react'
import type { PublicPlayerInfo } from '@undercover/shared'

interface ChatMessage {
  from: string
  fromName: string
  channel: string
  message: string
  timestamp: number
}

interface ChatPanelProps {
  players: PublicPlayerInfo[]
  currentPlayerId: string | null
  messages: ChatMessage[]
  onSend: (channel: 'public' | string, message: string) => void
  onClose: () => void
}

export function ChatPanel({
  players,
  currentPlayerId,
  messages,
  onSend,
  onClose,
}: ChatPanelProps) {
  const [channel, setChannel] = useState<'public' | string>('public')
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const filteredMessages = messages.filter(m =>
    channel === 'public'
      ? m.channel === 'public'
      : (m.channel === channel && m.from !== currentPlayerId) ||
        (m.from === currentPlayerId && m.channel === channel) ||
        (m.from === channel && m.channel === currentPlayerId)
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [filteredMessages.length])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    onSend(channel, trimmed)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const otherPlayers = players.filter(p => p.id !== currentPlayerId && !p.abandoned)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md mx-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">💬 Diplomatie</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Channel selector */}
        <div className="flex gap-1 p-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto shrink-0">
          <button
            onClick={() => setChannel('public')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              channel === 'public'
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            🌍 Public
          </button>
          {otherPlayers.map(p => (
            <button
              key={p.id}
              onClick={() => setChannel(p.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                channel === p.id
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              {p.countryFlag} {p.name}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {filteredMessages.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
              {channel === 'public' ? 'Aucun message public.' : 'Aucun message privé avec ce joueur.'}
            </p>
          ) : (
            filteredMessages.map((msg, i) => {
              const isMine = msg.from === currentPlayerId
              const sender = players.find(p => p.id === msg.from)
              return (
                <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-1.5 ${
                    isMine
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                  }`}>
                    {!isMine && (
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        {sender?.countryFlag} {msg.fromName}
                      </p>
                    )}
                    <p className="text-xs">{msg.message}</p>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 text-right mt-0.5">
                      {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2 p-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={channel === 'public' ? 'Message public...' : 'Message privé...'}
            maxLength={500}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4 py-2 rounded-xl font-bold text-white bg-amber-500 disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            Envoyer
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
