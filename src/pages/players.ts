import type { AppState } from '../app/state'
import { runOverlayExit } from '../app/motion'
import type { Player, PlayerRole } from '../domain/player'
import type { FldaPlayer } from '../services/flda'
import {
  findLegacyPlayerByIdentity, getCachedPlayerDetail, getCachedPlayersDataset,
  getFldaIdForLegacyId, getLegacyPlayer, getLegacyPlayerForFldaId,
  loadPlayerDetail, loadPlayersDataset,
} from '../services/playerRepository'
import { getLegacyIdFromFldaId } from '../services/playerIdentity'
import { renderPlayerDetailOverlay } from '../components/playerDetailOverlay'
import type { PlayerViewModel } from '../components/playerDataView'
import { auctionStatusClass, display, escapePlayerHtml, icaHue, renderPlayerBadges } from '../components/playerDataView'
import { getFldaPma } from '../domain/pma'

type RoleFilter = 'ALL' | PlayerRole
type SortKey = 'default' | 'name' | 'team' | 'fm_exp' | 'titolarita_display' | 'mv_fmv' | 'ica' | 'status'

interface PlayersActions {
  onRender: () => void
  onCallPlayer: (legacyId: string) => void
  onGoToAuction: () => void
  onOpenFullPlayer: (reference: string) => void
}

const viewState = {
  role: 'ALL' as RoleFilter,
  team: 'ALL',
  freeOnly: false,
  startingXi: false,
  goalkeeperOne: false,
  penalty: false,
  freeKick: false,
  corner: false,
  search: '',
  sortKey: 'default' as SortKey,
  sortDirection: 'desc' as 'asc' | 'desc',
}

let loadingBulk = false
let previewReference: string | null = null
let previewLoading = false
let previewError: string | undefined

function legacyReference(id: string): string { return `legacy:${id}` }
function fldaReference(player: FldaPlayer): string {
  return player.player_id || legacyReference(findLegacy(player)?.id ?? '')
}
function findLegacy(player: FldaPlayer): Player | undefined {
  return player.player_id
    ? getLegacyPlayerForFldaId(player.player_id)
    : findLegacyPlayerByIdentity(player)
}
function legacyIdFor(player: FldaPlayer): string | undefined {
  return player.player_id ? getLegacyIdFromFldaId(player.player_id) : findLegacy(player)?.id
}
function isAssigned(state: AppState, legacyId?: string): boolean {
  return Boolean(legacyId && state.auctionAssignments.some((item) => item.playerId === legacyId))
}
function statusValue(state: AppState, player: FldaPlayer): number {
  const legacyId = legacyIdFor(player)
  if (!legacyId) return -1
  if (state.auctionPhase !== 'live') return 0
  return isAssigned(state, legacyId) ? 1 : 2
}
function statusLabel(state: AppState, player: FldaPlayer): string {
  const legacyId = legacyIdFor(player)
  if (!legacyId) return 'NON ASSOCIATO'
  if (state.auctionPhase !== 'live') return 'NO LIVE'
  return isAssigned(state, legacyId) ? 'ASSEGNATO' : 'DA ASSEGNARE'
}
function numeric(value: unknown): number { return typeof value === 'number' ? value : -Infinity }

