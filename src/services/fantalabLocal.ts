// Sorgente dati locale: export FantaLab in database/ (fantalab_giocatori.csv,
// fantalab_allenatori.csv). Restituisce gli stessi formati del client FLDA,
// così il resto dell'app non distingue le due sorgenti. Usata quando FLDA
// non è raggiungibile.
import giocatoriCsvBundled from '../../database/fantalab_giocatori.csv?raw'
import allenatoriCsvBundled from '../../database/fantalab_allenatori.csv?raw'
import stagionePrecedenteCsvBundled from '../../database/fantalab_stagione_precedente.csv?raw'
import votiGiornateCsvBundled from '../../database/voti_giornate.csv?raw'
import storicoStagioniCsvBundled from '../../database/storico_stagioni.csv?raw'
import type {
  FldaBulkHistoryResponse,
  FldaHistoryRecord,
  FldaPlayer,
  FldaPlayerDetail,
  FldaPlayersPage,
  FldaRecord,
} from './flda'
import { getCsv } from '../data/csvOverrides'

// CSV caricati dalla pagina Import/Export, altrimenti quelli del progetto
const giocatoriCsv = getCsv('fantalab_giocatori', giocatoriCsvBundled)
const allenatoriCsv = getCsv('fantalab_allenatori', allenatoriCsvBundled)
const stagionePrecedenteCsv = getCsv('stagione_precedente', stagionePrecedenteCsvBundled)
const votiGiornateCsv = getCsv('voti_giornate', votiGiornateCsvBundled)
const storicoStagioniCsv = getCsv('storico_stagioni', storicoStagioniCsvBundled)

const CURRENT_SEASON = '2026/27'
const PREVIOUS_SEASON = '2025/26'

// letti una volta sola, al primo uso
let extras: {
  previous: Map<string, Row>
  votes: Map<string, Array<{ matchday: number; mv: number | null; fmv: number | null }>>
  seasons: Map<string, Row[]>
} | null = null

function loadExtras() {
  if (extras) return extras
  const previous = new Map(parseCsv(stagionePrecedenteCsv).map((row) => [row['ID FantaLab'], row]))
  const votes = new Map<string, Array<{ matchday: number; mv: number | null; fmv: number | null }>>()
  for (const row of parseCsv(votiGiornateCsv)) {
    const list = votes.get(row['ID Fantacalcio']) ?? []
    list.push({ matchday: Number(row['Giornata']), mv: num(row['Voto']), fmv: num(row['Fantavoto']) })
    votes.set(row['ID Fantacalcio'], list)
  }
  const seasons = new Map<string, Row[]>()
  for (const row of parseCsv(storicoStagioniCsv)) {
    const list = seasons.get(row['ID Fantacalcio']) ?? []
    list.push(row)
    seasons.set(row['ID Fantacalcio'], list)
  }
  extras = { previous, votes, seasons }
  return extras
}

type Row = Record<string, string>

// Le colonne finali ripetono alcuni nomi (es. "Gol Subiti"): vince la prima.
function parseCsv(text: string): Row[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim())
  const header = lines[0].split(';').map((cell) => cell.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(';')
    const row: Row = {}
    header.forEach((name, index) => {
      if (!(name in row)) row[name] = (cells[index] ?? '').trim()
    })
    return row
  })
}

function num(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('it').replace(/\s+/g, ' ')
}

function splitNames(value: string | undefined): string[] {
  return (value ?? '').split(',').map((name) => name.trim()).filter(Boolean)
}

const PMA_KEYS = [
  'classic_8_no_mod', 'classic_10_no_mod', 'classic_12_no_mod',
  'classic_8_mod', 'classic_10_mod', 'classic_12_mod',
  'mantra_8', 'mantra_10', 'mantra_12',
]

// Ruoli chiave FantaLab -> codici ruolo tattico usati dall'iCà.
const COACH_ROLE_CODES: Record<string, string> = {
  'portiere': 'gk',
  'difensori centrali': 'def-center',
  'terzini': 'def-fullbacks',
  'braccetti': 'def-halfbacks',
  'esterni di centrocampo': 'mid-wide',
  'mediani': 'mid-holding',
  'mezzali': 'mid-center',
  'trequartista centrale': 'treq-center',
  'trequartisti esterni': 'treq-wings',
  "ali d'attacco": 'att-wings',
  'punta centrale': 'att-center',
}

