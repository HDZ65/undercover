import { useEffect } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
const PING_INTERVAL_MS = 2 * 60_000 // 2 minutes

/**
 * Pings the server /health endpoint periodically via HTTP
 * to prevent Render free tier from sleeping during active games.
 * Only active when `active` is true (= player is in a game).
 */
export function useKeepAlive(active: boolean) {
  useEffect(() => {
    if (!active) return

    const ping = () => {
      fetch(`${SERVER_URL}/health`).catch(() => {})
    }

    // Ping immediately on activation
    ping()
    const interval = setInterval(ping, PING_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [active])
}
