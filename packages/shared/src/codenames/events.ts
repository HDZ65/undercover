import type {
  CodenamesPublicState,
  CodenamesPrivateState,
  CodenamesTeam,
} from './types'

export interface CodenamesClientToServerEvents {
  'room:create': (data: { playerName: string }) => void
  'room:join': (data: { roomCode: string; playerName: string; playerToken?: string }) => void
  'room:leave': () => void
  'game:joinTeam': (data: { team: CodenamesTeam }) => void
  'game:setSpymaster': () => void
  'game:startGame': () => void
  'game:giveClue': (data: { word: string; count: number }) => void
  'game:guessWord': (data: { cardIndex: number }) => void
  'game:passTurn': () => void
  'game:resetGame': () => void
}

export interface CodenamesServerToClientEvents {
  'game:state': (data: { publicState: CodenamesPublicState; privateState: CodenamesPrivateState }) => void
  'room:error': (data: { message: string }) => void
  'room:joined': (data: { roomCode: string; playerId: string; playerToken: string }) => void
}