function filteredPlayers(state: AppState, source: FldaPlayer[]): FldaPlayer[] {
  const query = viewState.search.trim().toLocaleLowerCase('it')
  return source.filter((player) => {
    if (viewState.role !== 'ALL' && player.role !== viewState.role) return false
    if (viewState.team !== 'ALL' && player.team !== viewState.team) return false
    if (viewState.freeOnly && state.auctionPhase === 'live' && statusValue(state, player) !== 2) return false
    if (viewState.startingXi && !player.is_starting_xi) return false
    if (viewState.goalkeeperOne && player.goalkeeper_rank !== 1) return false
    if (viewState.penalty && !player.penalty_rank) return false
    if (viewState.freeKick && !player.free_kick_rank) return false
    if (viewState.corner && !player.corner_rank) return false
    return !query || `${player.name} ${player.team}`.toLocaleLowerCase('it').includes(query)
  }).sort((a, b) => {
    if (viewState.sortKey === 'default') {
      const roleOrder = ['P', 'D', 'C', 'A']
      const roleResult = roleOrder.indexOf(a.role.toUpperCase()) - roleOrder.indexOf(b.role.toUpperCase())
      if (roleResult) return roleResult
      return numeric(findLegacy(b)?.iCa) - numeric(findLegacy(a)?.iCa)
    }
    let first: string | number
    let second: string | number
    if (viewState.sortKey === 'status') {
      first = statusValue(state, a); second = statusValue(state, b)
    } else if (viewState.sortKey === 'ica') {
      first = numeric(findLegacy(a)?.iCa); second = numeric(findLegacy(b)?.iCa)
    } else if (viewState.sortKey === 'mv_fmv') {
      first = numeric(findLegacy(a)?.fmv ?? findLegacy(a)?.mv)
      second = numeric(findLegacy(b)?.fmv ?? findLegacy(b)?.mv)
    } else if (viewState.sortKey === 'name' || viewState.sortKey === 'team') {
      first = a[viewState.sortKey]; second = b[viewState.sortKey]
    } else {
      first = numeric(a[viewState.sortKey])
      second = numeric(b[viewState.sortKey])
    }
    const result = typeof first === 'number' && typeof second === 'number'
      ? first - second
      : String(first).localeCompare(String(second), 'it')
    return viewState.sortDirection === 'asc' ? result : -result
  })
}

function playerForOverlay(reference: string, bulk: FldaPlayer[]): { flda: FldaPlayer; legacy?: Player } | undefined {
  if (reference.startsWith('legacy:')) {
    const legacy = getLegacyPlayer(reference.slice(7))
    if (!legacy) return undefined
    const fldaId = getFldaIdForLegacyId(legacy.id)
    const flda = bulk.find((item) => item.player_id === fldaId) ?? {
      player_id: null, name: legacy.name, team: legacy.team, role: legacy.role,
      fm_exp: legacy.fmv ?? null, integrita: null,
      titolarita_display: legacy.startingProbability ?? null,
    }
    return { flda, legacy }
  }
  const flda = bulk.find((item) => item.player_id === reference)
  return flda ? { flda, legacy: findLegacy(flda) } : undefined
}

function renderOverlay(state: AppState, bulk: FldaPlayer[]): string {
  if (!previewReference) return ''
  const selected = playerForOverlay(previewReference, bulk)
  if (!selected) return ''
  const legacyId = selected.legacy?.id
  const fldaId = selected.flda.player_id ?? undefined
  const view: PlayerViewModel = {
    flda: selected.flda, legacy: selected.legacy, legacyId,
    assigned: isAssigned(state, legacyId), auctionLive: state.auctionPhase === 'live',
    identityAvailable: Boolean(fldaId && legacyId),
    pmaConfiguration: state.pmaConfiguration,
    detail: fldaId ? getCachedPlayerDetail(fldaId) : undefined,
  }
  const shell: Player = selected.legacy ?? {
    id: '', name: selected.flda.name, team: selected.flda.team,
    role: selected.flda.role.toUpperCase() as PlayerRole, penaltyTaker: false, status: 'free',
  }
  return renderPlayerDetailOverlay(shell, view.assigned, state.auctionPhase === 'live', {
    view, loading: previewLoading, error: previewError,
  })
}

