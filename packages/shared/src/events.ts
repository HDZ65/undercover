import type { Player, WordCategory, WordPair, GamePhase, Role, PlayerScore } from './types';

// --- Client -> Server events ---
export interface ClientToServerEvents {
  'room:create': (data: { playerName: string }) => void;
  'room:join': (data: { roomCode: string; playerName: string; playerToken?: string }) => void;
  'room:leave': () => void;

  'game:setCategory': (data: { category: WordCategory }) => void;
  'game:setTimerDuration': (data: { duration: number }) => void;
  'game:setHideRoles': (data: { hideRoles: boolean }) => void;
  'game:startDistribution': () => void;
  'game:ready': () => void;
  'game:nextSpeaker': () => void;
  'game:startVoting': () => void;
  'game:castVote': (data: { targetId: string }) => void;
  'game:submitMrWhiteGuess': (data: { guess: string }) => void;
  'game:castMrWhiteVote': (data: { accepted: boolean }) => void;
  'game:setNoElimination': (data: { noElimination: boolean }) => void;
  'game:continueGame': () => void;
  'game:endGame': () => void;
  'game:resetGame': () => void;
}

// --- Server -> Client events ---

/** Public game state broadcast to all players in room (NO secrets) */
export interface PublicGameState {
  phase: GamePhase;
  players: PublicPlayer[];
  alivePlayers: string[];
  currentRound: number;
  currentSpeakerIndex: number;
  timerDuration: number;
  votingComplete: boolean;
  eliminatedPlayer: PublicPlayer | null;
  winner: Role | null;
  mrWhiteGuess: string;
  tieCandidates: string[];
  voteCount: number;
  totalVoters: number;
  mrWhiteVoteCount: number;
  roomCode: string;
  hostId: string;
  readyPlayers: string[];
  hideRoles: boolean;
  noElimination: boolean;
  scores: PlayerScore[];
  revealedPlayers: string[];
  wordPair: WordPair | null;
}

/** Player info visible to everyone (no role) */
export interface PublicPlayer {
  id: string;
  name: string;
  isEliminated?: boolean;
  avatar?: string;
  role?: Role;
}

/** Private state sent only to specific player */
export interface PrivatePlayerState {
  playerId: string;
  playerToken: string;
  role?: Role;
  word?: string;
  hasVoted: boolean;
  isHost: boolean;
}

export interface ServerToClientEvents {
  'room:created': (data: { roomCode: string; playerToken: string; playerId: string }) => void;
  'room:joined': (data: { roomCode: string; playerToken: string; playerId: string }) => void;
  'room:error': (data: { message: string }) => void;
  'room:playerJoined': (data: { player: PublicPlayer }) => void;
  'room:playerLeft': (data: { playerId: string }) => void;
  'room:hostChanged': (data: { hostId: string }) => void;

  'game:state': (data: { publicState: PublicGameState; privateState: PrivatePlayerState }) => void;
  'game:eliminated': (data: { player: PublicPlayer & { role: Role } }) => void;
  'game:victory': (data: { winner: Role | null; players: (PublicPlayer & { role: Role })[]; wordPair: WordPair | null }) => void;
}
