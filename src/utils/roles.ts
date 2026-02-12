/**
 * Role distribution utilities for the Undercover game.
 * Implements Fisher-Yates shuffle algorithm for unbiased role assignment.
 * @module utils/roles
 */

import type { Player, Role } from '../types/game'

/**
 * Role distribution configuration for a given player count range.
 */
interface RoleDistribution {
  /** Number of Undercover players */
  undercover: number
  /** Number of Mr. White players */
  mrwhite: number
}

/**
 * Distribution table mapping player counts to role allocations.
 * Ensures balanced gameplay across different group sizes.
 */
const roleDistributionTable: Array<{
  minPlayers: number
  maxPlayers: number
  distribution: RoleDistribution
}> = [
  { minPlayers: 3, maxPlayers: 4, distribution: { undercover: 1, mrwhite: 0 } },
  { minPlayers: 5, maxPlayers: 6, distribution: { undercover: 1, mrwhite: 1 } },
  { minPlayers: 7, maxPlayers: 8, distribution: { undercover: 2, mrwhite: 1 } },
  { minPlayers: 9, maxPlayers: 12, distribution: { undercover: 2, mrwhite: 1 } },
  { minPlayers: 13, maxPlayers: 16, distribution: { undercover: 3, mrwhite: 1 } },
  { minPlayers: 17, maxPlayers: 20, distribution: { undercover: 3, mrwhite: 2 } },
]

/**
 * Fisher-Yates shuffle algorithm for unbiased array randomization.
 * @template T - Type of array elements
 * @param items - Array to shuffle
 * @returns New shuffled array (original array is not modified)
 */
const shuffleArray = <T>(items: T[]): T[] => {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const currentValue = shuffled[index]
    shuffled[index] = shuffled[randomIndex]
    shuffled[randomIndex] = currentValue
  }

  return shuffled
}

/**
 * Get role distribution configuration for a given player count.
 * @param playerCount - Number of players (must be between 3 and 20)
 * @returns Role distribution with undercover and mrwhite counts
 * @throws {Error} If player count is outside supported range (3-20)
 */
const getRoleDistribution = (playerCount: number): RoleDistribution => {
  const row = roleDistributionTable.find(
    ({ minPlayers, maxPlayers }) => playerCount >= minPlayers && playerCount <= maxPlayers,
  )

  if (!row) {
    throw new Error(`Unsupported player count: ${playerCount}. Supported range is 3 to 20 players.`)
  }

  return row.distribution
}

/**
 * Distribute roles randomly among players using Fisher-Yates shuffle.
 * Assigns Civil, Undercover, and Mr. White roles based on player count.
 * 
 * @param players - Array of players to assign roles to
 * @returns New array of players with assigned roles and isEliminated set to false
 * @throws {Error} If player count results in invalid distribution
 * 
 * @example
 * ```ts
 * const players = [
 *   { id: '1', name: 'Alice' },
 *   { id: '2', name: 'Bob' },
 *   { id: '3', name: 'Charlie' }
 * ];
 * const withRoles = distributeRoles(players);
 * // Result: 2 Civils, 1 Undercover, 0 Mr. White
 * ```
 */
export const distributeRoles = (players: Player[]): Player[] => {
  const distribution = getRoleDistribution(players.length)
  const civilCount = players.length - distribution.undercover - distribution.mrwhite

  if (civilCount <= 0) {
    throw new Error('Invalid role distribution. Civil count must remain positive.')
  }

  const roles: Role[] = [
    ...Array.from({ length: civilCount }, (): Role => 'civil'),
    ...Array.from({ length: distribution.undercover }, (): Role => 'undercover'),
    ...Array.from({ length: distribution.mrwhite }, (): Role => 'mrwhite'),
  ]

  const shuffledRoles = shuffleArray(roles)

  return players.map((player, index) => ({
    ...player,
    role: shuffledRoles[index],
    isEliminated: false,
  }))
}

/**
 * Count alive players by role type.
 * Only counts players who are not eliminated.
 * 
 * @param players - Array of players to count
 * @returns Object with counts for each role type
 * 
 * @example
 * ```ts
 * const counts = getRoleCounts(players);
 * // { civil: 3, undercover: 1, mrwhite: 1 }
 * ```
 */
export const getRoleCounts = (players: Player[]) => {
  return players.reduce(
    (accumulator, player) => {
      if (!player.isEliminated) {
        if (player.role === 'civil') {
          accumulator.civil += 1
        } else if (player.role === 'undercover') {
          accumulator.undercover += 1
        } else if (player.role === 'mrwhite') {
          accumulator.mrwhite += 1
        }
      }

      return accumulator
    },
    { civil: 0, undercover: 0, mrwhite: 0 },
  )
}
