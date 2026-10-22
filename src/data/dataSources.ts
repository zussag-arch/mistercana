// Riepilogo delle fonti dati effettivamente usate dall'app, con i numeri veri
// (per la pagina Import/Export). Nessuna richiesta di rete: legge i file in database/.
import goalkeeperGridCsvBundled from '../../database/griglia_portieri.csv?raw'
import attackerGridCsvBundled from '../../database/griglia_attaccanti.csv?raw'
import { localPlayers, localTeamGuide } from '../services/fantalabLocal'
import { players as listone } from './players'
import { getSaggiForPlayer } from './saggi'
import { goalkeeperCalendarTeams } from './goalkeeperCalendar'
import { getCsv, getCsvOverrides } from './csvOverrides'
import type { CsvKey } from './csvOverrides'

// CSV caricati dalla pagina Import/Export, altrimenti quelli del progetto
const goalkeeperGridCsv = getCsv('griglia_portieri', goalkeeperGridCsvBundled)
const attackerGridCsv = getCsv('griglia_attaccanti', attackerGridCsvBundled)

export interface DataSourceSummary {
  key: string
  title: string
  file: string
  value: string
  detail: string
  usedBy: string
  /** da dove arrivano i dati e quando: "caricati il 21/10/2026" o "inclusi nell'app" */
  updated: string
}

function gridTeams(csv: string): number {
  return csv.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim()).length - 1
}

function formatDate(value: string | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('it-IT')
}

const SOURCE_CSV: Record<string, CsvKey[]> = {
  players: ['fantalab_giocatori'],
  coaches: ['fantalab_allenatori'],
  grids: ['griglia_portieri', 'griglia_attaccanti'],
  saggi: ['saggi'],
  history: [],
  goalkeepers: ['portieri_calendario', 'portieri_gerarchie'],
}

// data di pubblicazione dell'app (inserita da Vite al momento della build)
const BUILD_DATE = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : ''

function updatedLabel(key: string): string {
  const overrides = getCsvOverrides()
  const dates = (SOURCE_CSV[key] ?? [])
    .map((csvKey) => overrides[csvKey]?.loadedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
  return dates.length
    ? `caricati nel browser il ${formatDate(dates[dates.length - 1])}`
    : "inclusi nell'app"
}

/** Ultimo aggiornamento dei dati in uso: il più recente tra CSV caricati, Guida FantaLab e pubblicazione. */
export function getLastDataUpdate(): { date: string; source: string } {
  const overrides = Object.values(getCsvOverrides())
    .map((item) => item?.loadedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
  if (overrides.length) {
    return { date: formatDate(overrides[overrides.length - 1]), source: 'CSV caricati nel browser' }
  }
  const fantalab = localPlayers().players
  const teams = [...new Set(fantalab.map((player) => player.team))]
  const guide = teams
    .map((team) => String(localTeamGuide(team).updated_at ?? ''))
    .filter(Boolean)
    .sort()
  if (guide.length) {
    return { date: formatDate(guide[guide.length - 1]), source: "dati FantaLab inclusi nell'app" }
  }
  return { date: BUILD_DATE ? formatDate(BUILD_DATE) : '—', source: "pubblicazione dell'app" }
}

export function getDataSources(): DataSourceSummary[] {
  const fantalab = localPlayers().players
  const kept = listone.filter((player) => player.fantalabId && player.id !== player.fantalabId).length
  const added = listone.length - kept
  const teams = [...new Set(fantalab.map((player) => player.team))]
  const guides = teams.map((team) => localTeamGuide(team))
  const updates = guides.map((guide) => String(guide.updated_at ?? '')).filter(Boolean).sort()
  const withSaggi = listone.filter((player) => getSaggiForPlayer(player.id).length > 0).length

  return [
    {
      key: 'players',
      title: 'Listone giocatori',
      file: 'fantalab_giocatori.csv',
      value: `${fantalab.length} giocatori`,
      detail: `${kept} con codice storico conservato, ${added} nuovi`,
      usedBy: 'tutta l\'app: lista, schede, Asta, Obiettivi, iCà',
      updated: updatedLabel('players'),
    },
    {
      key: 'coaches',
      title: 'Allenatori e Guida',
      file: 'fantalab_allenatori.csv',
      value: `${teams.length} squadre`,
      detail: updates.length ? `aggiornata dal ${formatDate(updates[0])} al ${formatDate(updates[updates.length - 1])}` : 'data aggiornamento non indicata',
      usedBy: 'formazione tipo, rigoristi e piazzati, ruoli chiave, indici squadra',
      updated: updatedLabel('coaches'),
    },
    {
      key: 'grids',
      title: 'Griglie abbinamenti',
      file: 'griglia_portieri.csv · griglia_attaccanti.csv',
      value: `${gridTeams(goalkeeperGridCsv)} + ${gridTeams(attackerGridCsv)} squadre`,
      detail: 'portieri per P e D, attaccanti per C e A',
      usedBy: 'abbinamenti in Insights e facilità partite nell\'iCà',
      updated: updatedLabel('grids'),
    },
    {
      key: 'saggi',
      title: 'Prezzi dei Saggi',
      file: 'MisterCana_DB_Saggi.csv',
      value: `${withSaggi} giocatori`,
      detail: 'agganciati tramite il codice storico del giocatore',
      usedBy: 'Prezzo e Saggi, consenso, strategia portieri',
      updated: updatedLabel('saggi'),
    },
    {
      key: 'history',
      title: 'Listone stagione scorsa',
      file: 'MisterCana_DB_Giocatori_2026_27.csv',
      value: `${kept} giocatori`,
      detail: 'codici storici e statistiche della stagione precedente',
      usedBy: 'collegamento di obiettivi e Saggi, fantamedia storica nell\'iCà',
      updated: updatedLabel('history'),
    },
    {
      key: 'goalkeepers',
      title: 'Calendario e gerarchie portieri',
      file: 'MisterCana_DB_Portieri_Calendario.csv · _Gerarchie.csv',
      value: `${goalkeeperCalendarTeams.length} squadre`,
      detail: '38 giornate, valori favorevole / medio / difficile',
      usedBy: 'abbinamenti portieri e strategia portieri in Asta',
      updated: updatedLabel('goalkeepers'),
    },
  ]
}
