import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  EcoWarClientToServerEvents,
  EcoWarServerToClientEvents,
  EcoWarPublicGameState,
  EcoWarPrivatePlayerState,
  GameConfig,
  PlayerAction,
  ResourceType,
  VehicleTradeItem,
  MilitaryUnitTradeItem,
  OrganizationType,
  CountryProfile,
  TradeOffer,
  RegionPurchaseOffer,
  Threat,
  ResolutionEntry,
  GameNotification,
  JournalHeadline,
  IndustrySector,
  VehicleType,
  VehicleTier,
  WarAllocationSubmission,
  MilitaryUnits,
  AttackOrder,
} from '@undercover/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const STORAGE_KEY_PLAYER_ID = 'ecowar_playerId';
const STORAGE_KEY_PLAYER_TOKEN = 'ecowar_playerToken';
const STORAGE_KEY_ROOM_CODE = 'ecowar_roomCode';
const STORAGE_KEY_PLAYER_NAME = 'ecowar_playerName';

type EcoWarSocket = Socket<EcoWarServerToClientEvents, EcoWarClientToServerEvents>;

interface ConnectionInfo {
  connected: boolean;
  playerId: string | null;
  playerToken: string | null;
  roomCode: string | null;
  isHost: boolean;
}

export function useEcoWarSocket() {
  const socketRef = useRef<EcoWarSocket | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    connected: false,
    playerId: null,
    playerToken: null,
    roomCode: null,
    isHost: false,
  });
  const [publicState, setPublicState] = useState<EcoWarPublicGameState | null>(null);
  const [privateState, setPrivateState] = useState<EcoWarPrivatePlayerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [countryList, setCountryList] = useState<{ countries: CountryProfile[]; takenIds: string[] } | null>(null);
  const [incomingTrades, setIncomingTrades] = useState<TradeOffer[]>([]);
  const [incomingRegionPurchases, setIncomingRegionPurchases] = useState<RegionPurchaseOffer[]>([]);
  const [incomingThreats, setIncomingThreats] = useState<Threat[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ from: string; fromName: string; channel: string; message: string; timestamp: number }>>([]);
  const [resolutionLog, setResolutionLog] = useState<ResolutionEntry[]>([]);
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  const [journalHeadlines, setJournalHeadlines] = useState<JournalHeadline[]>([]);

  // ─── Socket Connection ───────────────────────────────────────

  useEffect(() => {
    const socket: EcoWarSocket = io(`${SERVER_URL}/economic-war`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionInfo(prev => ({ ...prev, connected: true }));

      // Auto-reconnect if we have stored session
      const storedToken = localStorage.getItem(STORAGE_KEY_PLAYER_TOKEN);
      const storedRoom = localStorage.getItem(STORAGE_KEY_ROOM_CODE);
      const storedName = localStorage.getItem(STORAGE_KEY_PLAYER_NAME);

      if (storedToken && storedRoom && storedName) {
        socket.emit('room:join', {
          roomCode: storedRoom,
          playerName: storedName,
          playerToken: storedToken,
        });
      }
    });

    socket.on('disconnect', () => {
      setConnectionInfo(prev => ({ ...prev, connected: false }));
    });

    // Room events
    socket.on('room:created', (data) => {
      localStorage.setItem(STORAGE_KEY_PLAYER_ID, data.playerId);
      localStorage.setItem(STORAGE_KEY_PLAYER_TOKEN, data.playerToken);
      localStorage.setItem(STORAGE_KEY_ROOM_CODE, data.roomCode);
      setConnectionInfo(prev => ({
        ...prev,
        playerId: data.playerId,
        playerToken: data.playerToken,
        roomCode: data.roomCode,
        isHost: true,
      }));
      setError(null);
    });

    socket.on('room:joined', (data) => {
      localStorage.setItem(STORAGE_KEY_PLAYER_ID, data.playerId);
      localStorage.setItem(STORAGE_KEY_PLAYER_TOKEN, data.playerToken);
      setConnectionInfo(prev => ({
        ...prev,
        playerId: data.playerId,
        playerToken: data.playerToken,
      }));
      setError(null);
    });

    socket.on('room:error', (data) => {
      setError(data.message);
    });

    socket.on('room:hostChanged', (data) => {
      setConnectionInfo(prev => ({
        ...prev,
        isHost: prev.playerId === data.hostId,
      }));
    });

    // Game state
    socket.on('game:publicState', (data) => {
      setPublicState(data);
      setConnectionInfo(prev => ({
        ...prev,
        isHost: prev.playerId === data.hostId,
        roomCode: prev.roomCode,
      }));
    });

    socket.on('game:privateState', (data) => {
      setPrivateState(data);
    });

    socket.on('game:timerTick', (data) => {
      setTimer(data.remaining);
    });

    socket.on('game:countryList', (data) => {
      setCountryList(data);
    });

    // Trade events
    socket.on('trade:incoming', (data) => {
      setIncomingTrades(prev => [...prev, data.trade]);
    });

    socket.on('trade:result', (data) => {
      setIncomingTrades(prev => prev.filter(t => t.id !== data.tradeId));
    });

    // Region purchase events
    socket.on('region:purchaseIncoming', (data) => {
      setIncomingRegionPurchases(prev => [...prev, data.offer]);
    });

    socket.on('region:purchaseResult', (data) => {
      setIncomingRegionPurchases(prev => prev.filter(o => o.id !== data.offerId));
    });

    // Threat events
    socket.on('threat:received', (data) => {
      setIncomingThreats(prev => [...prev, data.threat]);
    });

    socket.on('threat:resolved', (data) => {
      setIncomingThreats(prev => prev.filter(t => t.id !== data.threatId));
    });

    // Resolution events
    socket.on('resolution:step', (data) => {
      setResolutionLog(prev => [...prev, ...data.entries]);
    });

    socket.on('resolution:complete', (data) => {
      setResolutionLog(data.roundSummary);
    });

    // Chat events
    socket.on('chat:message', (data) => {
      setChatMessages(prev => [...prev.slice(-99), data]);
    });

    // Notification events
    socket.on('notification:alert', (data) => {
      setNotifications(prev => [...prev, data]);
    });

    // Journal headlines (emitted when entering marketEvent phase)
    socket.on('journal:headlines', (data) => {
      setJournalHeadlines(data.headlines);
    });

    // Clear resolution log on phase change
    socket.on('game:phaseChanged', () => {
      setResolutionLog([]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ─── Room Actions ────────────────────────────────────────────

  const createRoom = useCallback((playerName: string) => {
    localStorage.setItem(STORAGE_KEY_PLAYER_NAME, playerName);
    socketRef.current?.emit('room:create', { playerName });
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    localStorage.setItem(STORAGE_KEY_PLAYER_NAME, playerName);
    localStorage.setItem(STORAGE_KEY_ROOM_CODE, roomCode);
    const storedToken = localStorage.getItem(STORAGE_KEY_PLAYER_TOKEN);
    socketRef.current?.emit('room:join', {
      roomCode,
      playerName,
      playerToken: storedToken || undefined,
    });
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('room:leave');
    localStorage.removeItem(STORAGE_KEY_PLAYER_ID);
    localStorage.removeItem(STORAGE_KEY_PLAYER_TOKEN);
    localStorage.removeItem(STORAGE_KEY_ROOM_CODE);
    setPublicState(null);
    setPrivateState(null);
    setConnectionInfo(prev => ({
      ...prev,
      playerId: null,
      playerToken: null,
      roomCode: null,
      isHost: false,
    }));
  }, []);

  // ─── Lobby Actions ───────────────────────────────────────────

  const setConfig = useCallback((config: Partial<GameConfig>) => {
    socketRef.current?.emit('game:setConfig', { config });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.emit('game:startGame');
  }, []);

  // ─── Country Selection ───────────────────────────────────────

  const selectCountry = useCallback((countryId: string) => {
    socketRef.current?.emit('game:selectCountry', { countryId });
  }, []);

  // ─── Gameplay Actions ────────────────────────────────────────

  const submitActions = useCallback((actions: PlayerAction[]) => {
    socketRef.current?.emit('game:submitActions', { actions });
  }, []);

  const submitFreeAction = useCallback((action: PlayerAction) => {
    socketRef.current?.emit('game:freeAction', { action });
  }, []);

  const setProductionChoice = useCallback((
    sector: IndustrySector,
    opts: {
      vehicleType?: VehicleType;
      vehicleTier?: VehicleTier;
      weaponTier?: 1 | 2 | 3 | 4;
      partTier?: 1 | 2 | 3 | 4;
    },
  ) => {
    socketRef.current?.emit('game:setProductionChoice', { sector, ...opts });
  }, []);

  const submitWarAllocation = useCallback((allocation: WarAllocationSubmission) => {
    socketRef.current?.emit('war:allocate', allocation);
  }, []);

  const recruitInfantry = useCallback((tier: 1 | 2 | 3, count: number, regionId: string) => {
    socketRef.current?.emit('war:recruitInfantry', { tier, count, regionId });
  }, []);

  const trainInfantry = useCallback((regionId: string, fromTier: 1 | 2, count: number) => {
    socketRef.current?.emit('war:trainInfantry', { regionId, fromTier, count });
  }, []);

  const upgradeFactory = useCallback((factoryId: string) => {
    socketRef.current?.emit('factory:upgrade', { factoryId });
  }, []);

  const togglePauseFactory = useCallback((factoryId: string) => {
    socketRef.current?.emit('factory:togglePause', { factoryId });
  }, []);

  const deployTroops = useCallback((regionId: string, units: MilitaryUnits) => {
    socketRef.current?.emit('war:deployTroops', { regionId, units });
  }, []);

  const transferTroops = useCallback((fromRegionId: string, toRegionId: string, units: MilitaryUnits) => {
    socketRef.current?.emit('war:transferTroops', { fromRegionId, toRegionId, units });
  }, []);

  const attackProvince = useCallback((order: AttackOrder) => {
    socketRef.current?.emit('war:attackProvince', order);
  }, []);

  const occupyNeutral = useCallback((fromRegionId: string, toRegionId: string, units?: MilitaryUnits) => {
    socketRef.current?.emit('war:occupyNeutral', { fromRegionId, toRegionId, units });
  }, []);

  const fortifyProvince = useCallback((regionId: string) => {
    socketRef.current?.emit('war:fortifyProvince', { regionId });
  }, []);

  const markReady = useCallback(() => {
    socketRef.current?.emit('game:ready');
  }, []);

  const abandon = useCallback(() => {
    socketRef.current?.emit('game:abandon');
  }, []);

  // ─── Trade ───────────────────────────────────────────────────

  const proposeTrade = useCallback((
    targetId: string,
    offer: { resource: ResourceType; quantity: number }[],
    moneyAmount: number,
    vehicles?: VehicleTradeItem[],
    maintenanceParts?: { tier: 1 | 2 | 3 | 4; quantity: number }[],
    militaryUnits?: MilitaryUnitTradeItem[],
  ) => {
    socketRef.current?.emit('trade:propose', { targetId, offer, moneyAmount, vehicles, maintenanceParts, militaryUnits });
  }, []);

  const respondToTrade = useCallback((tradeId: string, accepted: boolean) => {
    socketRef.current?.emit('trade:respond', { tradeId, accepted });
  }, []);

  const respondToRegionPurchase = useCallback((offerId: string, accepted: boolean) => {
    socketRef.current?.emit('region:purchaseRespond', { offerId, accepted });
  }, []);

  const bidOnAuction = useCallback((auctionId: string) => {
    socketRef.current?.emit('trade:bid', { auctionId });
  }, []);

  // ─── Organizations ──────────────────────────────────────────

  const createOrganization = useCallback((name: string, type: OrganizationType, invitedPlayerIds: string[]) => {
    socketRef.current?.emit('org:create', { name, type, invitedPlayerIds });
  }, []);

  const voteInOrganization = useCallback((orgId: string, voteId: string, vote: boolean) => {
    socketRef.current?.emit('org:vote', { orgId, voteId, vote });
  }, []);

  const leaveOrganization = useCallback((orgId: string) => {
    socketRef.current?.emit('org:leave', { orgId });
  }, []);

  // ─── Threats ─────────────────────────────────────────────────

  const declareThreat = useCallback((targetId: string, targetInfrastructure: string, demand: string) => {
    socketRef.current?.emit('threat:declare', { targetId, targetInfrastructure, demand });
  }, []);

  const respondToThreat = useCallback((threatId: string, accepted: boolean) => {
    socketRef.current?.emit('threat:respond', { threatId, accepted });
  }, []);

  const executeThreat = useCallback((threatId: string) => {
    socketRef.current?.emit('threat:execute', { threatId });
  }, []);

  const withdrawThreat = useCallback((threatId: string) => {
    socketRef.current?.emit('threat:withdraw', { threatId });
  }, []);

  // ─── Sanctions ────────────────────────────────────────────────

  const applySanction = useCallback((targetId: string, type: 'trade' | 'tourism' | 'full') => {
    socketRef.current?.emit('sanction:apply', { targetId, type });
  }, []);

  const liftSanction = useCallback((sanctionId: string) => {
    socketRef.current?.emit('sanction:lift', { sanctionId });
  }, []);

  // ─── Org actions avancées ─────────────────────────────────────

  const proposeEmbargo = useCallback((orgId: string, targetId: string, amount: number) => {
    socketRef.current?.emit('org:proposeEmbargo', { orgId, targetId, amount });
  }, []);

  const proposeAidRequest = useCallback((orgId: string, motivationText: string) => {
    socketRef.current?.emit('org:proposeAidRequest', { orgId, motivationText });
  }, []);

  const castAmountVote = useCallback((orgId: string, voteId: string, amount: number) => {
    socketRef.current?.emit('org:castAmountVote', { orgId, voteId, amount });
  }, []);

  const respondToOrgInvite = useCallback((pendingOrgId: string, accepted: boolean) => {
    socketRef.current?.emit('org:respondInvite', { pendingOrgId, accepted });
  }, []);

  const requestJoinOrg = useCallback((orgId: string) => {
    socketRef.current?.emit('org:requestJoin', { orgId });
  }, []);

  const voteJoinRequest = useCallback((orgId: string, requestId: string, vote: boolean) => {
    socketRef.current?.emit('org:voteJoinRequest', { orgId, requestId, vote });
  }, []);

  const proposeExpelMember = useCallback((orgId: string, targetId: string) => {
    socketRef.current?.emit('org:proposeExpel', { orgId, targetId });
  }, []);

  // ─── Chat ────────────────────────────────────────────────────

  const sendChatMessage = useCallback((channel: 'public' | string, message: string) => {
    socketRef.current?.emit('chat:message', { channel, message });
  }, []);

  // ─── Reset ───────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    socketRef.current?.emit('game:resetGame' as any);
  }, []);

  return {
    // State
    connectionInfo,
    publicState,
    privateState,
    error,
    timer,
    countryList,
    incomingTrades,
    incomingRegionPurchases,
    incomingThreats,
    chatMessages,
    resolutionLog,
    notifications,
    journalHeadlines,

    // Room
    createRoom,
    joinRoom,
    leaveRoom,

    // Lobby
    setConfig,
    startGame,

    // Country selection
    selectCountry,

    // Gameplay
    submitActions,
    submitFreeAction,
    setProductionChoice,
    markReady,
    abandon,
    submitWarAllocation,
    recruitInfantry,
    trainInfantry,
    upgradeFactory,
    togglePauseFactory,
    deployTroops,
    transferTroops,
    attackProvince,
    occupyNeutral,
    fortifyProvince,

    // Trade
    proposeTrade,
    respondToTrade,
    bidOnAuction,
    respondToRegionPurchase,

    // Organizations
    createOrganization,
    voteInOrganization,
    leaveOrganization,
    proposeEmbargo,
    proposeAidRequest,
    castAmountVote,
    respondToOrgInvite,
    requestJoinOrg,
    voteJoinRequest,
    proposeExpelMember,

    // Threats
    declareThreat,
    respondToThreat,
    executeThreat,
    withdrawThreat,

    // Sanctions
    applySanction,
    liftSanction,

    // Chat
    sendChatMessage,

    // Reset
    resetGame,
  };
}
