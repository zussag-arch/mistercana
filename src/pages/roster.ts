// La mia rosa: campetto con la formazione consigliata della prossima giornata,
// panchina, infermeria. I dettagli di ogni giocatore stanno in un riquadro che
// compare passando sopra (o toccando) il suo pallino.
import {
  evaluatePick, infirmary, leagueTeams, nextMatchday, suggestLineup, teamRoster,
} from '../data/roster'
import type { League, MatchdayPick, Probable } from '../data/roster'
import { getICa } from '../data/ica'
import { getCachedPlayersDataset } from '../services/playerRepository'
import { display, escapePlayerHtml } from '../components/playerDataView'
import type { FldaPlayer } from '../services/flda'

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
// dati dei pallini per il riquadro, ricostruiti a ogni disegno della pagina
let picksById = new Map<string, MatchdayPick>()
let hidePopOnScroll: () => void = () => {}
let scrollListenerReady = false

/* ---------- pezzi del riquadro ---------- */

function formDots(values: Array<number | null>): string {
  if (!values.length) return '<span class="roster-form-empty">—</span>'
  return `<span class="roster-form">${values.map((value) => {
    if (typeof value !== 'number') return '<i class="sv" title="senza voto">sv</i>'
    const tone = value >= 7 ? 'great' : value >= 6 ? 'good' : value >= 5.5 ? 'ok' : 'bad'
    return `<i class="${tone}">${display(value, 1)}</i>`
  }).join('')}</span>`
}

function statusLabel(p?: Probable): { text: string; tone: 'bad' | 'warn' } | undefined {
  if (!p) return undefined
  if (p.injured) return { text: 'infortunato', tone: 'bad' }
  if (p.suspended) return { text: 'squalificato', tone: 'bad' }
  if (p.unavailable) return { text: 'indisponibile', tone: 'bad' }
  if (p.doubtful) return { text: 'in dubbio', tone: 'warn' }
  if (p.warned) return { text: 'diffidato', tone: 'warn' }
  return undefined
}

function returnText(p: Probable, day?: number): string {
  if (!p.returnDay) return ''
  if (day && p.returnDay <= day) return 'rientro previsto questa giornata'
  return `rientro previsto: ${p.returnDay}ª giornata${day ? ` (tra ${p.returnDay - day})` : ''}`
}

function renderPopover(pick: MatchdayPick): string {
  const p = pick.probable
  const status = statusLabel(p)
  const ica = getICa(pick.player.player_id)?.score
  const prob = Math.round(pick.probability * 100)
  return `<button type="button" class="roster-pop-close" data-roster-close aria-label="Chiudi">×</button>
    <div class="roster-pop-head">
      <span class="role-badge role-${pick.player.role.toLowerCase()}">${pick.player.role}</span>
      <div><strong>${escapePlayerHtml(pick.player.name)}</strong><small>${escapePlayerHtml(pick.player.team)}${p?.opponent ? ` · ${p.home ? 'vs' : '@'} ${escapePlayerHtml(p.opponent)}` : ''}</small></div>
    </div>
    ${status ? `<p class="roster-pop-status ${status.tone}"><b>${status.text}</b>${p?.note ? ` · ${escapePlayerHtml(p.note)}` : ''}${p ? ` ${returnText(p, nextMatchday())}` : ''}</p>` : ''}
    <div class="roster-pop-grid">
      <div><span>Attesi</span><strong class="accent">${display(pick.expected, 1)}</strong></div>
      <div><span>iCà</span><strong>${display(ica, 1)}</strong></div>
      <div><span>Titolare</span><strong>${prob}%</strong></div>
      <div><span>Prezzo</span><strong>${pick.price} cr</strong></div>
    </div>
    <div class="roster-pop-form"><span>Ultime 5</span>${formDots(pick.recent)}</div>
    ${pick.reasons.filter((reason) => !status || reason !== status.text).length ? `<div class="roster-pop-reasons">${pick.reasons.filter((reason) => !status || reason !== status.text).map((reason) => `<span>${escapePlayerHtml(reason)}</span>`).join('')}</div>` : ''}
    <button type="button" class="roster-pop-open" data-roster-open="${escapePlayerHtml(pick.player.player_id ?? '')}">Scheda completa →</button>`
}

/* ---------- campetto ---------- */

