import type { AppState } from '../app/state'
import type { FldaPlayer, FldaRecord } from '../services/flda'
import {
  getCachedPlayerDetail, getCachedPlayersDataset, getCachedTeamGuide,
  getFldaIdForLegacyId, getLegacyPlayer, getLegacyPlayerForFldaId,
  loadPlayerDetail, loadPlayersDataset, loadTeamGuide,
} from '../services/playerRepository'
import { getLegacyIdFromFldaId } from '../services/playerIdentity'
import { getAssignmentFldaId } from '../services/auctionPlayerResolver'
import {
  display, displayCount, escapePlayerHtml,
  field, latestHistory, renderCurrentMetrics,
  renderPerformanceChart, renderMatchdayChart, renderPlayerHead, renderHeatmap, renderCareer, renderSageSection, renderICaExplanation,
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
  // 12 indicatori per ruolo, stagione in corso
  const fields: Array<[string, string, 'count' | 'decimal']> = role === 'P'
    ? [['Gol subiti', 'gol_subiti', 'count'], ['Gol subiti/partita', 'goals_conceded_per_match', 'decimal'], ['Clean sheet', 'clean_sheet', 'count'], ['% clean sheet', 'clean_sheet_pct', 'decimal'],
       ['Parate', 'saves', 'count'], ['Parate/partita', 'saves_per_match', 'decimal'], ['% parate', 'saves_pct', 'decimal'], ['Parate in area', 'saves_inside_box', 'count'],
       ['Parate fuori area', 'saves_outside_box', 'count'], ['Rigori parati', 'rigori_parati', 'count'], ['Errori da gol', 'errors_to_goal', 'count'], ['Rating', 'rating', 'decimal']]
    : role === 'D'
      ? [['Gol', 'goals', 'count'], ['Assist', 'assist', 'count'], ['Contrasti/partita', 'tackles_per_match', 'decimal'], ['Intercetti/partita', 'interceptions_per_match', 'decimal'],
         ['Spazzate/partita', 'clearances_per_match', 'decimal'], ['Recuperi/partita', 'recuperi_per_match', 'decimal'], ['Duelli vinti/partita', 'duels_won_per_match', 'decimal'], ['Duelli aerei/partita', 'aerial_duels_per_match', 'decimal'],
         ['Tiri bloccati', 'blocked_shots', 'count'], ['Precisione passaggi %', 'accurate_passes_percentage', 'decimal'], ['Errori da gol', 'errors_to_goal', 'count'], ['Cartellini', 'cards', 'count']]
      : role === 'C'
        ? [['Gol', 'goals', 'count'], ['Assist', 'assist', 'count'], ['xG', 'xg', 'decimal'], ['xA', 'xa', 'decimal'],
           ['Passaggi chiave/partita', 'key_passes_per_match', 'decimal'], ['Occasioni create', 'big_chances_created', 'count'], ['Tiri/partita', 'shots_per_match', 'decimal'], ['Precisione passaggi %', 'accurate_passes_percentage', 'decimal'],
           ['% dribbling riusciti', 'dribbles_pct', 'decimal'], ['Palloni giocati/partita', 'touches_per_match', 'decimal'], ['Recuperi/partita', 'recuperi_per_match', 'decimal'], ['Cartellini', 'cards', 'count']]
        : [['Gol', 'goals', 'count'], ['Assist', 'assist', 'count'], ['xG', 'xg', 'decimal'], ['xG/partita', 'xg_per_match', 'decimal'],
           ['Tiri/partita', 'shots_per_match', 'decimal'], ['Tiri in porta/partita', 'shots_on_target_per_match', 'decimal'], ['% gol su tiri', 'goals_per_shot', 'decimal'], ['Occasioni mancate', 'big_chances_missed', 'count'],
           ['Gol di testa', 'headed_goals', 'count'], ['Rigori segnati', 'rigori_fatti', 'count'], ['Rigori guadagnati', 'penalties_won', 'count'], ['xA', 'xa', 'decimal']]
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
  return `<section class="player-full-section player-qualitative"><div class="player-section-heading"><span>Lettura editoriale</span><h2>Indicazioni qualitative</h2></div><div class="player-qualitative-grid">${present.map(([label, tone, items]) => `<article class="qualitative-${tone}"><h3>${label}</h3><ul>${items.map((item) => `<li>${escapePlayerHtml(item)}</li>`).join('')}</ul></article>`).join('')}</div></section>`
}

