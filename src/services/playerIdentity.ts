export type IdentityMatchStatus =
  | 'identity_matched_id'
  | 'identity_matched_deterministic_normalized'
  | 'identity_unmatched'
  | 'identity_ambiguous'

export interface LegacyPlayerIdentity {
  id: string
  name: string
  team: string
  role: string
  fantacalcioId?: string
  fantalabId?: string
  sportsmonksId?: string
}

export interface FldaPlayerIdentity {
  player_id: string | null
  name: string
  team: string
  role: string
  fantacalcio_id?: string | null
  fantalab_id?: string | null
  sportsmonks_id?: string | null
}

export interface PlayerIdentityMatch {
  legacyId: string
  fldaPlayerId?: string
  status: IdentityMatchStatus
  matchedBy?:
    | 'fantacalcio_id'
    | 'fantalab_id'
    | 'sportsmonks_id'
    | 'name_team_role'
  candidateFldaIds: string[]
}

export interface PlayerIdentitySummary {
  totalLegacy: number
  matchedByExplicitId: number
  matchedByDeterministicFallback: number
  unmatched: number
  ambiguous: number
}

const matchesByLegacyId =
  new Map<string, PlayerIdentityMatch>()
const legacyIdByFldaId =
  new Map<string, string>()

let currentSummary: PlayerIdentitySummary = {
  totalLegacy: 0,
  matchedByExplicitId: 0,
  matchedByDeterministicFallback: 0,
  unmatched: 0,
  ambiguous: 0,
}

function cleanId(
  value: string | null | undefined,
): string | undefined {
  const clean = value?.trim()
  return clean || undefined
}

function normalizeIdentityText(
  value: string,
): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizedIdentityKey(
  player: Pick<
    LegacyPlayerIdentity,
    'name' | 'team' | 'role'
  >,
): string {
  return [player.name, player.team, player.role]
    .map(normalizeIdentityText)
    .join('|')
}

function addToIndex<T>(
  index: Map<string, T[]>,
  key: string | undefined,
  value: T,
): void {
  if (!key) return
  index.set(key, [...(index.get(key) ?? []), value])
}

function validCandidates(
  candidates: FldaPlayerIdentity[],
): FldaPlayerIdentity[] {
  const unique =
    new Map<string, FldaPlayerIdentity>()

  candidates.forEach((candidate) => {
    const id = cleanId(candidate.player_id)
    if (id) unique.set(id, candidate)
  })

  return [...unique.values()]
}

