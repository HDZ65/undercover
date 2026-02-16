import { AnimatePresence } from 'framer-motion'
import { SocketProvider, useSocketContext } from './context/SocketContext.js'
import { useSocket } from './hooks/useSocket.js'

function PlaceholderScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-uno-blue to-uno-red p-6">
      <div className="rounded-2xl border border-white/20 bg-black/20 px-6 py-4 text-center text-2xl font-semibold text-white backdrop-blur-sm">
        {label}
      </div>
    </div>
  )
}

function AppContent() {
  const socket = useSocketContext()

  if (!socket.roomCode || !socket.publicState) {
    return <PlaceholderScreen label="Landing (placeholder)" />
  }

  switch (socket.phase) {
    case 'lobby':
      return <PlaceholderScreen label="Lobby (placeholder)" />
    case 'playerTurn':
    case 'colorChoice':
    case 'challengeWD4':
      return <PlaceholderScreen label="GameBoard (placeholder)" />
    case 'roundOver':
      return <PlaceholderScreen label="RoundOver (placeholder)" />
    case 'gameOver':
      return <PlaceholderScreen label="Victory (placeholder)" />
    default:
      return <PlaceholderScreen label="Loading..." />
  }
}

export default function App() {
  const socket = useSocket()

  const routeKey = !socket.roomCode || !socket.publicState ? 'landing' : socket.phase ?? 'loading'

  return (
    <SocketProvider value={socket}>
      <AnimatePresence mode="wait">
        <AppContent key={routeKey} />
      </AnimatePresence>
    </SocketProvider>
  )
}