function guideSummary(guide?: FldaRecord): string {
  if (!guide) return ''
  const keyPoints = asTextList(field(guide, 'key_points'))
  return `<section class="player-full-section"><div class="player-section-heading"><span>Contesto squadra</span><h2>Guida</h2></div><div class="player-guide-summary"><div><span>Allenatore</span><strong>${display(field(guide, 'coach'))}</strong></div><div><span>Modulo</span><strong>${display(field(guide, 'module'))}</strong></div><div><span>Attacco</span><strong>${display(field(guide, 'attack'), 0)}</strong></div><div><span>Difesa</span><strong>${display(field(guide, 'defense'), 0)}</strong></div></div>${field(guide, 'comment') ? `<p>${display(field(guide, 'comment'))}</p>` : ''}${field(guide, 'sos_fanta_comment') ? `<p>${display(field(guide, 'sos_fanta_comment'))}</p>` : ''}${keyPoints.length ? `<ul>${keyPoints.map((item) => `<li>${escapePlayerHtml(item)}</li>`).join('')}</ul>` : ''}</section>`
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

const roleNames: Record<string, string> = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' }

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
  const assigned = Boolean(flda.player_id && state.auctionAssignments.some((item) => getAssignmentFldaId(item) === flda.player_id))
  const view: PlayerViewModel = { flda, legacy, legacyId, detail, guide, assigned, auctionLive: state.auctionPhase === 'live', identityAvailable: Boolean(flda.player_id), pmaConfiguration: state.pmaConfiguration, initialCredits: state.initialCredits }
  const latest = latestHistory(detail)
  // statistiche avanzate: la stagione scorsa, completa (quella in corso è ancora breve)
  const previousSeason = detail?.history?.[1]
  const roleName = roleNames[role] ?? role
  return `<section class="page player-full-page player-full-page-v3 player-tone-${role.toLowerCase()}">
    <div class="player-detail-shell player-full-shell">
    <button type="button" class="player-detail-close-button sheet-x" data-player-detail-back aria-label="Chiudi">×</button>
    <div class="player-detail-card player-quick-card player-full-card">
    ${renderPlayerHead(view)}
    ${!view.identityAvailable ? '<p class="player-data-alert">Dati FLDA non disponibili per questa identità.</p>' : ''}${detailError ? `<p class="player-data-alert">${escapePlayerHtml(detailError)}</p>` : ''}
    ${renderCurrentMetrics(view, false, displayHistoricalAuctionPrices(detail) ?? '')}
    <section class="player-full-section player-ica-section"><div class="player-section-heading"><span>Valutazione</span><h2>Perché questo iCà</h2></div>${renderICaExplanation(view)}</section>
    <section class="player-full-section"><div class="player-section-heading"><span>Prestazioni</span><h2>Come sta andando</h2></div>${latestKpis(role, latest)}</section>
    <div class="player-chart-grid"><section class="player-full-section player-heatmap-section"><div class="player-section-heading"><span>Posizione in campo</span><h2>Heatmap</h2></div>${renderHeatmap(flda.player_id)}</section><section class="player-full-section"><div class="player-section-heading"><span>Campionato · ultime 3 stagioni · FotMob</span><h2>Carriera</h2></div>${renderCareer(flda.player_id)}</section></div>
    <section class="player-full-section player-sage-section"><div class="player-section-heading"><span>Asta</span><h2>Prezzo e Saggi</h2></div>${renderSageSection(view)}</section>
    <section class="player-full-section player-matchdays"><div class="player-section-heading"><span>Stagione ${escapePlayerHtml(String(field(latest, 'season') ?? ''))}</span><h2>Andamento giornata per giornata</h2></div>${renderMatchdayChart(detail)}</section>
    <div class="player-chart-grid"><section class="player-full-section"><div class="player-section-heading"><span>Stagioni</span><h2>Storico MV / FMV</h2></div>${renderPerformanceChart(detail)}</section><section class="player-full-section"><div class="player-section-heading"><span>${escapePlayerHtml(roleName)} · stagione ${escapePlayerHtml(String(field(latest, 'season') ?? ''))}</span><h2>Statistiche ruolo</h2></div>${roleStats(role, latest)}</section></div>
    ${guideSummary(guide)}
    ${qualitativeGuide(view, guide)}
    <section class="player-full-section player-advanced"><div class="player-section-heading"><span>Stagione ${escapePlayerHtml(String(field(previousSeason, 'season') ?? 'precedente'))}</span><h2>Statistiche avanzate</h2></div>${advancedStats(previousSeason)}</section>
    </div>
    </div>
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

let detailLoadListening = false
let latestDetailLoad: () => void = () => {}

export function bindFullPlayerPage(reference: string | null, actions: PlayerDetailActions): void {
  document.querySelector('[data-player-detail-back]')?.addEventListener('click', actions.onBack)
  document.querySelector<HTMLElement>('[data-full-player-call]')?.addEventListener('click', (event) => { const id = (event.currentTarget as HTMLElement).dataset.fullPlayerCall; if (id) actions.onCallPlayer(id) })
  const selected = reference ? resolve(reference) : undefined
  if (reference && !getCachedPlayersDataset()) void load(reference, actions)
  else if (reference && selected?.flda.player_id && (!getCachedPlayerDetail(selected.flda.player_id) || !getCachedTeamGuide(selected.flda.team))) void load(reference, actions)
  latestDetailLoad = () => { if (reference) void load(reference, actions) }
  if (!detailLoadListening) {
    detailLoadListening = true
    document.addEventListener('mistercana:player-detail-load', () => { detailLoadListening = false; latestDetailLoad() }, { once: true })
  }
}
