import { createContext, useContext } from 'react'
import type { UseSocketReturn } from '../hooks/useSocket.js'

const SocketContext = createContext<UseSocketReturn | null>(null)

export function useSocketContext(): UseSocketReturn {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocketContext must be used within SocketProvider')
  }

  return context
}

export const SocketProvider = SocketContext.Provider
