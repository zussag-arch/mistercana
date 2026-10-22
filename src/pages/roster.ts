// La mia rosa: la tua squadra di lega, la formazione consigliata per la
// prossima giornata e lo stato di ogni giocatore (forma, avversario, probabili).
import {
  evaluatePick, leagueTeams, nextMatchday, suggestLineup, teamRoster,
} from '../data/roster'
import type { League, MatchdayPick } from '../data/roster'
import { getICaV3 } from '../data/icaV3Data'
import { getCachedPlayersDataset } from '../services/playerRepository'
import { display, escapePlayerHtml } from '../components/playerDataView'

const CHOICE_KEY = 'mistercana_my_roster_v1'
const LEAGUE_LABEL: Record<League, string> = { SERIE_A: 'Serie A', SERIE_B: 'Serie B' }

interface Choice { league: League; team: string }

function loadChoice(): Choice | null {
  try {
    const raw = window.localStorage.getItem(CHOICE_KEY)
    const parsed = raw ? JSON.parse(raw) as Choice : null
    return parsed && leagueTeams(parsed.league).includes(parsed.team) ? parsed : null
  } catch {
    return null
  }
}

function saveChoice(choice: Choice): void {
  try { window.localStorage.setItem(CHOICE_KEY, JSON.stringify(choice)) } catch { /* solo comodità */ }
}

let league: League = loadChoice()?.league ?? 'SERIE_A'

function formDots(values: Array<number | null>): string {
  if (!values.length) return '<span class="roster-form-empty">—</span>'
  return `<span class="roster-form">${values.map((value) => {
    if (typeof value !== 'number') return '<i class="sv" title="senza voto">sv</i>'
    const tone = value >= 7 ? 'great' : value >= 6 ? 'good' : value >= 5.5 ? 'ok' : 'bad'
    return `<i class="${tone}" title="${display(value, 1)}">${display(value, 1)}</i>`
  }).join('')}</span>`
}

function statusChip(pick: MatchdayPick): string {
  const p = pick.probable
  if (p?.injured) return `<span class="roster-chip bad" title="${escapePlayerHtml(p.note)}">infortunato</span>`
  if (p?.suspended) return '<span class="roster-chip bad">squalificato</span>'
  if (p?.unavailable) return `<span class="roster-chip bad" title="${escapePlayerHtml(p.note)}">indisponibile</span>`
  if (p?.doubtful) return `<span class="roster-chip warn" title="${escapePlayerHtml(p.note)}">in dubbio</span>`
  if (p?.warned) return '<span class="roster-chip warn">diffidato</span>'
  return ''
}

function opponent(pick: MatchdayPick): string {
  const p = pick.probable
  if (!p?.opponent) return '<span class="roster-muted">—</span>'
  return `<span class="roster-opponent">${p.home ? 'vs' : '@'} ${escapePlayerHtml(p.opponent)}</span>`
}

function probability(pick: MatchdayPick): string {
  const value = Math.round(pick.probability * 100)
  const tone = pick.out ? 'out' : value >= 75 ? 'high' : value >= 50 ? 'mid' : 'low'
  return `<span class="roster-prob ${tone}"><b style="width:${value}%"></b><em>${value}%</em></span>`
}

function pickRow(pick: MatchdayPick, highlight = false): string {
  const ica = getICaV3(pick.player.player_id)?.score
  return `<button type="button" class="roster-row${highlight ? ' starter' : ''}${pick.out ? ' out' : ''}" data-player-ref="${escapePlayerHtml(pick.player.player_id ?? '')}">
    <span class="role-badge role-${pick.player.role.toLowerCase()}">${pick.player.role}</span>
    <span class="roster-name"><strong>${escapePlayerHtml(pick.player.name)}</strong><small>${escapePlayerHtml(pick.player.team)} · ${opponent(pick)}</small></span>
    <span class="roster-cell" data-label="Forma">${formDots(pick.recent)}</span>
    <span class="roster-cell" data-label="Titolare">${probability(pick)}</span>
    <span class="roster-cell roster-ica" data-label="iCà">${display(ica, 1)}</span>
    <span class="roster-cell roster-expected" data-label="Attesi">${display(pick.expected, 1)}</span>
    <span class="roster-status">${statusChip(pick)}${pick.reasons.filter((reason) => !['infortunato', 'squalificato', 'indisponibile', 'in dubbio'].includes(reason)).slice(0, 2).map((reason) => `<span class="roster-reason">${escapePlayerHtml(reason)}</span>`).join('')}</span>
  </button>`
}

