// Dati per "La mia rosa": rose delle leghe (aste.csv), probabili della prossima
// giornata (probabili.csv, da FLDA) e formazione consigliata.
import asteCsvBundled from '../../database/aste.csv?raw'
import probabiliCsvBundled from '../../database/probabili.csv?raw'
import { getCsv } from './csvOverrides'
import { getICaV3 } from './icaV3Data'
import { localPlayerDetail, localTeamGuide } from '../services/fantalabLocal'
import type { FldaPlayer } from '../services/flda'

const asteCsv = getCsv('aste', asteCsvBundled)
const probabiliCsv = getCsv('probabili', probabiliCsvBundled)

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

function rosters(): Map<string, RosterEntry[]> {
  if (rosterCache) return rosterCache
  const rows = parseCsv(asteCsv)
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
  }]))
  return probableCache
}

export function nextMatchday(): number | undefined {
  return [...probables().values()].map((item) => item.matchday).find((day) => day !== undefined)
}

/* =========================
   VALUTAZIONE PER LA GIORNATA
   Fantapunti attesi nella prossima partita:
     base   = fantamedia corretta iCà (70%) + forma ultime 5 (30%)
     ± avversario: forza in attacco (P/D) o in difesa (C/A) dalla Guida, ±0,15 per punto
     + 0,10 in casa
     × probabilità di partire titolare (probabili; altrimenti titolarità Guida)
     = 0 se infortunato, squalificato o indisponibile
========================= */

export interface MatchdayPick {
  player: FldaPlayer
  price: number
  probable?: Probable
  form?: number
  recent: Array<number | null>
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

export function evaluatePick(player: FldaPlayer, price: number): MatchdayPick {
  const id = player.player_id ?? ''
  const probable = probables().get(id)
  const ica = getICaV3(id)
  const recent = lastVotes(id)
  const voted = recent.filter((value): value is number => typeof value === 'number')
  const form = voted.length >= 2 ? voted.reduce((sum, value) => sum + value, 0) / voted.length : undefined
  const seasonFm = ica?.adjustedFm ?? player.fm_exp ?? 6
  let base = form === undefined ? seasonFm : seasonFm * 0.7 + form * 0.3
  const reasons: string[] = []

  if (probable?.opponent) {
    const guide = localTeamGuide(probable.opponent)
    const defensive = player.role === 'P' || player.role === 'D'
    const strength = Number(defensive ? guide.team_attack_index : guide.team_defense_index)
    if (Number.isFinite(strength)) {
      const delta = (3 - strength) * 0.15
      base += delta
      if (strength <= 2) reasons.push(`${probable.opponent} debole ${defensive ? 'in attacco' : 'in difesa'}`)
      if (strength >= 4) reasons.push(`${probable.opponent} forte ${defensive ? 'in attacco' : 'in difesa'}`)
    }
    if (probable.home) {
      base += 0.1
    }
  }
  // forma: confronto con la fantamedia "normale" (senza i correttivi iCà)
  const usualFm = ica?.expectedFm ?? player.fm_exp ?? 6
  if (form !== undefined && form >= usualFm + 0.75) reasons.push(`in forma (${form.toFixed(1).replace('.', ',')})`)
  if (form !== undefined && form <= usualFm - 0.75) reasons.push('fuori forma')
  if (player.penalty_rank === 1) reasons.push('rigorista')

  const out = Boolean(probable && (probable.injured || probable.suspended || probable.unavailable))
  const probability = out ? 0
    : typeof probable?.probability === 'number' ? probable.probability / 100
    : typeof player.titolarita_display === 'number' ? player.titolarita_display / 100
    : 0.5
  if (probable?.injured) reasons.unshift('infortunato')
  if (probable?.suspended) reasons.unshift('squalificato')
  if (probable?.unavailable && !probable.injured && !probable.suspended) reasons.unshift('indisponibile')
  if (probable?.doubtful) reasons.unshift('in dubbio')

  return { player, price, probable, form, recent, expected: base * probability, probability, out, reasons }
}

/* =========================
   FORMAZIONE CONSIGLIATA
========================= */

export const MODULES = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'] as const

export interface LineupSuggestion {
  module: string
  starters: MatchdayPick[]
  bench: MatchdayPick[]
  total: number
}

export function suggestLineup(picks: MatchdayPick[]): LineupSuggestion | undefined {
  const byRole = (role: string) => picks.filter((pick) => pick.player.role === role)
    .sort((a, b) => b.expected - a.expected)
  const goalkeepers = byRole('P')
  if (!goalkeepers.length) return undefined
  let best: LineupSuggestion | undefined
  for (const module of MODULES) {
    const [d, c, a] = module.split('-').map(Number)
    const defenders = byRole('D').slice(0, d)
    const midfielders = byRole('C').slice(0, c)
    const forwards = byRole('A').slice(0, a)
    if (defenders.length < d || midfielders.length < c || forwards.length < a) continue
    const starters = [goalkeepers[0], ...defenders, ...midfielders, ...forwards]
    const total = starters.reduce((sum, pick) => sum + pick.expected, 0)
    if (!best || total > best.total) {
      const chosen = new Set(starters)
      const bench = picks.filter((pick) => !chosen.has(pick))
        .sort((x, y) => 'PDCA'.indexOf(x.player.role) - 'PDCA'.indexOf(y.player.role) || y.expected - x.expected)
      best = { module, starters, bench, total }
    }
  }
  return best
}
