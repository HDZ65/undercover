import type { Namespace, Socket } from 'socket.io'
import { createActor } from 'xstate'
import type {
  TamalouClientToServerEvents,
  TamalouServerToClientEvents,
  TamalouPublicState,
  TamalouPrivateState,
  TamalouPublicPlayer,
  TamalouCard,
} from '@undercover/shared'
import { tamalouMachine, type TamalouPlayer, type TamalouActor } from './tamalouMachine.js'

type TamalouSocket = Socket<TamalouClientToServerEvents, TamalouServerToClientEvents>

interface RoomPlayer {
  id: string
  name: string
  socketId: string
  playerToken: string
}

interface Room {
  code: string
  actor: TamalouActor
  players: Map<string, RoomPlayer>
  hostId: string
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>
}

const DISCONNECT_GRACE_MS = 90_000

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

export class TamalouRoomManager {
  private rooms = new Map<string, Room>()
  private socketPresence = new Map<string, { roomCode: string; playerId: string }>()

  constructor(private io: Namespace<TamalouClientToServerEvents, TamalouServerToClientEvents>) {}

  createRoom(socket: TamalouSocket, playerName: string) {
    const existing = this.socketPresence.get(socket.id)
    if (existing) this.leaveRoom(socket)

    let code = generateRoomCode()
    while (this.rooms.has(code)) code = generateRoomCode()

    const playerId = generateId()
    const playerToken = generateId() + generateId()

    const actor = createActor(tamalouMachine)
    const room: Room = {
      code,
      actor,
      players: new Map(),
      hostId: playerId,
      disconnectTimers: new Map(),
    }

    room.players.set(playerId, { id: playerId, name: playerName, socketId: socket.id, playerToken })
    this.rooms.set(code, room)
    this.socketPresence.set(socket.id, { roomCode: code, playerId })
    socket.join(code)

    actor.subscribe(() => this.broadcastState(room))
    actor.start()
    actor.send({ type: 'ADD_PLAYER', id: playerId, name: playerName })

    socket.emit('room:joined', { roomCode: code, playerId, playerToken })
    console.log(`[Tamalou] Room ${code} created by ${playerName}`)
  }

  joinRoom(socket: TamalouSocket, roomCode: string, playerName: string, playerToken?: string) {
    const code = roomCode.toUpperCase()
    const room = this.rooms.get(code)
    if (!room) { socket.emit('room:error', { message: 'Salon introuvable' }); return }

    // Reconnection
    if (playerToken) {
      for (const [pid, player] of room.players) {
        if (player.playerToken === playerToken) {
          const timer = room.disconnectTimers.get(pid)
          if (timer) { clearTimeout(timer); room.disconnectTimers.delete(pid) }
          player.socketId = socket.id
          player.name = playerName
          this.socketPresence.set(socket.id, { roomCode: code, playerId: pid })
          socket.join(code)
          const mp = room.actor.getSnapshot().context.players.find((p: TamalouPlayer) => p.id === pid)
          if (mp) mp.connected = true
          socket.emit('room:joined', { roomCode: code, playerId: pid, playerToken: player.playerToken })
          this.broadcastState(room)
          return
        }
      }
    }

    // New player
    const playerId = generateId()
    const newToken = generateId() + generateId()
    room.players.set(playerId, { id: playerId, name: playerName, socketId: socket.id, playerToken: newToken })
    this.socketPresence.set(socket.id, { roomCode: code, playerId })
    socket.join(code)
    room.actor.send({ type: 'ADD_PLAYER', id: playerId, name: playerName })
    socket.emit('room:joined', { roomCode: code, playerId, playerToken: newToken })
  }

  leaveRoom(socket: TamalouSocket) {
    const presence = this.socketPresence.get(socket.id)
    if (!presence) return
    const room = this.rooms.get(presence.roomCode)
    if (!room) return
    this.removePlayer(room, presence.playerId)
    this.socketPresence.delete(socket.id)
    socket.leave(presence.roomCode)
  }

