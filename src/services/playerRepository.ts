import { players as legacyPlayers } from '../data/players'
import type { Player } from '../domain/player'
import {
  getFldaPlayerDetail,
  getFldaPlayers,
  getFldaTeamFixtures,
  getFldaTeamGuide,
} from './flda'
import type {
  FldaFixtureContext,
  FldaPlayer,
  FldaPlayerDetail,
  FldaRecord,
} from './flda'
import {
  getFldaIdFromLegacyId,
  getLegacyIdFromFldaId,
  initializePlayerIdentity,
} from './playerIdentity'

export interface PlayersDataset {
  source: 'flda' | 'legacy'
  players: FldaPlayer[]
  error?: string
}

const detailCache = new Map<string, FldaPlayerDetail>()
const detailRequests = new Map<string, Promise<FldaPlayerDetail>>()
const guideCache = new Map<string, FldaRecord>()
const guideRequests = new Map<string, Promise<FldaRecord>>()
const fixtureCache = new Map<string, FldaRecord[]>()
const fixtureRequests = new Map<string, Promise<FldaRecord[]>>()
let dataset: PlayersDataset | null = null
let datasetRequest: Promise<PlayersDataset> | null = null

function legacyAsFlda(player: Player): FldaPlayer {
  return {
    player_id: null,
    name: player.name,
    team: player.team,
    role: player.role,
    fm_exp: player.fmv ?? null,
    integrita: null,
    titolarita_display: player.startingProbability ?? null,
  }
}

function readableError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Dati FLDA non disponibili.'
}

export async function loadPlayersDataset(
  force = false,
): Promise<PlayersDataset> {
  if (dataset && !force) return dataset
  if (datasetRequest && !force) return datasetRequest

  datasetRequest = getFldaPlayers()
    .then((page) => {
      initializePlayerIdentity(legacyPlayers, page.players)
      dataset = { source: 'flda', players: page.players }
      return dataset
    })
    .catch((error: unknown) => {
      initializePlayerIdentity(legacyPlayers, [])
      dataset = {
        source: 'legacy',
        players: legacyPlayers.map(legacyAsFlda),
        error: readableError(error),
      }
      return dataset
    })
    .finally(() => {
      datasetRequest = null
    })

  return datasetRequest
}

export function getCachedPlayersDataset(): PlayersDataset | null {
  return dataset
}

export function getLegacyPlayerForFldaId(id: string): Player | undefined {
  const legacyId = getLegacyIdFromFldaId(id)
  return legacyPlayers.find((player) => player.id === legacyId)
}

export function getFldaIdForLegacyId(id: string): string | undefined {
  return getFldaIdFromLegacyId(id)
}

export function getLegacyPlayer(id: string): Player | undefined {
  return legacyPlayers.find((player) => player.id === id)
}

export function findLegacyPlayerByIdentity(player: FldaPlayer): Player | undefined {
  const name = player.name.trim().toLocaleLowerCase('it')
  const team = player.team.trim().toLocaleLowerCase('it')
  const role = player.role.trim().toUpperCase()
  return legacyPlayers.find((candidate) =>
    candidate.name.trim().toLocaleLowerCase('it') === name
    && candidate.team.trim().toLocaleLowerCase('it') === team
    && candidate.role.toUpperCase() === role,
  )
}

export async function loadPlayerDetail(id: string): Promise<FldaPlayerDetail> {
  const cached = detailCache.get(id)
  if (cached) return cached
  const pending = detailRequests.get(id)
  if (pending) return pending
  const request = getFldaPlayerDetail(id)
    .then((value) => {
      detailCache.set(id, value)
      return value
    })
    .finally(() => detailRequests.delete(id))
  detailRequests.set(id, request)
  return request
}

export function getCachedPlayerDetail(id: string): FldaPlayerDetail | undefined {
  return detailCache.get(id)
}

export async function loadTeamGuide(team: string): Promise<FldaRecord> {
  const cached = guideCache.get(team)
  if (cached) return cached
  const pending = guideRequests.get(team)
  if (pending) return pending
  const request = getFldaTeamGuide(team)
    .then((value) => {
      guideCache.set(team, value)
      return value
    })
    .finally(() => guideRequests.delete(team))
  guideRequests.set(team, request)
  return request
}

export function getCachedTeamGuide(team: string): FldaRecord | undefined {
  return guideCache.get(team)
}

export async function loadTeamFixtures(
  team: string,
  context: FldaFixtureContext,
): Promise<FldaRecord[]> {
  const key = `${team}|${context}`
  const cached = fixtureCache.get(key)
  if (cached) return cached
  const pending = fixtureRequests.get(key)
  if (pending) return pending
  const request = getFldaTeamFixtures(team, context)
    .then((value) => {
      fixtureCache.set(key, value)
      return value
    })
    .finally(() => fixtureRequests.delete(key))
  fixtureRequests.set(key, request)
  return request
}

export function getCachedTeamFixtures(
  team: string,
  context: FldaFixtureContext,
): FldaRecord[] | undefined {
  return fixtureCache.get(`${team}|${context}`)
}