function renderRow(state: AppState, player: FldaPlayer): string {
  const legacy = findLegacy(player)
  const status = statusLabel(state, player)
  const legacyId = legacyIdFor(player)
  const view: PlayerViewModel = {
    flda: player, legacy, legacyId,
    detail: player.player_id ? getCachedPlayerDetail(player.player_id) : undefined,
    assigned: isAssigned(state, legacyId), auctionLive: state.auctionPhase === 'live',
    identityAvailable: Boolean(player.player_id && legacyId),
    pmaConfiguration: state.pmaConfiguration,
  }
  const pma = getFldaPma(player, state.pmaConfiguration)
  return `<button type="button" class="players-table-row" data-player-ref="${escapePlayerHtml(fldaReference(player))}">
    <div class="players-player-cell"><span class="role-badge role-${player.role.toLowerCase()}">${escapePlayerHtml(player.role)}</span><span><span class="players-name-line"><strong>${escapePlayerHtml(player.name)}</strong>${renderPlayerBadges(view)}</span><small>${escapePlayerHtml(player.team)}</small></span></div>
    <div data-label="iCà"><span class="players-ica" style="--ica-hue:${icaHue(legacy?.iCa)}">${display(legacy?.iCa, 1)}</span></div>
    <div data-label="PMA">${typeof pma === 'number' ? `${display(pma, 1)}%` : '—'}</div>
    <div data-label="xFM">${display(player.fm_exp, 2)}</div>
    <div data-label="Titolarità">${display(player.titolarita_display, 0)}${typeof player.titolarita_display === 'number' ? '%' : ''}</div>
    <div data-label="MV/FMV"><span class="players-dual-value">${display(legacy?.mv, 2)} <small>/</small> ${display(legacy?.fmv, 2)}</span></div>
    <div data-label="Stato"><span class="player-status player-status-${auctionStatusClass(view)}">${status}</span></div>
  </button>`
}

function sortButton(label: string, key: SortKey): string {
  const active = viewState.sortKey === key
  return `<button type="button" data-player-sort="${key}">${label}${active ? (viewState.sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</button>`
}

export function renderPlayersPage(state: AppState): string {
  const dataset = getCachedPlayersDataset()
  if (!dataset && !loadingBulk) {
    loadingBulk = true
    window.setTimeout(() => void loadPlayersDataset().then(() => {
      loadingBulk = false
      document.dispatchEvent(new CustomEvent('mistercana:players-loaded'))
    }), 0)
  }
  const source = dataset?.players ?? []
  const rows = filteredPlayers(state, source)
  const teams = [...new Set(source.map((item) => item.team))].sort((a, b) => a.localeCompare(b, 'it'))
  if (state.auctionPhase !== 'live') viewState.freeOnly = false
  const activeFilters = [viewState.freeOnly, viewState.startingXi, viewState.goalkeeperOne, viewState.penalty, viewState.freeKick, viewState.corner].filter(Boolean).length

  return `<section class="page players-page">
    <div class="players-page-header"><div><span class="players-eyebrow">DATABASE FLDA</span><h1>Giocatori</h1><p><span data-players-count>${rows.length}</span> di ${source.length}</p></div><button id="playersGoToAuctionButton" class="players-auction-nav-button" ${state.auctionPhase === 'live' ? '' : 'disabled'}>Asta</button></div>
    <div class="players-toolbar">
      <div class="players-role-filter">${(['ALL','P','D','C','A'] as RoleFilter[]).map((role) => `<button type="button" data-player-role="${role}" class="players-filter-button ${viewState.role === role ? 'selected' : ''}">${role === 'ALL' ? 'Tutti' : role}</button>`).join('')}</div>
      <details class="players-team-filter"><summary aria-label="Seleziona squadra">${viewState.team === 'ALL' ? 'Tutte' : escapePlayerHtml(viewState.team)}</summary><div class="auction-team-selector" role="group" aria-label="Filtra per squadra"><button type="button" class="auction-team-choice ${viewState.team === 'ALL' ? 'selected' : ''}" data-player-team="ALL">Tutte</button>${teams.map((team) => `<button type="button" class="auction-team-choice ${viewState.team === team ? 'selected' : ''}" data-player-team="${escapePlayerHtml(team)}">${escapePlayerHtml(team)}</button>`).join('')}</div></details>
      <details class="players-filters"><summary aria-label="Apri filtri giocatori">Filtri${activeFilters ? ` (${activeFilters})` : ''}</summary><div class="players-filter-menu">
        <label><input data-player-filter="freeOnly" type="checkbox" ${viewState.freeOnly ? 'checked' : ''} ${state.auctionPhase === 'live' ? '' : 'disabled'}> Solo liberi</label>
        <label><input data-player-filter="startingXi" type="checkbox" ${viewState.startingXi ? 'checked' : ''}> Titolare XI</label>
        <label><input data-player-filter="goalkeeperOne" type="checkbox" ${viewState.goalkeeperOne ? 'checked' : ''}> P1</label>
        <label><input data-player-filter="penalty" type="checkbox" ${viewState.penalty ? 'checked' : ''}> Rigorista</label>
        <label><input data-player-filter="freeKick" type="checkbox" ${viewState.freeKick ? 'checked' : ''}> Punizioni</label>
        <label><input data-player-filter="corner" type="checkbox" ${viewState.corner ? 'checked' : ''}> Corner</label>
        <button type="button" id="clearPlayerFilters" ${activeFilters ? '' : 'disabled'}>Azzera filtri</button>
      </div></details>
      <input id="playersSearch" type="search" value="${escapePlayerHtml(viewState.search)}" placeholder="Cerca nome o squadra…" aria-label="Cerca giocatore per nome o squadra">
      ${dataset?.source === 'legacy' ? '<button id="retryPlayers" type="button">Riprova</button>' : ''}
    </div>
    ${dataset?.source === 'legacy' ? `<div class="players-source-warning">FLDA non raggiungibile. Fallback legacy attivo. ${escapePlayerHtml(dataset.error)}</div>` : ''}
    ${!dataset ? '<div class="players-loading">Caricamento giocatori FLDA…</div>' : `<div class="players-table-card"><div class="players-table-header"><span>Giocatore</span>${sortButton('iCà','ica')}<span>PMA</span>${sortButton('xFM','fm_exp')}${sortButton('Titolarità','titolarita_display')}${sortButton('MV/FMV','mv_fmv')}${sortButton('Stato','status')}</div><div class="players-table-body">${rows.map((player) => renderRow(state, player)).join('') || '<div class="players-empty">Nessun giocatore corrisponde ai filtri.</div>'}</div></div>`}
    <div class="players-footer-info"><span><span data-players-count>${rows.length}</span> giocatori</span><span>${dataset?.source === 'flda' ? 'Fonte FLDA' : 'Fonte legacy'}</span></div>
    ${renderOverlay(state, source)}
  </section>`
}

