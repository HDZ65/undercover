import type { Card, HandHistoryEntry, PokerAction, PokerPhase, PokerPlayer, TableConfig } from '@undercover/shared';

/**
 * Hand History Recorder
 * Records all actions, community cards, showdown, and winners for each hand
 * Exports hand history in standard poker text format
 */

interface ActionRecord {
  playerId: string;
  action: PokerAction;
  amount?: number;
  phase: PokerPhase;
}

interface WinnerRecord {
  playerId: string;
  amount: number;
  potIndex: number;
  handDescription: string;
}

interface PlayerSnapshot {
  id: string;
  name: string;
  seatIndex: number;
  startingStack: number;
}

export class HandHistoryRecorder {
  private handNumber: number = 0;
  private timestamp: number = 0;
  private tableConfig: TableConfig | null = null;
  private players: PlayerSnapshot[] = [];
  private actions: ActionRecord[] = [];
  private communityCards: Card[][] = []; // [flop, turn, river]
  private showdownHands: Map<string, Card[]> = new Map();
  private winners: WinnerRecord[] = [];
  private dealerSeatIndex: number = 0;

  /**
   * Initialize new hand recording
   */
  startHand(handNumber: number, tableConfig: TableConfig, players: PokerPlayer[], dealerSeatIndex: number): void {
    this.handNumber = handNumber;
    this.timestamp = Date.now();
    this.tableConfig = tableConfig;
    this.dealerSeatIndex = dealerSeatIndex;
    this.players = players.map((p) => ({
      id: p.id,
      name: p.name,
      seatIndex: p.seatIndex,
      startingStack: p.chipStack,
    }));
    this.actions = [];
    this.communityCards = [];
    this.showdownHands = new Map();
    this.winners = [];
  }

  /**
   * Record player action
   */
  recordAction(playerId: string, action: PokerAction, phase: PokerPhase, amount?: number): void {
    this.actions.push({
      playerId,
      action,
      amount,
      phase,
    });
  }

  /**
   * Record community cards (flop/turn/river)
   */
  recordCommunityCards(phase: PokerPhase, cards: Card[]): void {
    if (phase === 'flop' || phase === 'turn' || phase === 'river') {
      this.communityCards.push(cards);
    }
  }

  /**
   * Record revealed hands at showdown
   */
  recordShowdown(hands: Map<string, Card[]>): void {
    this.showdownHands = new Map(hands);
  }

  /**
   * Record pot winners
   */
  recordWinners(winners: Array<{ playerId: string; amount: number; potIndex: number; handDescription: string }>): void {
    this.winners = winners;
  }

  /**
   * Finish hand and return complete HandHistoryEntry
   */
  finishHand(): HandHistoryEntry {
    if (!this.tableConfig) {
      throw new Error('Cannot finish hand: no table config set');
    }

    return {
      handNumber: this.handNumber,
      timestamp: this.timestamp,
      tableConfig: this.tableConfig,
      players: this.players,
      actions: this.actions,
      communityCards: this.communityCards,
      pots: [], // Pots are calculated from actions, not stored separately
      winners: this.winners,
    };
  }

