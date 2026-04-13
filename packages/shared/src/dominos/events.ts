import type { DominosPublicState, DominosPrivateState, AttackTier } from './types'

export interface DominosClientToServerEvents {
  'room:create': (data: { playerName: string }) => void
  'room:join': (data: { roomCode: string; playerName: string; playerToken?: string }) => void
  'room:leave': () => void
  'game:startGame': () => void
  'game:setTargetScore': (data: { targetScore: number }) => void
  'game:placeTile': (data: { tileId: number; end: 'left' | 'right' }) => void
  'game:drawTile': () => void
  'game:pass': () => void
  'game:nextRound': () => void
  'game:resetGame': () => void
}

export interface DominosServerToClientEvents {
  'game:state': (data: { publicState: DominosPublicState; privateState: DominosPrivateState }) => void
  'room:error': (data: { message: string }) => void
  'room:joined': (data: { roomCode: string; playerId: string; playerToken: string }) => void
  'game:combatAnimation': (data: {
    winnerId: string
    losers: string[]
    attackTier: AttackTier
    pointsScored: number
    damagePerPlayer: Record<string, number>
  }) => void
}