interface LocalData {
  players: FldaPlayer[]
  rows: Map<string, Row>
  teams: Map<string, Row>
}

let cache: LocalData | null = null

function load(): LocalData {
  if (cache) return cache
  const teams = new Map(parseCsv(allenatoriCsv).map((row) => [row['Squadra'], row]))
  const rows = new Map<string, Row>()
  const players: FldaPlayer[] = []

  for (const row of parseCsv(giocatoriCsv)) {
    const id = row['ID FantaLab']
    if (!id || rows.has(id) || row['Nel listone'] === 'No') continue
    rows.set(id, row)
    const pma = num(row['PMA % budget (Guida)'])
    const player: FldaPlayer = {
      player_id: id,
      fantalab_id: id,
      fantacalcio_id: row['ID Fantacalcio'] || null,
      name: row['Nome'],
      team: row['Squadra'],
      role: row['Ruolo'].toUpperCase(),
      mantra_roles: row['Ruoli Mantra'] ? row['Ruoli Mantra'].split('/') : [],
      // xFM e integrità di FantaLab se il CSV le contiene (download automatico),
      // altrimenti la fantamedia della stagione
      fm_exp: num(row['FM Attesa (xFM)']) ?? num(row['Fantamedia']),
      integrita: num(row['Integrità']),
      tit_index_raw: null,
      titolarita_display: num(row['Titolarità % (Guida)']),
      is_starting_xi: row['Titolare (Guida)'] === 'Sì',
      // stagione precedente (presente nei CSV scaricati da FantaLab)
      previous_fmv: num(row['FM stagione precedente']),
      previous_presenze: num(row['Presenze stagione precedente']),
    }
    // PMA per configurazione di lega se il CSV lo fornisce (export FLDA), altrimenti quello della Guida
    for (const key of PMA_KEYS) player[`${key}_median_value`] = num(row[`PMA ${key} %`]) ?? pma
    players.push(player)
  }

  cache = { players, rows, teams }
  return cache
}

function teamPlayers(team: string): FldaPlayer[] {
  return load().players.filter((player) => player.team === team)
}

// Trova i giocatori della squadra citati per nome nelle liste FantaLab.
function idsByNames(team: string, names: string[]): string[] {
  const roster = teamPlayers(team)
  return names.flatMap((name) => {
    const wanted = normalizeName(name)
    const match = roster.find((player) => normalizeName(player.name) === wanted)
    return match?.player_id ? [match.player_id] : []
  })
}

