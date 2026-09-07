import type { AppState, AuctionAssignment } from '../app/state'
import { players as legacyPlayers } from '../data/players'
import { getFldaPma } from '../domain/pma'
import type { Player, PlayerRole } from '../domain/player'
import type { FldaPlayer } from './flda'
import { getAssignmentFldaId } from './auctionPlayerResolver'
import { getFldaIdFromLegacyId, getLegacyIdFromFldaId } from './playerIdentity'
import type { PlayersDataset } from './playerRepository'
import { getCachedICaV2 } from './playerRepository'

export interface AuctionStrategyContext {
  state: AppState
  players: Player[]
  byFldaId: ReadonlyMap<string, Player>
  currentPlayer?: Player
}

function validRole(value: string): value is PlayerRole {
  return value === 'P' || value === 'D' || value === 'C' || value === 'A'
}

export function adaptFldaPlayer(
  flda: FldaPlayer,
  state: AppState,
  legacy?: Player,
): Player | undefined {
  if (!flda.player_id || !validRole(flda.role)) return undefined
  return {
    ...legacy,
    id: legacy?.id ?? flda.player_id,
    name: flda.name,
    team: flda.team,
    role: flda.role,
    startingProbability: typeof flda.titolarita_display === 'number'
      ? flda.titolarita_display
      : undefined,
    pmaPercent: getFldaPma(flda, state.pmaConfiguration),
    xFmv: typeof flda.fm_exp === 'number' ? flda.fm_exp : undefined,
    iCa: getCachedICaV2(flda.player_id)?.score,
    penaltyTaker: legacy?.penaltyTaker ?? flda.penalty_rank === 1,
    status: 'free',
  }
}

function strategyAssignment(
  assignment: AuctionAssignment,
  byFldaId: ReadonlyMap<string, Player>,
): AuctionAssignment {
  const fldaId = getAssignmentFldaId(assignment)
  const adapted = fldaId ? byFldaId.get(fldaId) : undefined
  return adapted ? { ...assignment, playerId: adapted.id } : { ...assignment }
}

export function buildAuctionStrategyContext(
  state: AppState,
  dataset: PlayersDataset | null,
): AuctionStrategyContext {
  if (dataset?.source !== 'flda') {
    const players = legacyPlayers.map((player) => ({ ...player, iCa: undefined }))
    const currentPlayer = state.currentAuctionPlayerId
      ? players.find((player) => player.id === state.currentAuctionPlayerId)
      : undefined
    return { state, players, byFldaId: new Map(), currentPlayer }
  }

  const byFldaId = new Map<string, Player>()
  const players = dataset.players.flatMap((flda) => {
    if (!flda.player_id) return []
    const legacyId = getLegacyIdFromFldaId(flda.player_id)
    const legacy = legacyId
      ? legacyPlayers.find((player) => player.id === legacyId)
      : undefined
    const adapted = adaptFldaPlayer(flda, state, legacy)
    if (!adapted) return []
    byFldaId.set(flda.player_id, adapted)
    return [adapted]
  })
  const adaptedState: AppState = {
    ...state,
    currentAuctionPlayerId: state.currentAuctionFldaPlayerId
      ? byFldaId.get(state.currentAuctionFldaPlayerId)?.id ?? null
      : state.currentAuctionPlayerId,
    auctionAssignments: state.auctionAssignments.map((assignment) =>
      strategyAssignment(assignment, byFldaId)),
    recommendedDiscards: state.recommendedDiscards.map((id) => {
      const fldaId = getFldaIdFromLegacyId(id) ?? id
      return byFldaId.get(fldaId)?.id ?? id
    }),
  }
  const currentFldaId = state.currentAuctionFldaPlayerId
    ?? (state.currentAuctionPlayerId ? getFldaIdFromLegacyId(state.currentAuctionPlayerId) : undefined)
  return {
    state: adaptedState,
    players,
    byFldaId,
    currentPlayer: currentFldaId ? byFldaId.get(currentFldaId) : undefined,
  }
}
