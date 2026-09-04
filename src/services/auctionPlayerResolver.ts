import type { AppState, AuctionAssignment } from '../app/state'
import { players as legacyPlayers } from '../data/players'
import type { Player, PlayerRole } from '../domain/player'
import type { FldaPlayer } from './flda'
import { getFldaIdFromLegacyId } from './playerIdentity'
import type { PlayersDataset } from './playerRepository'

export interface CanonicalAuctionPlayer {
  source: 'flda' | 'legacy'
  canonicalId: string
  name: string
  team: string
  role: PlayerRole
  flda?: FldaPlayer
  legacy?: Player
}

function validRole(role: string): role is PlayerRole {
  return role === 'P' || role === 'D' || role === 'C' || role === 'A'
}

export function getAssignmentFldaId(
  assignment: AuctionAssignment,
): string | undefined {
  if (assignment.fldaPlayerId) return assignment.fldaPlayerId
  return assignment.playerId
    ? getFldaIdFromLegacyId(assignment.playerId)
    : undefined
}

export function resolveFldaPlayer(
  id: string | null | undefined,
  dataset: PlayersDataset | null,
): CanonicalAuctionPlayer | undefined {
  if (!id || dataset?.source !== 'flda') return undefined
  const flda = dataset.byId.get(id)
  if (!flda || !validRole(flda.role)) return undefined
  const legacy = legacyPlayers.find(
    (player) => getFldaIdFromLegacyId(player.id) === id,
  )
  return {
    source: 'flda', canonicalId: id,
    name: flda.name, team: flda.team, role: flda.role,
    flda, legacy,
  }
}

export function resolveLegacyPlayer(
  id: string | null | undefined,
): CanonicalAuctionPlayer | undefined {
  if (!id) return undefined
  const legacy = legacyPlayers.find((player) => player.id === id)
  return legacy ? {
    source: 'legacy', canonicalId: id,
    name: legacy.name, team: legacy.team, role: legacy.role,
    legacy,
  } : undefined
}

export function resolveAssignmentPlayer(
  assignment: AuctionAssignment,
  dataset: PlayersDataset | null,
): CanonicalAuctionPlayer | undefined {
  return resolveFldaPlayer(getAssignmentFldaId(assignment), dataset)
    ?? resolveLegacyPlayer(assignment.playerId)
}

export function resolveCurrentAuctionPlayer(
  state: AppState,
  dataset: PlayersDataset | null,
): CanonicalAuctionPlayer | undefined {
  return resolveFldaPlayer(state.currentAuctionFldaPlayerId, dataset)
    ?? resolveLegacyPlayer(state.currentAuctionPlayerId)
}

export function isFldaPlayerAssigned(
  assignments: AuctionAssignment[],
  fldaPlayerId: string,
): boolean {
  return assignments.some(
    (assignment) => getAssignmentFldaId(assignment) === fldaPlayerId,
  )
}

export function summarizeManagerAssignments(
  assignments: AuctionAssignment[],
  managerId: string,
  dataset: PlayersDataset | null,
): { spent: Record<PlayerRole, number>; slots: Record<PlayerRole, number> } {
  const spent = { P: 0, D: 0, C: 0, A: 0 }
  const slots = { P: 0, D: 0, C: 0, A: 0 }
  for (const assignment of assignments) {
    if (assignment.managerId !== managerId) continue
    const player = resolveAssignmentPlayer(assignment, dataset)
    if (!player) continue
    spent[player.role] += assignment.price
    slots[player.role] += 1
  }
  return { spent, slots }
}
