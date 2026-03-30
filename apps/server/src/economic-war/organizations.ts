/**
 * Empire du Commerce — Organizations
 *
 * Deux types : commercial | military
 *
 * Commercial :
 *   - Cotisation 2.5% du PIB/tour → trésorerie
 *   - Membres s'échangent avec 0% de taxe
 *   - Vote embargo sur pays externe (taux = moyenne des propositions)
 *   - Demande d'aide depuis trésorerie (montant = moyenne des propositions)
 *
 * Military :
 *   - Cotisation 4% du PIB tous les 3 tours → trésorerie
 *   - Attaquer un membre → -10 bonheur à l'attaquant (géré dans military.ts)
 *   - Demande d'aide depuis trésorerie (même mécanique)
 */

import type { Organization, OrganizationType, OrgVote, OrgEmbargo, OrgJoinRequest, ResolutionEntry } from '@undercover/shared';
import type { ServerPlayerState } from './types.js';
import {
  ORG_MIN_MEMBERS,
  ORG_SIMPLE_MAJORITY,
  ORG_STRUCTURAL_MAJORITY,
  ORG_COMMERCIAL_COTISATION_RATE,
  ORG_MILITARY_COTISATION_RATE,
  ORG_MILITARY_COTISATION_INTERVAL,
  ORG_EMBARGO_DURATION,
} from './constants.js';
import { randomUUID as uuid } from 'crypto';

// ─── Création ────────────────────────────────────────────────────

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
    treasury: 0,
    activeVotes: [],
    activeEmbargos: [],
    joinRequests: [],
    createdAtRound: currentRound,
  };
}

// ─── Votes simples (expelMember) ─────────────────────────────────

export function proposeExpelMember(
  org: Organization,
  proposerId: string,
  targetMemberId: string,
  currentRound: number,
): OrgVote | null {
  if (!org.memberIds.includes(proposerId)) return null;
  if (!org.memberIds.includes(targetMemberId)) return null;

  const vote: OrgVote = {
    id: uuid(),
    type: 'expelMember',
    description: `Expulsion de ${targetMemberId}`,
    proposedBy: proposerId,
    votes: {},
    amounts: {},
    requiredMajority: ORG_STRUCTURAL_MAJORITY,
    result: 'pending',
    roundProposed: currentRound,
    targetId: targetMemberId,
  };

  for (const memberId of org.memberIds) {
    vote.votes[memberId] = null;
  }
  vote.votes[proposerId] = true;

  org.activeVotes.push(vote);
  return vote;
}

export function castVote(
  org: Organization,
  voteId: string,
  playerId: string,
  inFavor: boolean,
): boolean {
  const vote = org.activeVotes.find(v => v.id === voteId && v.type === 'expelMember');
  if (!vote || vote.result !== 'pending') return false;
  if (!org.memberIds.includes(playerId)) return false;
  if (vote.votes[playerId] !== null) return false;

  vote.votes[playerId] = inFavor;

  const allVoted = Object.values(vote.votes).every(v => v !== null);
  if (allVoted) resolveExpelVote(org, vote);

  return true;
}

function resolveExpelVote(org: Organization, vote: OrgVote): void {
  const total = Object.keys(vote.votes).length;
  const yes   = Object.values(vote.votes).filter(v => v === true).length;
  vote.result = yes / total >= vote.requiredMajority ? 'passed' : 'rejected';

  if (vote.result === 'passed' && vote.targetId) {
    org.memberIds = org.memberIds.filter(id => id !== vote.targetId);
  }
}

// ─── Votes avec montants (embargo / aidRequest) ──────────────────

export function proposeEmbargo(
  org: Organization,
  proposerId: string,
  targetId: string,
  targetName: string,
  proposedRate: number,   // 0–1, ex. 0.35 = 35%
  currentRound: number,
): OrgVote | null {
  if (!org.memberIds.includes(proposerId)) return null;
  if (org.memberIds.includes(targetId)) return null; // cible doit être externe

  const vote: OrgVote = {
    id: uuid(),
    type: 'embargo',
    description: `Embargo contre ${targetName}`,
    proposedBy: proposerId,
    votes: {},
    amounts: {},
    requiredMajority: ORG_SIMPLE_MAJORITY,
    result: 'pending',
    roundProposed: currentRound,
    targetId,
    targetName,
  };

  for (const memberId of org.memberIds) {
    vote.amounts[memberId] = null;
  }
  // Proposeur soumet directement son taux (entier %, ex. 50 = 50%)
  vote.amounts[proposerId] = Math.max(0, Math.floor(proposedRate));

  org.activeVotes.push(vote);
  return vote;
}

