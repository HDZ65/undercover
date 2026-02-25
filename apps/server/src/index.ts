import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { Namespace } from 'socket.io';
import cors from 'cors';
import type { ClientToServerEvents, ServerToClientEvents } from '@undercover/shared';
import type {
  ClientToServerEvents as UnoClientToServerEvents,
  ServerToClientEvents as UnoServerToClientEvents,
} from './uno/shared.js';
import type {
  EcoWarClientToServerEvents,
  EcoWarServerToClientEvents,
} from '@undercover/shared';
import { RoomManager } from './roomManager';
import { PokerRoomManager } from './poker/pokerRoomManager';
import { RoomManager as UnoRoomManager } from './uno/roomManager.js';
import { EcoWarRoomManager } from './economic-war/roomManager.js';

const app = express();
app.use(cors());
// Health check endpoint — used by external cron (e.g. cron-job.org) to keep Render awake
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});
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
  // Tuned for Render free tier (sleeps after 15 min inactivity)
  pingInterval: 20_000,
  pingTimeout: 10_000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60_000,
    skipMiddlewares: true,
  },
});

const roomManager = new RoomManager(io);
const pokerRoomManager = new PokerRoomManager(io);
const unoNamespace = io.of('/uno') as Namespace<UnoClientToServerEvents, UnoServerToClientEvents>;
const unoRoomManager = new UnoRoomManager(unoNamespace);
const ecoWarNamespace = io.of('/economic-war') as Namespace<EcoWarClientToServerEvents, EcoWarServerToClientEvents>;
const ecoWarRoomManager = new EcoWarRoomManager(ecoWarNamespace);

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

  socket.on('poker:toggleStraddle', () => pokerRoomManager.toggleStraddle(socket));
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

  socket.on('game:playCards', (data) => {
    unoRoomManager.handleGameEvent(socket, 'PLAY_CARDS', data);
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

ecoWarNamespace.on('connection', (socket) => {
  console.log(`[EcoWar] Connected: ${socket.id}`);

  // Room management
  socket.on('room:create', (data) => {
    ecoWarRoomManager.createRoom(socket, data.playerName);
  });

  socket.on('room:join', (data) => {
    ecoWarRoomManager.joinRoom(socket, data.roomCode, data.playerName, data.playerToken);
  });

  socket.on('room:leave', () => {
    ecoWarRoomManager.leaveRoom(socket);
  });

  // Lobby
  socket.on('game:setConfig', (data) => {
    ecoWarRoomManager.handleSetConfig(socket, data.config);
  });

  socket.on('game:startGame', () => {
    ecoWarRoomManager.handleStartGame(socket);
  });

  // Country selection
  socket.on('game:selectCountry', (data) => {
    ecoWarRoomManager.handleSelectCountry(socket, data.countryId);
  });

  // Gameplay
  socket.on('game:submitActions', (data) => {
    ecoWarRoomManager.handleSubmitActions(socket, data.actions);
  });

  socket.on('game:ready', () => {
    ecoWarRoomManager.handleReady(socket);
  });

  socket.on('game:abandon', () => {
    ecoWarRoomManager.handleAbandon(socket);
  });

  // Trade
  socket.on('trade:propose', (data) => {
    ecoWarRoomManager.handleTradePropose(socket, data.targetId, data.offer, data.moneyAmount);
  });

  socket.on('trade:respond', (data) => {
    ecoWarRoomManager.handleTradeRespond(socket, data.tradeId, data.accepted);
  });

  // Organizations
  socket.on('org:create', (data) => {
    ecoWarRoomManager.handleOrgCreate(socket, data.name, data.type, data.invitedPlayerIds);
  });

  socket.on('org:vote', (data) => {
    ecoWarRoomManager.handleOrgVote(socket, data.orgId, data.voteId, data.vote);
  });

  socket.on('org:leave', (data) => {
    ecoWarRoomManager.handleOrgLeave(socket, data.orgId);
  });

  socket.on('org:proposeVote', (data) => {
    ecoWarRoomManager.handleOrgProposeVote(socket, data.orgId, data.type, data.description);
  });

  // Sanctions
  socket.on('sanction:apply', (data) => {
    ecoWarRoomManager.handleSanctionApply(socket, data.targetId, data.type);
  });

  socket.on('sanction:lift', (data) => {
    ecoWarRoomManager.handleSanctionLift(socket, data.sanctionId);
  });

  // Threats
  socket.on('threat:declare', (data) => {
    ecoWarRoomManager.handleThreatDeclare(socket, data.targetId, data.targetInfrastructure, data.demand);
  });

  socket.on('threat:respond', (data) => {
    ecoWarRoomManager.handleThreatRespond(socket, data.threatId, data.accepted);
  });

  socket.on('threat:execute', (data) => {
    ecoWarRoomManager.handleThreatExecute(socket, data.threatId);
  });

  socket.on('threat:withdraw', (data) => {
    ecoWarRoomManager.handleThreatWithdraw(socket, data.threatId);
  });

  // Chat
  socket.on('chat:message', (data) => {
    ecoWarRoomManager.handleChatMessage(socket, data.channel, data.message);
  });

  // Reset
  socket.on('game:resetGame' as any, () => {
    ecoWarRoomManager.handleResetGame(socket);
  });

  socket.on('disconnect', () => {
    ecoWarRoomManager.handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Server] Undercover game server running on port ${PORT}`);
  // Self-ping keepalive: prevent Render free tier from sleeping while the process is up.
  // This pings our own /health endpoint every 10 minutes.
  const KEEPALIVE_INTERVAL_MS = 10 * 60_000;
  setInterval(() => {
    fetch(`http://localhost:${PORT}/health`).catch(() => {
      // Swallow errors — this is best-effort
    });
  }, KEEPALIVE_INTERVAL_MS);
});