function refreshPlayerResults(state: AppState, actions: PlayersActions): void {
  const source = getCachedPlayersDataset()?.players ?? []
  const rows = filteredPlayers(state, source)
  const body = document.querySelector<HTMLElement>('.players-table-body')
  if (body) body.innerHTML = rows.map((player) => renderRow(state, player)).join('') || '<div class="players-empty">Nessun giocatore corrisponde ai filtri.</div>'
  document.querySelectorAll<HTMLElement>('[data-players-count]').forEach((item) => { item.textContent = String(rows.length) })
  bindPlayerRows(state, actions)
}

function refreshFilterControls(): void {
  const active = [viewState.freeOnly, viewState.startingXi, viewState.goalkeeperOne, viewState.penalty, viewState.freeKick, viewState.corner].filter(Boolean).length
  const summary = document.querySelector<HTMLElement>('.players-filters > summary')
  if (summary) summary.textContent = `Filtri${active ? ` (${active})` : ''}`
  const clear = document.querySelector<HTMLButtonElement>('#clearPlayerFilters')
  if (clear) clear.disabled = active === 0
}

function bindPlayerRows(_state: AppState, actions: PlayersActions): void {
  document.querySelectorAll<HTMLElement>('[data-player-ref]').forEach((row) => row.addEventListener('click', () => {
    const ref = row.dataset.playerRef
    if (!ref) return
    previewReference = ref
    actions.onRender()
    void loadPreview(ref, actions)
  }))
}

async function loadPreview(reference: string, actions: PlayersActions): Promise<void> {
  const dataset = getCachedPlayersDataset()
  const selected = dataset ? playerForOverlay(reference, dataset.players) : undefined
  const fldaId = selected?.flda.player_id
  if (!selected || !fldaId) return
  previewLoading = true; previewError = undefined; actions.onRender()
  try {
    await loadPlayerDetail(fldaId)
  } catch (error) {
    previewError = error instanceof Error ? error.message : 'Dati FLDA non disponibili.'
  } finally {
    if (previewReference === reference) { previewLoading = false; actions.onRender() }
  }
}

