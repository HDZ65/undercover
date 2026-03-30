import type { Namespace, Socket } from 'socket.io'
import { createActor } from 'xstate'
import type {
  CodenamesClientToServerEvents,
  CodenamesServerToClientEvents,
  CodenamesPublicState,
  CodenamesPrivateState,
  CodenamesPublicCard,
  CodenamesTeam,
} from '@undercover/shared'
import { codenamesMachine, type CodenamesPlayer, type CodenamesActor } from './codenamesMachine.js'

type CodenamesSocket = Socket<CodenamesClientToServerEvents, CodenamesServerToClientEvents>

interface RoomPlayer {
  id: string
  name: string
  socketId: string
  playerToken: string
}

interface Room {
  code: string
  actor: CodenamesActor
  players: Map<string, RoomPlayer>
  hostId: string
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>
}

const DISCONNECT_GRACE_MS = 90_000

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

export class CodenamesRoomManager {
  private rooms = new Map<string, Room>()
  private socketPresence = new Map<string, { roomCode: string; playerId: string }>()

  constructor(private io: Namespace<CodenamesClientToServerEvents, CodenamesServerToClientEvents>) {}

  createRoom(socket: CodenamesSocket, playerName: string) {
    // Leave existing room first
    const existing = this.socketPresence.get(socket.id)
    if (existing) this.leaveRoom(socket)

    let code = generateRoomCode()
    while (this.rooms.has(code)) code = generateRoomCode()

    const playerId = generateId()
    const playerToken = generateId() + generateId()

    const actor = createActor(codenamesMachine, {
      input: undefined,
    })

    const room: Room = {
      code,
      actor,
      players: new Map(),
      hostId: playerId,
      disconnectTimers: new Map(),
    }

    room.players.set(playerId, {
      id: playerId,
      name: playerName,
      socketId: socket.id,
      playerToken,
    })

    this.rooms.set(code, room)
    this.socketPresence.set(socket.id, { roomCode: code, playerId })

    socket.join(code)

    // Start actor and subscribe to state changes
    actor.subscribe(() => {
      this.broadcastState(room)
    })
    actor.start()

    // Add player to machine context
    actor.send({ type: 'ADD_PLAYER', id: playerId, name: playerName })

    // Set host
    const snapshot = actor.getSnapshot()
    if (snapshot.context.hostId === '') {
      // Manually set hostId (not in machine, handled here)
    }

    socket.emit('room:joined', { roomCode: code, playerId, playerToken })
    console.log(`[Codenames] Room ${code} created by ${playerName}`)
  }

  joinRoom(socket: CodenamesSocket, roomCode: string, playerName: string, playerToken?: string) {
    const code = roomCode.toUpperCase()
    const room = this.rooms.get(code)

    if (!room) {
      socket.emit('room:error', { message: 'Salon introuvable' })
      return
    }

    // Check for reconnection via token
    if (playerToken) {
      for (const [pid, player] of room.players) {
        if (player.playerToken === playerToken) {
          // Reconnect
          const oldTimer = room.disconnectTimers.get(pid)
          if (oldTimer) {
            clearTimeout(oldTimer)
            room.disconnectTimers.delete(pid)
          }

          player.socketId = socket.id
          player.name = playerName
          this.socketPresence.set(socket.id, { roomCode: code, playerId: pid })
          socket.join(code)

          // Mark connected in machine
          const snapshot = room.actor.getSnapshot()
          const machinePlayer = snapshot.context.players.find((p: CodenamesPlayer) => p.id === pid)
          if (machinePlayer) {
            machinePlayer.connected = true
          }

          socket.emit('room:joined', { roomCode: code, playerId: pid, playerToken: player.playerToken })
          this.broadcastState(room)
          console.log(`[Codenames] ${playerName} reconnected to ${code}`)
          return
        }
      }
    }

    // New player joining
    const playerId = generateId()
    const newToken = generateId() + generateId()

    room.players.set(playerId, {
      id: playerId,
      name: playerName,
      socketId: socket.id,
      playerToken: newToken,
    })

    this.socketPresence.set(socket.id, { roomCode: code, playerId })
    socket.join(code)

    room.actor.send({ type: 'ADD_PLAYER', id: playerId, name: playerName })

    socket.emit('room:joined', { roomCode: code, playerId, playerToken: newToken })
    console.log(`[Codenames] ${playerName} joined ${code}`)
  }

  leaveRoom(socket: CodenamesSocket) {
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
      // Clean up empty room
      room.actor.stop()
      this.rooms.delete(room.code)
      console.log(`[Codenames] Room ${room.code} deleted (empty)`)
      return
    }

    // Transfer host if needed
    if (room.hostId === playerId) {
      const firstPlayer = room.players.values().next().value
      if (firstPlayer) {
        room.hostId = firstPlayer.id
      }
    }

