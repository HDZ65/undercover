import type { TamalouPublicState, TamalouPrivateState } from './types'

export interface TamalouClientToServerEvents {
  'room:create': (data: { playerName: string }) => void
  'room:join': (data: { roomCode: string; playerName: string; playerToken?: string }) => void
  'room:leave': () => void
  'game:startGame': () => void
  'game:setMaxScore': (data: { maxScore: number }) => void
  /** Initial peek: choose which 2 cards to look at (indices 0-3) */
  'game:peekInitial': (data: { cardIndices: [number, number] }) => void
  /** Draw from pile or discard */
  'game:draw': (data: { source: 'pile' | 'discard' }) => void
  /** After drawing: swap drawn card with one of your cards */
  'game:swapWithOwn': (data: { cardIndex: number }) => void
  /** After drawing: discard the drawn card (may trigger power) */
  'game:discardDrawn': () => void
  /** Use power: peek at own card */
  'game:peekOwn': (data: { cardIndex: number }) => void
  /** Use power: peek at opponent card */
  'game:peekOpponent': (data: { targetPlayerId: string; cardIndex: number }) => void
  /** Use power: blind swap */
  'game:blindSwap': (data: { ownCardIndex: number; targetPlayerId: string; targetCardIndex: number }) => void
  /** Skip using the power */
  'game:skipPower': () => void
  /** Acknowledge peek (dismiss the revealed card) */
  'game:ackPeek': () => void
  /** Call Tamalou */
  'game:callTamalou': () => void
  /** Continue to next round after roundEnd */
  'game:nextRound': () => void
  'game:resetGame': () => void
}

export interface TamalouServerToClientEvents {
  'game:state': (data: { publicState: TamalouPublicState; privateState: TamalouPrivateState }) => void
  'room:error': (data: { message: string }) => void
  'room:joined': (data: { roomCode: string; playerId: string; playerToken: string }) => void
}
