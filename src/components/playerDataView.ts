import type { FldaPlayer, FldaPlayerDetail, FldaRecord } from '../services/flda'
import type { Player } from '../domain/player'
import type { PmaConfiguration } from '../app/state'
import { getFldaPma } from '../domain/pma'
import { getICaV3 } from '../data/icaV3Data'

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
  pmaConfiguration?: PmaConfiguration
  initialCredits?: number
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
  if (view.flda.is_starting_xi || (!view.flda.player_id && typeof view.flda.titolarita_display === 'number' && view.flda.titolarita_display >= 90)) {
    badges.push('<span class="player-signal player-signal-xi">XI</span>')
  }
  if (view.flda.goalkeeper_rank && view.flda.goalkeeper_rank <= 3) badges.push(`<span class="player-signal player-signal-goalkeeper">🧤 P${view.flda.goalkeeper_rank}</span>`)
  if (view.flda.penalty_rank) badges.push(`<span class="player-signal player-signal-penalty">🥅${view.flda.penalty_rank > 1 ? ` ${view.flda.penalty_rank}` : ''}</span>`)
  if (view.flda.free_kick_rank) badges.push(`<span class="player-signal player-signal-free-kick">👟${view.flda.free_kick_rank > 1 ? ` ${view.flda.free_kick_rank}` : ''}</span>`)
  if (view.flda.corner_rank) badges.push(`<span class="player-signal player-signal-corner">🚩${view.flda.corner_rank > 1 ? ` ${view.flda.corner_rank}` : ''}</span>`)
  for (const row of hierarchyRows(view.detail)) {
    const type = hierarchyType(row)
    const rank = hierarchyRank(row)
    const suffix = rank ? ` ${rank}°` : ''
    if (type.includes('GOALKEEPER') && !view.flda.goalkeeper_rank && rank && rank <= 3) badges.push(`<span class="player-signal player-signal-goalkeeper">🧤 P${rank}</span>`)
    else if (type.includes('PENALTY') && !view.flda.penalty_rank) badges.push(`<span class="player-signal player-signal-penalty">🥅${suffix}</span>`)
    else if (type.includes('FREE_KICK') && !view.flda.free_kick_rank) badges.push(`<span class="player-signal player-signal-free-kick">👟${suffix}</span>`)
    else if (type.includes('CORNER') && !view.flda.corner_rank) badges.push(`<span class="player-signal player-signal-corner">🚩${suffix}</span>`)
  }
  return badges.length ? `<div class="player-signals">${badges.join('')}</div>` : ''
}

