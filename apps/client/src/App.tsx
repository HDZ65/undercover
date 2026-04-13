import { createContext, useState, useCallback } from 'react'
import { AnimatePresence } from 'motion/react'
import { useTheme } from './hooks/useTheme'
import { useSocket, type UseSocketReturn } from './hooks/useSocket'
import { GameLayout } from './components/layout/GameLayout'
import { GameMenu } from './components/screens/GameMenu'
import { Landing } from './components/screens/Landing'
import { Lobby } from './components/screens/Lobby'
import { Distribution } from './components/screens/Distribution'
import { GameMaster } from './components/screens/GameMaster'
import { Vote } from './components/screens/Vote'
import { Elimination } from './components/screens/Elimination'
import { MrWhiteGuess } from './components/screens/MrWhiteGuess'
import { Victory } from './components/screens/Victory'
import { PokerLobby } from './components/screens/poker'
import { UnoLobby } from './components/screens/uno'
import { EcoWarLobby } from './components/screens/economic-war'
import { CodenamesLobby } from './components/screens/codenames'
import { TamalouLobby } from './components/screens/tamalou'
import { MojoLobby } from './components/screens/mojo'
import { DominosLobby } from './components/screens/dominos'

import { ConnectionStatusOverlay } from './components/ui/ConnectionStatusOverlay'
import { useKeepAlive } from './hooks/useKeepAlive'
import { ConnectionStatusContext } from './hooks/useConnectionStatus'

export const SocketContext = createContext<UseSocketReturn | null>(null)

function App() {
  useTheme()
  const socket = useSocket()
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [gameConnected, setGameConnected] = useState(true)

  // Ping server every 2 min while in a game to prevent Render free tier sleep
  useKeepAlive(selectedGame !== null)

  // Undercover uses its own socket; other games report via ConnectionStatusContext
  const isUndercover = selectedGame === 'undercover'
  const connected = isUndercover ? socket.connected : gameConnected
  const handleSetConnected = useCallback((v: boolean) => setGameConnected(v), [])

  const handleBackToMenu = () => {
    if (socket.roomCode) {
      socket.leaveRoom()
    }
    setSelectedGame(null)
  }

  const renderScreen = () => {
    if (!selectedGame) {
      return <GameMenu onSelectGame={setSelectedGame} />
    }

    if (selectedGame === 'undercover') {
      if (!socket.roomCode || !socket.publicState) {
        return <Landing onBack={handleBackToMenu} />
      }

      switch (socket.phase) {
        case 'lobby':
          return <Lobby onBack={handleBackToMenu} />
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
          return <Landing onBack={handleBackToMenu} />
      }
    }

    if (selectedGame === 'economic-war') {
      return <EcoWarLobby onBack={handleBackToMenu} />
    }

    if (selectedGame === 'poker') {
      return <PokerLobby onBack={handleBackToMenu} />
    }

    if (selectedGame === 'uno') {
      return <UnoLobby onBack={handleBackToMenu} />
    }

    if (selectedGame === 'codenames') {
      return <CodenamesLobby onBack={handleBackToMenu} />
    }

    if (selectedGame === 'tamalou') {
      return <TamalouLobby onBack={handleBackToMenu} />
    }

    if (selectedGame === 'mojo') {
      return <MojoLobby onBack={handleBackToMenu} />
    }

    if (selectedGame === 'dominos') {
      return <DominosLobby onBack={handleBackToMenu} />
    }

    return <GameMenu onSelectGame={setSelectedGame} />
  }

  return (
    <SocketContext.Provider value={socket}>
      <ConnectionStatusContext.Provider value={{ connected: gameConnected, setConnected: handleSetConnected }}>
        {selectedGame && <ConnectionStatusOverlay connected={connected} />}
        <AnimatePresence mode="wait">
          <GameLayout>{renderScreen()}</GameLayout>
        </AnimatePresence>
      </ConnectionStatusContext.Provider>
    </SocketContext.Provider>
  )
}

export default App
