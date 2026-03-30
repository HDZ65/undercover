import type { MojoCard, MojoColor } from '@undercover/shared'
import { MOJO_DECK_SPEC } from '@undercover/shared'

export function createMojoDeck(): MojoCard[] {
  const cards: MojoCard[] = []
  let id = 0
  for (const spec of MOJO_DECK_SPEC) {
    for (let i = 0; i < spec.count; i++) {
      cards.push({ id: id++, color: spec.color, value: spec.value })
    }
  }
  return cards
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Score a hand: for each color, keep only the highest value card,
 * then sum those highest values.
 */
export function scoreHand(cards: MojoCard[]): number {
  const maxByColor = new Map<MojoColor, number>()
  for (const card of cards) {
    const current = maxByColor.get(card.color)
    if (current === undefined || card.value > current) {
      maxByColor.set(card.color, card.value)
    }
  }
  let total = 0
  for (const v of maxByColor.values()) total += v
  return total
}