export function renderCurrentMetrics(view: PlayerViewModel, compact = false,
  historicalPrice?: string): string {
  const iCaV3 = getICaV3(view.flda.player_id)
  const fldaPma = view.pmaConfiguration ? getFldaPma(view.flda, view.pmaConfiguration) : undefined
  const pmaValue = fldaPma ?? (!view.flda.player_id ? view.legacy?.pmaPercent : undefined)
  const pma = typeof pmaValue === 'number' ? `${display(pmaValue, 1)}%` : '—'
  const items: Array<[string, string, string, string?]> = [
    ['iCà', display(iCaV3?.score, 2), `fantapunti a partita${typeof iCaV3?.rolePercentile === 'number' ? ` · meglio del ${Math.round(iCaV3.rolePercentile)}% del ruolo` : ''}${typeof iCaV3?.affare === 'number' ? ` · affare ${iCaV3.affare > 0 ? '+' : ''}${Math.round(iCaV3.affare)}` : ''}`, 'player-metric-ica'],
    ['PMA', pma, pma === '—' ? 'dato non disponibile' : view.pmaConfiguration ? `${view.pmaConfiguration.mode === 'classic' ? 'Classic' : 'Mantra'} · ${view.pmaConfiguration.participants} · ${view.pmaConfiguration.defenseModifier ? 'con modificatore' : 'senza modificatore'}` : 'budget iniziale'],
    ['xFM', display(view.flda.fm_exp, 2), 'FM Exp. FLDA'],
    ['Integrità', display(view.flda.integrita, 0), ''],
  ]
  if (compact) items.push(
    ['Titolarità', `${display(view.flda.titolarita_display, 0)}${typeof view.flda.titolarita_display === 'number' ? '%' : ''}`, 'indicatore editoriale'],
    ['Prezzo storico A/B', historicalPrice ?? '— / —', 'stagione 2025/26', 'player-metric-history'],
  )
  // MV/FMV della stagione più recente disponibile; il listone legacy solo come ripiego.
  const latest = latestHistory(view.detail)
  const latestMv = field(latest, 'mv')
  const latestFmv = field(latest, 'fmv')
  const seasonNote = latest ? `stagione ${String(field(latest, 'season') ?? '')}` : 'dato legacy'
  if (!compact) items.push(
    ['MV', display(typeof latestMv === 'number' ? latestMv : view.legacy?.mv, 2), typeof latestMv === 'number' ? seasonNote : 'dato legacy'],
    ['FMV', display(typeof latestFmv === 'number' ? latestFmv : view.legacy?.fmv, 2), typeof latestFmv === 'number' ? seasonNote : 'dato legacy'],
    ['Titolarità', `${display(view.flda.titolarita_display, 0)}${typeof view.flda.titolarita_display === 'number' ? '%' : ''}`, 'indicatore editoriale'],
  )
  return `<div class="player-current-metrics${compact ? ' player-current-metrics-full' : ''}">${items.map(([label, value, note, className]) => `<div class="${className ?? ''}"${className === 'player-metric-ica' ? ` style="--ica-hue:${icaHue(iCaV3?.rolePercentile)}"` : ''}><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`).join('')}</div>`
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
  const baseY = 250
  const height = 185
  const barWidth = 70
  const gap = 40
  const startX = 62
  const averageY = baseY - (average / max) * height
  const ticks = [0, max / 2, max]
  return `<div class="player-chart"><svg viewBox="0 0 620 315" role="img" aria-label="Prezzi dei cinque Saggi e media descrittiva">
    <text x="13" y="155" text-anchor="middle" transform="rotate(-90 13 155)" class="chart-axis-title">Prezzo (crediti)</text>
    ${ticks.map((tick) => { const tickY = baseY - (tick / max) * height; return `<line x1="40" y1="${tickY}" x2="590" y2="${tickY}" class="chart-grid-line"/><text x="35" y="${tickY + 4}" text-anchor="end" class="chart-tick">${display(tick, 0)}</text>` }).join('')}
    <line x1="40" y1="${averageY}" x2="590" y2="${averageY}" class="chart-average-line"/><text x="56" y="${averageY - 6}" text-anchor="end" class="chart-average-value">${display(average, 1)} cr</text>
    ${rows.map((row, index) => { const h = (row.price / max) * height; const x = startX + index * (barWidth + gap); return `<rect x="${x}" y="${baseY - h}" width="${barWidth}" height="${h}" rx="10" class="chart-bar"/><text x="${x + barWidth / 2}" y="${baseY - h - 9}" text-anchor="middle" class="chart-value">${display(row.price, 0)}</text><text x="${x + barWidth / 2}" y="280" text-anchor="middle" class="chart-label">${escapePlayerHtml(row.name)}</text>` }).join('')}
    <line x1="40" y1="${baseY}" x2="590" y2="${baseY}" class="chart-axis"/>
  </svg></div>`
}

