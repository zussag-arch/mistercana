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

export function auctionStatusLabel(view: PlayerViewModel): string {
  if (!view.identityAvailable) return 'IDENTITÀ NON ASSOCIATA'
  if (!view.auctionLive) return 'NO LIVE'
  return view.assigned ? 'ASSEGNATO' : 'DA ASSEGNARE'
}

export function renderCurrentMetrics(view: PlayerViewModel): string {
  return `<div class="player-current-metrics">
    <div><span>PMA</span><strong>—</strong><small>modalità non configurata</small></div>
    <div><span>FM Exp.</span><strong>${display(view.flda.fm_exp, 2)}</strong></div>
    <div><span>Titolarità</span><strong>${display(view.flda.titolarita_display, 0)}${typeof view.flda.titolarita_display === 'number' ? '%' : ''}</strong><small>indicatore editoriale</small></div>
    <div><span>Integrità</span><strong>${display(view.flda.integrita, 0)}</strong></div>
    ${view.legacy ? `<div><span>iCà MisterCanà</span><strong>${display(view.legacy.iCa, 2)}</strong></div>` : ''}
  </div>`
}

export function renderSaggi(detail?: FldaPlayerDetail, full = false): string {
  const rows = detail?.saggi ?? []
  if (!rows.length) return '<p class="player-data-empty">Nessuna osservazione Saggi disponibile.</p>'
  return `<div class="player-data-table"><div class="player-data-row player-data-head"><span>Saggio</span>${full ? '<span>Fascia originale</span>' : ''}<span>Fascia canonica</span><span>Prezzo</span></div>${rows.map((row) => `<div class="player-data-row"><span>${display(field(row, 'saggio'))}</span>${full ? `<span>${display(field(row, 'fascia_originale'))}</span>` : ''}<span>${display(field(row, 'fascia_canonica'))}</span><span>${display(field(row, 'prezzo'), 0)}</span></div>`).join('')}</div>`
}

export function renderHistory(detail?: FldaPlayerDetail, full = false): string {
  const rows = detail?.history ?? []
  if (!rows.length) return '<p class="player-data-empty">Storico non disponibile.</p>'
  return `<div class="player-data-table"><div class="player-data-row player-data-head"><span>Stagione</span><span>Presenze</span>${full ? '<span>Minuti</span>' : ''}<span>MV</span><span>FMV</span></div>${rows.map((row) => `<div class="player-data-row"><span>${display(field(row, 'season'))}</span><span>${display(field(row, 'presenze'), 0)}</span>${full ? `<span>${display(field(row, 'min_playing_time'), 0)}</span>` : ''}<span>${display(field(row, 'mv'), 2)}</span><span>${display(field(row, 'fmv'), 2)}</span></div>`).join('')}</div>`
}

export function renderHierarchies(detail?: FldaPlayerDetail): string {
  const contexts = field(detail?.guide, 'contexts')
  const all = [...(detail?.hierarchies ?? []), ...(Array.isArray(contexts) ? contexts as FldaRecord[] : [])]
  if (!all.length) return '<p class="player-data-empty">Gerarchie non disponibili.</p>'
  return `<div class="player-chip-list">${all.map((row) => `<span><strong>${display(field(row, 'hierarchy_type') ?? field(row, 'type') ?? field(row, 'context_type'))}</strong> · posizione ${display(field(row, 'source_rank') ?? field(row, 'source_order'), 0)} <small>ordine editoriale</small></span>`).join('')}</div>`
}

export function renderFixtures(fixtures?: FldaRecord[], limit = 5): string {
  if (!fixtures?.length) return '<p class="player-data-empty">Calendario non disponibile.</p>'
  return `<div class="player-fixtures">${fixtures.slice(0, limit).map((row) => `<div><strong>G${display(field(row, 'day'), 0)}</strong><span>${display(field(row, 'opponent_team_short'))} · ${display(field(row, 'match_location'))}</span><em class="fixture-${escapePlayerHtml(field(row, 'difficulty_category'))}">${display(field(row, 'difficulty_category'))}</em></div>`).join('')}</div>`
}