function historyRecord(row: Row, season = CURRENT_SEASON): FldaHistoryRecord {
  return {
    season,
    presenze: num(row['Presenze']),
    starts_eleven: num(row['Titolarità']),
    min_playing_time: num(row['Minuti Giocati']),
    mv: num(row['Media Voto']),
    fmv: num(row['Fantamedia']),
    gol_fatti: num(row['Gol Totali']),
    assist: num(row['Assist Totali']),
    amm: num(row['Ammonizioni']),
    esp: num(row['Espulsioni']),
    rigori_fatti: num(row['Rigori Segnati']),
    rigori_sbagliati: num(row['Rigori Sbagliati']),
    gol_subiti: num(row['Gol Subiti']),
    rigori_parati: num(row['Rigori Parati']),
    clean_sheet: num(row['Clean Sheet']),
    xg: num(row['xG']),
    xa: num(row['xA']),
    injury_games_missed: num(row['Partite Saltate (Inf.)']),
    // campi usati dalla scheda completa (nomi FLDA)
    min_playing_time_per_match: num(row['Minuti/Partita']),
    mv_5: num(row['MV Ultime 5']),
    fmv_5: num(row['FMV Ultime 5']),
    presenze_5: num(row['Presenze Ultime 5']),
    starts_eleven_5: num(row['Titolare Ultime 5']),
    perc_match_with_bonus: num(row['% Partite con Bonus']),
    perc_match_over_6: num(row['% Partite Voto >= 6']),
    perc_match_over_6_half: num(row['% Partite Voto >= 6.5']),
    perc_match_with_vote: num(row['% Partite con Voto']),
    rating: num(row['Rating SM']),
    total_shots: num(row['Tiri Totali']),
    shots_on_target: num(row['Tiri in Porta']),
    shots_per_match: num(row['Tiri/Partita']),
    key_passes: num(row['Passaggi Chiave']),
    key_passes_per_match: num(row['Pass. Chiave/Partita']),
    accurate_passes: num(row['Passaggi Riusciti']),
    accurate_passes_percentage: num(row['% Passaggi Riusciti']),
    tackles: num(row['Contrasti']),
    duels_won: num(row['Duelli Vinti']),
    fouls: num(row['Falli Commessi']),
    recuperi_per_match: num(row['Recuperi/Partita']),
    saves: num(row['Parate']),
    saves_per_match: num(row['Parate/Partita']),
    goals_per_shot: num(row['% Gol su Tiri']),
    xg_per_match: num(row['xG/Partita']),
    shots_on_target_per_match: num(row['Tiri in Porta/Partita']),
    headed_goals: num(row['Gol di Testa']),
    big_chances_created: num(row['Occasioni Create']),
    big_chances_missed: num(row['Occasioni Mancate']),
    penalties_won: num(row['Rigori Guadagnati']),
    xa_per_match: num(row['xA/Partita']),
    crosses_pct: num(row['% Cross Riusciti']),
    dribbles_pct: num(row['% Dribbling Riusciti']),
    touches_per_match: num(row['Palloni Giocati/Partita']),
    fouls_drawn: num(row['Falli Subiti']),
    clearances: num(row['Spazzate']),
    interceptions: num(row['Intercetti']),
    aerial_duels_won: num(row['Duelli Aerei Vinti']),
    total_duels: num(row['Duelli Totali']),
    clearances_per_match: num(row['Spazzate/Partita']),
    interceptions_per_match: num(row['Intercetti/Partita']),
    tackles_per_match: num(row['Contrasti/Partita']),
    duels_won_per_match: num(row['Duelli Vinti/Partita']),
    aerial_duels_per_match: num(row['Duelli Aerei/Partita']),
    blocked_shots: num(row['Tiri Bloccati']),
    errors_to_goal: num(row['Errori da Gol']),
    penalties_caused: num(row['Rigori Causati']),
    dispossessed_per_match: num(row['Palle Perse/Partita']),
    cards: num(row['Cartellini']),
    saves_inside_box: num(row['Parate in Area']),
    saves_outside_box: num(row['Parate Fuori Area']),
    saves_pct: num(row['% Parate']),
    goals_conceded_per_match: num(row['Gol Subiti/Partita']),
    clean_sheet_pct: num(row['% Clean Sheet']),
    goals: num(row['Gol Totali']),
  }
}

export function localPlayers(): FldaPlayersPage {
  const { players } = load()
  return { total: players.length, limit: players.length, offset: 0, players }
}

export function localBulkHistory(): FldaBulkHistoryResponse {
  const { players, rows } = load()
  return {
    seasons: 1,
    fields: Object.keys(historyRecord({})),
    players: players.map((player) => ({
      player_id: player.player_id!,
      history: [historyRecord(rows.get(player.player_id!)!)],
    })),
  }
}

export function localTeamGuide(team: string): FldaRecord {
  const row = load().teams.get(team)
  if (!row) return { starting_xi: [], key_roles: [] }
  const keyRoles = (row['Ruoli chiave'] ?? '').split('|').flatMap((item) => {
    const match = item.trim().match(/^(.+?)\s*\((positivo|negativo|neutro)\)$/i)
    if (!match) return []
    const role = COACH_ROLE_CODES[normalizeName(match[1])]
    const tone = match[2].toLowerCase() === 'positivo' ? 'good'
      : match[2].toLowerCase() === 'negativo' ? 'bad' : null
    return role && tone ? [{ role, tone }] : []
  })
  return {
    team,
    coach: row['Allenatore'],
    module: row['Modulo'],
    attack: num(row['Voto allenatore Attacco']),
    team_attack_index: num(row['Indice squadra Attacco']),
    team_defense_index: num(row['Indice squadra Difesa']),
    defense: num(row['Voto allenatore Difesa']),
    key_points: (row['Punti chiave'] ?? '').split('|')
      .map((text) => text.trim()).filter(Boolean).map((text) => ({ text })),
    starting_xi: idsByNames(team, splitNames(row['Formazione tipo']))
      .map((player_id) => ({ player_id })),
    key_roles: keyRoles,
    // etichette leggibili per la UI: [{ label: "Ali d'attacco", tone: 'good' }]
    key_roles_text: (row['Ruoli chiave'] ?? '').split('|').flatMap((item) => {
      const match = item.trim().match(/^(.+?)\s*\((positivo|negativo|neutro)\)$/i)
      if (!match) return []
      const tone = match[2].toLowerCase() === 'positivo' ? 'good' : match[2].toLowerCase() === 'negativo' ? 'bad' : 'neutral'
      return [{ label: match[1], tone }]
    }),
    valorizzati: splitNames(row['Valorizzati']),
    penalizzati: splitNames(row['Penalizzati']),
    updated_at: row['Aggiornato'],
  }
}

