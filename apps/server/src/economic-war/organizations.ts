/**
 * Empire du Commerce — Organizations
 * Creation, voting, cotisations, expulsion
 */

import type { Organization, OrganizationType, OrgVote, VoteType, ResolutionEntry } from '@undercover/shared';
import type { ServerPlayerState, EcoWarGameContext } from './types';
import {
  ORG_MIN_MEMBERS,
  ORG_COTISATION_MIN,
  ORG_SIMPLE_MAJORITY,
  ORG_STRUCTURAL_MAJORITY,
  ORG_MILITARY_INTERVENTION_BONUS,
  ORG_MILITARY_INTERVENTION_COST,
  ORG_NON_INTERVENTION_HAPPINESS_LOSS,
} from './constants';
import { randomUUID as uuid } from 'crypto';

export function createOrganization(
  name: string,
  type: OrganizationType,
  founderIds: string[],
  currentRound: number,
): Organization | null {
  if (founderIds.length < ORG_MIN_MEMBERS) return null;

  return {
    id: uuid(),
    name,
    type,
    memberIds: [...founderIds],
    cotisationRate: ORG_COTISATION_MIN,
    treasury: 0,
    transactionFeeReduction: type === 'commercial' ? 0.05 : 0, // 5% base reduction for commercial orgs
    activeVotes: [],
    createdAtRound: currentRound,
  };
}

export function proposeVote(
  org: Organization,
  proposerId: string,
  type: VoteType,
  description: string,
  currentRound: number,
): OrgVote | null {
  if (!org.memberIds.includes(proposerId)) return null;

  const vote: OrgVote = {
    id: uuid(),
    type,
    description,
    proposedBy: proposerId,
    votes: {},
    requiredMajority: isStructuralVote(type) ? ORG_STRUCTURAL_MAJORITY : ORG_SIMPLE_MAJORITY,
    result: 'pending',
    roundProposed: currentRound,
  };

  // Initialize votes (null = not voted)
  for (const memberId of org.memberIds) {
    vote.votes[memberId] = null;
  }
  // Proposer auto-votes for
  vote.votes[proposerId] = true;

  org.activeVotes.push(vote);
  return vote;
}

export function castVote(org: Organization, voteId: string, playerId: string, inFavor: boolean): boolean {
  const vote = org.activeVotes.find(v => v.id === voteId);
  if (!vote || vote.result !== 'pending') return false;
  if (!org.memberIds.includes(playerId)) return false;
  if (vote.votes[playerId] !== null) return false; // already voted

  vote.votes[playerId] = inFavor;

  // Check if all voted
  const allVoted = Object.values(vote.votes).every(v => v !== null);
  if (allVoted) {
    resolveVote(org, vote);
  }

  return true;
}

function resolveVote(org: Organization, vote: OrgVote): void {
  const totalVoters = Object.keys(vote.votes).length;
  const inFavor = Object.values(vote.votes).filter(v => v === true).length;
  const ratio = inFavor / totalVoters;

  vote.result = ratio >= vote.requiredMajority ? 'passed' : 'rejected';
}

function isStructuralVote(type: VoteType): boolean {
  return type === 'structuralChange' || type === 'expelMember';
}

export function collectCotisations(
  org: Organization,
  players: Map<string, ServerPlayerState>,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  for (const memberId of org.memberIds) {
    const player = players.get(memberId);
    if (!player || player.abandoned) continue;

    const cotisation = Math.round(player.gdp * org.cotisationRate);
    player.money -= cotisation;
    org.treasury += cotisation;
  }

  return entries;
}

export function leaveOrganization(
  org: Organization,
  playerId: string,
  player: ServerPlayerState,
): void {
  // Pay penalty (1 turn cotisation)
  const penaltyCost = Math.round(player.gdp * org.cotisationRate);
  player.money -= penaltyCost;

  // Remove from members
  org.memberIds = org.memberIds.filter(id => id !== playerId);
  player.organizationMemberships = player.organizationMemberships.filter(id => id !== org.id);

  // Remove pending votes by this player
  for (const vote of org.activeVotes) {
    delete vote.votes[playerId];
  }
}

export function handleMilitaryIntervention(
  org: Organization,
  defenderId: string,
  intervenerId: string,
  intervenerPlayer: ServerPlayerState,
  defenderPlayer: ServerPlayerState,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  if (org.type !== 'military') return entries;

  // Cost to intervener
  const cost = Math.round(intervenerPlayer.gdp * ORG_MILITARY_INTERVENTION_COST);
  intervenerPlayer.money -= cost;

  // Bonus to defender
  defenderPlayer.military.armedForces = Math.min(
    100,
    defenderPlayer.military.armedForces + Math.round(defenderPlayer.military.armedForces * ORG_MILITARY_INTERVENTION_BONUS),
  );

  entries.push({
    step: 'war',
    playerId: intervenerId,
    targetId: defenderId,
    description: `${intervenerPlayer.countryName} intervient militairement pour défendre ${defenderPlayer.countryName} via ${org.name} !`,
    icon: '🤝',
    positive: true,
  });

  return entries;
}

export function penalizeNonIntervention(player: ServerPlayerState, orgName: string): void {
  player.population.happinessLevel = Math.max(0, player.population.happinessLevel - ORG_NON_INTERVENTION_HAPPINESS_LOSS);

  player.notifications.push({
    id: uuid(),
    type: 'org_expelled',
    title: `Expulsé de ${orgName}`,
    message: `Votre refus d'intervenir a entraîné votre expulsion de ${orgName} et -${ORG_NON_INTERVENTION_HAPPINESS_LOSS}% bonheur.`,
    icon: '🚫',
    severity: 'danger',
    round: 0,
    read: false,
  });
}
