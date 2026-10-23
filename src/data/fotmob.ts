// Dati FotMob raccolti da FLDA: heatmap della stagione e carriera in tutti i campionati.
import heatmapCsvBundled from '../../database/heatmap.csv?raw'
import careerCsvBundled from '../../database/carriera.csv?raw'
import { getCsv } from './csvOverrides'

type Row = Record<string, string>

function parseCsv(text: string): Row[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
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

export interface Heatmap {
  season: string
  position: string
  /** tocchi di palla nella stagione */
  touches?: number
  /** 30 × 20 celle, intensità 0-9, riga per riga */
  cells: number[]
}

export const HEATMAP_COLUMNS = 30
export const HEATMAP_ROWS = 20

let heatmaps: Map<string, Heatmap> | null = null

export function heatmapFor(fantalabId: string | null | undefined): Heatmap | undefined {
  if (!fantalabId) return undefined
  if (!heatmaps) {
    heatmaps = new Map(parseCsv(getCsv('heatmap', heatmapCsvBundled))
      .filter((row) => row['Griglia']?.length === HEATMAP_COLUMNS * HEATMAP_ROWS)
      .map((row) => [row['ID FantaLab'], { season: row['Stagione'], position: row['Ruolo'], touches: num(row['Tocchi']), cells: [...row['Griglia']].map(Number) }]))
  }
  return heatmaps.get(fantalabId)
}

export interface CareerSeason {
  season: string
  league: string
  team: string
  appearances?: number
  goals?: number
  assists?: number
  rating?: number
}

let careers: Map<string, CareerSeason[]> | null = null

export function careerFor(fantalabId: string | null | undefined): CareerSeason[] {
  if (!fantalabId) return []
  if (!careers) {
    careers = new Map()
    for (const row of parseCsv(getCsv('carriera', careerCsvBundled))) {
      const list = careers.get(row['ID FantaLab']) ?? []
      list.push({ season: row['Stagione'], league: row['Campionato'], team: row['Squadra'], appearances: num(row['Presenze']), goals: num(row['Gol']), assists: num(row['Assist']), rating: num(row['Voto FotMob']) })
      careers.set(row['ID FantaLab'], list)
    }
  }
  return careers.get(fantalabId) ?? []
}
