import type { FldaPlayer, FldaPlayerDetail, FldaRecord } from '../services/flda'
import type { Player } from '../domain/player'

export interface PlayerViewModel {
  flda: FldaPlayer
  legacy?: Player
  detail?: FldaPlayerDetail
  fixtures?: FldaRecord[]
  guide?: FldaRecord
  legacyId?: string
  assigned: boolean
  auctionLive: boolean
  identityAvailable: boolean
}

export function escapePlayerHtml(value: unknown): string {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

export function field(record: FldaRecord | undefined | null, key: string): unknown {
  return record?.[key]
}

export function display(value: unknown, digits = 0): string {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(digits).replace('.', ',')
  if (typeof value === 'string' && value.trim()) return escapePlayerHtml(value)
  return '—'
}

export function displayCount(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : '—'
}

export function auctionStatusLabel(view: PlayerViewModel): string {
  if (!view.identityAvailable) return 'IDENTITÀ NON ASSOCIATA'
  if (!view.auctionLive) return 'NO LIVE'
  return view.assigned ? 'ASSEGNATO' : 'DA ASSEGNARE'
}

export function auctionStatusClass(view: PlayerViewModel): string {
  if (!view.identityAvailable) return 'unmatched'
  if (!view.auctionLive) return 'offline'
  return view.assigned ? 'assigned' : 'free'
}

export function icaHue(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0'
  return String(Math.max(0, Math.min(120, value * 1.2)))
}

function hierarchyRows(detail?: FldaPlayerDetail): FldaRecord[] {
  const contexts = field(detail?.guide, 'contexts')
  return [...(detail?.hierarchies ?? []), ...(Array.isArray(contexts) ? contexts as FldaRecord[] : [])]
}

function hierarchyType(row: FldaRecord): string {
  return String(field(row, 'hierarchy_type') ?? field(row, 'type') ?? field(row, 'context_type') ?? '').toUpperCase()
}

function hierarchyRank(row: FldaRecord): number | undefined {
  const value = field(row, 'source_rank') ?? field(row, 'source_order')
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined
}

export function renderPlayerBadges(view: PlayerViewModel): string {
  const badges: string[] = []
  if (typeof view.flda.titolarita_display === 'number' && view.flda.titolarita_display >= 90) {
    badges.push('<span class="player-signal player-signal-xi">XI</span>')
  }
  for (const row of hierarchyRows(view.detail)) {
    const type = hierarchyType(row)
    const rank = hierarchyRank(row)
    const suffix = rank ? ` ${rank}°` : ''
    if (type.includes('GOALKEEPER')) badges.push(`<span class="player-signal player-signal-goalkeeper">🧤 P${rank ?? ''}</span>`)
    else if (type.includes('PENALTY')) badges.push(`<span class="player-signal player-signal-penalty">Rig.${suffix}</span>`)
    else if (type.includes('FREE_KICK')) badges.push(`<span class="player-signal player-signal-free-kick">👟 Pun.${suffix}</span>`)
    else if (type.includes('CORNER')) badges.push(`<span class="player-signal player-signal-corner">🚩 Corner${suffix}</span>`)
  }
  return badges.length ? `<div class="player-signals">${badges.join('')}</div>` : ''
}

export function renderCurrentMetrics(view: PlayerViewModel, compact = false): string {
  const pma = !view.flda.player_id && typeof view.legacy?.pmaPercent === 'number'
    ? `${display(view.legacy.pmaPercent, 1)}%`
    : '—'
  const items = [
    ['iCà', display(view.legacy?.iCa, 1), 'Indice MisterCanà'],
    ['PMA', pma, pma === '—' ? 'modalità non configurata' : 'budget iniziale'],
    ['xFM', display(view.flda.fm_exp, 2), 'FM Exp. FLDA'],
    ['Integrità', display(view.flda.integrita, 0), ''],
  ]
  if (!compact) items.push(
    ['MV', display(view.legacy?.mv, 2), 'dato legacy'],
    ['FMV', display(view.legacy?.fmv, 2), 'dato legacy'],
    ['Titolarità', `${display(view.flda.titolarita_display, 0)}${typeof view.flda.titolarita_display === 'number' ? '%' : ''}`, 'indicatore editoriale'],
  )
  return `<div class="player-current-metrics">${items.map(([label, value, note]) => `<div><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`).join('')}</div>`
}

function chartEmpty(message: string): string {
  return `<div class="player-chart-empty">${escapePlayerHtml(message)}</div>`
}

export function renderSageChart(detail?: FldaPlayerDetail): string {
  const preferred = ['Carmy', 'Recosta', 'Il Tattico', 'SOS Fanta', 'Il Profeta']
  const rows = (detail?.saggi ?? []).map((row) => ({
    name: String(field(row, 'saggio') ?? ''),
    price: field(row, 'prezzo'),
  })).filter((row): row is { name: string; price: number } => typeof row.price === 'number' && Number.isFinite(row.price))
    .sort((a, b) => {
      const ai = preferred.findIndex((item) => a.name.toLocaleLowerCase('it').includes(item.toLocaleLowerCase('it')))
      const bi = preferred.findIndex((item) => b.name.toLocaleLowerCase('it').includes(item.toLocaleLowerCase('it')))
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
    }).slice(0, 5)
  if (!rows.length) return chartEmpty('Prezzi Saggi non disponibili.')
  const average = rows.reduce((sum, row) => sum + row.price, 0) / rows.length
  const max = Math.max(...rows.map((row) => row.price), average, 1)
  const baseY = 190
  const height = 130
  const barWidth = 70
  const gap = 40
  const startX = 62
  const averageY = baseY - (average / max) * height
  return `<div class="player-chart"><svg viewBox="0 0 620 245" role="img" aria-label="Prezzi dei cinque Saggi e media descrittiva">
    <line x1="45" y1="${averageY}" x2="590" y2="${averageY}" class="chart-average-line"/><text x="588" y="${averageY - 7}" text-anchor="end" class="chart-average-label">media ${display(average, 1)}</text>
    ${rows.map((row, index) => { const h = (row.price / max) * height; const x = startX + index * (barWidth + gap); return `<rect x="${x}" y="${baseY - h}" width="${barWidth}" height="${h}" rx="10" class="chart-bar"/><text x="${x + barWidth / 2}" y="${baseY - h - 8}" text-anchor="middle" class="chart-value">${display(row.price, 0)}</text><text x="${x + barWidth / 2}" y="214" text-anchor="middle" class="chart-label">${escapePlayerHtml(row.name)}</text>` }).join('')}
    <line x1="45" y1="${baseY}" x2="590" y2="${baseY}" class="chart-axis"/>
  </svg><p>La media è descrittiva e non modifica i calcoli.</p></div>`
}

export function renderPerformanceChart(detail?: FldaPlayerDetail): string {
  const rows = (detail?.history ?? []).map((row) => ({ season: String(field(row, 'season') ?? ''), mv: field(row, 'mv'), fmv: field(row, 'fmv') }))
    .filter((row) => typeof row.mv === 'number' || typeof row.fmv === 'number').reverse()
  if (!rows.length) return chartEmpty('Storico MV/FMV non disponibile.')
  const values = rows.flatMap((row) => [row.mv, row.fmv]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const min = Math.min(...values, 4)
  const max = Math.max(...values, 8)
  const x = (index: number) => rows.length === 1 ? 310 : 55 + index * (520 / (rows.length - 1))
  const y = (value: number) => 185 - ((value - min) / Math.max(max - min, 1)) * 125
  const points = (key: 'mv' | 'fmv') => rows.map((row, index) => typeof row[key] === 'number' ? `${x(index)},${y(row[key])}` : '').filter(Boolean).join(' ')
  return `<div class="player-chart"><svg viewBox="0 0 620 245" role="img" aria-label="Andamento multi-stagione MV e FMV">
    <line x1="45" y1="185" x2="590" y2="185" class="chart-axis"/><polyline points="${points('mv')}" class="chart-line chart-line-mv"/><polyline points="${points('fmv')}" class="chart-line chart-line-fmv"/>
    ${rows.map((row, index) => `<text x="${x(index)}" y="214" text-anchor="middle" class="chart-label">${escapePlayerHtml(row.season)}</text>${typeof row.mv === 'number' ? `<circle cx="${x(index)}" cy="${y(row.mv)}" r="5" class="chart-dot chart-dot-mv"><title>MV ${display(row.mv, 2)}</title></circle>` : ''}${typeof row.fmv === 'number' ? `<circle cx="${x(index)}" cy="${y(row.fmv)}" r="5" class="chart-dot chart-dot-fmv"><title>FMV ${display(row.fmv, 2)}</title></circle>` : ''}`).join('')}
    <g class="chart-legend"><circle cx="440" cy="25" r="5" class="chart-dot-mv"/><text x="452" y="29">MV</text><circle cx="510" cy="25" r="5" class="chart-dot-fmv"/><text x="522" y="29">FMV</text></g>
  </svg></div>`
}

export function latestHistory(detail?: FldaPlayerDetail): FldaRecord | undefined {
  return detail?.history?.[0]
}

export function renderHierarchies(detail?: FldaPlayerDetail): string {
  const rows = hierarchyRows(detail)
  if (!rows.length) return '<p class="player-data-empty">Gerarchie non disponibili.</p>'
  return `<div class="player-chip-list">${rows.map((row) => `<span><strong>${display(field(row, 'hierarchy_type') ?? field(row, 'type') ?? field(row, 'context_type'))}</strong> · posizione ${display(field(row, 'source_rank') ?? field(row, 'source_order'), 0)} <small>ordine editoriale</small></span>`).join('')}</div>`
}
