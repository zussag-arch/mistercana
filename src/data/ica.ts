import { loadState } from '../app/storage'
import { getFldaPma } from '../domain/pma'
// Ingressi dell'iCà dalle tabelle FantaLab (stagione in corso, Guida,
// allenatori) e dal vecchio listone (stagione precedente). Non dipende da
// FLDA né dal calendario: è sempre calcolabile con i dati in database/.
import {
  localBulkHistory,
  localPlayers,
  localTeamGuide,
  localTeamHierarchies,
} from '../services/fantalabLocal'
import { calculateICa, coachRoleTone } from '../domain/ica'
import type { ICaBaseInput, ICaCoachRole, ICaForeignSeason, ICaInput, ICaResult, ICaRole, ICaSeason } from '../domain/ica'
import { players as listone } from './players'
import goalkeeperGridCsvBundled from '../../database/griglia_portieri.csv?raw'
import attackerGridCsvBundled from '../../database/griglia_attaccanti.csv?raw'
import { getCsv } from './csvOverrides'

// CSV caricati dalla pagina Import/Export, altrimenti quelli del progetto
const goalkeeperGridCsv = getCsv('griglia_portieri', goalkeeperGridCsvBundled)
const attackerGridCsv = getCsv('griglia_attaccanti', attackerGridCsvBundled)

import storicoCsvBundled from '../../database/storico_stagioni.csv?raw'
import votesCsvBundled from '../../database/voti_giornate.csv?raw'
import { nextMatchday, probables } from './roster'
import { careerFor } from './fotmob'

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

// Facilità partite per squadra da una griglia abbinamenti (CSV squadra × squadra):
// media della riga, scalata fra −1 (squadra più sfavorita) e +1 (più favorita).
function gridEase(csv: string): Map<string, { mean: number; index: number }> {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  const means = new Map<string, number>()
  for (const line of lines.slice(1)) {
    const [team, ...cells] = line.split(/[,;]/)
    const values = cells.map((cell) => Number(cell.replace(',', '.'))).filter((value, index) => cells[index].trim() !== '' && Number.isFinite(value))
    if (team && values.length) means.set(team.trim(), values.reduce((sum, value) => sum + value, 0) / values.length)
  }
  const all = [...means.values()]
  const center = all.reduce((sum, value) => sum + value, 0) / (all.length || 1)
  const spread = Math.max(...all.map((value) => Math.abs(value - center)), 0)
  return new Map([...means].map(([team, mean]) => [team, { mean, index: spread > 0 ? (mean - center) / spread : 0 }]))
}