  /**
   * Export hand history to standard poker text format
   * Hides opponent hole cards unless showdown occurred
   */
  exportAsText(entry: HandHistoryEntry, viewerPlayerId?: string): string {
    const lines: string[] = [];
    const { handNumber, timestamp, tableConfig, players, actions, communityCards, winners } = entry;

    // Header
    const date = new Date(timestamp);
    const dateStr = date.toISOString().replace('T', ' ').substring(0, 19);
    const blinds = `${tableConfig.smallBlind / 100}/${tableConfig.bigBlind / 100}`;
    lines.push(`Main #${handNumber} - Texas Hold'em No Limit (${blinds}) - ${dateStr}`);
    lines.push(`Table 'Table 1' ${tableConfig.maxPlayers}-max Seat #${this.dealerSeatIndex + 1} is the button`);

    // Players
    for (const player of players) {
      const chips = (player.startingStack / 100).toFixed(2);
      lines.push(`Seat ${player.seatIndex + 1}: ${player.name} (${chips} in chips)`);
    }

    // Blinds
    const sbPlayer = players.find((p) => p.seatIndex === (this.dealerSeatIndex + 1) % players.length);
    const bbPlayer = players.find((p) => p.seatIndex === (this.dealerSeatIndex + 2) % players.length);
    if (sbPlayer) {
      lines.push(`${sbPlayer.name}: posts small blind ${tableConfig.smallBlind / 100}`);
    }
    if (bbPlayer) {
      lines.push(`${bbPlayer.name}: posts big blind ${tableConfig.bigBlind / 100}`);
    }

    // Hole cards (only show viewer's cards)
    lines.push('*** HOLE CARDS ***');
    if (viewerPlayerId) {
      const viewerPlayer = players.find((p) => p.id === viewerPlayerId);
      if (viewerPlayer && this.showdownHands.has(viewerPlayerId)) {
        const cards = this.showdownHands.get(viewerPlayerId)!;
        lines.push(`Dealt to ${viewerPlayer.name} [${this.formatCards(cards)}]`);
      }
    }

    // Actions by phase
    let currentPhase: PokerPhase | null = null;
    for (const action of actions) {
      if (action.phase !== currentPhase) {
        currentPhase = action.phase;
        if (currentPhase === 'flop' && communityCards[0]) {
          lines.push(`*** FLOP *** [${this.formatCards(communityCards[0])}]`);
        } else if (currentPhase === 'turn' && communityCards[1]) {
          const allCards = [...communityCards[0], ...communityCards[1]];
          lines.push(`*** TURN *** [${this.formatCards(communityCards[0])}] [${this.formatCards(communityCards[1])}]`);
        } else if (currentPhase === 'river' && communityCards[2]) {
          lines.push(
            `*** RIVER *** [${this.formatCards([...communityCards[0], ...communityCards[1]])}] [${this.formatCards(communityCards[2])}]`
          );
        }
      }

      const player = players.find((p) => p.id === action.playerId);
      if (player) {
        lines.push(this.formatAction(player.name, action));
      }
    }

    // Showdown
    if (this.showdownHands.size > 0) {
      lines.push('*** SHOWDOWN ***');
      for (const [playerId, cards] of this.showdownHands) {
        const player = players.find((p) => p.id === playerId);
        const winner = winners.find((w) => w.playerId === playerId);
        if (player) {
          lines.push(`${player.name}: shows [${this.formatCards(cards)}] (${winner?.handDescription ?? 'unknown hand'})`);
        }
      }
    }

    // Winners
    for (const winner of winners) {
      const player = players.find((p) => p.id === winner.playerId);
      if (player) {
        const amount = (winner.amount / 100).toFixed(2);
        lines.push(`${player.name} collected ${amount} from pot`);
      }
    }

    // Summary
    lines.push('*** SUMMARY ***');
    const totalPot = winners.reduce((sum, w) => sum + w.amount, 0);
    lines.push(`Total pot ${(totalPot / 100).toFixed(2)} | Rake 0`);
    if (communityCards.length > 0) {
      const allCommunity = communityCards.flat();
      lines.push(`Board [${this.formatCards(allCommunity)}]`);
    }

    for (const player of players) {
      const winner = winners.find((w) => w.playerId === player.id);
      const cards = this.showdownHands.get(player.id);
      if (winner && cards) {
        const amount = (winner.amount / 100).toFixed(2);
        const position = player.seatIndex === this.dealerSeatIndex ? '(button)' : '';
        lines.push(
          `Seat ${player.seatIndex + 1}: ${player.name} ${position} showed [${this.formatCards(cards)}] and won (${amount}) with ${winner.handDescription}`
        );
      } else if (cards) {
        const position = player.seatIndex === this.dealerSeatIndex ? '(button)' : '';
        lines.push(
          `Seat ${player.seatIndex + 1}: ${player.name} ${position} showed [${this.formatCards(cards)}] and lost with ${winners.find((w) => w.playerId === player.id)?.handDescription ?? 'unknown hand'}`
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Format cards as text (e.g., "Ah Kd")
   */
  private formatCards(cards: Card[]): string {
    return cards.map((c) => `${c.rank}${c.suit[0]}`).join(' ');
  }

  /**
   * Format action as text
   */
  private formatAction(playerName: string, action: ActionRecord): string {
    switch (action.action) {
      case 'fold':
        return `${playerName}: folds`;
      case 'check':
        return `${playerName}: checks`;
      case 'call':
        return `${playerName}: calls ${action.amount ? (action.amount / 100).toFixed(2) : '0'}`;
      case 'raise':
        return `${playerName}: raises ${action.amount ? (action.amount / 100).toFixed(2) : '0'}`;
      case 'allIn':
        return `${playerName}: bets ${action.amount ? (action.amount / 100).toFixed(2) : '0'} and is all-in`;
      default:
        return `${playerName}: ${action.action}`;
    }
  }
}
