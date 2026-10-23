// Dati per "La mia rosa": rose delle leghe (aste.csv), probabili della prossima
// giornata (probabili.csv, da FLDA) e formazione consigliata.
import asteCsvBundled from '../../database/aste.csv?raw'
import probabiliCsvBundled from '../../database/probabili.csv?raw'
import sosProbabiliCsvBundled from '../../database/sos_probabili.csv?raw'
import sosConsigliCsvBundled from '../../database/sos_consigli.csv?raw'
import { getCsv } from './csvOverrides'
import { localPlayerDetail, localPlayers, localTeamGuide } from '../services/fantalabLocal'
import { calculateFva, roleMeans } from '../domain/fva'
import type { FvaResult, FvaRole, FvaRoleMeans, FvaSeason } from '../domain/fva'
import type { FldaPlayer } from '../services/flda'

const probabiliCsv = getCsv('probabili', probabiliCsvBundled)
const sosProbabiliCsv = getCsv('sos_probabili', sosProbabiliCsvBundled)
const sosConsigliCsv = getCsv('sos_consigli', sosConsigliCsvBundled)

type Row = Record<string, string>

function parseCsv(text: string): Row[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return []
  const header = lines[0].split(';').map((cell) => cell.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(';')
    const row: Row = {}
    header.forEach((name, index) => { row[name] = (cells[index] ?? '').trim() })
    return row
  })
}

