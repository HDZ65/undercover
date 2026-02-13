import { createContext } from 'react'
import { AnimatePresence } from 'motion/react'
import { useTheme } from './hooks/useTheme'
import { useSocket, type UseSocketReturn } from './hooks/useSocket'
import { GameLayout } from './components/layout/GameLayout'
import { Landing } from './components/screens/Landing'
import { Lobby } from './components/screens/Lobby'
import { Distribution } from './components/screens/Distribution'
import { GameMaster } from './components/screens/GameMaster'
import { Vote } from './components/screens/Vote'
import { Elimination } from './components/screens/Elimination'
import { MrWhiteGuess } from './components/screens/MrWhiteGuess'
import { Victory } from './components/screens/Victory'

export const SocketContext = createContext<UseSocketReturn | null>(null)

function App() {
  useTheme()
  const socket = useSocket()

  const renderScreen = () => {
    if (!socket.roomCode || !socket.publicState) {
      return <Landing />
    }

    switch (socket.phase) {
      case 'lobby':
        return <Lobby />
      case 'roleDistribution':
        return <Distribution />
      case 'discussion':
        return <GameMaster />
      case 'voting':
        return <Vote />
      case 'elimination':
        return <Elimination />
      case 'mrWhiteGuess':
        return <MrWhiteGuess />
      case 'mrWhiteVote':
        return <MrWhiteGuess />
      case 'victory':
        return <Victory />
      default:
        return <Landing />
    }
  }

  return (
    <SocketContext.Provider value={socket}>
      <AnimatePresence mode="wait">
        <GameLayout>{renderScreen()}</GameLayout>
      </AnimatePresence>
    </SocketContext.Provider>
  )
}

export default App