function dot(pick: MatchdayPick): string {
  const status = statusLabel(pick.probable)
  const surname = pick.player.name.replace(/\s+[A-Z]\.$/, '')
  return `<button type="button" class="rpitch-dot role-${pick.player.role.toLowerCase()}${pick.out ? ' out' : ''}" data-roster-dot="${escapePlayerHtml(pick.player.player_id ?? '')}" aria-label="${escapePlayerHtml(pick.player.name)}">
    <span class="rpitch-dot-marker">
      <svg viewBox="0 0 40 40" aria-hidden="true"><path class="rpitch-dot-shape" d="M23.18 5.21 Q29.49 8.44 34.51 13.44 Q37.69 15.75 36.47 19.50 Q35.36 26.49 32.15 32.80 Q30.93 36.55 27.00 36.55 Q20.00 37.65 13.00 36.55 Q9.07 36.55 7.85 32.80 Q4.64 26.49 3.53 19.50 Q2.31 15.75 5.49 13.44 Q10.51 8.44 16.82 5.21 Q20.00 2.90 23.18 5.21 Z"/></svg>
      <b>${display(pick.expected, 1)}</b>
      ${status ? `<i class="rpitch-dot-flag ${status.tone}" title="${status.text}"></i>` : ''}
    </span>
    <span class="rpitch-dot-name">${escapePlayerHtml(surname)}</span>
  </button>`
}

function renderPitch(starters: MatchdayPick[]): string {
  const line = (role: string) => `<div class="rpitch-line">${starters.filter((pick) => pick.player.role === role).map(dot).join('')}</div>`
  return `<div class="rpitch">
    <div class="rpitch-marks" aria-hidden="true"><span class="rpitch-half"></span><span class="rpitch-circle"></span><span class="rpitch-spot"></span><span class="rpitch-box top"></span><span class="rpitch-box bottom"></span><span class="rpitch-small top"></span><span class="rpitch-small bottom"></span></div>
    ${line('A')}${line('C')}${line('D')}${line('P')}
  </div>`
}

/* ---------- infermeria ---------- */

function infirmaryRow(player: FldaPlayer | undefined, p: Probable, mine: boolean, day?: number): string {
  if (!player) return ''
  const status = statusLabel(p)
  return `<div class="infirmary-row${mine ? ' mine' : ''}">
    <span class="role-badge role-${player.role.toLowerCase()}">${player.role}</span>
    <div class="infirmary-name"><strong>${escapePlayerHtml(player.name)}</strong><small>${escapePlayerHtml(player.team)}</small></div>
    <span class="roster-chip ${status?.tone ?? 'warn'}">${status?.text ?? ''}</span>
    <p>${escapePlayerHtml(p.note || '—')}</p>
    <span class="infirmary-return">${p.returnDay ? (day && p.returnDay <= day ? 'questa giornata' : `${p.returnDay}ª giornata`) : '—'}</span>
  </div>`
}

function renderInfirmary(rosterIds: Set<string>, byId: Map<string | null, FldaPlayer>): string {
  const day = nextMatchday()
  const all = infirmary().sort((a, b) => (a.probable.returnDay ?? 99) - (b.probable.returnDay ?? 99))
  const mine = all.filter((item) => rosterIds.has(item.playerId))
  const others = all.filter((item) => !rosterIds.has(item.playerId))
  return `<section class="roster-section infirmary">
    <div class="roster-section-head"><h2>Infermeria</h2><span>${day ? `giornata ${day}` : ''} · fonti FantaLab e SOS Fanta</span></div>
    <h3 class="roster-bench-title">La tua rosa</h3>
    ${mine.length ? `<div class="infirmary-list">${mine.map((item) => infirmaryRow(byId.get(item.playerId), item.probable, true, day)).join('')}</div>` : '<p class="roster-note">Nessun giocatore della tua rosa è fuori o in dubbio.</p>'}
    <details class="infirmary-all"><summary>Tutta la Serie A <small>${others.length} giocatori</small></summary>
      <div class="infirmary-list">${others.map((item) => infirmaryRow(byId.get(item.playerId), item.probable, false, day)).join('')}</div>
    </details>
  </section>`
}

/* ---------- pagina ---------- */