    this.broadcastState(room)
  }

  handleJoinTeam(socket: CodenamesSocket, team: CodenamesTeam) {
    const presence = this.socketPresence.get(socket.id)
    if (!presence) return
    const room = this.rooms.get(presence.roomCode)
    if (!room) return

    room.actor.send({ type: 'JOIN_TEAM', playerId: presence.playerId, team })
  }

  handleSetSpymaster(socket: CodenamesSocket) {
    const presence = this.socketPresence.get(socket.id)
    if (!presence) return
    const room = this.rooms.get(presence.roomCode)
    if (!room) return

    room.actor.send({ type: 'SET_SPYMASTER', playerId: presence.playerId })
  }

  handleStartGame(socket: CodenamesSocket) {
    const presence = this.socketPresence.get(socket.id)
    if (!presence) return
    const room = this.rooms.get(presence.roomCode)
    if (!room) return

    // Only host can start
    if (room.hostId !== presence.playerId) {
      socket.emit('room:error', { message: 'Seul le chef de salon peut lancer la partie' })
      return
    }

    room.actor.send({ type: 'START_GAME' })
  }

  handleGiveClue(socket: CodenamesSocket, word: string, count: number) {
    const presence = this.socketPresence.get(socket.id)
    if (!presence) return
    const room = this.rooms.get(presence.roomCode)
    if (!room) return

    // Only current team's spymaster can give clue
    const snapshot = room.actor.getSnapshot()
    const player = snapshot.context.players.find((p: CodenamesPlayer) => p.id === presence.playerId)
    if (!player || !player.isSpymaster || player.team !== snapshot.context.currentTeam) {
      socket.emit('room:error', { message: "Ce n'est pas votre tour de donner un indice" })
      return
    }

    room.actor.send({ type: 'GIVE_CLUE', word: word.trim(), count })
  }

  handleGuessWord(socket: CodenamesSocket, cardIndex: number) {
    const presence = this.socketPresence.get(socket.id)
    if (!presence) return
    const room = this.rooms.get(presence.roomCode)
    if (!room) return

    // Only current team's agents (non-spymasters) can guess
    const snapshot = room.actor.getSnapshot()
    const player = snapshot.context.players.find((p: CodenamesPlayer) => p.id === presence.playerId)
    if (!player || player.isSpymaster || player.team !== snapshot.context.currentTeam) {
      socket.emit('room:error', { message: "Ce n'est pas votre tour de deviner" })
      return
    }

    // Validate card index
    if (cardIndex < 0 || cardIndex >= 25) return
    if (snapshot.context.cards[cardIndex]?.revealed) return

    room.actor.send({ type: 'GUESS_WORD', playerId: presence.playerId, cardIndex })
  }

  handlePassTurn(socket: CodenamesSocket) {
    const presence = this.socketPresence.get(socket.id)
    if (!presence) return
    const room = this.rooms.get(presence.roomCode)
    if (!room) return

    // Only current team's agents can pass
    const snapshot = room.actor.getSnapshot()
    const player = snapshot.context.players.find((p: CodenamesPlayer) => p.id === presence.playerId)
    if (!player || player.isSpymaster || player.team !== snapshot.context.currentTeam) return

    room.actor.send({ type: 'PASS_TURN' })
  }

  handleResetGame(socket: CodenamesSocket) {
    const presence = this.socketPresence.get(socket.id)
    if (!presence) return
    const room = this.rooms.get(presence.roomCode)
    if (!room) return

    if (room.hostId !== presence.playerId) return

    room.actor.send({ type: 'RESET_GAME' })
  }

  handleDisconnect(socket: CodenamesSocket) {
    const presence = this.socketPresence.get(socket.id)
    if (!presence) return

    const room = this.rooms.get(presence.roomCode)
    if (!room) return

    const playerId = presence.playerId
    this.socketPresence.delete(socket.id)

    // Mark as disconnected in machine
    const snapshot = room.actor.getSnapshot()
    const machinePlayer = snapshot.context.players.find((p: CodenamesPlayer) => p.id === playerId)
    if (machinePlayer) {
      machinePlayer.connected = false
    }
    this.broadcastState(room)

    // Grace period before removal
    const timer = setTimeout(() => {
      room.disconnectTimers.delete(playerId)
      this.removePlayer(room, playerId)
    }, DISCONNECT_GRACE_MS)

    room.disconnectTimers.set(playerId, timer)
    console.log(`[Codenames] ${playerId} disconnected from ${room.code}, grace period started`)
  }

  private broadcastState(room: Room) {
    const snapshot = room.actor.getSnapshot()
    const ctx = snapshot.context
    const phase = String(snapshot.value) as CodenamesPublicState['phase']

    // Build public cards (hide colors from non-spymasters)
    const publicCards: CodenamesPublicCard[] = ctx.cards.map((card: { word: string; color: import('@undercover/shared').CardColor; revealed: boolean }) => ({
      word: card.word,
      revealed: card.revealed,
      color: card.revealed ? card.color : null,
    }))

    const publicState: CodenamesPublicState = {
      phase,
      roomCode: room.code,
      hostId: room.hostId,
      players: ctx.players.map((p: CodenamesPlayer) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        isSpymaster: p.isSpymaster,
        connected: p.connected,
      })),
      cards: publicCards,
      currentTeam: ctx.currentTeam,
      currentClue: ctx.currentClue,
      remainingGuesses: ctx.remainingGuesses,
      scores: ctx.scores,
      targets: ctx.targets,
      winner: ctx.winner,
      winReason: ctx.winReason,
      loser: ctx.loser,
    }

    // Send to each player with their private state
    for (const [playerId, roomPlayer] of room.players) {
      const machinePlayer = ctx.players.find((p: CodenamesPlayer) => p.id === playerId)
      const sockets = this.io.sockets
      const playerSocket = sockets?.get(roomPlayer.socketId)
      if (!playerSocket) continue

      const privateState: CodenamesPrivateState = {
        playerId,
        playerToken: roomPlayer.playerToken,
        isHost: room.hostId === playerId,
        team: machinePlayer?.team ?? null,
        isSpymaster: machinePlayer?.isSpymaster ?? false,
        // Spymasters see all card colors
        spymasterCards: machinePlayer?.isSpymaster ? ctx.cards : null,
      }

      playerSocket.emit('game:state', { publicState, privateState })
    }
  }
}
