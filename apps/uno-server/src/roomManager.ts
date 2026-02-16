import { randomInt, randomUUID } from 'node:crypto'
import {
  BOT_PLAY_DELAY_MS,
  DISCONNECT_GRACE_MS,
  UNO_CATCH_WINDOW_MS,
} from '@uno/shared'
import type {
  Card,
  CardColor,
  ClientToServerEvents,
  HouseRules,
  PlayerScore,
  PrivatePlayerState,
  PublicGameState,
  PublicPlayer,
  ServerToClientEvents,
  UnoGamePhase,
} from '@uno/shared'
import type { Server, Socket } from 'socket.io'
import { createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate'
import { getValidPlays } from './deck.js'
import { calculateRoundScore } from './scoring.js'
import { unoMachine, type UnoMachineContext, type UnoMachineEvent } from './unoMachine.js'

type ServerSocket = Socket<ClientToServerEvents, ServerToClientEvents>
type UnoActor = ActorRefFrom<typeof unoMachine>
type UnoSnapshot = SnapshotFrom<typeof unoMachine>

type ForwardUnoEvent =
  | 'START_GAME'
  | 'SET_HOUSE_RULES'
  | 'SET_TARGET_SCORE'
  | 'SET_TURN_TIMER'
  | 'CONTINUE_NEXT_ROUND'
  | 'PLAY_CARD'
  | 'DRAW_CARD'
  | 'CALL_UNO'
  | 'CATCH_UNO'
  | 'CHOOSE_COLOR'
  | 'CHALLENGE_WD4'
  | 'ACCEPT_WD4'
  | 'RESET_GAME'

interface RoomPlayer {
  id: string
  name: string
  socketId: string | null
  playerToken: string
  avatar?: string
  isBot: boolean
}

interface Room {
  code: string
  actor: UnoActor
  players: Map<string, RoomPlayer>
  hostId: string
  disconnectTimers: Map<string, NodeJS.Timeout>
  emptyRoomTimer: NodeJS.Timeout | null
  botTimers: Map<string, NodeJS.Timeout>
  turnTimerInterval: NodeJS.Timeout | null
}

const EMPTY_ROOM_TTL_MS = 10 * 60_000
const MAX_PLAYERS_PER_ROOM = 8
const ROOM_CODE_LENGTH = 6
const ROOM_CODE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export class RoomManager {
  private readonly io: Server<ClientToServerEvents, ServerToClientEvents>
  private readonly rooms: Map<string, Room> = new Map()
  private readonly socketPresence: Map<string, string> = new Map()
  private readonly turnTimerRemaining: Map<string, number> = new Map()
  private readonly activeTurnPlayer: Map<string, string> = new Map()
  private readonly lastPhaseByRoom: Map<string, UnoGamePhase> = new Map()

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io
  }

  createRoom(socket: ServerSocket, playerName: string, avatar?: string): string {
    this.leaveRoom(socket)

    let roomCode = ''
    do {
      roomCode = this.generateRoomCode()
    } while (this.rooms.has(roomCode))

    const player = this.createRoomPlayer(playerName, socket.id, avatar)
    const actor = createActor(unoMachine)

    const room: Room = {
      code: roomCode,
      actor,
      players: new Map([[player.id, player]]),
      hostId: player.id,
      disconnectTimers: new Map(),
      emptyRoomTimer: null,
      botTimers: new Map(),
      turnTimerInterval: null,
    }

    this.rooms.set(roomCode, room)
    this.socketPresence.set(socket.id, roomCode)
    socket.join(roomCode)

    actor.subscribe((snapshot) => {
      const liveRoom = this.rooms.get(roomCode)
      if (!liveRoom) {
        return
      }

      this.handleActorSnapshot(liveRoom, snapshot)
    })

    actor.start()
    this.sendEvent(room, {
      type: 'ADD_PLAYER',
      playerId: player.id,
      name: player.name,
      avatar: player.avatar,
    })

    socket.emit('room:created', {
      roomCode,
      playerToken: player.playerToken,
      playerId: player.id,
    })

    this.broadcastState(room)
    return roomCode
  }

  joinRoom(
    socket: ServerSocket,
    roomCode: string,
    playerName: string,
    playerToken?: string,
    avatar?: string,
  ): void {
    this.leaveRoom(socket)

    const normalizedCode = roomCode.trim().toUpperCase()
    const room = this.rooms.get(normalizedCode)

    if (!room) {
      socket.emit('room:error', { message: 'Room not found.' })
      return
    }

    this.clearEmptyRoomTimer(room)

    const reconnectPlayer = playerToken
      ? [...room.players.values()].find((candidate) => candidate.playerToken === playerToken)
      : undefined

    if (reconnectPlayer) {
      if (reconnectPlayer.socketId && reconnectPlayer.socketId !== socket.id) {
        this.socketPresence.delete(reconnectPlayer.socketId)
      }

      this.clearDisconnectTimer(room, reconnectPlayer.id)
      this.clearBotTimer(room, reconnectPlayer.id)

      reconnectPlayer.socketId = socket.id
      reconnectPlayer.isBot = false

      this.socketPresence.set(socket.id, normalizedCode)
      socket.join(normalizedCode)

      socket.emit('room:joined', {
        roomCode: normalizedCode,
        playerToken: reconnectPlayer.playerToken,
        playerId: reconnectPlayer.id,
      })

      this.reassignHostIfNeeded(room)
      this.syncBotForSnapshot(room, room.actor.getSnapshot())
      this.broadcastState(room)
      return
    }

    const snapshot = room.actor.getSnapshot()
    if (!snapshot.matches('lobby')) {
      socket.emit('room:error', { message: 'Game already started. Reconnect with your player token.' })
      return
    }

    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      socket.emit('room:error', { message: 'Room is full.' })
      return
    }

    const player = this.createRoomPlayer(playerName, socket.id, avatar)
    room.players.set(player.id, player)

    this.socketPresence.set(socket.id, normalizedCode)
    socket.join(normalizedCode)

    this.sendEvent(room, {
      type: 'ADD_PLAYER',
      playerId: player.id,
      name: player.name,
      avatar: player.avatar,
    })

    socket.emit('room:joined', {
      roomCode: normalizedCode,
      playerToken: player.playerToken,
      playerId: player.id,
    })

    this.broadcastState(room)
  }

  leaveRoom(socket: ServerSocket): void {
    const roomCode = this.socketPresence.get(socket.id)
    if (!roomCode) {
      return
    }

    this.socketPresence.delete(socket.id)
    socket.leave(roomCode)

    const room = this.rooms.get(roomCode)
    if (!room) {
      return
    }

    const player = this.findPlayerBySocket(room, socket.id)
    if (!player) {
      return
    }

    this.removePlayer(room, player.id)
  }

  handleDisconnect(socket: ServerSocket): void {
    const roomCode = this.socketPresence.get(socket.id)
    if (!roomCode) {
      return
    }

    this.socketPresence.delete(socket.id)

    const room = this.rooms.get(roomCode)
    if (!room) {
      return
    }

    const player = this.findPlayerBySocket(room, socket.id)
    if (!player) {
      return
    }

    player.socketId = null

    this.reassignHostIfNeeded(room)
    this.clearDisconnectTimer(room, player.id)

    const timer = setTimeout(() => {
      const liveRoom = this.rooms.get(roomCode)
      if (!liveRoom) {
        return
      }

      const livePlayer = liveRoom.players.get(player.id)
      if (!livePlayer || livePlayer.socketId !== null) {
        return
      }

      liveRoom.disconnectTimers.delete(player.id)
      livePlayer.isBot = true

      const snapshot = liveRoom.actor.getSnapshot()
      if (this.canBotAct(snapshot, livePlayer.id)) {
        this.startBotPlay(liveRoom, livePlayer.id)
      }

      this.broadcastState(liveRoom)
    }, DISCONNECT_GRACE_MS)

    room.disconnectTimers.set(player.id, timer)
    this.broadcastState(room)
  }

  handleGameEvent(socket: ServerSocket, eventType: ForwardUnoEvent, payload?: unknown): void {
    const resolved = this.resolveRoomAndPlayer(socket)
    if (!resolved) {
      return
    }

    const { room, player } = resolved
    const snapshot = room.actor.getSnapshot()

    switch (eventType) {
      case 'START_GAME': {
        if (!this.isHost(room, player.id)) {
          return
        }

        const data = payload as
          | {
              houseRules?: HouseRules
              targetScore?: number
              turnTimer?: number
            }
          | undefined

        this.sendEvent(room, {
          type: 'START_GAME',
          houseRules: data?.houseRules,
          targetScore: data?.targetScore,
          turnTimer: data?.turnTimer,
        })
        return
      }

      case 'SET_HOUSE_RULES': {
        if (!this.isHost(room, player.id)) {
          return
        }

        const houseRules = (payload as { houseRules?: HouseRules } | undefined)?.houseRules
        if (!houseRules) {
          return
        }

        this.sendEvent(room, {
          type: 'SET_HOUSE_RULES',
          houseRules,
        })
        return
      }

      case 'SET_TARGET_SCORE': {
        if (!this.isHost(room, player.id)) {
          return
        }

        const targetScore = (payload as { targetScore?: number } | undefined)?.targetScore
        if (typeof targetScore !== 'number') {
          return
        }

        this.sendEvent(room, {
          type: 'SET_TARGET_SCORE',
          targetScore,
        })
        return
      }

      case 'SET_TURN_TIMER': {
        if (!this.isHost(room, player.id)) {
          return
        }

        const turnTimer = (payload as { turnTimer?: number } | undefined)?.turnTimer
        if (typeof turnTimer !== 'number') {
          return
        }

        this.sendEvent(room, {
          type: 'SET_TURN_TIMER',
          turnTimer,
        })
        return
      }

      case 'CONTINUE_NEXT_ROUND': {
        if (!this.isHost(room, player.id)) {
          return
        }

        this.sendEvent(room, { type: 'CONTINUE_NEXT_ROUND' })
        return
      }

      case 'PLAY_CARD': {
        const cardId = (payload as { cardId?: string } | undefined)?.cardId
        if (!cardId || snapshot.context.currentPlayerId !== player.id) {
          return
        }

        if (!snapshot.matches('playerTurn')) {
          return
        }

        const machinePlayer = snapshot.context.players.find((candidate) => candidate.id === player.id)
        const discardTop = snapshot.context.discardPile[snapshot.context.discardPile.length - 1]

        if (!machinePlayer || !discardTop) {
          return
        }

        const cardInHand = machinePlayer.hand.find((candidate) => candidate.id === cardId)
        if (!cardInHand) {
          return
        }

        const validPlays = getValidPlays(
          machinePlayer.hand,
          discardTop,
          snapshot.context.currentColor,
          snapshot.context.houseRules,
          snapshot.context.pendingDrawStack,
        )

        if (!validPlays.some((card) => card.id === cardId)) {
          return
        }

        this.sendEvent(room, {
          type: 'PLAY_CARD',
          playerId: player.id,
          cardId,
        })
        return
      }

      case 'DRAW_CARD': {
        if (!snapshot.matches('playerTurn') || snapshot.context.currentPlayerId !== player.id) {
          return
        }

        this.sendEvent(room, {
          type: 'DRAW_CARD',
          playerId: player.id,
        })
        return
      }

      case 'CALL_UNO': {
        this.sendEvent(room, {
          type: 'CALL_UNO',
          playerId: player.id,
        })
        return
      }

      case 'CATCH_UNO': {
        const targetId = (payload as { playerId?: string } | undefined)?.playerId
        if (!targetId || targetId === player.id) {
          return
        }

        this.sendEvent(room, {
          type: 'CATCH_UNO',
          playerId: player.id,
          targetId,
        })
        return
      }

      case 'CHOOSE_COLOR': {
        const color = (payload as { color?: CardColor } | undefined)?.color
        if (!this.isCardColor(color)) {
          return
        }

        if (!snapshot.matches('colorChoice') || snapshot.context.colorChooserId !== player.id) {
          return
        }

        this.sendEvent(room, {
          type: 'CHOOSE_COLOR',
          playerId: player.id,
          color,
        })
        return
      }

      case 'CHALLENGE_WD4': {
        if (!snapshot.matches('challengeWD4') || snapshot.context.currentPlayerId !== player.id) {
          return
        }

        this.sendEvent(room, {
          type: 'CHALLENGE_WD4',
          playerId: player.id,
        })
        return
      }

      case 'ACCEPT_WD4': {
        if (!snapshot.matches('challengeWD4') || snapshot.context.currentPlayerId !== player.id) {
          return
        }

        const accepted = (payload as { accepted?: boolean } | undefined)?.accepted
        if (accepted === false) {
          this.sendEvent(room, {
            type: 'CHALLENGE_WD4',
            playerId: player.id,
          })
          return
        }

        this.sendEvent(room, {
          type: 'ACCEPT_WD4',
          playerId: player.id,
        })
        return
      }

      case 'RESET_GAME': {
        this.sendEvent(room, { type: 'RESET_GAME' })
      }
    }
  }

  private handleActorSnapshot(room: Room, snapshot: UnoSnapshot): void {
    this.syncTurnTimer(room, snapshot)
    this.syncBotForSnapshot(room, snapshot)
    this.broadcastState(room)
    this.emitPhaseEvents(room, snapshot)
  }

  private emitPhaseEvents(room: Room, snapshot: UnoSnapshot): void {
    const phase = this.resolvePhase(snapshot)
    const previousPhase = this.lastPhaseByRoom.get(room.code)

    if (phase === previousPhase) {
      return
    }

    this.lastPhaseByRoom.set(room.code, phase)

    if (phase === 'roundOver') {
      this.io.to(room.code).emit('game:roundOver', {
        scores: this.getScores(snapshot.context),
      })
      return
    }

    if (phase === 'gameOver') {
      const winner = snapshot.context.gameWinner ?? snapshot.context.winner
      if (!winner) {
        return
      }

      this.io.to(room.code).emit('game:gameOver', {
        winner,
        scores: this.getScores(snapshot.context),
      })
    }
  }

  private syncTurnTimer(room: Room, snapshot: UnoSnapshot): void {
    if (!snapshot.matches('playerTurn')) {
      this.stopTurnTimer(room)
      return
    }

    const currentPlayerId = snapshot.context.currentPlayerId
    const trackedPlayerId = this.activeTurnPlayer.get(room.code)

    if (!room.turnTimerInterval || trackedPlayerId !== currentPlayerId) {
      this.startTurnTimer(room)
    }
  }

  private startTurnTimer(room: Room): void {
    this.stopTurnTimer(room)

    const snapshot = room.actor.getSnapshot()
    const trackedPlayerId = snapshot.context.currentPlayerId

    if (!trackedPlayerId || !snapshot.matches('playerTurn')) {
      return
    }

    let remaining =
      snapshot.context.turnTimeRemaining > 0
        ? snapshot.context.turnTimeRemaining
        : snapshot.context.turnTimer
    this.turnTimerRemaining.set(room.code, remaining)
    this.activeTurnPlayer.set(room.code, trackedPlayerId)

    room.turnTimerInterval = setInterval(() => {
      const liveRoom = this.rooms.get(room.code)
      if (!liveRoom) {
        return
      }

      const liveSnapshot = liveRoom.actor.getSnapshot()
      if (!liveSnapshot.matches('playerTurn')) {
        this.stopTurnTimer(liveRoom)
        return
      }

      if (liveSnapshot.context.currentPlayerId !== trackedPlayerId) {
        this.stopTurnTimer(liveRoom)
        return
      }

      remaining -= 1
      this.turnTimerRemaining.set(liveRoom.code, Math.max(remaining, 0))

      if (remaining <= 0) {
        this.stopTurnTimer(liveRoom)
        this.sendEvent(liveRoom, { type: 'TURN_TIMEOUT' })
        return
      }

      this.broadcastState(liveRoom)
    }, 1000)
  }

  private stopTurnTimer(room: Room): void {
    if (room.turnTimerInterval) {
      clearInterval(room.turnTimerInterval)
      room.turnTimerInterval = null
    }

    this.activeTurnPlayer.delete(room.code)
    this.turnTimerRemaining.delete(room.code)
  }

  private syncBotForSnapshot(room: Room, snapshot: UnoSnapshot): void {
    for (const [playerId, timer] of room.botTimers) {
      const roomPlayer = room.players.get(playerId)
      if (!roomPlayer?.isBot || !this.canBotAct(snapshot, playerId)) {
        clearTimeout(timer)
        room.botTimers.delete(playerId)
      }
    }

    const currentPlayer = room.players.get(snapshot.context.currentPlayerId)
    if (currentPlayer?.isBot && this.canBotAct(snapshot, currentPlayer.id)) {
      this.startBotPlay(room, currentPlayer.id)
    }
  }

  private canBotAct(snapshot: UnoSnapshot, playerId: string): boolean {
    if (snapshot.context.currentPlayerId !== playerId) {
      return false
    }

    if (snapshot.matches('playerTurn')) {
      return true
    }

    if (snapshot.matches('challengeWD4')) {
      return true
    }

    if (snapshot.matches('colorChoice')) {
      return snapshot.context.colorChooserId === playerId
    }

    return false
  }

  private startBotPlay(room: Room, playerId: string): void {
    if (room.botTimers.has(playerId)) {
      return
    }

    const timer = setTimeout(() => {
      room.botTimers.delete(playerId)

      const liveRoom = this.rooms.get(room.code)
      if (!liveRoom) {
        return
      }

      this.executeBotTurn(liveRoom, playerId)
    }, BOT_PLAY_DELAY_MS)

    room.botTimers.set(playerId, timer)
  }

  private executeBotTurn(room: Room, playerId: string): void {
    const roomPlayer = room.players.get(playerId)
    if (!roomPlayer?.isBot) {
      return
    }

    const snapshot = room.actor.getSnapshot()
    if (snapshot.context.currentPlayerId !== playerId) {
      return
    }

    if (snapshot.matches('colorChoice')) {
      const machinePlayer = snapshot.context.players.find((candidate) => candidate.id === playerId)
      if (!machinePlayer) {
        return
      }

      this.sendEvent(room, {
        type: 'CHOOSE_COLOR',
        playerId,
        color: this.getMostCommonColor(machinePlayer.hand),
      })
      return
    }

    if (snapshot.matches('challengeWD4')) {
      this.sendEvent(room, {
        type: 'ACCEPT_WD4',
        playerId,
      })
      return
    }

    if (!snapshot.matches('playerTurn')) {
      return
    }

    const machinePlayer = snapshot.context.players.find((candidate) => candidate.id === playerId)
    const discardTop = snapshot.context.discardPile[snapshot.context.discardPile.length - 1]

    if (!machinePlayer || !discardTop) {
      return
    }

    const validPlays = getValidPlays(
      machinePlayer.hand,
      discardTop,
      snapshot.context.currentColor,
      snapshot.context.houseRules,
      snapshot.context.pendingDrawStack,
    )

    if (validPlays.length === 0) {
      const handBeforeDraw = machinePlayer.hand
      const handBeforeIds = new Set(handBeforeDraw.map((card) => card.id))

      this.sendEvent(room, {
        type: 'DRAW_CARD',
        playerId,
      })

      const afterDrawSnapshot = room.actor.getSnapshot()
      if (
        !afterDrawSnapshot.matches('playerTurn') ||
        afterDrawSnapshot.context.currentPlayerId !== playerId
      ) {
        return
      }

      const afterDrawPlayer = afterDrawSnapshot.context.players.find((candidate) => candidate.id === playerId)
      const afterDrawDiscardTop =
        afterDrawSnapshot.context.discardPile[afterDrawSnapshot.context.discardPile.length - 1]

      if (!afterDrawPlayer || !afterDrawDiscardTop) {
        return
      }

      const drawnCard = afterDrawPlayer.hand.find((card) => !handBeforeIds.has(card.id))
      if (!drawnCard) {
        return
      }

      const drawnCardIsPlayable = getValidPlays(
        [drawnCard],
        afterDrawDiscardTop,
        afterDrawSnapshot.context.currentColor,
        afterDrawSnapshot.context.houseRules,
        afterDrawSnapshot.context.pendingDrawStack,
      )

      if (drawnCardIsPlayable.length === 0) {
        return
      }

      this.sendEvent(room, {
        type: 'PLAY_CARD',
        playerId,
        cardId: drawnCard.id,
      })

      if (afterDrawPlayer.hand.length === 2) {
        this.sendEvent(room, {
          type: 'CALL_UNO',
          playerId,
        })
      }

      if (drawnCard.color === null) {
        const remainingHand = afterDrawPlayer.hand.filter((card) => card.id !== drawnCard.id)
        this.sendEvent(room, {
          type: 'CHOOSE_COLOR',
          playerId,
          color: this.getMostCommonColor(remainingHand),
        })
      }

      return
    }

    const selectedCard = this.selectBestCard(validPlays, snapshot.context.currentColor, discardTop)

    this.sendEvent(room, {
      type: 'PLAY_CARD',
      playerId,
      cardId: selectedCard.id,
    })

    if (machinePlayer.hand.length === 2) {
      this.sendEvent(room, {
        type: 'CALL_UNO',
        playerId,
      })
    }

    if (selectedCard.color === null) {
      const remainingHand = machinePlayer.hand.filter((card) => card.id !== selectedCard.id)
      this.sendEvent(room, {
        type: 'CHOOSE_COLOR',
        playerId,
        color: this.getMostCommonColor(remainingHand),
      })
    }
  }

  private selectBestCard(validPlays: Card[], currentColor: CardColor, discardTop: Card): Card {
    const sameColorCard = validPlays.find((card) => card.color === currentColor && card.color !== null)
    if (sameColorCard) {
      return sameColorCard
    }

    const sameValueCard = validPlays.find(
      (card) => card.value === discardTop.value && card.color !== null,
    )
    if (sameValueCard) {
      return sameValueCard
    }

    const wildCard = validPlays.find((card) => card.value === 'wild')
    if (wildCard) {
      return wildCard
    }

    const wildDrawFourCard = validPlays.find((card) => card.value === 'wild-draw4')
    if (wildDrawFourCard) {
      return wildDrawFourCard
    }

    return validPlays[0]
  }

  private getMostCommonColor(hand: Card[]): CardColor {
    const colorCounts: Record<CardColor, number> = {
      red: 0,
      blue: 0,
      green: 0,
      yellow: 0,
    }

    for (const card of hand) {
      if (card.color) {
        colorCounts[card.color] += 1
      }
    }

    let bestColor: CardColor = 'red'
    let bestCount = -1

    for (const color of ['red', 'blue', 'green', 'yellow'] as const) {
      if (colorCounts[color] > bestCount) {
        bestColor = color
        bestCount = colorCounts[color]
      }
    }

    return bestColor
  }

  private broadcastState(room: Room): void {
    const snapshot = room.actor.getSnapshot()
    const publicState = this.getPublicState(snapshot, room)

    for (const [playerId, player] of room.players) {
      if (!player.socketId) {
        continue
      }

      const privateState = this.getPrivateState(snapshot, room, playerId)
      this.io.to(player.socketId).emit('game:state', {
        publicState,
        privateState,
      })
    }
  }

  private getPublicState(snapshot: UnoSnapshot, room: Room): PublicGameState {
    const context = snapshot.context
    const phase = this.resolvePhase(snapshot)
    const machinePlayersById = new Map(context.players.map((player) => [player.id, player]))

    const players: PublicPlayer[] = [...room.players.values()].map((roomPlayer) => {
      const machinePlayer = machinePlayersById.get(roomPlayer.id)

      return {
        id: roomPlayer.id,
        name: roomPlayer.name,
        avatar: roomPlayer.avatar,
        handSize: machinePlayer?.hand.length ?? 0,
        hasCalledUno: machinePlayer?.hasCalledUno ?? false,
        isConnected: roomPlayer.socketId !== null,
      }
    })

    return {
      phase,
      players,
      currentPlayerId: context.currentPlayerId,
      playDirection: context.playDirection,
      discardTop: context.discardPile[context.discardPile.length - 1] ?? null,
      drawPileSize: context.drawPile.length,
      turnTimeRemaining: this.turnTimerRemaining.get(room.code) ?? context.turnTimeRemaining,
      houseRules: context.houseRules,
      targetScore: context.targetScore,
      turnTimer: context.turnTimer,
      scores: this.getScores(context),
      roomCode: room.code,
      hostId: room.hostId,
    }
  }

  private getPrivateState(
    snapshot: UnoSnapshot,
    room: Room,
    playerId: string,
  ): PrivatePlayerState {
    const context = snapshot.context
    const roomPlayer = room.players.get(playerId)
    const machinePlayer = context.players.find((candidate) => candidate.id === playerId)

    const discardTop = context.discardPile[context.discardPile.length - 1]
    const isCurrentPlayer = context.currentPlayerId === playerId

    const canPlayCards =
      machinePlayer && discardTop && isCurrentPlayer && snapshot.matches('playerTurn')
        ? getValidPlays(
            machinePlayer.hand,
            discardTop,
            context.currentColor,
            context.houseRules,
            context.pendingDrawStack,
          )
        : []

    return {
      playerId,
      playerToken: roomPlayer?.playerToken ?? '',
      hand: machinePlayer?.hand ?? [],
      isHost: room.hostId === playerId,
      canPlayCards,
      canDraw:
        isCurrentPlayer &&
        snapshot.matches('playerTurn') &&
        !context.hasDrawnThisTurn &&
        (!context.houseRules.forcePlay || canPlayCards.length === 0),
      canCallUno: Boolean(machinePlayer && machinePlayer.hand.length === 1 && !machinePlayer.hasCalledUno),
      canCatchUno: this.canPlayerCatchUno(context, playerId),
      mustChooseColor: snapshot.matches('colorChoice') && context.colorChooserId === playerId,
    }
  }

  private canPlayerCatchUno(context: UnoMachineContext, playerId: string): boolean {
    const now = Date.now()

    return context.players.some((player) => {
      if (player.id === playerId) {
        return false
      }

      if (player.hand.length !== 1 || player.hasCalledUno || player.unoCallTime === null) {
        return false
      }

      return now - player.unoCallTime <= UNO_CATCH_WINDOW_MS
    })
  }

  private resolvePhase(snapshot: UnoSnapshot): UnoGamePhase {
    if (snapshot.matches('lobby')) return 'lobby'
    if (snapshot.matches('dealing')) return 'dealing'
    if (snapshot.matches('colorChoice')) return 'colorChoice'
    if (snapshot.matches('challengeWD4')) return 'challengeWD4'
    if (snapshot.matches('roundOver')) return 'roundOver'
    if (snapshot.matches('gameOver')) return 'gameOver'
    return 'playerTurn'
  }

  private resolveRoomAndPlayer(socket: ServerSocket): { room: Room; player: RoomPlayer } | null {
    const roomCode = this.socketPresence.get(socket.id)
    if (!roomCode) {
      socket.emit('room:error', { message: 'You are not in a room.' })
      return null
    }

    const room = this.rooms.get(roomCode)
    if (!room) {
      socket.emit('room:error', { message: 'Room no longer exists.' })
      return null
    }

    const player = this.findPlayerBySocket(room, socket.id)
    if (!player) {
      socket.emit('room:error', { message: 'Player session not found.' })
      return null
    }

    return { room, player }
  }

  private findPlayerBySocket(room: Room, socketId: string): RoomPlayer | undefined {
    return [...room.players.values()].find((candidate) => candidate.socketId === socketId)
  }

  private removePlayer(room: Room, playerId: string): void {
    const player = room.players.get(playerId)
    if (!player) {
      return
    }

    if (player.socketId) {
      this.socketPresence.delete(player.socketId)
    }

    this.clearDisconnectTimer(room, playerId)
    this.clearBotTimer(room, playerId)

    room.players.delete(playerId)
    this.sendEvent(room, { type: 'REMOVE_PLAYER', playerId })

    this.reassignHostIfNeeded(room)

    if (room.players.size === 0) {
      this.scheduleEmptyRoomCleanup(room)
    } else {
      this.clearEmptyRoomTimer(room)
    }

    this.broadcastState(room)
  }

  private scheduleEmptyRoomCleanup(room: Room): void {
    this.clearEmptyRoomTimer(room)

    room.emptyRoomTimer = setTimeout(() => {
      const liveRoom = this.rooms.get(room.code)
      if (!liveRoom || liveRoom.players.size > 0) {
        return
      }

      this.stopTurnTimer(liveRoom)

      for (const timer of liveRoom.disconnectTimers.values()) {
        clearTimeout(timer)
      }
      liveRoom.disconnectTimers.clear()

      for (const timer of liveRoom.botTimers.values()) {
        clearTimeout(timer)
      }
      liveRoom.botTimers.clear()

      liveRoom.actor.stop()

      this.rooms.delete(liveRoom.code)
      this.lastPhaseByRoom.delete(liveRoom.code)
      this.activeTurnPlayer.delete(liveRoom.code)
      this.turnTimerRemaining.delete(liveRoom.code)
    }, EMPTY_ROOM_TTL_MS)
  }

  private clearEmptyRoomTimer(room: Room): void {
    if (!room.emptyRoomTimer) {
      return
    }

    clearTimeout(room.emptyRoomTimer)
    room.emptyRoomTimer = null
  }

  private clearDisconnectTimer(room: Room, playerId: string): void {
    const timer = room.disconnectTimers.get(playerId)
    if (!timer) {
      return
    }

    clearTimeout(timer)
    room.disconnectTimers.delete(playerId)
  }

  private clearBotTimer(room: Room, playerId: string): void {
    const timer = room.botTimers.get(playerId)
    if (!timer) {
      return
    }

    clearTimeout(timer)
    room.botTimers.delete(playerId)
  }

  private reassignHostIfNeeded(room: Room): void {
    const currentHost = room.players.get(room.hostId)
    if (currentHost && currentHost.socketId !== null) {
      return
    }

    const connectedPlayer = [...room.players.values()].find((candidate) => candidate.socketId !== null)
    const fallbackPlayer = [...room.players.values()][0]
    const nextHost = connectedPlayer ?? fallbackPlayer
    const nextHostId = nextHost?.id ?? ''

    if (room.hostId === nextHostId) {
      return
    }

    room.hostId = nextHostId

    if (nextHostId) {
      this.io.to(room.code).emit('room:hostChanged', {
        hostId: nextHostId,
      })
    }
  }

  private createRoomPlayer(playerName: string, socketId: string, avatar?: string): RoomPlayer {
    return {
      id: randomUUID(),
      name: this.normalizePlayerName(playerName),
      socketId,
      playerToken: this.generatePlayerToken(),
      avatar,
      isBot: false,
    }
  }

  private normalizePlayerName(name: string): string {
    const normalized = name.trim()
    if (normalized.length === 0) {
      return 'Player'
    }

    return normalized.slice(0, 24)
  }

  private getScores(context: UnoMachineContext): PlayerScore[] {
    const roundWinnerId = context.winner
    const roundWinnerScore = roundWinnerId
      ? calculateRoundScore(
          context.players
            .filter((player) => player.id !== roundWinnerId)
            .map((player) => player.hand),
        )
      : 0

    return context.players.map((player) => ({
      playerId: player.id,
      roundScore: player.id === roundWinnerId ? roundWinnerScore : 0,
      totalScore: context.scores[player.id] ?? 0,
    }))
  }

  private isHost(room: Room, playerId: string): boolean {
    return room.hostId === playerId
  }

  private isCardColor(value: unknown): value is CardColor {
    return value === 'red' || value === 'blue' || value === 'green' || value === 'yellow'
  }

  private sendEvent(room: Room, event: UnoMachineEvent): void {
    room.actor.send(event)
  }

  private generateRoomCode(): string {
    let code = ''

    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      const charIndex = randomInt(0, ROOM_CODE_CHARSET.length)
      code += ROOM_CODE_CHARSET[charIndex]
    }

    return code
  }

  private generatePlayerToken(): string {
    return randomUUID()
  }
}
