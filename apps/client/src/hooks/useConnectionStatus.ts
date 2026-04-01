import { createContext, useContext } from 'react'

export interface ConnectionStatusContextValue {
  connected: boolean
  setConnected: (connected: boolean) => void
}

export const ConnectionStatusContext = createContext<ConnectionStatusContextValue>({
  connected: true,
  setConnected: () => {},
})

export function useConnectionStatus() {
  return useContext(ConnectionStatusContext)
}
