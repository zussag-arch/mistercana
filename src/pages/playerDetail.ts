import type { AppState } from '../app/state'
import type { FldaFixtureContext, FldaPlayer, FldaRecord } from '../services/flda'
import {
  getCachedPlayerDetail, getCachedPlayersDataset, getCachedTeamFixtures,
  getCachedTeamGuide, getFldaIdForLegacyId, getLegacyPlayer,
  getLegacyPlayerForFldaId, loadPlayerDetail, loadPlayersDataset,
  loadTeamFixtures, loadTeamGuide,
} from '../services/playerRepository'
import { getLegacyIdFromFldaId } from '../services/playerIdentity'
import {
  auctionStatusLabel, display, escapePlayerHtml, field,
  renderCurrentMetrics, renderFixtures, renderHierarchies,
  renderHistory, renderSaggi,
} from '../components/playerDataView'
import type { PlayerViewModel } from '../components/playerDataView'

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

function roleStats(role: string, row?: FldaRecord): string {
  if (!row) return '<p class="player-data-empty">Statistiche non disponibili.</p>'
  const fields: Array<[string, string]> = role === 'P'
    ? [['Gol subiti','gol_subiti'],['Clean sheet','clean_sheet'],['Parate','saves'],['Rigori parati','rigori_parati']]
    : role === 'D'
      ? [['Gol','gol_fatti'],['Assist','assist'],['Ammonizioni','amm'],['Espulsioni','esp'],['Minuti/presenza','min_playing_time_per_match']]
      : role === 'C'
        ? [['Gol','gol_fatti'],['Assist','assist'],['Key passes','key_passes'],['Bonus/malus','bonus_malus'],['Minuti/presenza','min_playing_time_per_match']]
        : [['Gol','gol_fatti'],['Assist','assist'],['Tiri','total_shots'],['Tiri in porta','shots_on_target'],['xG','xg'],['Minuti/presenza','min_playing_time_per_match']]
  return `<div class="player-role-stats">${fields.map(([label,key]) => `<div><span>${label}</span><strong>${display(field(row,key), 2)}</strong></div>`).join('')}</div>`
}

function textList(value: unknown): string {
  if (!Array.isArray(value) || !value.length) return '<p class="player-data-empty">Nessun dato.</p>'
  return `<ul>${(value as FldaRecord[]).map((item) => `<li>${display(field(item,'text') ?? field(item,'role') ?? field(item,'name'))}</li>`).join('')}</ul>`
}

function guideSection(guide?: FldaRecord): string {
  if (!guide) return '<p class="player-data-empty">Guida squadra non disponibile.</p>'
  return `<div class="player-guide-summary"><div><span>Allenatore</span><strong>${display(field(guide,'coach'))}</strong></div><div><span>Modulo</span><strong>${display(field(guide,'module'))}</strong></div><div><span>Attacco</span><strong>${display(field(guide,'attack'),0)}</strong></div><div><span>Difesa</span><strong>${display(field(guide,'defense'),0)}</strong></div></div>
    <p>${display(field(guide,'comment'))}</p><p>${display(field(guide,'sos_fanta_comment'))}</p>
    <div class="player-guide-columns"><div><h4>Up</h4>${textList(field(guide,'up'))}</div><div><h4>Down</h4>${textList(field(guide,'down'))}</div><div><h4>Hidden</h4>${textList(field(guide,'hidden'))}</div><div><h4>Punti chiave</h4>${textList(field(guide,'key_points'))}</div><div><h4>Ruoli chiave</h4>${textList(field(guide,'key_roles'))}</div><div><h4>Ballottaggi</h4>${textList(field(guide,'competitions'))}</div></div>`
}

function advancedStats(row?: FldaRecord): string {
  if (!row) return '<p class="player-data-empty">Statistiche avanzate non disponibili.</p>'
  const keys = ['mv_5','fmv_5','presenze_5','starts_eleven_5','perc_match_with_bonus','perc_match_over_6','perc_match_over_6_half','perc_match_with_vote','total_shots','shots_on_target','key_passes','accurate_passes','accurate_passes_percentage','tackles','duels_won','fouls','recuperi_per_match','rating','xg','xa','shots_per_match','key_passes_per_match','saves_per_match']
  return `<div class="player-advanced-grid">${keys.filter((key) => field(row,key) !== null && field(row,key) !== undefined).map((key) => `<div><span>${escapePlayerHtml(key.replaceAll('_',' '))}</span><strong>${display(field(row,key),2)}</strong></div>`).join('')}</div>`
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
  const context: FldaFixtureContext | undefined = role === 'P' ? 'goalkeeper' : role === 'A' ? 'attacker' : undefined
  const fixtures = context ? getCachedTeamFixtures(flda.team, context) : undefined
  const assigned = Boolean(legacyId && state.auctionAssignments.some((item) => item.playerId === legacyId))
  const view: PlayerViewModel = { flda, legacy, legacyId, detail, guide, fixtures, assigned, auctionLive: state.auctionPhase === 'live', identityAvailable: Boolean(flda.player_id && legacyId) }
  const latest = detail?.history?.[0]
  return `<section class="page player-full-page">
    <header class="player-full-header"><button type="button" data-player-detail-back>← Giocatori</button><div><span class="player-detail-role player-detail-role-${role.toLowerCase()}">${escapePlayerHtml(role)}</span><div><small>SCHEDA GIOCATORE</small><h1>${escapePlayerHtml(flda.name)}</h1><p>${escapePlayerHtml(flda.team)} · ${auctionStatusLabel(view)}</p></div></div>${legacyId ? `<button type="button" data-full-player-call="${escapePlayerHtml(legacyId)}" ${state.auctionPhase === 'live' && !assigned ? '' : 'disabled'}>${assigned ? 'ASSEGNATO' : 'CHIAMA'}</button>` : ''}</header>
    ${renderCurrentMetrics(view)}
    ${!view.identityAvailable ? '<p class="player-data-alert">Dati FLDA non disponibili per questa identità.</p>' : ''}${detailError ? `<p class="player-data-alert">${escapePlayerHtml(detailError)}</p>` : ''}
    <section class="player-full-section"><h2>Panoramica</h2>${roleStats(role, latest)}</section>
    <section class="player-full-section"><h2>Storico</h2>${renderHistory(detail,true)}</section>
    <section class="player-full-section"><h2>Squadra / Guida</h2>${guideSection(guide)}</section>
    <section class="player-full-section"><h2>Gerarchie</h2>${renderHierarchies(detail)}</section>
    <section class="player-full-section"><h2>Saggi</h2>${renderSaggi(detail,true)}</section>
    <section class="player-full-section"><h2>Calendario</h2>${context ? renderFixtures(fixtures,38) : '<p class="player-data-empty">Calendario specifico non disponibile per questo ruolo.</p>'}</section>
    <details class="player-full-section"><summary>Statistiche avanzate</summary>${advancedStats(latest)}</details>
  </section>`
}

async function load(reference: string, actions: PlayerDetailActions): Promise<void> {
  if (loadingReference === reference) return
  loadingReference = reference; detailError = undefined
  try {
    await loadPlayersDataset()
    const selected = resolve(reference)
    if (!selected?.flda.player_id) return
    const tasks: Promise<unknown>[] = [loadPlayerDetail(selected.flda.player_id), loadTeamGuide(selected.flda.team)]
    const role = selected.flda.role.toUpperCase()
    if (role === 'P' || role === 'A') tasks.push(loadTeamFixtures(selected.flda.team, role === 'P' ? 'goalkeeper' : 'attacker'))
    await Promise.all(tasks)
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
