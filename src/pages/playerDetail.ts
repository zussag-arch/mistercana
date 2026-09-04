import type { AppState } from '../app/state'
import type { FldaPlayer, FldaRecord } from '../services/flda'
import {
  getCachedPlayerDetail, getCachedPlayersDataset, getCachedTeamGuide,
  getFldaIdForLegacyId, getLegacyPlayer, getLegacyPlayerForFldaId,
  loadPlayerDetail, loadPlayersDataset, loadTeamGuide,
} from '../services/playerRepository'
import { getLegacyIdFromFldaId } from '../services/playerIdentity'
import {
  auctionStatusClass, auctionStatusLabel, display, displayCount, escapePlayerHtml,
  field, latestHistory, renderCurrentMetrics,
  renderPerformanceChart, renderPlayerBadges, renderSageChart,
} from '../components/playerDataView'
import type { PlayerViewModel } from '../components/playerDataView'
import { displayHistoricalAuctionPrices } from '../domain/historicalAuctionPrice'

export interface PlayerDetailActions {
  onBack: () => void
  onRender: () => void
  onCallPlayer: (legacyId: string) => void
}

let loadingReference: string | null = null
let detailError: string | undefined

function resolve(reference: string): { flda: FldaPlayer; legacyId?: string } | undefined {
  const dataset = getCachedPlayersDataset()
  if (reference.startsWith('legacy:')) {
    const legacyId = reference.slice(7)
    const legacy = getLegacyPlayer(legacyId)
    if (!legacy) return undefined
    const fldaId = getFldaIdForLegacyId(legacyId)
    const flda = dataset?.players.find((item) => item.player_id === fldaId) ?? {
      player_id: null, name: legacy.name, team: legacy.team, role: legacy.role,
      fm_exp: legacy.fmv ?? null, integrita: null,
      titolarita_display: legacy.startingProbability ?? null,
    }
    return { flda, legacyId }
  }
  const flda = dataset?.players.find((item) => item.player_id === reference)
  return flda ? { flda, legacyId: getLegacyIdFromFldaId(reference) } : undefined
}

function statGrid(fields: Array<[string, unknown, 'count' | 'decimal']>): string {
  return `<div class="player-role-stats">${fields.map(([label, value, format]) => `<div><span>${label}</span><strong>${format === 'count' ? displayCount(value) : display(value, 2)}</strong></div>`).join('')}</div>`
}

function latestKpis(role: string, row?: FldaRecord): string {
  const goals = role === 'P' ? field(row, 'gol_subiti') : field(row, 'gol_fatti')
  const goalDisplay = role === 'P' && typeof goals === 'number' ? -Math.abs(Math.round(goals)) : goals
  return statGrid([
    ['Presenze', field(row, 'presenze'), 'count'],
    ['Minuti', field(row, 'min_playing_time'), 'count'],
    ['Media minuti', field(row, 'min_playing_time_per_match'), 'count'],
    [role === 'P' ? 'Gol subiti' : 'Gol', goalDisplay, 'count'],
    ['Assist', field(row, 'assist'), 'count'],
    ['Ammonizioni', field(row, 'amm'), 'count'],
    ['Espulsioni', field(row, 'esp'), 'count'],
    ['Titolare', field(row, 'starts_eleven') ?? field(row, 'starts_eleven_5'), 'count'],
  ])
}

function roleStats(role: string, row?: FldaRecord): string {
  if (!row) return '<p class="player-data-empty">Statistiche non disponibili.</p>'
  const fields: Array<[string, string, 'count' | 'decimal']> = role === 'P'
    ? [['Rigori parati', 'rigori_parati', 'count'], ['Parate', 'saves', 'count'], ['Parate/partita', 'saves_per_match', 'decimal'], ['Rating', 'rating', 'decimal']]
    : role === 'D'
      ? [['Recuperi/partita', 'recuperi_per_match', 'decimal'], ['Tackle', 'tackles', 'count'], ['Duelli vinti', 'duels_won', 'count'], ['Falli', 'fouls', 'count']]
      : role === 'C'
        ? [['Passaggi chiave', 'key_passes', 'count'], ['Passaggi precisi', 'accurate_passes', 'count'], ['Tiri', 'total_shots', 'count'], ['xA', 'xa', 'decimal']]
        : [['Tiri', 'total_shots', 'count'], ['Tiri in porta', 'shots_on_target', 'count'], ['xG', 'xg', 'decimal'], ['xA', 'xa', 'decimal']]
  return statGrid(fields.map(([label, key, format]) => [label, field(row, key), format]))
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return (value as FldaRecord[]).map((item) => String(field(item, 'text') ?? field(item, 'role') ?? field(item, 'name') ?? '').trim()).filter(Boolean)
}