export function renderRosterPage(): string {
  const choice = loadChoice()
  const teams = leagueTeams(league)
  const dataset = getCachedPlayersDataset()
  const selector = `
    <div class="roster-picker">
      <div class="roster-league" role="tablist">${(['SERIE_A', 'SERIE_B'] as League[]).map((item) => `<button type="button" data-roster-league="${item}" aria-selected="${item === league}">${LEAGUE_LABEL[item]}</button>`).join('')}</div>
      <select class="roster-team" data-roster-team aria-label="Squadra">
        <option value="">Scegli la tua squadra…</option>
        ${teams.map((team) => `<option value="${escapePlayerHtml(team)}" ${choice?.league === league && choice.team === team ? 'selected' : ''}>${escapePlayerHtml(team)}</option>`).join('')}
      </select>
    </div>`

  if (!choice || choice.league !== league) {
    return `<section class="page roster-page"><header class="roster-hero"><div class="roster-hero-title"><h1>Rosa</h1><p>Scegli lega e squadra: l'app ricorda la scelta.</p></div>${selector}</header></section>`
  }
  if (!dataset || dataset.source !== 'flda') {
    return `<section class="page roster-page"><header class="roster-hero"><div class="roster-hero-title"><h1>Rosa</h1></div>${selector}</header><div class="players-loading">Caricamento giocatori…</div></section>`
  }

  const byId = new Map(dataset.players.map((player) => [player.player_id, player]))
  const roster = teamRoster(choice.league, choice.team)
  const picks = roster.flatMap((entry) => { const player = byId.get(entry.playerId); return player ? [evaluatePick(player, entry.price)] : [] })
  picksById = new Map(picks.map((pick) => [pick.player.player_id ?? '', pick]))
  const lineup = suggestLineup(picks)
  const day = nextMatchday()
  const spent = picks.reduce((sum, pick) => sum + pick.price, 0)

  return `<section class="page roster-page">
    <header class="roster-hero">
      <div class="roster-hero-title"><span class="roster-hero-kicker">${LEAGUE_LABEL[choice.league]}</span><h1>${escapePlayerHtml(choice.team)}</h1><p>${picks.length} giocatori · ${spent} crediti spesi${day ? ` · prossima: giornata ${day}` : ''}</p></div>
      ${selector}
    </header>
    <div class="roster-layout">
      <section class="roster-section">
        <div class="roster-section-head"><h2>Formazione consigliata</h2><span>${day ? `giornata ${day}` : 'prossima giornata'}${lineup ? ` · ${lineup.module} · ${display(lineup.total, 1)} fantapunti attesi` : ''}</span></div>
        ${lineup ? `${renderPitch(lineup.starters)}
          <h3 class="roster-bench-title">Panchina</h3>
          <div class="bench">${lineup.bench.map(dot).join('')}</div>
          <p class="roster-note">Nel pallino i fantapunti attesi nella partita. Passa sopra o tocca un giocatore per i dettagli.</p>`
        : '<p class="roster-note">Rosa incompleta: servono almeno 1 portiere, 3 difensori, 3 centrocampisti e 1 attaccante.</p>'}
      </section>
      ${renderInfirmary(new Set(roster.map((entry) => entry.playerId)), byId)}
    </div>
    <div class="roster-pop" role="dialog" aria-live="polite" hidden></div>
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

  if (!scrollListenerReady) {
    document.addEventListener('scroll', () => hidePopOnScroll(), { passive: true, capture: true })
    scrollListenerReady = true
  }
  const pop = document.querySelector<HTMLElement>('.roster-pop')
  const page = document.querySelector<HTMLElement>('.roster-page')
  if (!pop || !page) return
  let current: string | null = null
  const hide = () => { pop.hidden = true; current = null }
  const show = (target: HTMLElement) => {
    const id = target.dataset.rosterDot ?? ''
    const pick = picksById.get(id)
    if (!pick) return
    pop.innerHTML = renderPopover(pick)
    pop.hidden = false
    current = id
    const rect = target.getBoundingClientRect()
    const width = pop.offsetWidth
    const height = pop.offsetHeight
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)
    const below = rect.bottom + 18
    // la × sporge di metà dall'angolo: 18 px di margine; se sotto non c'è spazio, il riquadro va sopra
    const top = below + height < window.innerHeight - 70 ? below : Math.max(18, rect.top - height - 18)
    pop.style.left = `${left}px`
    pop.style.top = `${top}px`
  }

  // un solo gestore per campo e panchina: si apre solo toccando
  page.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-roster-close]')) { hide(); return }
    const open = target.closest<HTMLElement>('[data-roster-open]')
    if (open?.dataset.rosterOpen) { actions.onOpenPlayer(open.dataset.rosterOpen); return }
    const dot = target.closest<HTMLElement>('[data-roster-dot]')
    if (dot) {
      if (current === dot.dataset.rosterDot) hide()
      else show(dot)
      return
    }
    if (!pop.contains(target)) hide()
  })
  // lo scorrimento avviene dentro l'app (non nella finestra): un solo ascoltatore in cattura,
  // sostituito a ogni ridisegno invece di accumularsi
  hidePopOnScroll = () => { if (!pop.hidden) hide() }
}
