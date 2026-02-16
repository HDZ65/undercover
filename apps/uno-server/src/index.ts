import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import type { ClientToServerEvents, ServerToClientEvents } from '@uno/shared'
import { RoomManager } from './roomManager.js'

const app = express()
const httpServer = createServer(app)

const ALLOWED_ORIGINS = [
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean) as string[]

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
  },
})

const roomManager = new RoomManager(io)

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`)

  socket.on('room:create', (data) => {
    roomManager.createRoom(socket, data.playerName)
  })

  socket.on('room:join', (data) => {
    roomManager.joinRoom(socket, data.roomCode, data.playerName, data.playerToken)
  })

  socket.on('room:leave', () => {
    roomManager.leaveRoom(socket)
  })

  socket.on('game:startGame', (data) => {
    roomManager.handleGameEvent(socket, 'START_GAME', data)
  })

  socket.on('game:playCard', (data) => {
    roomManager.handleGameEvent(socket, 'PLAY_CARD', data)
  })

  socket.on('game:drawCard', () => {
    roomManager.handleGameEvent(socket, 'DRAW_CARD')
  })

  socket.on('game:callUno', () => {
    roomManager.handleGameEvent(socket, 'CALL_UNO')
  })

  socket.on('game:catchUno', (data) => {
    roomManager.handleGameEvent(socket, 'CATCH_UNO', data)
  })

  socket.on('game:chooseColor', (data) => {
    roomManager.handleGameEvent(socket, 'CHOOSE_COLOR', data)
  })

  socket.on('game:challengeWD4', () => {
    roomManager.handleGameEvent(socket, 'CHALLENGE_WD4')
  })

  socket.on('game:acceptWD4', (data) => {
    roomManager.handleGameEvent(socket, 'ACCEPT_WD4', data)
  })

  socket.on('game:setHouseRules', (data) => {
    roomManager.handleGameEvent(socket, 'SET_HOUSE_RULES', data)
  })

  socket.on('game:setTargetScore', (data) => {
    roomManager.handleGameEvent(socket, 'SET_TARGET_SCORE', data)
  })

  socket.on('game:setTurnTimer', (data) => {
    roomManager.handleGameEvent(socket, 'SET_TURN_TIMER', data)
  })

  socket.on('game:continueNextRound', () => {
    roomManager.handleGameEvent(socket, 'CONTINUE_NEXT_ROUND')
  })

  socket.on('game:resetGame', () => {
    roomManager.handleGameEvent(socket, 'RESET_GAME')
  })

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`)
    roomManager.handleDisconnect(socket)
  })
})

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002

httpServer.listen(PORT, () => {
  console.log(`[Server] UNO game server running on port ${PORT}`)
})