export function localTeamHierarchies(team: string): FldaRecord[] {
  const row = load().teams.get(team)
  if (!row) return []
  const lists: Array<[string, string]> = [
    ['PENALTY', 'Rigoristi'],
    ['FREE_KICK', 'Punizioni'],
    ['CORNER', "Calci d'angolo"],
  ]
  const hierarchies = lists.flatMap(([type, column]) =>
    idsByNames(team, splitNames(row[column])).map((player_id, index) => ({
      player_id, hierarchy_type: type, source_rank: index + 1,
    })))
  // Portieri: titolare della Guida per primo, poi per titolarità.
  const keepers = teamPlayers(team)
    .filter((player) => player.role === 'P')
    .sort((a, b) => Number(b.is_starting_xi) - Number(a.is_starting_xi)
      || (b.titolarita_display ?? 0) - (a.titolarita_display ?? 0))
  keepers.forEach((player, index) => hierarchies.push({
    player_id: player.player_id!, hierarchy_type: 'GOALKEEPER', source_rank: index + 1,
  }))
  return hierarchies
}

// stagione in corso, stagione scorsa con tutte le statistiche (FantaLab),
// poi le stagioni più vecchie solo con MV/FMV/presenze (fantacalcio.it)
function playerHistory(playerId: string, row: Row): FldaHistoryRecord[] {
  const { previous, seasons } = loadExtras()
  const history = [historyRecord(row)]
  const previousRow = previous.get(playerId)
  if (previousRow && num(previousRow['Presenze'])) history.push(historyRecord(previousRow, PREVIOUS_SEASON))
  const known = new Set(history.map((item) => item.season))
  const older = (seasons.get(row['ID Fantacalcio']) ?? [])
    .filter((item) => !known.has(item['Stagione']))
    .sort((a, b) => b['Stagione'].localeCompare(a['Stagione']))
  for (const item of older) {
    history.push({ season: item['Stagione'], presenze: num(item['Presenze']), mv: num(item['MV']), fmv: num(item['FMV']) })
  }
  return history
}

function playerMatchdays(row: Row): FldaPlayerDetail['matchdays'] {
  const list = loadExtras().votes.get(row['ID Fantacalcio']) ?? []
  const last = Math.max(0, ...[...loadExtras().votes.values()].flat().map((item) => item.matchday))
  const byDay = new Map(list.map((item) => [item.matchday, item]))
  // tutte le giornate giocate dalla Serie A, anche quelle in cui il giocatore non c'era
  return Array.from({ length: last }, (_, index) => byDay.get(index + 1) ?? { matchday: index + 1, mv: null, fmv: null })
}

export function localPlayerDetail(playerId: string): FldaPlayerDetail {
  const { players, rows } = load()
  const current = players.find((player) => player.player_id === playerId)
  const row = rows.get(playerId)
  if (!current || !row) throw new Error('Giocatore non presente nelle tabelle FantaLab.')
  return {
    current,
    history: playerHistory(playerId, row),
    matchdays: playerMatchdays(row),
    guide: localTeamGuide(current.team),
    hierarchies: localTeamHierarchies(current.team)
      .filter((item) => item.player_id === playerId),
    saggi: [],
    auction_prices: [],
  }
}