export function renderRosterPage(): string {
  const choice = loadChoice()
  const teams = leagueTeams(league)
  const dataset = getCachedPlayersDataset()
  const selector = `
    <div class="roster-picker">
      <div class="roster-league" role="tablist">${(['SERIE_A', 'SERIE_B'] as League[]).map((item) => `<button type="button" data-roster-league="${item}" aria-selected="${item === league}">${LEAGUE_LABEL[item]}</button>`).join('')}</div>
      <select class="roster-team" data-roster-team aria-label="La mia squadra">
        <option value="">Scegli la tua squadra…</option>
        ${teams.map((team) => `<option value="${escapePlayerHtml(team)}" ${choice?.league === league && choice.team === team ? 'selected' : ''}>${escapePlayerHtml(team)}</option>`).join('')}
      </select>
    </div>`

  if (!choice || choice.league !== league) {
    return `<section class="page roster-page">
      <header class="roster-header"><h1>La mia rosa</h1><p>Scegli lega e squadra: l'app ricorda la scelta.</p></header>
      ${selector}
    </section>`
  }
  if (!dataset || dataset.source !== 'flda') {
    return `<section class="page roster-page"><header class="roster-header"><h1>La mia rosa</h1></header>${selector}<div class="players-loading">Caricamento giocatori…</div></section>`
  }

  const byId = new Map(dataset.players.map((player) => [player.player_id, player]))
  const picks = teamRoster(choice.league, choice.team)
    .flatMap((entry) => { const player = byId.get(entry.playerId); return player ? [evaluatePick(player, entry.price)] : [] })
  const lineup = suggestLineup(picks)
  const day = nextMatchday()
  const spent = picks.reduce((sum, pick) => sum + pick.price, 0)
  const starters = new Set(lineup?.starters ?? [])
  const byRole = (role: string) => picks.filter((pick) => pick.player.role === role).sort((a, b) => b.expected - a.expected)

  return `<section class="page roster-page">
    <header class="roster-header">
      <div><h1>${escapePlayerHtml(choice.team)}</h1><p>${LEAGUE_LABEL[choice.league]} · ${picks.length} giocatori · ${spent} crediti spesi</p></div>
    </header>
    ${selector}
    <section class="roster-section">
      <div class="roster-section-head"><h2>Formazione consigliata</h2><span>${day ? `giornata ${day}` : 'prossima giornata'}${lineup ? ` · ${lineup.module} · ${display(lineup.total, 1)} fantapunti attesi` : ''}</span></div>
      ${lineup ? `
        <div class="roster-list">${lineup.starters.map((pick) => pickRow(pick, true)).join('')}</div>
        <h3 class="roster-bench-title">Panchina</h3>
        <div class="roster-list">${lineup.bench.map((pick) => pickRow(pick)).join('')}</div>
        <p class="roster-note">Attesi = fantapunti stimati nella partita: fantamedia (iCà) e forma delle ultime 5, avversario, casa/trasferta, × probabilità di giocare dalle formazioni probabili.</p>`
      : '<p class="roster-note">Rosa incompleta: servono almeno 1 portiere, 3 difensori, 3 centrocampisti e 1 attaccante.</p>'}
    </section>
    <section class="roster-section">
      <div class="roster-section-head"><h2>Rosa per reparto</h2><span>forma ultime 5 giornate</span></div>
      ${['P', 'D', 'C', 'A'].map((role) => `<div class="roster-list">${byRole(role).map((pick) => pickRow(pick, starters.has(pick))).join('')}</div>`).join('')}
    </section>
  </section>`
}

export interface RosterActions {
  onRender: () => void
  onOpenPlayer: (reference: string) => void
}

export function bindRosterEvents(actions: RosterActions): void {
  document.querySelectorAll<HTMLButtonElement>('[data-roster-league]').forEach((button) => button.addEventListener('click', () => {
    league = button.dataset.rosterLeague === 'SERIE_B' ? 'SERIE_B' : 'SERIE_A'
    actions.onRender()
  }))
  document.querySelector<HTMLSelectElement>('[data-roster-team]')?.addEventListener('change', (event) => {
    const team = (event.currentTarget as HTMLSelectElement).value
    if (team) saveChoice({ league, team })
    actions.onRender()
  })
  document.querySelectorAll<HTMLElement>('.roster-row[data-player-ref]').forEach((row) => row.addEventListener('click', () => {
    if (row.dataset.playerRef) actions.onOpenPlayer(row.dataset.playerRef)
  }))
}
