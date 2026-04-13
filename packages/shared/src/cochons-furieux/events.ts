import type {
  CochonsPublicState,
  CochonsPrivateState,
  ShotInput,
  ShotResult,
  TemplateId,
  CellType,
  WeaponType,
} from './types'

export interface CochonsClientToServerEvents {
  'room:create': (data: { playerName: string }) => void
  'room:join': (data: { roomCode: string; playerName: string; playerToken?: string }) => void
  'room:leave': () => void
  'game:startGame': () => void
  // Build phase
  'game:selectTemplate': (data: { templateId: TemplateId }) => void
  'game:placeBlock': (data: { col: number; row: number; type: CellType }) => void
  'game:removeBlock': (data: { col: number; row: number }) => void
  'game:placePig': (data: { col: number; row: number }) => void
  'game:removePig': (data: { col: number; row: number }) => void
  'game:confirmBuild': () => void
  // Battle phase
  'game:fire': (data: { angle: number; power: number; weapon: WeaponType }) => void
  'game:resetGame': () => void
}

export interface CochonsServerToClientEvents {
  'game:state': (data: { publicState: CochonsPublicState; privateState: CochonsPrivateState }) => void
  'room:error': (data: { message: string }) => void
  'room:joined': (data: { roomCode: string; playerId: string; playerToken: string }) => void
  'game:shotAnimation': (data: {
    shooterId: string
    targetId: string
    input: ShotInput
    result: ShotResult
  }) => void
  'game:buildTimer': (data: { secondsRemaining: number }) => void
}
