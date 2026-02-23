import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { Namespace } from 'socket.io';
import cors from 'cors';
import type { ClientToServerEvents, ServerToClientEvents } from '@undercover/shared';
import type {
  ClientToServerEvents as UnoClientToServerEvents,
  ServerToClientEvents as UnoServerToClientEvents,
} from '@uno/shared';
import { RoomManager } from './roomManager';
import { PokerRoomManager } from './poker/pokerRoomManager';
import { RoomManager as UnoRoomManager } from './uno/roomManager.js';

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
const pokerRoomManager = new PokerRoomManager(io);
const unoNamespace = io.of('/uno') as Namespace<UnoClientToServerEvents, UnoServerToClientEvents>;
const unoRoomManager = new UnoRoomManager(unoNamespace);

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on('room:create', (data) => roomManager.createRoom(socket, data));
  socket.on('room:join', (data) => roomManager.joinRoom(socket, data));
  socket.on('room:leave', () => roomManager.leaveRoom(socket));
  socket.on('room:list', () => {
    socket.emit('room:list', { rooms: roomManager.getPublicRooms() });
  });

  socket.on('poker:createTable', (data) => pokerRoomManager.createTable(socket, data));
  socket.on('poker:joinTable', (data) => {
    void pokerRoomManager.joinTable(socket, data);
  });
  socket.on('poker:leaveTable', () => {
    void pokerRoomManager.leaveTable(socket);
  });
  socket.on('poker:sitOut', () => pokerRoomManager.sitOut(socket));
  socket.on('poker:sitIn', () => pokerRoomManager.sitIn(socket));

  socket.on('poker:fold', ((data?: { sequenceNumber?: number }) => pokerRoomManager.handleAction(socket, 'fold', data)) as () => void);
  socket.on('poker:check', ((data?: { sequenceNumber?: number }) => pokerRoomManager.handleAction(socket, 'check', data)) as () => void);
  socket.on('poker:call', ((data?: { sequenceNumber?: number }) => pokerRoomManager.handleAction(socket, 'call', data)) as () => void);
  socket.on('poker:allIn', ((data?: { sequenceNumber?: number }) => pokerRoomManager.handleAction(socket, 'allIn', data)) as () => void);
  socket.on('poker:raise', (data) => pokerRoomManager.handleAction(socket, 'raise', data));
  socket.on('poker:acceptRunItTwice', (data) => pokerRoomManager.acceptRunItTwice(socket, data));

  socket.on('game:setCategory', (data) => roomManager.handleGameEvent(socket, 'SET_CATEGORY', data));
  socket.on('game:setTimerDuration', (data) => roomManager.handleGameEvent(socket, 'SET_TIMER_DURATION', data));
  socket.on('game:setHideRoles', (data) => roomManager.handleGameEvent(socket, 'SET_HIDE_ROLES', data));
  socket.on('game:setNoElimination', (data) => roomManager.handleGameEvent(socket, 'SET_NO_ELIMINATION', data));
  socket.on('game:startDistribution', () => roomManager.handleGameEvent(socket, 'START_ROLE_DISTRIBUTION'));
  socket.on('game:ready', () => roomManager.handleGameEvent(socket, 'PLAYER_READY'));
  socket.on('game:nextSpeaker', () => roomManager.handleGameEvent(socket, 'NEXT_SPEAKER'));
  socket.on('game:startVoting', () => roomManager.handleGameEvent(socket, 'START_VOTING'));
  socket.on('game:castVote', (data) => roomManager.handleGameEvent(socket, 'CAST_VOTE', data));
  socket.on('game:submitMrWhiteGuess', (data) => roomManager.handleGameEvent(socket, 'SUBMIT_MRWHITE_GUESS', data));
  socket.on('game:castMrWhiteVote', (data) => roomManager.handleGameEvent(socket, 'CAST_MRWHITE_VOTE', data));
  socket.on('game:continueGame', () => roomManager.handleGameEvent(socket, 'CONTINUE_GAME'));
  socket.on('game:endGame', () => roomManager.handleGameEvent(socket, 'END_GAME'));
  socket.on('game:resetGame', () => roomManager.handleGameEvent(socket, 'RESET_GAME'));

  socket.on('disconnect', () => roomManager.handleDisconnect(socket));
  socket.on('disconnect', () => pokerRoomManager.handleDisconnect(socket));
});

unoNamespace.on('connection', (socket) => {
  console.log(`[UNO] Connected: ${socket.id}`);

  socket.on('room:create', (data) => {
    unoRoomManager.createRoom(socket, data.playerName);
  });

  socket.on('room:join', (data) => {
    unoRoomManager.joinRoom(socket, data.roomCode, data.playerName, data.playerToken);
  });

  socket.on('room:leave', () => {
    unoRoomManager.leaveRoom(socket);
  });

  socket.on('game:startGame', (data) => {
    unoRoomManager.handleGameEvent(socket, 'START_GAME', data);
  });

  socket.on('game:playCard', (data) => {
    unoRoomManager.handleGameEvent(socket, 'PLAY_CARD', data);
  });

  socket.on('game:drawCard', () => {
    unoRoomManager.handleGameEvent(socket, 'DRAW_CARD');
  });

  socket.on('game:callUno', () => {
    unoRoomManager.handleGameEvent(socket, 'CALL_UNO');
  });

  socket.on('game:catchUno', (data) => {
    unoRoomManager.handleGameEvent(socket, 'CATCH_UNO', data);
  });

  socket.on('game:chooseColor', (data) => {
    unoRoomManager.handleGameEvent(socket, 'CHOOSE_COLOR', data);
  });

  socket.on('game:challengeWD4', () => {
    unoRoomManager.handleGameEvent(socket, 'CHALLENGE_WD4');
  });

  socket.on('game:acceptWD4', (data) => {
    unoRoomManager.handleGameEvent(socket, 'ACCEPT_WD4', data);
  });

  socket.on('game:setHouseRules', (data) => {
    unoRoomManager.handleGameEvent(socket, 'SET_HOUSE_RULES', data);
  });

  socket.on('game:setTargetScore', (data) => {
    unoRoomManager.handleGameEvent(socket, 'SET_TARGET_SCORE', data);
  });

  socket.on('game:setTurnTimer', (data) => {
    unoRoomManager.handleGameEvent(socket, 'SET_TURN_TIMER', data);
  });

  socket.on('game:continueNextRound', () => {
    unoRoomManager.handleGameEvent(socket, 'CONTINUE_NEXT_ROUND');
  });

  socket.on('game:resetGame', () => {
    unoRoomManager.handleGameEvent(socket, 'RESET_GAME');
  });

  socket.on('disconnect', () => {
    unoRoomManager.handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Server] Undercover game server running on port ${PORT}`);
});
