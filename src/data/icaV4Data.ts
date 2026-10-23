// Ingressi dell'iCà 4: quelli dell'iCà 3 più stagioni passate (storico fantacalcio.it), minuti e
// partite della stagione in corso, giornate giocate dalla squadra e infortuni con rientro (probabili).
import storicoCsvBundled from '../../database/storico_stagioni.csv?raw'
import votesCsvBundled from '../../database/voti_giornate.csv?raw'
import { getCsv } from './csvOverrides'
import { buildICaInputs } from './icaV3Data'
import { nextMatchday, probables } from './roster'
import { localBulkHistory, localPlayers } from '../services/fantalabLocal'
import { calculateICaV4 } from '../domain/icaV4'
import type { ICaV4Input, ICaV4Result, ICaV4Season } from '../domain/icaV4'

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

function buildInputs(): ICaV4Input[] {
  const players = new Map(localPlayers().players.map((player) => [player.player_id, player]))
  const current = new Map(localBulkHistory().players.map((item) => [item.player_id, item.history[0]]))

  // stagioni per ID fantacalcio, dalla più recente; la stagione in corso è l'ultima dello storico
  const storico = parseCsv(getCsv('storico_stagioni', storicoCsvBundled))
  const latest = storico.map((row) => row['Stagione']).sort().pop()
  const seasons = new Map<string, ICaV4Season[]>()
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

  return buildICaInputs().map((base) => {
    const player = players.get(base.id)
    const season = current.get(base.id)
    const fantacalcioId = player?.fantacalcio_id ?? ''
    const status = probable.get(base.id)
    const out = Boolean(status && (status.injured || status.suspended || status.unavailable))
    return {
      ...base,
      pastSeasons: seasons.get(fantacalcioId) ?? [],
      minutes: typeof season?.min_playing_time === 'number' ? season.min_playing_time : undefined,
      starts: typeof season?.starts_eleven === 'number' ? season.starts_eleven : undefined,
      teamMatches: days.get(base.team.toLowerCase())?.size || allDays || undefined,
      currentMatchday: nextDay,
      returnMatchday: status?.returnDay,
      out,
    }
  })
}

let cache: Map<string, ICaV4Result> | null = null

/** Risultati iCà 4 per ID FantaLab (calcolati una volta per sessione). */
export function getICaV4Results(): Map<string, ICaV4Result> {
  if (!cache) cache = calculateICaV4(buildInputs())
  return cache
}

export function getICaV4(fantalabId: string | null | undefined): ICaV4Result | undefined {
  return fantalabId ? getICaV4Results().get(fantalabId) : undefined
}
