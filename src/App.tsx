import { AnimatePresence } from 'motion/react'
import { useTheme } from './hooks/useTheme'
import { useGameActor } from './hooks/useGameActor'
import { GameLayout } from './components/layout/GameLayout'
import { Landing } from './components/screens/Landing'
import { Lobby } from './components/screens/Lobby'
import { Distribution } from './components/screens/Distribution'
import { GameMaster } from './components/screens/GameMaster'
import { Vote } from './components/screens/Vote'
import { Elimination } from './components/screens/Elimination'
import { MrWhiteGuess } from './components/screens/MrWhiteGuess'
import { Victory } from './components/screens/Victory'

function App() {
  useTheme() // Initialize theme on app load
  const [snapshot] = useGameActor()

  // Determine which screen to render based on state machine state
  const renderScreen = () => {
    // Check for nested states (e.g., gameRound.discussion)
    if (snapshot.matches('menu')) {
      return <Landing />
    }

    if (snapshot.matches('lobby')) {
      return <Lobby />
    }

    if (snapshot.matches('roleDistribution')) {
      return <Distribution />
    }

    if (snapshot.matches('gameRound')) {
      return <GameMaster />
    }

    if (snapshot.matches('vote')) {
      return <Vote />
    }

    if (snapshot.matches('elimination')) {
      return <Elimination />
    }

    if (snapshot.matches('mrWhiteGuess')) {
      return <MrWhiteGuess />
    }

    if (snapshot.matches('victory')) {
      return <Victory />
    }

    // Fallback to Landing
    return <Landing />
  }

  return (
    <AnimatePresence mode="wait">
      <GameLayout>
        {renderScreen()}
      </GameLayout>
    </AnimatePresence>
  )
}

export default App