function num(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

/* =========================
   ROSE DELLE LEGHE
========================= */

export type League = 'SERIE_A' | 'SERIE_B'

export interface RosterEntry {
  playerId: string
  price: number
}

let rosterCache: Map<string, RosterEntry[]> | null = null

function rosterKey(league: League, team: string): string {
  return `${league}|${team}`
}

let rosterText = ''

function rosters(): Map<string, RosterEntry[]> {
  const text = getCsv('aste', asteCsvBundled)
  if (rosterCache && rosterText === text) return rosterCache
  rosterText = text
  const rows = parseCsv(text)
  const latest = rows.map((row) => row['Stagione']).sort().pop()
  rosterCache = new Map()
  for (const row of rows) {
    if (row['Stagione'] !== latest || !row['ID FantaLab']) continue
    const key = rosterKey(row['Lega'] === 'SERIE_B' ? 'SERIE_B' : 'SERIE_A', row['Squadra'])
    const list = rosterCache.get(key) ?? []
    list.push({ playerId: row['ID FantaLab'], price: num(row['Prezzo']) ?? 0 })
    rosterCache.set(key, list)
  }
  return rosterCache
}

export function leagueTeams(league: League): string[] {
  return [...rosters().keys()]
    .filter((key) => key.startsWith(`${league}|`))
    .map((key) => key.slice(league.length + 1))
    .sort((a, b) => a.localeCompare(b, 'it'))
}

export function teamRoster(league: League, team: string): RosterEntry[] {
  return rosters().get(rosterKey(league, team)) ?? []
}

/* =========================
   PROBABILI
========================= */

export interface Probable {
  matchday?: number
  opponent: string
  home?: boolean
  date?: string
  starter: boolean
  probability?: number
  injured: boolean
  doubtful: boolean
  suspended: boolean
  warned: boolean
  unavailable: boolean
  note: string
  /** infortunio: dalla giornata / rientro previsto (giornata) */
  fromDay?: number
  returnDay?: number
}

let probableCache: Map<string, Probable> | null = null

export function probables(): Map<string, Probable> {
  if (probableCache) return probableCache
  probableCache = new Map(parseCsv(probabiliCsv).map((row) => [row['ID FantaLab'], {
    matchday: num(row['Giornata']),
    opponent: row['Avversario'],
    home: row['Casa'] === 'Sì' ? true : row['Casa'] === 'No' ? false : undefined,
    date: row['Data'] || undefined,
    starter: row['Titolare'] === 'Sì',
    probability: num(row['Probabilità']),
    injured: row['Infortunato'] === 'Sì',
    doubtful: row['In dubbio'] === 'Sì',
    suspended: row['Squalificato'] === 'Sì',
    warned: row['Diffidato'] === 'Sì',
    unavailable: row['Indisponibile'] === 'Sì',
    note: row['Nota'] ?? '',
    fromDay: num(row['Dalla giornata']),
    returnDay: num(row['Rientro giornata']),
  }]))
  return probableCache
}

/* =========================
   SOS FANTA: probabili aggiornate (con ballottaggi) e consigli fascia per fascia
========================= */

interface SosInfo { probability?: number; duel?: string; fascia?: number; fasciaDay?: number }

let sosCache: Map<string, SosInfo> | null = null
/** "squadra|nome" di chi è citato come alternativa → titolare indicato (es. Inter|calhanoglu → Zielinski) */
let duelOthers: Map<string, string> | null = null

function duelFor(team: string | undefined, name: string | undefined): string | undefined {
  if (!duelOthers) {
    duelOthers = new Map()
    for (const row of parseCsv(sosProbabiliCsv)) {
      const other = (row['Ballottaggio'] ?? '').replace(/\s*\(\d+%\)\s*$/, '').trim().toLowerCase()
      if (other) duelOthers.set(`${row['Squadra']}|${other}`, row['Nome'])
    }
  }
  return duelOthers.get(`${team}|${(name ?? '').trim().toLowerCase()}`)
}

function sosInfo(playerId: string): SosInfo | undefined {
  if (!sosCache) {
    sosCache = new Map()
    for (const row of parseCsv(sosProbabiliCsv)) {
      sosCache.set(row['ID FantaLab'], { probability: num(row['Probabilità']), duel: row['Ballottaggio'] || undefined })
    }
    for (const row of parseCsv(sosConsigliCsv)) {
      const item = sosCache.get(row['ID FantaLab']) ?? {}
      sosCache.set(row['ID FantaLab'], { ...item, fascia: num(row['Fascia']), fasciaDay: num(row['Giornata']) })
    }
  }
  return sosCache.get(playerId)
}


export function nextMatchday(): number | undefined {
  return [...probables().values()].map((item) => item.matchday).find((day) => day !== undefined)
}

/* =========================
   VALUTAZIONE PER LA GIORNATA
   FVA = fantavoto atteso se gioca (domain/fva.ts): voto + bonus/malus attesi contro quell'avversario.
   Per scegliere la formazione conta FVA × probabilità di partire titolare (SOS Fanta → FantaLab →
   titolarità Guida); 0 se infortunato, squalificato o indisponibile.
========================= */

export interface MatchdayPick {
  player: FldaPlayer
  price: number
  probable?: Probable
  form?: number
  recent: Array<number | null>
  /** fantavoto atteso se gioca */
  fva: number
  fvaDetail?: FvaResult
  /** FVA × probabilità di giocare: ordina la formazione */
  expected: number
  probability: number
  out: boolean
  reasons: string[]
}

function lastVotes(playerId: string): Array<number | null> {
  try {
    return (localPlayerDetail(playerId).matchdays ?? []).slice(-5).map((day) => day.fmv ?? day.mv)
  } catch {
    return []
  }
}

function fvaSeasons(playerId: string): FvaSeason[] {
  try {
    return (localPlayerDetail(playerId).history ?? []).slice(0, 2).map((row) => ({
      appearances: num(String(row.presenze ?? '')), minutes: num(String(row.min_playing_time ?? '')), mv: num(String(row.mv ?? '')),
      goals: num(String(row.gol_fatti ?? '')), assists: num(String(row.assist ?? '')),
      xg: num(String(row.xg ?? '')), xa: num(String(row.xa ?? '')),
      yellow: num(String(row.amm ?? '')), red: num(String(row.esp ?? '')), conceded: num(String(row.gol_subiti ?? '')),
    }))
  } catch {
    return []
  }
}

let meansCache: Record<FvaRole, FvaRoleMeans> | null = null
function fvaMeans(): Record<FvaRole, FvaRoleMeans> {
  if (!meansCache) {
    meansCache = roleMeans(localPlayers().players.filter((player) => player.player_id && 'PDCA'.includes(player.role))
      .map((player) => ({ role: player.role as FvaRole, seasons: fvaSeasons(player.player_id as string) })))
  }
  return meansCache
}

export function evaluatePick(player: FldaPlayer, price: number): MatchdayPick {
  const id = player.player_id ?? ''
  const probable = probables().get(id)
  const recent = lastVotes(id)
  const voted = recent.filter((value): value is number => typeof value === 'number')
  const form = voted.length >= 2 ? voted.reduce((sum, value) => sum + value, 0) / voted.length : undefined
  const reasons: string[] = []
  const role = (player.role as FvaRole)

  // forza dell'avversario: il suo attacco per portieri, la sua difesa per gli altri
  let opponentIndex: number | undefined
  if (probable?.opponent) {
    const guide = localTeamGuide(probable.opponent)
    const strength = Number(role === 'P' ? guide.team_attack_index : guide.team_defense_index)
    if (Number.isFinite(strength)) {
      opponentIndex = strength
      const defensive = role === 'P' || role === 'D'
      const attackIdx = Number(guide.team_attack_index)
      if (defensive && Number.isFinite(attackIdx)) {
        if (attackIdx <= 2) reasons.push(`${probable.opponent} debole in attacco`)
        if (attackIdx >= 4) reasons.push(`${probable.opponent} forte in attacco`)
      } else if (!defensive) {
        if (strength <= 2) reasons.push(`${probable.opponent} debole in difesa`)
        if (strength >= 4) reasons.push(`${probable.opponent} forte in difesa`)
      }
    }
  }
  const sos = sosInfo(id)
  const day = nextMatchday()
  const fascia = sos?.fascia && (!day || !sos.fasciaDay || sos.fasciaDay === day) ? sos.fascia : undefined
  const detail = calculateFva({ role, seasons: fvaSeasons(id), opponentIndex, home: probable?.home, sosFascia: fascia }, fvaMeans()[role])
  if (fascia) reasons.push(`SOS ${fascia}ª fascia`)
  const usualFm = player.fm_exp ?? detail.fva
  if (form !== undefined && form >= usualFm + 0.75) reasons.push(`in forma (${form.toFixed(1).replace('.', ',')})`)
  if (form !== undefined && form <= usualFm - 0.75) reasons.push('fuori forma')
  if (player.penalty_rank === 1) reasons.push('rigorista')
  const duel = sos?.duel ?? duelFor(player.team, player.name)
  if (duel) reasons.push(`ballottaggio con ${duel}`)

  const out = Boolean(probable && (probable.injured || probable.suspended || probable.unavailable))
  const probability = out ? 0
    : typeof sos?.probability === 'number' ? sos.probability / 100
    : typeof probable?.probability === 'number' ? probable.probability / 100
    : typeof player.titolarita_display === 'number' ? player.titolarita_display / 100
    : 0.5
  if (probable?.injured) reasons.unshift('infortunato')
  if (probable?.suspended) reasons.unshift('squalificato')
  if (probable?.unavailable && !probable.injured && !probable.suspended) reasons.unshift('indisponibile')
  if (probable?.doubtful) reasons.unshift('in dubbio')

  // l'FVA resta "se gioca" anche per chi è fuori: è la probabilità (0) a escluderlo dalla formazione
  const fva = detail.fva
  return { player, price, probable, form, recent, fva, fvaDetail: detail, expected: fva * probability, probability, out, reasons }
}

/* =========================
   FORMAZIONE CONSIGLIATA
========================= */

const MODULES = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'] as const

export interface LineupSuggestion {
  module: string
  starters: MatchdayPick[]
  bench: MatchdayPick[]
  total: number
}

/**
 * Valore di un titolare: se gioca porta il suo FVA, se non gioca entra il primo panchinaro del ruolo.
 *   valore = probabilità × FVA + (1 − probabilità) × resa del panchinaro
 * Così un giocatore forte in ballottaggio (es. 49%) non vale la metà del suo FVA: se resta fuori
 * la partita la gioca comunque qualcun altro.
 */
function pickRole(candidates: MatchdayPick[], slots: number): { chosen: MatchdayPick[]; value: number } {
  const byExpected = [...candidates].sort((a, b) => b.expected - a.expected)
  let reserve = byExpected[slots]?.expected ?? 0
  let chosen = byExpected.slice(0, slots)
  for (let round = 0; round < 3; round++) {
    const worth = (pick: MatchdayPick) => pick.probability * pick.fva + (1 - pick.probability) * reserve
    chosen = [...candidates].sort((a, b) => worth(b) - worth(a)).slice(0, slots)
    const next = Math.max(0, ...candidates.filter((pick) => !chosen.includes(pick)).map((pick) => pick.expected))
    if (next === reserve) break
    reserve = next
  }
  const value = chosen.reduce((sum, pick) => sum + pick.probability * pick.fva + (1 - pick.probability) * reserve, 0)
  return { chosen: chosen.sort((a, b) => b.expected - a.expected), value }
}

export function suggestLineup(picks: MatchdayPick[]): LineupSuggestion | undefined {
  const byRole = (role: string) => picks.filter((pick) => pick.player.role === role)
  if (!byRole('P').length) return undefined
  let best: LineupSuggestion | undefined
  for (const module of MODULES) {
    const [d, c, a] = module.split('-').map(Number)
    if (byRole('D').length < d || byRole('C').length < c || byRole('A').length < a) continue
    const roles = [pickRole(byRole('P'), 1), pickRole(byRole('D'), d), pickRole(byRole('C'), c), pickRole(byRole('A'), a)]
    const starters = roles.flatMap((role) => role.chosen)
    const total = roles.reduce((sum, role) => sum + role.value, 0)
    if (!best || total > best.total) {
      const chosen = new Set(starters)
      const bench = picks.filter((pick) => !chosen.has(pick))
        .sort((x, y) => 'PDCA'.indexOf(x.player.role) - 'PDCA'.indexOf(y.player.role) || y.expected - x.expected)
      best = { module, starters, bench, total }
    }
  }
  return best
}

/** Tutti i giocatori fuori o in dubbio per la prossima giornata (Serie A). */
export function infirmary(): Array<{ playerId: string; probable: Probable }> {
  return [...probables().entries()]
    .filter(([, item]) => item.injured || item.suspended || item.unavailable || item.doubtful)
    .map(([playerId, probable]) => ({ playerId, probable }))
}
