export type CardColor = 'red' | 'blue' | 'green' | 'yellow';

export type CardValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2';

export type WildCardValue = 'wild' | 'wild-draw4';

export interface Card {
  id: string;
  color: CardColor | null;
  value: CardValue | WildCardValue;
}

export type PlayDirection = 'clockwise' | 'counterclockwise';

export type UnoGamePhase = 'lobby' | 'dealing' | 'playerTurn' | 'colorChoice' | 'challengeWD4' | 'roundOver' | 'gameOver';

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  handSize: number;
  hasCalledUno: boolean;
}

export interface HouseRules {
  stackDrawTwo: boolean;
  stackDrawFour: boolean;
  bluffChallenge: boolean;
  forcePlay: boolean;
}

export interface PlayerScore {
  playerId: string;
  roundScore: number;
  totalScore: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatar?: string;
  handSize: number;
  hasCalledUno: boolean;
  isConnected: boolean;
}
