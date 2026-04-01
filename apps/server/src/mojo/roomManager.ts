import type { Namespace, Socket } from 'socket.io'
import { createActor } from 'xstate'
import type {
  MojoClientToServerEvents,
  MojoServerToClientEvents,
  MojoPublicState,
  MojoPrivateState,
  MojoPublicPlayer,
  MojoCard,
} from '@undercover/shared'
import { mojoMachine, type MojoPlayer, type MojoActor } from './mojoMachine.js'

type MojoSocket = Socket<MojoClientToServerEvents, MojoServerToClientEvents>

interface RoomPlayer { id: string; name: string; socketId: string; playerToken: string }
interface Room {
  code: string; actor: MojoActor; players: Map<string, RoomPlayer>
  hostId: string; disconnectTimers: Map<string, ReturnType<typeof setTimeout>>
}

const DISCONNECT_GRACE_MS = 90_000
function genCode(): string { const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let r = ''; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r }
function genId(): string { return Math.random().toString(36).substring(2, 10) }

export class MojoRoomManager {
  private rooms = new Map<string, Room>()
  private socketPresence = new Map<string, { roomCode: string; playerId: string }>()

  constructor(private io: Namespace<MojoClientToServerEvents, MojoServerToClientEvents>) {}

  createRoom(socket: MojoSocket, playerName: string) {
    const existing = this.socketPresence.get(socket.id)
    if (existing) this.leaveRoom(socket)
    let code = genCode(); while (this.rooms.has(code)) code = genCode()
    const playerId = genId(); const playerToken = genId() + genId()
    const actor = createActor(mojoMachine)
    const room: Room = { code, actor, players: new Map(), hostId: playerId, disconnectTimers: new Map() }
    room.players.set(playerId, { id: playerId, name: playerName, socketId: socket.id, playerToken })
    this.rooms.set(code, room); this.socketPresence.set(socket.id, { roomCode: code, playerId })
    socket.join(code)
    actor.subscribe(() => this.broadcastState(room)); actor.start()
    actor.send({ type: 'ADD_PLAYER', id: playerId, name: playerName })
    socket.emit('room:joined', { roomCode: code, playerId, playerToken })
    console.log(`[Mojo] Room ${code} created by ${playerName}`)
  }

  joinRoom(socket: MojoSocket, roomCode: string, playerName: string, playerToken?: string) {
    const code = roomCode.toUpperCase(); const room = this.rooms.get(code)
    if (!room) { socket.emit('room:error', { message: 'Salon introuvable' }); return }
    if (playerToken) {
      for (const [pid, player] of room.players) {
        if (player.playerToken === playerToken) {
          const t = room.disconnectTimers.get(pid); if (t) { clearTimeout(t); room.disconnectTimers.delete(pid) }
          player.socketId = socket.id; player.name = playerName
          this.socketPresence.set(socket.id, { roomCode: code, playerId: pid }); socket.join(code)
          const mp = room.actor.getSnapshot().context.players.find((p: MojoPlayer) => p.id === pid)
          if (mp) mp.connected = true
          socket.emit('room:joined', { roomCode: code, playerId: pid, playerToken: player.playerToken })
          this.broadcastState(room); return
        }
      }
    }
    const playerId = genId(); const newToken = genId() + genId()
    room.players.set(playerId, { id: playerId, name: playerName, socketId: socket.id, playerToken: newToken })
    this.socketPresence.set(socket.id, { roomCode: code, playerId }); socket.join(code)
    room.actor.send({ type: 'ADD_PLAYER', id: playerId, name: playerName })
    socket.emit('room:joined', { roomCode: code, playerId, playerToken: newToken })
  }

  leaveRoom(socket: MojoSocket) {
    const p = this.socketPresence.get(socket.id); if (!p) return
    const room = this.rooms.get(p.roomCode); if (!room) return
    this.removePlayer(room, p.playerId); this.socketPresence.delete(socket.id); socket.leave(p.roomCode)
  }

  private removePlayer(room: Room, playerId: string) {
    room.players.delete(playerId); room.actor.send({ type: 'REMOVE_PLAYER', id: playerId })
    if (room.players.size === 0) { room.actor.stop(); this.rooms.delete(room.code); return }
    if (room.hostId === playerId) { const f = room.players.values().next().value; if (f) room.hostId = f.id }
    this.broadcastState(room)
  }

  private pr(socket: MojoSocket): { room: Room; playerId: string } | null {
    const p = this.socketPresence.get(socket.id); if (!p) return null
    const room = this.rooms.get(p.roomCode); if (!room) return null
    return { room, playerId: p.playerId }
  }
  private isCurrent(room: Room, pid: string): boolean {
    const ctx = room.actor.getSnapshot().context; return ctx.players[ctx.currentPlayerIndex]?.id === pid
  }

  handleStartGame(socket: MojoSocket) { const r = this.pr(socket); if (!r || r.room.hostId !== r.playerId) return; r.room.actor.send({ type: 'START_GAME' }) }
  handleSetDoubleDiscard(socket: MojoSocket, enabled: boolean) { const r = this.pr(socket); if (!r || r.room.hostId !== r.playerId) return; r.room.actor.send({ type: 'SET_DOUBLE_DISCARD', enabled }) }

