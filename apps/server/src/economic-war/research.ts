/**
 * Empire du Commerce — Research, Education, Patents
 */

import type { ResearchBranch, Patent } from '@undercover/shared';
import type { ServerPlayerState } from './types';
import { RESEARCH_COST_PER_LEVEL, RESEARCH_EDUCATION_BOOST, PATENT_INCOME_BASE } from './constants';
import { randomUUID as uuid } from 'crypto';

export function getResearchCost(branch: ResearchBranch, currentLevel: number): number {
  return Math.round(RESEARCH_COST_PER_LEVEL * (1 + currentLevel / 20));
}

export function doResearch(
  player: ServerPlayerState,
  branch: ResearchBranch,
  currentRound: number,
): { success: boolean; patent: Patent | null; message: string } {
  const currentLevel = player.research.branches[branch];
  const cost = getResearchCost(branch, currentLevel);

  if (player.money < cost) {
    return { success: false, patent: null, message: 'Fonds insuffisants pour la recherche.' };
  }

  player.money -= cost;

  // Calculate research gain (boosted by education)
  const educationBoost = 1 + player.research.educationLevel * RESEARCH_EDUCATION_BOOST;
  const telecomBoost = 1 + player.infrastructure.telecom / 200;
  const gain = Math.round(5 * educationBoost * telecomBoost);

  player.research.branches[branch] = Math.min(100, currentLevel + gain);

  // Update global level (average of all branches)
  const branches = Object.values(player.research.branches) as number[];
  player.research.globalLevel = Math.round(branches.reduce((a, b) => a + b, 0) / branches.length);

  // Patent chance at milestones (every 20 levels)
  let patent: Patent | null = null;
  const oldMilestone = Math.floor(currentLevel / 20);
  const newMilestone = Math.floor(player.research.branches[branch] / 20);

  if (newMilestone > oldMilestone) {
    patent = {
      id: uuid(),
      branch,
      incomePerTurn: PATENT_INCOME_BASE + newMilestone * 20,
      acquiredAtRound: currentRound,
    };
    player.patents.push(patent);
  }

  return {
    success: true,
    patent,
    message: patent
      ? `Recherche en ${branch} : niveau ${player.research.branches[branch]} (+${gain}). Nouveau brevet déposé !`
      : `Recherche en ${branch} : niveau ${player.research.branches[branch]} (+${gain}).`,
  };
}

export function investInEducation(player: ServerPlayerState): { success: boolean; message: string } {
  const cost = Math.round(200 * (1 + player.research.educationLevel / 30));

  if (player.money < cost) {
    return { success: false, message: 'Fonds insuffisants pour l\'éducation.' };
  }

  player.money -= cost;
  const gain = 3;
  player.research.educationLevel = Math.min(100, player.research.educationLevel + gain);

  return {
    success: true,
    message: `Éducation améliorée : niveau ${player.research.educationLevel} (+${gain}).`,
  };
}

export function canResearchBranch(player: ServerPlayerState, branch: ResearchBranch): boolean {
  // Nuclear branch has special requirements
  if (branch === 'nuclear') {
    return player.research.globalLevel >= 50;
  }
  return true;
}