function competitionItems(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return (value as FldaRecord[]).map((competition) => {
    const members = field(competition, 'members')
    if (!Array.isArray(members)) return ''
    return (members as FldaRecord[]).map((member) => {
      const percentage = field(member, 'percentage')
      return `${String(field(member, 'name') ?? '').trim()}${typeof percentage === 'number' ? ` ${display(percentage, 0)}%` : ''}`
    }).filter(Boolean).join(' · ')
  }).filter(Boolean)
}

function normalizedName(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('it')
}

function playerCompetitions(value: unknown, playerName: string): string[] {
  if (!Array.isArray(value)) return []
  return (value as FldaRecord[]).filter((competition) => {
    const members = field(competition, 'members')
    return Array.isArray(members) && (members as FldaRecord[]).some((member) => normalizedName(field(member, 'name')) === normalizedName(playerName))
  }).flatMap((competition) => competitionItems([competition]))
}

function qualitativeGuide(view: PlayerViewModel, guide?: FldaRecord): string {
  const groups: Array<[string, string, string[]]> = [
    ['Valorizzato', 'positive', view.legacy?.valorizzato ? ['Segnale presente nel listone'] : []],
    ['Penalizzato / Sfavorito', 'negative', view.legacy?.penalizzato ? ['Segnale presente nel listone'] : []],
    ['Nome nascosto', 'hidden', view.legacy?.nomeNascosto ? ['Segnale presente nel listone'] : []],
    ['Ballottaggio', 'competition', playerCompetitions(field(guide, 'competitions'), view.flda.name)],
  ]
  const present = groups.filter(([, , items]) => items.length)
  if (!present.length) return ''
  return `<section class="player-full-section player-qualitative"><div class="player-section-heading"><span>LETTURA EDITORIALE</span><h2>Indicazioni qualitative</h2></div><div class="player-qualitative-grid">${present.map(([label, tone, items]) => `<article class="qualitative-${tone}"><h3>${label}</h3><ul>${items.map((item) => `<li>${escapePlayerHtml(item)}</li>`).join('')}</ul></article>`).join('')}</div></section>`
}

function guideSummary(guide?: FldaRecord): string {
  if (!guide) return ''
  const keyPoints = asTextList(field(guide, 'key_points'))
  return `<section class="player-full-section"><div class="player-section-heading"><span>CONTESTO SQUADRA</span><h2>Guida</h2></div><div class="player-guide-summary"><div><span>Allenatore</span><strong>${display(field(guide, 'coach'))}</strong></div><div><span>Modulo</span><strong>${display(field(guide, 'module'))}</strong></div><div><span>Attacco</span><strong>${display(field(guide, 'attack'), 0)}</strong></div><div><span>Difesa</span><strong>${display(field(guide, 'defense'), 0)}</strong></div></div>${field(guide, 'comment') ? `<p>${display(field(guide, 'comment'))}</p>` : ''}${field(guide, 'sos_fanta_comment') ? `<p>${display(field(guide, 'sos_fanta_comment'))}</p>` : ''}${keyPoints.length ? `<ul>${keyPoints.map((item) => `<li>${escapePlayerHtml(item)}</li>`).join('')}</ul>` : ''}</section>`
}

const advancedLabels: Record<string, string> = {
  mv_5: 'MV ultime 5', fmv_5: 'FMV ultime 5', presenze_5: 'Presenze ultime 5', starts_eleven_5: 'Titolare ultime 5',
  perc_match_with_bonus: 'Partite con bonus', perc_match_over_6: 'Partite sopra 6', perc_match_over_6_half: 'Partite sopra 6,5', perc_match_with_vote: 'Partite con voto',
  total_shots: 'Tiri', shots_on_target: 'Tiri in porta', key_passes: 'Passaggi chiave', accurate_passes: 'Passaggi precisi', accurate_passes_percentage: 'Precisione passaggi',
  tackles: 'Tackle', duels_won: 'Duelli vinti', fouls: 'Falli', recuperi_per_match: 'Recuperi/partita', rating: 'Rating', xg: 'xG', xa: 'xA', shots_per_match: 'Tiri/partita', key_passes_per_match: 'Passaggi chiave/partita', saves_per_match: 'Parate/partita',
}

function advancedStats(row?: FldaRecord): string {
  if (!row) return '<p class="player-data-empty">Statistiche avanzate non disponibili.</p>'
  const discrete = new Set(['presenze_5', 'starts_eleven_5', 'total_shots', 'shots_on_target', 'key_passes', 'accurate_passes', 'tackles', 'duels_won', 'fouls'])
  const keys = Object.keys(advancedLabels).filter((key) => field(row, key) !== null && field(row, key) !== undefined)
  if (!keys.length) return '<p class="player-data-empty">Statistiche avanzate non disponibili.</p>'
  return `<div class="player-advanced-grid">${keys.map((key) => `<div><span>${advancedLabels[key]}</span><strong>${discrete.has(key) ? displayCount(field(row, key)) : display(field(row, key), 2)}</strong></div>`).join('')}</div>`
}