  private removePlayer(room: Room, playerId: string) {
    room.players.delete(playerId)
    room.actor.send({ type: 'REMOVE_PLAYER', id: playerId })
    if (room.players.size === 0) {
      room.actor.stop()
      this.rooms.delete(room.code)
      return
    }
    if (room.hostId === playerId) {
      const first = room.players.values().next().value
      if (first) room.hostId = first.id
    }
    this.broadcastState(room)
  }

  private getPresenceAndRoom(socket: TamalouSocket): { room: Room; playerId: string } | null {
    const presence = this.socketPresence.get(socket.id)
    if (!presence) return null
    const room = this.rooms.get(presence.roomCode)
    if (!room) return null
    return { room, playerId: presence.playerId }
  }

  private isCurrentPlayer(room: Room, playerId: string): boolean {
    const ctx = room.actor.getSnapshot().context
    return ctx.players[ctx.currentPlayerIndex]?.id === playerId
  }

  handleStartGame(socket: TamalouSocket) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || r.room.hostId !== r.playerId) return
    r.room.actor.send({ type: 'START_GAME' })
  }

  handleSetMaxScore(socket: TamalouSocket, maxScore: number) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || r.room.hostId !== r.playerId) return
    r.room.actor.send({ type: 'SET_MAX_SCORE', maxScore })
  }

  handlePeekInitial(socket: TamalouSocket, cardIndices: [number, number]) {
    const r = this.getPresenceAndRoom(socket)
    if (!r) return
    const ctx = r.room.actor.getSnapshot().context
    if (ctx.peeksCompleted.has(r.playerId)) return
    if (cardIndices.some(i => i < 0 || i > 3)) return
    if (cardIndices[0] === cardIndices[1]) return
    r.room.actor.send({ type: 'PEEK_INITIAL', playerId: r.playerId, cardIndices })
  }

  handleDraw(socket: TamalouSocket, source: 'pile' | 'discard') {
    const r = this.getPresenceAndRoom(socket)
    if (!r || !this.isCurrentPlayer(r.room, r.playerId)) return
    r.room.actor.send({ type: 'DRAW', source })
  }

  handleSwapWithOwn(socket: TamalouSocket, cardIndex: number) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || !this.isCurrentPlayer(r.room, r.playerId)) return
    if (cardIndex < 0 || cardIndex > 3) return
    r.room.actor.send({ type: 'SWAP_WITH_OWN', cardIndex })
  }

  handleDiscardDrawn(socket: TamalouSocket) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || !this.isCurrentPlayer(r.room, r.playerId)) return
    r.room.actor.send({ type: 'DISCARD_DRAWN' })
  }

  handlePeekOwn(socket: TamalouSocket, cardIndex: number) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || !this.isCurrentPlayer(r.room, r.playerId)) return
    r.room.actor.send({ type: 'PEEK_OWN', cardIndex })
  }

  handlePeekOpponent(socket: TamalouSocket, targetPlayerId: string, cardIndex: number) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || !this.isCurrentPlayer(r.room, r.playerId)) return
    if (targetPlayerId === r.playerId) return
    r.room.actor.send({ type: 'PEEK_OPPONENT', targetPlayerId, cardIndex })
  }

  handleBlindSwap(socket: TamalouSocket, ownCardIndex: number, targetPlayerId: string, targetCardIndex: number) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || !this.isCurrentPlayer(r.room, r.playerId)) return
    if (targetPlayerId === r.playerId) return
    r.room.actor.send({ type: 'BLIND_SWAP', ownCardIndex, targetPlayerId, targetCardIndex })
  }

  handleSkipPower(socket: TamalouSocket) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || !this.isCurrentPlayer(r.room, r.playerId)) return
    r.room.actor.send({ type: 'SKIP_POWER' })
  }

  handleAckPeek(socket: TamalouSocket) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || !this.isCurrentPlayer(r.room, r.playerId)) return
    r.room.actor.send({ type: 'ACK_PEEK' })
  }

  handleCallTamalou(socket: TamalouSocket) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || !this.isCurrentPlayer(r.room, r.playerId)) return
    const ctx = r.room.actor.getSnapshot().context
    if (ctx.tamalouCaller) return // Already called
    r.room.actor.send({ type: 'CALL_TAMALOU' })
  }

  handleNextRound(socket: TamalouSocket) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || r.room.hostId !== r.playerId) return
    r.room.actor.send({ type: 'NEXT_ROUND' })
  }

  handleResetGame(socket: TamalouSocket) {
    const r = this.getPresenceAndRoom(socket)
    if (!r || r.room.hostId !== r.playerId) return
    r.room.actor.send({ type: 'RESET_GAME' })
  }

  handleDisconnect(socket: TamalouSocket) {
    const presence = this.socketPresence.get(socket.id)
    if (!presence) return
    const room = this.rooms.get(presence.roomCode)
    if (!room) return
    const playerId = presence.playerId
    this.socketPresence.delete(socket.id)

    const mp = room.actor.getSnapshot().context.players.find((p: TamalouPlayer) => p.id === playerId)
    if (mp) mp.connected = false
    this.broadcastState(room)

    const timer = setTimeout(() => {
      room.disconnectTimers.delete(playerId)
      this.removePlayer(room, playerId)
    }, DISCONNECT_GRACE_MS)
    room.disconnectTimers.set(playerId, timer)
  }

  private broadcastState(room: Room) {
    const snapshot = room.actor.getSnapshot()
    const ctx = snapshot.context
    const phase = this.resolvePhase(snapshot.value)

    const publicPlayers: TamalouPublicPlayer[] = ctx.players.map((p: TamalouPlayer) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      cardCount: (ctx.hands[p.id] || []).length,
    }))

    const publicState: TamalouPublicState = {
      phase,
      roomCode: room.code,
      hostId: room.hostId,
      players: publicPlayers,
      currentPlayerId: ctx.players[ctx.currentPlayerIndex]?.id ?? null,
      discardTop: ctx.discardPile.length > 0 ? ctx.discardPile[ctx.discardPile.length - 1] : null,
      drawPileCount: ctx.drawPile.length,
      tamalouCaller: ctx.tamalouCaller,
      activePower: ctx.activePower,
      powerTargetPlayerId: ctx.powerTargetPlayerId,
      scores: this.serializeScores(ctx.scores),
      maxScore: ctx.maxScore,
      round: ctx.round,
      revealedHands: ctx.roundScores ? this.serializeHands(ctx.hands) : null,
      roundScores: ctx.roundScores,
      winnerId: ctx.winnerId,
    }

    for (const [playerId, roomPlayer] of room.players) {
      const playerSocket = this.io.sockets?.get(roomPlayer.socketId)
      if (!playerSocket) continue

      const known = ctx.knownPositions[playerId] || new Set()
      const hand: (TamalouCard | null)[] = (ctx.hands[playerId] || []).map(
        (card: TamalouCard, idx: number) => known.has(idx) ? card : null,
      )

      // During roundEnd/gameOver, show full hand
      const isRevealed = phase === 'roundEnd' || phase === 'gameOver'
      const visibleHand = isRevealed ? (ctx.hands[playerId] || []) : hand

      const isCurrentPlayer = ctx.players[ctx.currentPlayerIndex]?.id === playerId

      const privateState: TamalouPrivateState = {
        playerId,
        playerToken: roomPlayer.playerToken,
        isHost: room.hostId === playerId,
        hand: visibleHand,
        drawnCard: isCurrentPlayer ? ctx.drawnCard : null,
        peekedCard: isCurrentPlayer ? ctx.peekedCard : null,
      }

      playerSocket.emit('game:state', { publicState, privateState })
    }
  }

  private resolvePhase(value: unknown): TamalouPublicState['phase'] {
    if (typeof value === 'string') {
      // playerTurnAfterTamalou is displayed as playerTurn to the client
      if (value === 'playerTurnAfterTamalou') return 'playerTurn'
      return value as TamalouPublicState['phase']
    }
    return 'lobby'
  }

  private serializeScores(scores: Record<string, number[]>): Record<string, number[]> {
    const result: Record<string, number[]> = {}
    for (const [k, v] of Object.entries(scores)) {
      result[k] = [...v]
    }
    return result
  }

  private serializeHands(hands: Record<string, TamalouCard[]>): Record<string, TamalouCard[]> {
    const result: Record<string, TamalouCard[]> = {}
    for (const [k, v] of Object.entries(hands)) {
      result[k] = [...v]
    }
    return result
  }
}