  handlePlayCard(socket: MojoSocket, cardId: number, discardIndex: number) {
    const r = this.pr(socket); if (!r || !this.isCurrent(r.room, r.playerId)) return
    r.room.actor.send({ type: 'PLAY_CARD', playerId: r.playerId, cardId, discardIndex: discardIndex || 0 })
  }

  handleDraw(socket: MojoSocket, source: 'pile' | 'discard', discardIndex: number) {
    const r = this.pr(socket); if (!r || !this.isCurrent(r.room, r.playerId)) return
    r.room.actor.send({ type: 'DRAW', source, discardIndex: discardIndex || 0 })
  }

  handleEndTurn(socket: MojoSocket) {
    const r = this.pr(socket); if (!r || !this.isCurrent(r.room, r.playerId)) return
    r.room.actor.send({ type: 'END_TURN' })
  }

  handleRevealMojoCard(socket: MojoSocket, cardId: number) {
    const r = this.pr(socket); if (!r || !this.isCurrent(r.room, r.playerId)) return
    r.room.actor.send({ type: 'REVEAL_MOJO_CARD', playerId: r.playerId, cardId })
  }

  handleNextRound(socket: MojoSocket) { const r = this.pr(socket); if (!r || r.room.hostId !== r.playerId) return; r.room.actor.send({ type: 'NEXT_ROUND' }) }
  handleResetGame(socket: MojoSocket) { const r = this.pr(socket); if (!r || r.room.hostId !== r.playerId) return; r.room.actor.send({ type: 'RESET_GAME' }) }

  handleDisconnect(socket: MojoSocket) {
    const p = this.socketPresence.get(socket.id); if (!p) return
    const room = this.rooms.get(p.roomCode); if (!room) return
    const pid = p.playerId; this.socketPresence.delete(socket.id)
    const mp = room.actor.getSnapshot().context.players.find((pl: MojoPlayer) => pl.id === pid)
    if (mp) mp.connected = false; this.broadcastState(room)
    const timer = setTimeout(() => { room.disconnectTimers.delete(pid); this.removePlayer(room, pid) }, DISCONNECT_GRACE_MS)
    room.disconnectTimers.set(pid, timer)
  }

  private broadcastState(room: Room) {
    const snapshot = room.actor.getSnapshot()
    const ctx = snapshot.context
    const phase = this.resolvePhase(snapshot.value)

    const publicPlayers: MojoPublicPlayer[] = ctx.players.map((p: MojoPlayer) => ({
      id: p.id, name: p.name, connected: p.connected,
      handCount: p.hand.length, mojoCardsCount: p.mojoCards.length,
      revealedMojoCards: p.revealedMojoCards, inMojoTime: p.inMojoTime, hasMojo: p.hasMojo,
    }))

    const revealedHands: Record<string, MojoCard[]> | null = phase === 'roundEnd' || phase === 'gameOver'
      ? Object.fromEntries(ctx.players.map((p: MojoPlayer) => [p.id, [...p.hand, ...p.mojoCards, ...p.revealedMojoCards]]))
      : null

    const publicState: MojoPublicState = {
      phase, roomCode: room.code, hostId: room.hostId, players: publicPlayers,
      currentPlayerId: ctx.players[ctx.currentPlayerIndex]?.id ?? null,
      discardTops: ctx.discardPiles.map((d: MojoCard[]) => d.length > 0 ? d[d.length - 1] : null),
      drawPileCount: ctx.drawPile.length,
      discardCount: ctx.discardCount, mojoHolderId: ctx.mojoHolderId,
      direction: ctx.direction, scores: this.serializeScores(ctx.scores),
      round: ctx.round, roundScores: ctx.roundScores,
      revealedHands,
      mojoScoreZero: ctx.mojoHolderId !== null && ctx.roundScores?.[ctx.mojoHolderId] === 0,
      mojoPenalty: ctx.mojoHolderId !== null && ctx.roundScores !== null && (ctx.roundScores[ctx.mojoHolderId] ?? 0) > 0 && ctx.players.find((p: MojoPlayer) => p.id === ctx.mojoHolderId)?.hasMojo === true,
      winnerId: ctx.winnerId,
      doubleDiscard: ctx.doubleDiscard,
      playedThisTurn: ctx.playedThisTurn, mustDraw: ctx.mustDraw,
      equalChainActive: ctx.lastPlayedValue !== null,
      activeDiscardIndex: ctx.activeDiscardIndex,
    }

    for (const [playerId, roomPlayer] of room.players) {
      const playerSocket = this.io.sockets?.get(roomPlayer.socketId); if (!playerSocket) continue
      const mp = ctx.players.find((p: MojoPlayer) => p.id === playerId)
      const privateState: MojoPrivateState = {
        playerId, playerToken: roomPlayer.playerToken, isHost: room.hostId === playerId,
        hand: mp?.hand || [], mojoCards: mp?.mojoCards || [],
      }
      playerSocket.emit('game:state', { publicState, privateState })
    }
  }

  private resolvePhase(value: unknown): MojoPublicState['phase'] {
    if (typeof value === 'string') return value as MojoPublicState['phase']
    return 'playing'
  }
  private serializeScores(s: Record<string, number[]>): Record<string, number[]> {
    const r: Record<string, number[]> = {}; for (const [k, v] of Object.entries(s)) r[k] = [...v]; return r
  }
}
