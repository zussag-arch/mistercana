const DEFAULT_FLDA_API_URL =
  'http://127.0.0.1:8765'

const DEFAULT_TIMEOUT_MS = 8000
const UPDATE_TIMEOUT_MS = 120000

export type FldaDatasetStatus =
  | 'success'
  | 'warning'
  | 'failed'
  | 'never'

export type FldaUpdateTarget =
  | 'players'
  | 'guide'
  | 'grid'
  | 'history'

export interface FldaHealth {
  status: string
  database?: string
  version?: string
}

export interface FldaDatasetState {
  dataset_name: string
  status: FldaDatasetStatus
  record_count: number
  warning_count: number
  blocking_count: number
  last_attempt_at?: string | null
  last_success_at?: string | null
  source_mode?: string | null
  details_json?: unknown
}

export type FldaUpdateResult =
  Record<string, unknown>

export interface FldaPlayer {
  player_id: string | null
  fantalab_id?: string | null
  fantacalcio_id?: string | null
  sportsmonks_id?: string | null
  name: string
  team: string
  role: string
  fm_exp?: number | null
  integrita?: number | null
  tit_index_raw?: number | null
  titolarita_display?: number | null
  is_starting_xi?: boolean
  goalkeeper_rank?: number | null
  penalty_rank?: number | null
  free_kick_rank?: number | null
  corner_rank?: number | null
  [key: string]: unknown
}

export interface FldaPlayersPage {
  total: number
  limit: number
  offset: number
  players: FldaPlayer[]
}

export type FldaRecord = Record<string, unknown>

export interface FldaHistoricalAuctionPrice {
  season: string
  division: 'SERIE_A' | 'SERIE_B'
  coach_name: string
  price: number
}

export interface FldaPlayerDetail {
  current: FldaPlayer
  history: FldaRecord[]
  guide: FldaRecord | null
  hierarchies: FldaRecord[]
  saggi: FldaRecord[]
  auction_prices: FldaHistoricalAuctionPrice[]
}

export type FldaFixtureContext =
  | 'goalkeeper'
  | 'attacker'

export type FldaErrorKind =
  | 'unreachable'
  | 'timeout'
  | 'api'
  | 'invalid-response'

export class FldaApiError extends Error {
  readonly kind: FldaErrorKind
  readonly status?: number

  constructor(
    message: string,
    kind: FldaErrorKind,
    status?: number,
  ) {
    super(message)
    this.name = 'FldaApiError'
    this.kind = kind
    this.status = status
  }
}

function normalizeBaseUrl(
  value: string | undefined,
): string {
  const normalized = value?.trim()

  return (
    normalized || DEFAULT_FLDA_API_URL
  ).replace(/\/+$/, '')
}

export const FLDA_API_URL =
  normalizeBaseUrl(
    import.meta.env?.VITE_FLDA_API_URL,
  )

function getErrorMessage(
  value: unknown,
): string | null {
  if (
    typeof value === 'object' &&
    value !== null
  ) {
    const record = value as Record<
      string,
      unknown
    >

    for (const key of [
      'detail',
      'message',
      'error',
    ]) {
      if (
        typeof record[key] === 'string' &&
        record[key].trim()
      ) {
        return record[key]
      }
    }
  }

  return null
}

async function readResponseBody(
  response: Response,
): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

async function fldaFetch<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller =
    new AbortController()

  const timeoutId = window.setTimeout(
    () => controller.abort(),
    timeoutMs,
  )

  let response: Response

  try {
    response = await fetch(
      `${FLDA_API_URL}${path}`,
      {
        ...init,
        headers: {
          Accept: 'application/json',
          ...init.headers,
        },
        signal: controller.signal,
      },
    )
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === 'AbortError'
    ) {
      throw new FldaApiError(
        'FLDA non ha risposto entro il tempo previsto.',
        'timeout',
      )
    }

    throw new FldaApiError(
      'FLDA non è raggiungibile. Verifica che il servizio locale sia avviato.',
      'unreachable',
    )
  } finally {
    window.clearTimeout(timeoutId)
  }

  const body =
    await readResponseBody(response)

  if (!response.ok) {
    throw new FldaApiError(
      getErrorMessage(body) ??
        `FLDA ha risposto con errore HTTP ${response.status}.`,
      'api',
      response.status,
    )
  }

  return body as T
}

export function getFldaHealth():
  Promise<FldaHealth> {
  return fldaFetch<FldaHealth>(
    '/api/health',
  )
}

export function getFldaStatus():
  Promise<FldaDatasetState[]> {
  return fldaFetch<FldaDatasetState[]>(
    '/api/status',
  ).then((result) => {
    if (!Array.isArray(result)) {
      throw new FldaApiError(
        'FLDA ha restituito uno status non valido.',
        'invalid-response',
      )
    }

    return result
  })
}

export function getFldaPlayers(
  limit = 1000,
  offset = 0,
): Promise<FldaPlayersPage> {
  const query =
    new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })

  return fldaFetch<FldaPlayersPage>(
    `/api/players?${query.toString()}`,
  )
}

export function getFldaPlayerDetail(
  playerId: string,
): Promise<FldaPlayerDetail> {
  return fldaFetch<FldaPlayerDetail>(
    `/api/players/${encodeURIComponent(playerId)}`,
  )
}

export function getFldaHistoricalAuctionPrices(
  playerId: string,
): Promise<FldaHistoricalAuctionPrice[]> {
  return fldaFetch<FldaHistoricalAuctionPrice[]>(
    `/api/players/${encodeURIComponent(playerId)}/auction-prices`,
  )
}

export function getFldaTeamGuide(
  team: string,
): Promise<FldaRecord> {
  return fldaFetch<FldaRecord>(
    `/api/teams/${encodeURIComponent(team)}/guide`,
  )
}

export function getFldaTeamHierarchies(
  team: string,
): Promise<FldaRecord[]> {
  return fldaFetch<FldaRecord[]>(
    `/api/teams/${encodeURIComponent(team)}/hierarchies`,
  )
}

export function getFldaTeamFixtures(
  team: string,
  context: FldaFixtureContext,
): Promise<FldaRecord[]> {
  const query = new URLSearchParams({ context })
  return fldaFetch<FldaRecord[]>(
    `/api/teams/${encodeURIComponent(team)}/fixtures?${query.toString()}`,
  )
}

export function updateFlda(
  only?: FldaUpdateTarget,
): Promise<FldaUpdateResult> {
  return fldaFetch<FldaUpdateResult>(
    '/api/update',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify(
        only ? { only } : {},
      ),
    },
    UPDATE_TIMEOUT_MS,
  )
}