function buildBaseInputs(): ICaBaseInput[] {
  const page = localPlayers()
  const history = new Map(localBulkHistory().players.map((item) => [item.player_id, item.history[0]]))
  const previous = new Map(listone
    .filter((player) => player.fantalabId && player.id !== player.fantalabId)
    .map((player) => [player.fantalabId as string, player]))

  const teams = new Map<string, { guide: ReturnType<typeof localTeamGuide>; ranks: ReturnType<typeof localTeamHierarchies> }>()
  const team = (name: string) => {
    let entry = teams.get(name)
    if (!entry) {
      entry = { guide: localTeamGuide(name), ranks: localTeamHierarchies(name) }
      teams.set(name, entry)
    }
    return entry
  }

  const goalkeeperEase = gridEase(goalkeeperGridCsv)
  const attackerEase = gridEase(attackerGridCsv)
  const ease = (teamName: string, role: ICaRole) => {
    const defensive = role === 'P' || role === 'D'
    const entry = (defensive ? goalkeeperEase : attackerEase).get(teamName)
    return entry
      ? { easeIndex: entry.index, easeGridValue: entry.mean, easeGridName: defensive ? 'portieri' : 'attaccanti' }
      : {}
  }

  const pmaConfiguration = loadState().pmaConfiguration

  return page.players.flatMap((player): ICaBaseInput[] => {
    const id = player.player_id
    const role = player.role as ICaRole
    if (!id || !['P', 'D', 'C', 'A'].includes(role)) return []
    const season = history.get(id)
    const old = previous.get(id)
    const { guide, ranks } = team(player.team)
    const rankOf = (type: string) => ranks.find((row) => row.player_id === id && row.hierarchy_type === type)?.source_rank as number | undefined
    const index = role === 'P' || role === 'D' ? guide.team_defense_index : guide.team_attack_index
    const coachTone = coachRoleTone(player.mantra_roles, (guide.key_roles ?? []) as ICaCoachRole[])
    const named = (key: string) => Array.isArray(guide[key])
      && (guide[key] as unknown[]).some((name) => String(name).trim().toLocaleLowerCase('it') === player.name.trim().toLocaleLowerCase('it'))
    return [{
      id,
      name: player.name,
      team: player.team,
      role,
      fm: finite(season?.fmv) ? season.fmv : undefined,
      appearances: finite(season?.presenze) ? season.presenze : undefined,
      // stagione scorsa: prima quella scaricata da FantaLab, poi il vecchio listone
      // (nel vecchio listone FMV 0 = voti assenti, es. Serie B: non è uno storico)
      previousFm: finite(player.previous_fmv) && player.previous_fmv > 0 ? player.previous_fmv
        : old?.fmv && old.fmv > 0 ? old.fmv : undefined,
      previousAppearances: finite(player.previous_fmv) && player.previous_fmv > 0 && finite(player.previous_presenze) ? player.previous_presenze
        : old?.fmv && old.fmv > 0 ? old.appearances : undefined,
      fantalabXfm: finite(player.fm_exp) && player.fm_exp > 0 ? player.fm_exp : undefined,
      titolarita: player.titolarita_display ?? undefined,
      injuryGamesMissed: finite(season?.injury_games_missed) ? season.injury_games_missed : undefined,
      penaltyRank: rankOf('PENALTY'),
      freeKickRank: rankOf('FREE_KICK'),
      cornerRank: rankOf('CORNER'),
      teamIndex: finite(index) ? index : undefined,
      coachTone,
      coachPlayerTone: named('valorizzati') ? 'good' : named('penalizzati') ? 'bad' : undefined,
      ...ease(player.team, role),
      // PMA della configurazione di lega scelta in Dashboard (Classic/Mantra, partecipanti, modificatore)
      pmaPercent: getFldaPma(player, pmaConfiguration) ?? (finite(player.classic_8_mod_median_value) ? player.classic_8_mod_median_value : undefined),
    }]
  })
}

type Row = Record<string, string>

function parseCsv(text: string): Row[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return []
  const header = lines[0].split(';').map((cell) => cell.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(';')
    return Object.fromEntries(header.map((name, index) => [name, (cells[index] ?? '').trim()]))
  })
}

