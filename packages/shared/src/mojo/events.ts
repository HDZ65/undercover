import type { MojoPublicState, MojoPrivateState } from './types'

export interface MojoClientToServerEvents {
  'room:create': (data: { playerName: string }) => void
  'room:join': (data: { roomCode: string; playerName: string; playerToken?: string }) => void
  'room:leave': () => void
  'game:startGame': () => void
  'game:setDoubleDiscard': (data: { enabled: boolean }) => void
  /** Play a card from hand onto a discard pile */
  'game:playCard': (data: { cardId: number; discardIndex?: number }) => void
  /** Draw a card (from pile, or from other discard in double-discard mode) */
  'game:draw': (data: { source: 'pile' | 'discard'; discardIndex?: number }) => void
  /** End turn (after playing lower card, or after drawing for higher) */
  'game:endTurn': () => void
  /** Reveal a mojo-time face-down card */
  'game:revealMojoCard': (data: { cardId: number }) => void
  /** Continue to next round (host) */
  'game:nextRound': () => void
  'game:resetGame': () => void
}

export interface MojoServerToClientEvents {
  'game:state': (data: { publicState: MojoPublicState; privateState: MojoPrivateState }) => void
  'room:error': (data: { message: string }) => void
  'room:joined': (data: { roomCode: string; playerId: string; playerToken: string }) => void
}
