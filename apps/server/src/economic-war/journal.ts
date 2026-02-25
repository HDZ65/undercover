/**
 * Empire du Commerce — Journal Satirique "Le Monde en Bref"
 * Generates 1-3 satirical headlines per round based on public events
 */

import type { JournalHeadline, ResolutionEntry } from '@undercover/shared';
import type { EcoWarGameContext } from './types.js';

type HeadlineGenerator = (ctx: EcoWarGameContext, entries: ResolutionEntry[]) => JournalHeadline | null;

const HEADLINE_GENERATORS: HeadlineGenerator[] = [
  // Sabotage with proof
  (ctx, entries) => {
    const sabProof = entries.find(e => e.step === 'sabotage' && e.description.includes('PREUVE'));
    if (!sabProof || !sabProof.targetId || !sabProof.playerId) return null;
    const attacker = ctx.players.get(sabProof.targetId);
    const victim = ctx.players.get(sabProof.playerId);
    if (!attacker || !victim) return null;
    const templates = [
      `SCANDALE — ${attacker.countryName} pris la main dans le sac en sabotant ${victim.countryName}. La communauté internationale feint la surprise.`,
      `ESPIONNAGE — ${attacker.countryName} tente de saboter ${victim.countryName} et se fait attraper comme un stagiaire.`,
      `DIPLOMATIE — ${attacker.countryName} envoie ses meilleurs agents saboter ${victim.countryName}. Spoiler : ils n'étaient pas les meilleurs.`,
    ];
    return {
      text: templates[Math.floor(Math.random() * templates.length)],
      tone: 'satirical',
      relatedPlayerIds: [sabProof.targetId, sabProof.playerId],
    };
  },

  // War declared
  (ctx, entries) => {
    const warEntry = entries.find(e => e.step === 'war' && e.description.includes('conquiert'));
    if (!warEntry || !warEntry.playerId) return null;
    const attacker = ctx.players.get(warEntry.playerId);
    const defender = warEntry.targetId ? ctx.players.get(warEntry.targetId) : null;
    if (!attacker) return null;
    const templates = [
      `GÉOPOLITIQUE — ${attacker.countryName} continue sa campagne militaire. Les experts se demandent encore « pourquoi ? ».`,
      `CONFLIT — ${attacker.countryName} progresse sur le terrain. ${defender?.countryName || 'L\'adversaire'} affirme que « tout va bien ».`,
    ];
    return {
      text: templates[Math.floor(Math.random() * templates.length)],
      tone: 'dramatic',
      relatedPlayerIds: [warEntry.playerId, ...(warEntry.targetId ? [warEntry.targetId] : [])],
    };
  },

  // Last place in leaderboard
  (ctx) => {
    const lb = ctx.leaderboard;
    if (lb.length < 3) return null;
    const last = lb[lb.length - 1];
    if (last.abandoned) return null;
    const templates = [
      `CLASSEMENT — ${last.countryName} occupe fièrement la dernière place pour le ${ctx.currentRound > 3 ? `${ctx.currentRound}e` : ''}tour. « C'est une stratégie à long terme », affirme le dirigeant.`,
      `ÉCONOMIE — ${last.countryName} annonce un plan de relance. Le plan consiste à « espérer que les autres fassent pire ».`,
    ];
    return {
      text: templates[Math.floor(Math.random() * templates.length)],
      tone: 'mocking',
      relatedPlayerIds: [last.playerId],
    };
  },

  // First place
  (ctx) => {
    const lb = ctx.leaderboard;
    if (lb.length < 2) return null;
    const first = lb[0];
    const second = lb[1];
    const gap = first.score - second.score;
    if (gap < 1000) return null;
    return {
      text: `HÉGÉMONIE — ${first.countryName} domine le classement avec ${gap.toLocaleString()} points d'avance. ${second.countryName} qualifie la situation de « temporaire ».`,
      tone: 'satirical',
      relatedPlayerIds: [first.playerId, second.playerId],
    };
  },

  // Nuclear strike
  (_ctx, entries) => {
    const nuke = entries.find(e => e.description.includes('NUCLÉAIRE'));
    if (!nuke) return null;
    return {
      text: `FLASH — Un champignon atomique illumine le ciel. L'humanité vient de franchir un cap. Les actions des fabricants de bunkers s'envolent.`,
      tone: 'dramatic',
      relatedPlayerIds: [nuke.playerId || '', nuke.targetId || ''].filter(Boolean),
    };
  },

  // Bombardment
  (_ctx, entries) => {
    const bomb = entries.find(e => e.description.includes('bombarde'));
    if (!bomb || !bomb.playerId || !bomb.targetId) return null;
    return {
      text: `ATTAQUE AÉRIENNE — Des explosions secouent la région. Les pilotes affirment avoir « visé les bonnes cibles cette fois ».`,
      tone: 'dramatic',
      relatedPlayerIds: [bomb.playerId, bomb.targetId],
    };
  },

  // Market event
  (_ctx, entries) => {
    const marketEvt = entries.find(e => e.step === 'events');
    if (!marketEvt) return null;
    const templates = [
      `MARCHÉS — Les économistes sont unanimes : personne n'a vu ça venir. Comme d'habitude.`,
      `BOURSE — Les marchés réagissent avec leur sérénité habituelle. C'est-à-dire : panique totale.`,
    ];
    return {
      text: templates[Math.floor(Math.random() * templates.length)],
      tone: 'satirical',
      relatedPlayerIds: [],
    };
  },

  // Trade between countries
  (ctx, entries) => {
    const trade = entries.find(e => e.step === 'commerce' && e.positive);
    if (!trade || !trade.playerId || !trade.targetId) return null;
    const from = ctx.players.get(trade.playerId);
    const to = ctx.players.get(trade.targetId);
    if (!from || !to) return null;
    return {
      text: `COMMERCE — ${from.countryName} et ${to.countryName} signent un accord commercial. Les deux parties affirment avoir « fait une excellente affaire ». Comme toujours.`,
      tone: 'satirical',
      relatedPlayerIds: [trade.playerId, trade.targetId],
    };
  },

  // Player abandoned
  (ctx) => {
    const abandoned = Array.from(ctx.players.values()).find(
      p => p.abandoned && p.activeEffects.some(e => e.remainingTurns === 999),
    );
    if (!abandoned) return null;
    return {
      text: `POLITIQUE — Le dirigeant de ${abandoned.countryName} a démissionné. « J'en ai marre de ce jeu », a-t-il déclaré avant de claquer la porte.`,
      tone: 'mocking',
      relatedPlayerIds: [abandoned.id],
    };
  },
];

export function generateJournalHeadlines(
  context: EcoWarGameContext,
  resolutionEntries: ResolutionEntry[],
): JournalHeadline[] {
  const headlines: JournalHeadline[] = [];
  const maxHeadlines = 1 + Math.floor(Math.random() * 3); // 1-3

  // Shuffle generators for variety
  const shuffled = [...HEADLINE_GENERATORS].sort(() => Math.random() - 0.5);

  for (const generator of shuffled) {
    if (headlines.length >= maxHeadlines) break;
    const headline = generator(context, resolutionEntries);
    if (headline) {
      headlines.push(headline);
    }
  }

  // Fallback if no headlines generated
  if (headlines.length === 0) {
    headlines.push({
      text: `ACTUALITÉ — Tour ${context.currentRound}. Rien de notable ne s'est produit. Les journalistes sont en vacances.`,
      tone: 'satirical',
      relatedPlayerIds: [],
    });
  }

  return headlines;
}