const num = (value: string | undefined) => {
  if (!value) return undefined
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

// fasce dei campionati (pochi casi per campionato: si ragiona per gruppi)
const TOP_LEAGUES = new Set(['Premier League', 'LaLiga', 'Bundesliga', 'Ligue 1'])
const MID_LEAGUES = new Set(['Serie B', 'Championship', 'Eredivisie', 'Liga Portugal', 'First Division A', 'Süper Lig', 'Premiership',
  'Série A', 'Liga Profesional', 'MLS', '2. Bundesliga', 'LaLiga2', 'Ligue 2', 'Super League', 'Superliga'])
const CUP_WORDS = ['Cup', 'Coppa', 'Pokal', 'Copa', 'Coupe', 'Champions League', 'Europa League', 'Conference League', 'Supercoppa',
  'Club World Cup', 'Nations League', 'Qualification', 'Friendl', 'Taça', 'Beker', 'Trophée']

/** ultima stagione piena giocata fuori dalla Serie A (campionato, non coppe), dalla carriera FotMob */
function foreignSeason(fantalabId: string, before: string | undefined): ICaForeignSeason | undefined {
  const rows = careerFor(fantalabId).filter((row) => row.league !== 'Serie A' && !CUP_WORDS.some((word) => row.league.includes(word))
    && (row.appearances ?? 0) >= 8 && (!before || row.season.slice(0, 4) < before.slice(0, 4)))
  if (!rows.length) return undefined
  const latestYear = rows.map((row) => row.season.slice(0, 4)).sort().pop()
  const best = rows.filter((row) => row.season.slice(0, 4) === latestYear).sort((a, b) => (b.appearances ?? 0) - (a.appearances ?? 0))[0]
  const apps = best.appearances ?? 0
  return {
    season: best.season, league: best.league, appearances: apps,
    bonusPerMatch: (3 * (best.goals ?? 0) + (best.assists ?? 0)) / Math.max(1, apps),
    tier: TOP_LEAGUES.has(best.league) ? 0 : MID_LEAGUES.has(best.league) ? 1 : 2,
  }
}

function buildInputs(): ICaInput[] {
  const players = new Map(localPlayers().players.map((player) => [player.player_id, player]))
  const current = new Map(localBulkHistory().players.map((item) => [item.player_id, item.history[0]]))

  // stagioni per ID fantacalcio, dalla più recente; la stagione in corso è l'ultima dello storico
  const storico = parseCsv(getCsv('storico_stagioni', storicoCsvBundled))
  const latest = storico.map((row) => row['Stagione']).sort().pop()
  const seasons = new Map<string, ICaSeason[]>()
  for (const row of storico) {
    if (row['Stagione'] === latest) continue
    const list = seasons.get(row['ID Fantacalcio']) ?? []
    list.push({ season: row['Stagione'], fm: num(row['FMV']), appearances: num(row['Presenze']) })
    seasons.set(row['ID Fantacalcio'], list)
  }
  for (const list of seasons.values()) list.sort((a, b) => b.season.localeCompare(a.season))

  // giornate giocate da ogni squadra (dai voti per giornata)
  const days = new Map<string, Set<string>>()
  for (const row of parseCsv(getCsv('voti_giornate', votesCsvBundled))) {
    const set = days.get(row['Squadra'].toLowerCase()) ?? new Set<string>()
    set.add(row['Giornata'])
    days.set(row['Squadra'].toLowerCase(), set)
  }
  const allDays = Math.max(0, ...[...days.values()].map((set) => set.size))
  const nextDay = nextMatchday()
  const probable = probables()

  return buildBaseInputs().map((base) => {
    const player = players.get(base.id)
    const season = current.get(base.id)
    const fantacalcioId = player?.fantacalcio_id ?? ''
    const status = probable.get(base.id)
    const out = Boolean(status && (status.injured || status.suspended || status.unavailable))
    const past = seasons.get(fantacalcioId) ?? []
    const playedInA = past.some((item) => (item.appearances ?? 0) > 0)
    return {
      ...base,
      pastSeasons: past,
      foreignSeason: playedInA ? undefined : foreignSeason(base.id, latest),
      minutes: typeof season?.min_playing_time === 'number' ? season.min_playing_time : undefined,
      starts: typeof season?.starts_eleven === 'number' ? season.starts_eleven : undefined,
      teamMatches: days.get(base.team.toLowerCase())?.size || allDays || undefined,
      currentMatchday: nextDay,
      returnMatchday: status?.returnDay,
      out,
    }
  })
}

let cache: Map<string, ICaResult> | null = null

/** iCà di tutti i giocatori, per ID FantaLab (calcolato una volta per sessione) */
export function getICaResults(): Map<string, ICaResult> {
  if (!cache) {
    cache = new Map([...calculateICa(buildInputs())].map(([id, result]) => [id, {
      id,
      score: result.quality,
      rolePercentile: result.rolePercentile,
      affare: result.affare,
      expectedFm: result.expectedFm,
      adjustedFm: result.adjustedFm,
      expectedShare: result.expectedShare,
      contributions: result.contributions,
      missing: result.quality === undefined ? ['fantamedia'] : [],
      yieldScore: result.score,
      shareParts: result.shareParts,
    }]))
  }
  return cache
}

export function getICa(fantalabId: string | null | undefined): ICaResult | undefined {
  return fantalabId ? getICaResults().get(fantalabId) : undefined
}
