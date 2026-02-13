import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { ClientToServerEvents, ServerToClientEvents } from '@undercover/shared';
import { RoomManager } from './roomManager';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
];

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager(io);

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on('room:create', (data) => roomManager.createRoom(socket, data));
  socket.on('room:join', (data) => roomManager.joinRoom(socket, data));
  socket.on('room:leave', () => roomManager.leaveRoom(socket));

  socket.on('game:setCategory', (data) => roomManager.handleGameEvent(socket, 'SET_CATEGORY', data));
  socket.on('game:setTimerDuration', (data) => roomManager.handleGameEvent(socket, 'SET_TIMER_DURATION', data));
  socket.on('game:setHideRoles', (data) => roomManager.handleGameEvent(socket, 'SET_HIDE_ROLES', data));
  socket.on('game:startDistribution', () => roomManager.handleGameEvent(socket, 'START_ROLE_DISTRIBUTION'));
  socket.on('game:ready', () => roomManager.handleGameEvent(socket, 'PLAYER_READY'));
  socket.on('game:nextSpeaker', () => roomManager.handleGameEvent(socket, 'NEXT_SPEAKER'));
  socket.on('game:startVoting', () => roomManager.handleGameEvent(socket, 'START_VOTING'));
  socket.on('game:castVote', (data) => roomManager.handleGameEvent(socket, 'CAST_VOTE', data));
  socket.on('game:submitMrWhiteGuess', (data) => roomManager.handleGameEvent(socket, 'SUBMIT_MRWHITE_GUESS', data));
  socket.on('game:castMrWhiteVote', (data) => roomManager.handleGameEvent(socket, 'CAST_MRWHITE_VOTE', data));
  socket.on('game:resetGame', () => roomManager.handleGameEvent(socket, 'RESET_GAME'));

  socket.on('disconnect', () => roomManager.handleDisconnect(socket));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Server] Undercover game server running on port ${PORT}`);
});