export function bindPlayersEvents(state: AppState, actions: PlayersActions): void {
  document.addEventListener('mistercana:players-loaded', actions.onRender, { once: true })
  document.querySelector('#playersGoToAuctionButton')?.addEventListener('click', actions.onGoToAuction)
  document.querySelectorAll<HTMLElement>('[data-player-role]').forEach((button) => button.addEventListener('click', () => { viewState.role = button.dataset.playerRole as RoleFilter; actions.onRender() }))
  document.querySelectorAll<HTMLButtonElement>('[data-player-team]').forEach((button) => button.addEventListener('click', () => {
    viewState.team = button.dataset.playerTeam ?? 'ALL'
    document.querySelectorAll<HTMLElement>('[data-player-team]').forEach((item) => item.classList.toggle('selected', item.dataset.playerTeam === viewState.team))
    const summary = document.querySelector<HTMLElement>('.players-team-filter > summary')
    if (summary) summary.textContent = viewState.team === 'ALL' ? 'Tutte' : viewState.team
    document.querySelector<HTMLDetailsElement>('.players-team-filter')?.removeAttribute('open')
    refreshPlayerResults(state, actions)
  }))
  document.querySelectorAll<HTMLInputElement>('[data-player-filter]').forEach((input) => input.addEventListener('change', () => { const key = input.dataset.playerFilter as 'freeOnly' | 'startingXi' | 'goalkeeperOne' | 'penalty' | 'freeKick' | 'corner'; viewState[key] = input.checked; refreshFilterControls(); refreshPlayerResults(state, actions) }))
  document.querySelector('#clearPlayerFilters')?.addEventListener('click', () => { viewState.freeOnly = false; viewState.startingXi = false; viewState.goalkeeperOne = false; viewState.penalty = false; viewState.freeKick = false; viewState.corner = false; document.querySelectorAll<HTMLInputElement>('[data-player-filter]').forEach((input) => { input.checked = false }); refreshFilterControls(); refreshPlayerResults(state, actions) })
  document.querySelector<HTMLInputElement>('#playersSearch')?.addEventListener('input', (event) => { viewState.search = (event.currentTarget as HTMLInputElement).value; refreshPlayerResults(state, actions) })
  document.querySelector('#retryPlayers')?.addEventListener('click', () => { loadingBulk = true; void loadPlayersDataset(true).then(() => { loadingBulk = false; actions.onRender() }) })
  document.querySelectorAll<HTMLElement>('[data-player-sort]').forEach((button) => button.addEventListener('click', () => { const key = button.dataset.playerSort as SortKey; if (viewState.sortKey === key) viewState.sortDirection = viewState.sortDirection === 'asc' ? 'desc' : 'asc'; else { viewState.sortKey = key; viewState.sortDirection = key === 'name' || key === 'team' ? 'asc' : 'desc' } actions.onRender() }))
  bindPlayerRows(state, actions)
  const close = () => runOverlayExit('#playerDetailOverlay', () => { previewReference = null; previewError = undefined; actions.onRender() })
  document.querySelectorAll('[data-close-player-detail]').forEach((item) => item.addEventListener('click', close))
  document.querySelector<HTMLElement>('[data-player-detail-call]')?.addEventListener('click', (event) => { const id = (event.currentTarget as HTMLElement).dataset.playerDetailCall; if (id) actions.onCallPlayer(id) })
  document.querySelector<HTMLElement>('[data-open-full-player]')?.addEventListener('click', (event) => { const ref = (event.currentTarget as HTMLElement).dataset.openFullPlayer; if (ref) { previewReference = null; actions.onOpenFullPlayer(ref) } })
  const dialog = document.querySelector<HTMLElement>('.player-quick-card')
  dialog?.focus()
  dialog?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close()
    if (event.key === 'Tab') {
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')]
      if (!focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  })
}