export function renderFullPlayerPage(reference: string | null, state: AppState): string {
  if (!reference) return '<section class="page player-full-page"><p>Nessun giocatore selezionato.</p></section>'
  const selected = resolve(reference)
  if (!selected) {
    window.setTimeout(() => document.dispatchEvent(new CustomEvent('mistercana:player-detail-load')), 0)
    return '<section class="page player-full-page"><div class="players-loading">Caricamento giocatore…</div></section>'
  }
  const { flda, legacyId } = selected
  const legacy = legacyId ? getLegacyPlayer(legacyId) : flda.player_id ? getLegacyPlayerForFldaId(flda.player_id) : undefined
  const detail = flda.player_id ? getCachedPlayerDetail(flda.player_id) : undefined
  const guide = getCachedTeamGuide(flda.team)
  const role = flda.role.toUpperCase()
  const assigned = Boolean(legacyId && state.auctionAssignments.some((item) => item.playerId === legacyId))
  const view: PlayerViewModel = { flda, legacy, legacyId, detail, guide, assigned, auctionLive: state.auctionPhase === 'live', identityAvailable: Boolean(flda.player_id && legacyId), pmaConfiguration: state.pmaConfiguration }
  const latest = latestHistory(detail)
  return `<section class="page player-full-page">
    <header class="player-full-header"><button type="button" data-player-detail-back>← Giocatori</button><div class="player-full-identity"><span class="player-detail-role player-detail-role-${role.toLowerCase()}">${escapePlayerHtml(role)}</span><div><small>SCHEDA GIOCATORE</small><h1>${escapePlayerHtml(flda.name)}</h1><p>${escapePlayerHtml(flda.team)}</p>${renderPlayerBadges(view)}</div></div><div class="player-full-actions"><span class="player-status player-status-${auctionStatusClass(view)}">${auctionStatusLabel(view)}</span>${legacyId ? `<button type="button" data-full-player-call="${escapePlayerHtml(legacyId)}" ${state.auctionPhase === 'live' && !assigned ? '' : 'disabled'}>${assigned ? 'ASSEGNATO' : 'CHIAMA'}</button>` : ''}</div></header>
    ${!view.identityAvailable ? '<p class="player-data-alert">Dati FLDA non disponibili per questa identità.</p>' : ''}${detailError ? `<p class="player-data-alert">${escapePlayerHtml(detailError)}</p>` : ''}
    <section class="player-full-section"><div class="player-section-heading"><span>ULTIMA STAGIONE</span><h2>Panoramica</h2></div>${latestKpis(role, latest)}</section>
    <div class="player-chart-grid"><section class="player-full-section"><h2>Prezzi dei Saggi</h2>${renderSageChart(detail)}</section><section class="player-full-section"><h2>Storico MV / FMV</h2>${renderPerformanceChart(detail)}</section></div>
    <section class="player-full-section"><div class="player-section-heading"><span>ASTA</span><h2>Dati correnti</h2></div>${renderCurrentMetrics(view, true, displayHistoricalAuctionPrices(detail))}</section>
    ${qualitativeGuide(view, guide)}
    <section class="player-full-section"><div class="player-section-heading"><span>${escapePlayerHtml(role)}</span><h2>Statistiche ruolo</h2></div>${roleStats(role, latest)}</section>
    ${guideSummary(guide)}
    <section class="player-full-section player-advanced"><div class="player-section-heading"><span>DETTAGLIO</span><h2>Statistiche avanzate</h2></div>${advancedStats(latest)}</section>
  </section>`
}

async function load(reference: string, actions: PlayerDetailActions): Promise<void> {
  if (loadingReference === reference) return
  loadingReference = reference; detailError = undefined
  try {
    await loadPlayersDataset()
    const selected = resolve(reference)
    if (!selected?.flda.player_id) return
    await Promise.all([loadPlayerDetail(selected.flda.player_id), loadTeamGuide(selected.flda.team)])
  } catch (error) { detailError = error instanceof Error ? error.message : 'Dati FLDA non disponibili.' }
  finally { loadingReference = null; actions.onRender() }
}

export function bindFullPlayerPage(reference: string | null, actions: PlayerDetailActions): void {
  document.querySelector('[data-player-detail-back]')?.addEventListener('click', actions.onBack)
  document.querySelector<HTMLElement>('[data-full-player-call]')?.addEventListener('click', (event) => { const id = (event.currentTarget as HTMLElement).dataset.fullPlayerCall; if (id) actions.onCallPlayer(id) })
  const selected = reference ? resolve(reference) : undefined
  if (reference && !getCachedPlayersDataset()) void load(reference, actions)
  else if (reference && selected?.flda.player_id && (!getCachedPlayerDetail(selected.flda.player_id) || !getCachedTeamGuide(selected.flda.team))) void load(reference, actions)
  document.addEventListener('mistercana:player-detail-load', () => { if (reference) void load(reference, actions) }, { once: true })
}
