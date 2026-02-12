import { AnimatePresence } from 'motion/react'
import { ThemeToggle } from './components/ui/ThemeToggle'
import { useTheme } from './hooks/useTheme'

function App() {
  useTheme() // Initialize theme on app load
  
  return (
    <AnimatePresence mode="wait">
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
        <ThemeToggle />
        {/* Game screens will be rendered here */}
      </div>
    </AnimatePresence>
  )
}

export default App
