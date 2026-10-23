import { getSaggiForPlayer } from '../data/saggi'
import { getICa } from '../data/ica'
import type { AppState, AuctionAssignment } from '../app/state'
import { players as legacyPlayers } from '../data/players'
import { getFldaPma } from '../domain/pma'
import type { Player, PlayerRole } from '../domain/player'
import type { FldaPlayer } from './flda'
import { getAssignmentFldaId } from './auctionPlayerResolver'
import { getFldaIdFromLegacyId, getLegacyIdFromFldaId } from './playerIdentity'
import type { PlayersDataset } from './playerRepository'

export interface AuctionStrategyContext {
  state: AppState
  players: Player[]
  byFldaId: ReadonlyMap<string, Player>
  currentPlayer?: Player
}

// mediana dei prezzi dei Saggi (base 500 crediti) per un giocatore
function medianSaggiPrice(playerId: string): number | undefined {
  const prices = getSaggiForPlayer(playerId)
    .map((record) => record.prezzo)
    .filter((value): value is number => typeof value === 'number' && value > 0)
    .sort((first, second) => first - second)
  if (!prices.length) return undefined
  const middle = Math.floor(prices.length / 2)
  return prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2
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
    // agli algoritmi serve una qualità 0-100: la posizione nel ruolo
    iCa: getICa(flda.player_id)?.rolePercentile,
    affare: getICa(flda.player_id)?.affare,
    saggiPrice: medianSaggiPrice(flda.player_id),
    fantalabId: flda.player_id,
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