export function proposeAidRequest(
  org: Organization,
  proposerId: string,
  motivationText: string,
  currentRound: number,
): OrgVote | null {
  if (!org.memberIds.includes(proposerId)) return null;

  const vote: OrgVote = {
    id: uuid(),
    type: 'aidRequest',
    description: `Demande d'aide`,
    proposedBy: proposerId,
    votes: {},
    amounts: {},
    requiredMajority: ORG_SIMPLE_MAJORITY,
    result: 'pending',
    roundProposed: currentRound,
    motivationText,
  };

  // Tous les membres SAUF le demandeur votent
  for (const memberId of org.memberIds) {
    if (memberId !== proposerId) {
      vote.amounts[memberId] = null;
    }
  }

  org.activeVotes.push(vote);
  return vote;
}

export function castAmountVote(
  org: Organization,
  voteId: string,
  playerId: string,
  amount: number,
  players: Map<string, ServerPlayerState>,
): boolean {
  const vote = org.activeVotes.find(v => v.id === voteId && (v.type === 'embargo' || v.type === 'aidRequest' || v.type === 'embargoRenewal'));
  if (!vote || vote.result !== 'pending') return false;
  if (!(playerId in vote.amounts)) return false;
  if (vote.amounts[playerId] !== null) return false; // déjà voté

  vote.amounts[playerId] = Math.max(0, Math.floor(amount));

  const allVoted = Object.values(vote.amounts).every(v => v !== null);
  if (allVoted) resolveAmountVote(org, vote, players);

  return true;
}

function resolveAmountVote(
  org: Organization,
  vote: OrgVote,
  players: Map<string, ServerPlayerState>,
): void {
  const submitted = Object.values(vote.amounts).filter((v): v is number => v !== null);
  if (submitted.length === 0) { vote.result = 'rejected'; return; }

  const yesVotes = submitted.filter(v => v > 0);
  const yesCount = yesVotes.length;
  const majority = yesCount / Object.keys(vote.amounts).length > ORG_SIMPLE_MAJORITY;

  // Average of POSITIVE votes only — refusals (0) count toward majority threshold but don't dilute the rate/amount
  const positiveAvg = yesCount > 0
    ? yesVotes.reduce((s, v) => s + v, 0) / yesCount
    : 0;
  vote.resolvedAmount = Math.floor(positiveAvg);
  vote.result = majority ? 'passed' : 'rejected';

  if (vote.result !== 'passed') return;

  if ((vote.type === 'embargo' || vote.type === 'embargoRenewal') && vote.targetId) {
    // resolvedAmount is an integer percentage (e.g. 75 = 75%); convert to 0–1 rate
    const rate = vote.resolvedAmount / 100;
    const existing = org.activeEmbargos.find(e => e.targetId === vote.targetId);
    if (existing) {
      existing.rate           = rate;
      existing.turnsRemaining = ORG_EMBARGO_DURATION;
    } else {
      org.activeEmbargos.push({
        targetId:       vote.targetId,
        targetName:     vote.targetName ?? vote.targetId,
        rate,
        turnsRemaining: ORG_EMBARGO_DURATION,
        originVoteId:   vote.id,
      });
    }
  }

  if (vote.type === 'aidRequest') {
    const requester = players.get(vote.proposedBy);
    if (requester) {
      const amount = Math.min(vote.resolvedAmount, org.treasury);
      requester.money += amount;
      org.treasury    -= amount;
    }
  }
}

// ─── Demandes d'adhésion ─────────────────────────────────────────

export function addJoinRequest(
  org: Organization,
  requesterId: string,
  requesterName: string,
  currentRound: number,
): OrgJoinRequest | null {
  if (org.memberIds.includes(requesterId)) return null;
  // Prevent duplicate requests
  if (org.joinRequests.some(r => r.requesterId === requesterId && r.result === 'pending')) return null;

  const request: OrgJoinRequest = {
    id: uuid(),
    orgId: org.id,
    requesterId,
    requesterName,
    votes: {},
    result: 'pending',
    roundProposed: currentRound,
  };

  for (const memberId of org.memberIds) {
    request.votes[memberId] = null;
  }

  org.joinRequests.push(request);
  return request;
}

