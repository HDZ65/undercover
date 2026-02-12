import { AnimatePresence } from 'motion/react'

function App() {
  return (
    <AnimatePresence mode="wait">
      <div className="min-h-screen bg-slate-900">
        {/* Game screens will be rendered here */}
      </div>
    </AnimatePresence>
  )
}

export default App