export function renderPerformanceChart(detail?: FldaPlayerDetail): string {
  const rows = (detail?.history ?? []).map((row) => ({ season: String(field(row, 'season') ?? ''), mv: field(row, 'mv'), fmv: field(row, 'fmv') }))
    .filter((row) => typeof row.mv === 'number' || typeof row.fmv === 'number').reverse()
  if (!rows.length) return chartEmpty('Storico MV/FMV non disponibile.')
  const values = rows.flatMap((row) => [row.mv, row.fmv]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const min = Math.min(...values, 4)
  const max = Math.max(...values, 8)
  const x = (index: number) => rows.length === 1 ? 310 : 55 + index * (520 / (rows.length - 1))
  const y = (value: number) => 245 - ((value - min) / Math.max(max - min, 1)) * 180
  const points = (key: 'mv' | 'fmv') => rows.map((row, index) => typeof row[key] === 'number' ? `${x(index)},${y(row[key])}` : '').filter(Boolean).join(' ')
  const ticks = [min, (min + max) / 2, max]
  return `<div class="player-chart"><svg viewBox="0 0 620 315" role="img" aria-label="Andamento multi-stagione MV e FMV">
    <text x="13" y="155" text-anchor="middle" transform="rotate(-90 13 155)" class="chart-axis-title">Voto</text>
    ${ticks.map((tick) => { const tickY = y(tick); return `<line x1="40" y1="${tickY}" x2="590" y2="${tickY}" class="chart-grid-line"/><text x="35" y="${tickY + 4}" text-anchor="end" class="chart-tick">${display(tick, 1)}</text>` }).join('')}
    <line x1="40" y1="245" x2="590" y2="245" class="chart-axis"/><polyline points="${points('mv')}" class="chart-line chart-line-mv"/><polyline points="${points('fmv')}" class="chart-line chart-line-fmv"/>
    ${rows.map((row, index) => { const title = `${row.season} · MV ${display(row.mv, 2)} · FMV ${display(row.fmv, 2)}`; return `<text x="${x(index)}" y="278" text-anchor="middle" class="chart-label">${escapePlayerHtml(row.season)}</text>${typeof row.mv === 'number' ? `<circle cx="${x(index)}" cy="${y(row.mv)}" r="6" class="chart-dot chart-dot-mv"><title>${title}</title></circle>` : ''}${typeof row.fmv === 'number' ? `<circle cx="${x(index)}" cy="${y(row.fmv)}" r="6" class="chart-dot chart-dot-fmv"><title>${title}</title></circle>` : ''}` }).join('')}
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

// I prezzi dei Saggi sono espressi su un budget di 500 crediti.
const SAGE_BUDGET = 500

function median(values: number[]): number | undefined {
  if (!values.length) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

// Sezione "Prezzo e Saggi" come nella Scheda Giocatore V2: prezzo medio grande,
// striscia con i prezzi dei Saggi e tabella con fascia, affidabilità e integrità.
export function renderSageSection(view: PlayerViewModel): string {
  const budget = view.initialCredits && view.initialCredits > 0 ? view.initialCredits : SAGE_BUDGET
  const scale = budget / SAGE_BUDGET
  const rows = (view.detail?.saggi ?? []).map((row) => ({
    name: String(field(row, 'saggio') ?? ''),
    band: String(field(row, 'fascia') ?? ''),
    value: finiteNumber(field(row, 'fascia_valore')),
    reliability: finiteNumber(field(row, 'affidabilita')),
    integrity: finiteNumber(field(row, 'integrita')),
    price: finiteNumber(field(row, 'prezzo')) === undefined ? undefined : Math.round(Number(field(row, 'prezzo')) * scale),
  }))
  const prices = rows.flatMap((row) => row.price === undefined ? [] : [row.price])
  const pmaPercent = view.pmaConfiguration ? getFldaPma(view.flda, view.pmaConfiguration) : undefined
  const pmaCredits = pmaPercent === undefined ? undefined : Math.round(pmaPercent / 100 * budget)
  const priceMedian = median(prices)
  const lead = pmaCredits ?? (priceMedian === undefined ? undefined : Math.round(priceMedian))

  const leadBlock = lead === undefined
    ? '<div class="player-sage-lead"><span class="player-sage-kicker">Prezzo medio d\'asta</span><p class="player-sage-note">Prezzo non disponibile.</p></div>'
    : `<div class="player-sage-lead">
        <span class="player-sage-kicker">${pmaCredits !== undefined ? 'Prezzo medio d\'asta' : 'Mediana dei Saggi'}</span>
        <div class="player-sage-big">${lead}<small>crediti</small></div>
        <p class="player-sage-note">${pmaPercent !== undefined ? `${display(pmaPercent, 1)}% di un budget da ${budget} crediti. ` : ''}Sotto, i prezzi indicati da ciascun Saggio${scale !== 1 ? ` riportati a ${budget} crediti` : ''}.</p>
        ${renderSageStrip(prices, priceMedian)}
      </div>`

  if (!rows.length) {
    return `<div class="player-sage">${leadBlock}<div class="player-chart-empty">Prezzi Saggi non disponibili.</div></div>`
  }

  const dots = (value?: number) => value === undefined ? '—'
    : `<span class="player-sage-dots" aria-label="${value} su 5">${[1, 2, 3, 4, 5].map((step) => `<i class="${step <= value ? 'on' : ''}"></i>`).join('')}</span>`
  const cell = (value?: number) => value === undefined ? '—' : String(value)
  const medianOf = (pick: (row: typeof rows[number]) => number | undefined) => {
    const value = median(rows.flatMap((row) => { const item = pick(row); return item === undefined ? [] : [item] }))
    return value === undefined ? '—' : display(value, 1)
  }

  return `<div class="player-sage">
    ${leadBlock}
    <div class="player-sage-table"><table>
      <thead><tr><th>Saggio</th><th>Fascia</th><th>Valore</th><th class="n">Affid.</th><th class="n">Integr.</th><th class="n">Prezzo</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${escapePlayerHtml(row.name.replace(/^Saggio\s*/i, ''))}</td>
        <td>${escapePlayerHtml(row.band || '—')}</td>
        <td>${dots(row.value)}</td>
        <td class="n">${cell(row.reliability)}</td>
        <td class="n">${cell(row.integrity)}</td>
        <td class="n">${cell(row.price)}</td>
      </tr>`).join('')}
      <tr class="player-sage-median"><td>Mediana</td><td></td><td class="n">${medianOf((row) => row.value)}</td><td class="n">${medianOf((row) => row.reliability)}</td><td class="n">${medianOf((row) => row.integrity)}</td><td class="n">${medianOf((row) => row.price)}</td></tr>
      </tbody>
    </table></div>
  </div>`
}

function renderSageStrip(prices: number[], priceMedian?: number): string {
  if (!prices.length) return ''
  const top = Math.max(50, Math.ceil(Math.max(...prices) * 1.1 / 50) * 50)
  const x = (value: number) => 10 + (value / top) * 380
  const ticks = [0, 1, 2, 3, 4].map((step) => Math.round(top * step / 4))
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  return `<svg class="player-sage-strip" viewBox="0 0 400 64" role="img" aria-label="Prezzi dei Saggi da ${low} a ${high} crediti">
    <line x1="10" y1="34" x2="390" y2="34" class="strip-axis"/>
    <line x1="${x(low)}" y1="34" x2="${x(high)}" y2="34" class="strip-range"/>
    ${prices.map((price) => `<circle cx="${x(price)}" cy="34" r="4.5" class="strip-dot"><title>${price} crediti</title></circle>`).join('')}
    ${priceMedian === undefined ? '' : `<line x1="${x(priceMedian)}" y1="22" x2="${x(priceMedian)}" y2="42" class="strip-median"/><text x="${x(priceMedian)}" y="16" text-anchor="middle" class="strip-median-label">mediana ${Math.round(priceMedian)}</text>`}
    ${ticks.map((tick) => `<text x="${x(tick)}" y="58" text-anchor="middle">${tick}</text>`).join('')}
  </svg>`
}

// "Contesto squadra" dello snapshot: allenatore e modulo, ruoli che l'allenatore
// valorizza/penalizza, posto del giocatore (formazione tipo, battitore) e forma
// recente. Sostituisce il grafico storico, poco leggibile con una sola stagione.
export function renderTeamContext(view: PlayerViewModel): string {
  const guide = view.guide ?? view.detail?.guide ?? undefined
  const player = view.flda
  const latest = latestHistory(view.detail)
  const name = player.name.trim().toLocaleLowerCase('it')
  const listed = (key: string) => {
    const value = field(guide, key)
    return Array.isArray(value) && value.some((item) => String(item).trim().toLocaleLowerCase('it') === name)
  }

  const facts: Array<[string, string, 'good' | 'bad' | 'neutral']> = []
  if (player.is_starting_xi) facts.push(['Titolare', 'nella formazione tipo', 'good'])
  else if (typeof player.titolarita_display === 'number') facts.push(['Riserva', `titolarità ${display(player.titolarita_display, 0)}%`, player.titolarita_display >= 50 ? 'neutral' : 'bad'])
  const ranks: Array<[string, unknown]> = [['Rigori', player.penalty_rank], ['Punizioni', player.free_kick_rank], ['Angoli', player.corner_rank]]
  for (const [label, rank] of ranks) {
    if (typeof rank === 'number') facts.push([label, `${rank}° nella gerarchia`, rank === 1 ? 'good' : 'neutral'])
  }
  if (player.role === 'P' && typeof player.goalkeeper_rank === 'number') {
    facts.push(['Portiere', player.goalkeeper_rank === 1 ? 'titolare' : `${player.goalkeeper_rank}° nelle gerarchie`, player.goalkeeper_rank === 1 ? 'good' : 'bad'])
  }
  if (listed('valorizzati')) facts.push(['Valorizzato', "dall'allenatore", 'good'])
  if (listed('penalizzati')) facts.push(['Penalizzato', "dall'allenatore", 'bad'])

  const keyRoles = (Array.isArray(field(guide, 'key_roles_text')) ? field(guide, 'key_roles_text') as FldaRecord[] : [])
    .map((item) => ({ label: String(field(item, 'label') ?? ''), tone: String(field(item, 'tone') ?? 'neutral') }))
    .filter((item) => item.label)

  const form = (label: string, season: unknown, recent: unknown) => {
    const a = finiteNumber(season)
    const b = finiteNumber(recent)
    const delta = a !== undefined && b !== undefined ? b - a : undefined
    const trend = delta === undefined ? '' : delta > 0.15 ? 'up' : delta < -0.15 ? 'down' : 'flat'
    return `<div class="team-context-form-item">
      <span>${label}</span>
      <strong>${display(a, 2)}</strong>
      <small class="trend-${trend || 'none'}">${b === undefined ? 'ultime 5: —' : `ultime 5: ${display(b, 2)} ${trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}`}</small>
    </div>`
  }

  const coach = field(guide, 'coach')
  const module = field(guide, 'module')
  const attack = finiteNumber(field(guide, 'attack'))
  const defense = finiteNumber(field(guide, 'defense'))

  return `<div class="team-context">
    <div class="team-context-team">
      <span class="team-context-kicker">${escapePlayerHtml(player.team)}</span>
      <strong>${coach ? escapePlayerHtml(coach) : 'Allenatore non disponibile'}</strong>
      <div class="team-context-meta">
        ${module ? `<span class="team-context-pill">${escapePlayerHtml(module)}</span>` : ''}
        ${attack !== undefined ? `<span class="team-context-pill">attacco ${display(attack, 1)}/5</span>` : ''}
        ${defense !== undefined ? `<span class="team-context-pill">difesa ${display(defense, 1)}/5</span>` : ''}
      </div>
      ${keyRoles.length ? `<div class="team-context-roles">${keyRoles.map((item) => `<span class="team-context-role tone-${escapePlayerHtml(item.tone)}">${escapePlayerHtml(item.label)}${item.tone === 'good' ? ' +' : item.tone === 'bad' ? ' −' : ''}</span>`).join('')}</div>` : ''}
    </div>
    <div class="team-context-player">
      <span class="team-context-kicker">Il suo posto</span>
      ${facts.length
        ? `<ul>${facts.map(([label, text, tone]) => `<li class="tone-${tone}"><b>${label}</b> ${escapePlayerHtml(text)}</li>`).join('')}</ul>`
        : '<p class="player-data-empty">Nessuna indicazione dalla Guida.</p>'}
    </div>
    <div class="team-context-form">
      <span class="team-context-kicker">Forma ${latest ? escapePlayerHtml(String(field(latest, 'season') ?? '')) : ''}</span>
      <div class="team-context-form-grid">
        ${form('MV', field(latest, 'mv'), field(latest, 'mv_5'))}
        ${form('FMV', field(latest, 'fmv'), field(latest, 'fmv_5'))}
      </div>
    </div>
  </div>`
}

// "Perché questo iCà": come nasce l'iCà 3 del giocatore, passo per passo.
export function renderICaV3Explanation(view: PlayerViewModel): string {
  const result = getICaV3(view.flda.player_id)
  if (!result) return '<p class="player-data-empty">iCà non disponibile per questo giocatore.</p>'
  if (result.score === undefined) {
    return `<p class="player-data-empty">iCà non calcolabile: manca ${result.missing.join(' e ') || 'un dato'}.</p>`
  }
  const sign = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${display(Math.abs(value), 2)}`
  const affare = result.affare
  const affareText = typeof affare !== 'number' ? 'prezzo non disponibile'
    : affare >= 15 ? 'rende più di quanto costa' : affare <= -15 ? 'costa più di quanto rende' : 'prezzo in linea con il valore'
  return `<div class="ica-explain">
    <div class="ica-explain-score">
      <span class="ica-explain-kicker">iCà</span>
      <strong>${display(result.score, 2)}</strong>
      <small>fantapunti attesi a partita${typeof result.rolePercentile === 'number' ? ` · meglio del ${Math.round(result.rolePercentile)}% del ruolo` : ''}</small>
      ${typeof affare === 'number' ? `<span class="ica-explain-affare tone-${affare >= 15 ? 'good' : affare <= -15 ? 'bad' : 'neutral'}">Affare ${affare > 0 ? '+' : ''}${Math.round(affare)}</span><small>${affareText}</small>` : ''}
    </div>
    <ol class="ica-explain-steps">
      <li><b>Fantamedia attesa ${display(result.expectedFm, 2)}</b><small>stagione in corso e scorsa, frenate dalla media del ruolo</small></li>
      ${result.contributions.map((item) => `<li class="${item.value > 0 ? 'up' : 'down'}"><b>${sign(item.value)}</b> ${item.label}</li>`).join('')}
      <li><b>Fantamedia corretta ${display(result.adjustedFm, 2)}</b><small>fantamedia attesa più i correttivi</small></li>
      <li><b>× presenze attese ${display((result.expectedShare ?? 0) * 100, 0)}%</b><small>titolarità Guida, ridotta dagli infortuni</small></li>
      <li class="total"><b>= iCà ${display(result.score, 2)}</b><small>fantapunti attesi a partita</small></li>
    </ol>
  </div>`
}