export function voteOnJoinRequest(
  org: Organization,
  requestId: string,
  voterId: string,
  vote: boolean,
  players: Map<string, ServerPlayerState>,
): boolean {
  if (!org.memberIds.includes(voterId)) return false;
  const request = org.joinRequests.find(r => r.id === requestId && r.result === 'pending');
  if (!request) return false;
  if (!(voterId in request.votes) || request.votes[voterId] !== null) return false;

  request.votes[voterId] = vote;

  // Resolve early if majority already reached, or all voted
  const total    = Object.keys(request.votes).length;
  const yesCount = Object.values(request.votes).filter(v => v === true).length;
  const noCount  = Object.values(request.votes).filter(v => v === false).length;
  const allVoted = Object.values(request.votes).every(v => v !== null);

  // Early pass: majority of yes is already impossible to overturn
  if (yesCount / total > ORG_SIMPLE_MAJORITY) {
    request.result = 'passed';
    const requester = players.get(request.requesterId);
    if (requester) {
      org.memberIds.push(request.requesterId);
      requester.organizationMemberships.push(org.id);
      // Add requester to any current pending votes (as null voter)
      for (const activeVote of org.activeVotes) {
        if (activeVote.result === 'pending') {
          if (activeVote.type === 'expelMember') activeVote.votes[request.requesterId] = null;
          else activeVote.amounts[request.requesterId] = null;
        }
      }
    }
  } else if (noCount / total >= (1 - ORG_SIMPLE_MAJORITY) || allVoted) {
    // Majority against or everyone voted and no majority → rejected
    request.result = 'rejected';
  }

  // Clean up resolved requests (keep last 5)
  if (request.result !== 'pending') {
    const pending  = org.joinRequests.filter(r => r.result === 'pending');
    const resolved = org.joinRequests.filter(r => r.result !== 'pending');
    org.joinRequests = [...pending, ...resolved.slice(-5)];
  }

  return true;
}

// ─── Cotisations ─────────────────────────────────────────────────

export function collectCotisations(
  org: Organization,
  players: Map<string, ServerPlayerState>,
  currentRound: number,
): ResolutionEntry[] {
  const entries: ResolutionEntry[] = [];

  const shouldCollect =
    org.type === 'commercial' ||
    (org.type === 'military' && currentRound % ORG_MILITARY_COTISATION_INTERVAL === 0);

  if (!shouldCollect) return entries;

  const rate = org.type === 'commercial'
    ? ORG_COMMERCIAL_COTISATION_RATE
    : ORG_MILITARY_COTISATION_RATE;

  for (const memberId of org.memberIds) {
    const player = players.get(memberId);
    if (!player || player.abandoned) continue;

    const cotisation = Math.floor(player.gdp * rate);
    player.money  -= cotisation;
    org.treasury  += cotisation;
  }

  return entries;
}

// ─── Tick embargos ───────────────────────────────────────────────

export function tickEmbargos(org: Organization): void {
  for (const emb of org.activeEmbargos) {
    emb.turnsRemaining--;
  }
  org.activeEmbargos = org.activeEmbargos.filter(e => e.turnsRemaining > 0);
}

// ─── Tick votes (auto-résolution après 1 tour) ───────────────────

export function tickOrgVotes(
  org: Organization,
  players: Map<string, ServerPlayerState>,
  currentRound: number,
): void {
  for (const vote of org.activeVotes) {
    if (vote.result !== 'pending') continue;
    if (vote.roundProposed >= currentRound) continue; // proposé ce tour → attendre

    // Forcer résolution : null → 0 pour les votes amounts
    if (vote.type === 'embargo' || vote.type === 'aidRequest' || vote.type === 'embargoRenewal') {
      for (const memberId of Object.keys(vote.amounts)) {
        if (vote.amounts[memberId] === null) vote.amounts[memberId] = 0;
      }
      resolveAmountVote(org, vote, players);
    } else if (vote.type === 'expelMember') {
      for (const memberId of Object.keys(vote.votes)) {
        if (vote.votes[memberId] === null) vote.votes[memberId] = false;
      }
      resolveExpelVote(org, vote);
    }
  }

  // Nettoyer les votes résolus (garder 5 derniers pour l'historique)
  const resolved = org.activeVotes.filter(v => v.result !== 'pending');
  const pending  = org.activeVotes.filter(v => v.result === 'pending');
  org.activeVotes = [...pending, ...resolved.slice(-5)];
}

// ─── Quitter l'organisation ──────────────────────────────────────

export function leaveOrganization(
  org: Organization,
  playerId: string,
  player: ServerPlayerState,
): void {
  const rate = org.type === 'commercial'
    ? ORG_COMMERCIAL_COTISATION_RATE
    : ORG_MILITARY_COTISATION_RATE;

  const penalty = Math.floor(player.gdp * rate);
  player.money -= penalty;

  org.memberIds = org.memberIds.filter(id => id !== playerId);
  player.organizationMemberships = player.organizationMemberships.filter(id => id !== org.id);

  // Retirer le joueur des votes en cours
  for (const vote of org.activeVotes) {
    delete vote.votes[playerId];
    delete vote.amounts[playerId];
  }
}
