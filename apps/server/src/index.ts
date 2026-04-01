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
import type {
  CodenamesClientToServerEvents,
  CodenamesServerToClientEvents,
} from '@undercover/shared';
import { CodenamesRoomManager } from './codenames/roomManager.js';
import type {
  TamalouClientToServerEvents,
  TamalouServerToClientEvents,
} from '@undercover/shared';
import { TamalouRoomManager } from './tamalou/roomManager.js';
import type {
  MojoClientToServerEvents,
  MojoServerToClientEvents,
} from '@undercover/shared';
import { MojoRoomManager } from './mojo/roomManager.js';

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
  pingInterval: 10_000,
  pingTimeout: 5_000,
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
const codenamesNamespace = io.of('/codenames') as Namespace<CodenamesClientToServerEvents, CodenamesServerToClientEvents>;
const codenamesRoomManager = new CodenamesRoomManager(codenamesNamespace);
const tamalouNamespace = io.of('/tamalou') as Namespace<TamalouClientToServerEvents, TamalouServerToClientEvents>;
const tamalouRoomManager = new TamalouRoomManager(tamalouNamespace);
const mojoNamespace = io.of('/mojo') as Namespace<MojoClientToServerEvents, MojoServerToClientEvents>;
const mojoRoomManager = new MojoRoomManager(mojoNamespace);

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

  socket.on('game:freeAction', (data) => {
    ecoWarRoomManager.handleFreeAction(socket, data.action);
  });

  socket.on('game:setProductionChoice', (data) => {
    ecoWarRoomManager.handleSetProductionChoice(socket, data.sector, data.vehicleType, data.vehicleTier, data.weaponTier, data.partTier);
  });

  socket.on('game:ready', () => {
    ecoWarRoomManager.handleReady(socket);
  });

  socket.on('game:abandon', () => {
    ecoWarRoomManager.handleAbandon(socket);
  });

  // Trade
  socket.on('trade:propose', (data) => {
    ecoWarRoomManager.handleTradePropose(socket, data.targetId, data.offer, data.moneyAmount, data.vehicles, data.maintenanceParts, data.militaryUnits);
  });

  socket.on('trade:respond', (data) => {
    ecoWarRoomManager.handleTradeRespond(socket, data.tradeId, data.accepted);
  });

  socket.on('trade:bid', (data) => {
    ecoWarRoomManager.handleAuctionBid(socket, data.auctionId);
  });

  // Region Purchase
  socket.on('region:purchaseRespond', (data) => {
    ecoWarRoomManager.handleRegionPurchaseRespond(socket, data.offerId, data.accepted);
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

  socket.on('org:proposeEmbargo', (data) => {
    ecoWarRoomManager.handleOrgProposeEmbargo(socket, data.orgId, data.targetId, data.amount);
  });

  socket.on('org:proposeAidRequest', (data) => {
    ecoWarRoomManager.handleOrgProposeAidRequest(socket, data.orgId, data.motivationText);
  });

  socket.on('org:castAmountVote', (data) => {
    ecoWarRoomManager.handleOrgCastAmountVote(socket, data.orgId, data.voteId, data.amount);
  });

  socket.on('org:respondInvite', (data) => {
    ecoWarRoomManager.handleOrgRespondInvite(socket, data.pendingOrgId, data.accepted);
  });

  socket.on('org:requestJoin', (data) => {
    ecoWarRoomManager.handleOrgRequestJoin(socket, data.orgId);
  });

  socket.on('org:voteJoinRequest', (data) => {
    ecoWarRoomManager.handleOrgVoteJoinRequest(socket, data.orgId, data.requestId, data.vote);
  });

  socket.on('org:proposeExpel', (data) => {
    ecoWarRoomManager.handleOrgProposeExpel(socket, data.orgId, data.targetId);
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
    ecoWarRoomManager.handleThreatDeclare(socket, data.targetId, data.targetInfrastructure as import('@undercover/shared').ThreatInfraTarget, data.demand as unknown as import('@undercover/shared').ThreatDemand);
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

  // War
  socket.on('war:allocate', (data) => {
    ecoWarRoomManager.handleWarAllocate(socket, data);
  });

  socket.on('war:recruitInfantry', (data) => {
    ecoWarRoomManager.handleRecruitInfantry(socket, data.tier, data.count, data.regionId);
  });

  socket.on('war:trainInfantry', (data) => {
    ecoWarRoomManager.handleTrainInfantry(socket, data.regionId, data.fromTier, data.count);
  });

  socket.on('factory:upgrade', (data) => {
    ecoWarRoomManager.handleUpgradeFactory(socket, data.factoryId);
  });

  socket.on('factory:togglePause', (data) => {
    ecoWarRoomManager.handleTogglePauseFactory(socket, data.factoryId);
  });

  socket.on('war:deployTroops', (data) => {
    ecoWarRoomManager.handleDeployTroops(socket, data.regionId, data.units);
  });

  socket.on('war:transferTroops', (data) => {
    ecoWarRoomManager.handleTransferTroops(socket, data.fromRegionId, data.toRegionId, data.units);
  });

  socket.on('war:attackProvince', (data) => {
    ecoWarRoomManager.handleAttackProvince(socket, data);
  });

  socket.on('war:occupyNeutral', (data) => {
    ecoWarRoomManager.handleOccupyNeutral(socket, data.fromRegionId, data.toRegionId, data.units);
  });

  socket.on('war:fortifyProvince', (data) => {
    ecoWarRoomManager.handleFortifyProvince(socket, data.regionId);
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

// ── Codenames namespace ──
codenamesNamespace.on('connection', (socket) => {
  console.log(`[Codenames] Connected: ${socket.id}`);

  socket.on('room:create', (data) => {
    codenamesRoomManager.createRoom(socket, data.playerName);
  });

  socket.on('room:join', (data) => {
    codenamesRoomManager.joinRoom(socket, data.roomCode, data.playerName, data.playerToken);
  });

  socket.on('room:leave', () => {
    codenamesRoomManager.leaveRoom(socket);
  });

  socket.on('game:joinTeam', (data) => {
    codenamesRoomManager.handleJoinTeam(socket, data.team);
  });

  socket.on('game:setSpymaster', () => {
    codenamesRoomManager.handleSetSpymaster(socket);
  });

  socket.on('game:startGame', () => {
    codenamesRoomManager.handleStartGame(socket);
  });

  socket.on('game:giveClue', (data) => {
    codenamesRoomManager.handleGiveClue(socket, data.word, data.count);
  });

  socket.on('game:guessWord', (data) => {
    codenamesRoomManager.handleGuessWord(socket, data.cardIndex);
  });

  socket.on('game:passTurn', () => {
    codenamesRoomManager.handlePassTurn(socket);
  });

  socket.on('game:resetGame', () => {
    codenamesRoomManager.handleResetGame(socket);
  });

  socket.on('disconnect', () => {
    codenamesRoomManager.handleDisconnect(socket);
  });
});

// ── Tamalou namespace ──
tamalouNamespace.on('connection', (socket) => {
  console.log(`[Tamalou] Connected: ${socket.id}`);

  socket.on('room:create', (data) => tamalouRoomManager.createRoom(socket, data.playerName));
  socket.on('room:join', (data) => tamalouRoomManager.joinRoom(socket, data.roomCode, data.playerName, data.playerToken));
  socket.on('room:leave', () => tamalouRoomManager.leaveRoom(socket));
  socket.on('game:startGame', () => tamalouRoomManager.handleStartGame(socket));
  socket.on('game:setMaxScore', (data) => tamalouRoomManager.handleSetMaxScore(socket, data.maxScore));
  socket.on('game:peekInitial', (data) => tamalouRoomManager.handlePeekInitial(socket, data.cardIndices));
  socket.on('game:draw', (data) => tamalouRoomManager.handleDraw(socket, data.source));
  socket.on('game:swapWithOwn', (data) => tamalouRoomManager.handleSwapWithOwn(socket, data.cardIndex));
  socket.on('game:discardDrawn', () => tamalouRoomManager.handleDiscardDrawn(socket));
  socket.on('game:peekOwn', (data) => tamalouRoomManager.handlePeekOwn(socket, data.cardIndex));
  socket.on('game:peekOpponent', (data) => tamalouRoomManager.handlePeekOpponent(socket, data.targetPlayerId, data.cardIndex));
  socket.on('game:blindSwap', (data) => tamalouRoomManager.handleBlindSwap(socket, data.ownCardIndex, data.targetPlayerId, data.targetCardIndex));
  socket.on('game:skipPower', () => tamalouRoomManager.handleSkipPower(socket));
  socket.on('game:ackPeek', () => tamalouRoomManager.handleAckPeek(socket));
  socket.on('game:callTamalou', () => tamalouRoomManager.handleCallTamalou(socket));
  socket.on('game:nextRound', () => tamalouRoomManager.handleNextRound(socket));
  socket.on('game:resetGame', () => tamalouRoomManager.handleResetGame(socket));
  socket.on('disconnect', () => tamalouRoomManager.handleDisconnect(socket));
});

// ── Mojo namespace ──
mojoNamespace.on('connection', (socket) => {
  console.log(`[Mojo] Connected: ${socket.id}`);
  socket.on('room:create', (data) => mojoRoomManager.createRoom(socket, data.playerName));
  socket.on('room:join', (data) => mojoRoomManager.joinRoom(socket, data.roomCode, data.playerName, data.playerToken));
  socket.on('room:leave', () => mojoRoomManager.leaveRoom(socket));
  socket.on('game:startGame', () => mojoRoomManager.handleStartGame(socket));
  socket.on('game:setDoubleDiscard', (data) => mojoRoomManager.handleSetDoubleDiscard(socket, data.enabled));
  socket.on('game:playCard', (data) => mojoRoomManager.handlePlayCard(socket, data.cardId, data.discardIndex ?? 0));
  socket.on('game:draw', (data) => mojoRoomManager.handleDraw(socket, data.source, data.discardIndex ?? 0));
  socket.on('game:endTurn', () => mojoRoomManager.handleEndTurn(socket));
  socket.on('game:revealMojoCard', (data) => mojoRoomManager.handleRevealMojoCard(socket, data.cardId));
  socket.on('game:nextRound', () => mojoRoomManager.handleNextRound(socket));
  socket.on('game:resetGame', () => mojoRoomManager.handleResetGame(socket));
  socket.on('disconnect', () => mojoRoomManager.handleDisconnect(socket));
});

// ── Global error handlers — prevent silent crashes ──
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Server] Undercover game server running on port ${PORT}`);

  // Self-ping via external URL to prevent Render free tier from sleeping.
  // Set RENDER_EXTERNAL_URL in Render dashboard (e.g. https://undercover-server.onrender.com)
  const externalUrl = process.env.RENDER_EXTERNAL_URL;
  if (externalUrl) {
    const KEEPALIVE_MS = 5 * 60_000; // every 5 min
    console.log(`[Server] Keepalive enabled: pinging ${externalUrl}/health every 5 min`);
    setInterval(() => {
      fetch(`${externalUrl}/health`).catch(() => {});
    }, KEEPALIVE_MS);
  }
});