export function initializePlayerIdentity(
  legacyPlayers: LegacyPlayerIdentity[],
  fldaPlayers: FldaPlayerIdentity[],
): PlayerIdentitySummary {
  matchesByLegacyId.clear()
  legacyIdByFldaId.clear()

  const providerIndexes = {
    fantacalcio_id:
      new Map<string, FldaPlayerIdentity[]>(),
    fantalab_id:
      new Map<string, FldaPlayerIdentity[]>(),
    sportsmonks_id:
      new Map<string, FldaPlayerIdentity[]>(),
  }
  const normalizedIndex =
    new Map<string, FldaPlayerIdentity[]>()

  fldaPlayers.forEach((player) => {
    addToIndex(providerIndexes.fantacalcio_id, cleanId(player.fantacalcio_id), player)
    addToIndex(providerIndexes.fantalab_id, cleanId(player.fantalab_id), player)
    addToIndex(providerIndexes.sportsmonks_id, cleanId(player.sportsmonks_id), player)
    addToIndex(normalizedIndex, normalizedIdentityKey(player), player)
  })

  currentSummary = {
    totalLegacy: legacyPlayers.length,
    matchedByExplicitId: 0,
    matchedByDeterministicFallback: 0,
    unmatched: 0,
    ambiguous: 0,
  }

  legacyPlayers.forEach((legacyPlayer) => {
    const providerKeys = [
      ['fantacalcio_id', cleanId(legacyPlayer.fantacalcioId)],
      ['fantalab_id', cleanId(legacyPlayer.fantalabId)],
      ['sportsmonks_id', cleanId(legacyPlayer.sportsmonksId)],
    ] as const

    let matchedBy: PlayerIdentityMatch['matchedBy']
    let candidates: FldaPlayerIdentity[] = []

    for (const [provider, value] of providerKeys) {
      if (!value) continue
      candidates = validCandidates(
        providerIndexes[provider].get(value) ?? [],
      )
      if (candidates.length > 0) {
        matchedBy = provider
        break
      }
    }

    if (!matchedBy) {
      matchedBy = 'name_team_role'
      candidates = validCandidates(
        normalizedIndex.get(
          normalizedIdentityKey(legacyPlayer),
        ) ?? [],
      )
    }

    const candidateFldaIds = candidates
      .map((candidate) => cleanId(candidate.player_id))
      .filter((id): id is string => Boolean(id))

    if (candidates.length !== 1) {
      const status = candidates.length > 1
        ? 'identity_ambiguous'
        : 'identity_unmatched'

      matchesByLegacyId.set(legacyPlayer.id, {
        legacyId: legacyPlayer.id,
        status,
        matchedBy: candidates.length > 1 ? matchedBy : undefined,
        candidateFldaIds,
      })
      currentSummary[
        status === 'identity_ambiguous'
          ? 'ambiguous'
          : 'unmatched'
      ] += 1
      return
    }

    const fldaPlayerId = candidateFldaIds[0]
    const existingLegacyId =
      legacyIdByFldaId.get(fldaPlayerId)

    if (existingLegacyId) {
      const existing = matchesByLegacyId.get(existingLegacyId)
      if (existing?.fldaPlayerId) {
        existing.fldaPlayerId = undefined
        existing.status = 'identity_ambiguous'
        currentSummary.ambiguous += 1
        if (existing.matchedBy === 'name_team_role') {
          currentSummary.matchedByDeterministicFallback -= 1
        } else {
          currentSummary.matchedByExplicitId -= 1
        }
      }

      legacyIdByFldaId.delete(fldaPlayerId)

      matchesByLegacyId.set(legacyPlayer.id, {
        legacyId: legacyPlayer.id,
        status: 'identity_ambiguous',
        matchedBy,
        candidateFldaIds,
      })
      currentSummary.ambiguous += 1
      return
    }

    const explicit = matchedBy !== 'name_team_role'
    matchesByLegacyId.set(legacyPlayer.id, {
      legacyId: legacyPlayer.id,
      fldaPlayerId,
      status: explicit
        ? 'identity_matched_id'
        : 'identity_matched_deterministic_normalized',
      matchedBy,
      candidateFldaIds,
    })
    legacyIdByFldaId.set(fldaPlayerId, legacyPlayer.id)

    if (explicit) currentSummary.matchedByExplicitId += 1
    else currentSummary.matchedByDeterministicFallback += 1
  })

  return getPlayerIdentitySummary()
}

export function getFldaIdFromLegacyId(
  legacyId: string,
): string | undefined {
  const match = matchesByLegacyId.get(legacyId)
  return match?.status === 'identity_matched_id' ||
    match?.status === 'identity_matched_deterministic_normalized'
    ? match.fldaPlayerId
    : undefined
}

export function getLegacyIdFromFldaId(
  fldaId: string,
): string | undefined {
  return legacyIdByFldaId.get(fldaId)
}

export function getIdentityMatchStatus(
  legacyId: string,
): PlayerIdentityMatch {
  return matchesByLegacyId.get(legacyId) ?? {
    legacyId,
    status: 'identity_unmatched',
    candidateFldaIds: [],
  }
}

export function getPlayerIdentitySummary():
  PlayerIdentitySummary {
  return { ...currentSummary }
}

export async function loadPlayerIdentity(
  legacyPlayers: LegacyPlayerIdentity[],
): Promise<PlayerIdentitySummary> {
  const page = await getFldaPlayers()
  return initializePlayerIdentity(
    legacyPlayers,
    page.players,
  )
}
import {
  getFldaPlayers,
} from './flda.ts'
