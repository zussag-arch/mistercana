import type { Player } from '../domain/player'
import type { PlayerViewModel } from './playerDataView'
import {
  auctionStatusClass, auctionStatusLabel, displayCount, escapePlayerHtml,
  field, latestHistory, renderCurrentMetrics, renderPerformanceChart,
  renderPlayerBadges, renderSageChart,
} from './playerDataView'
import '../styles/playerDetail.css'

export interface PlayerOverlayOptions {
  view?: PlayerViewModel
  loading?: boolean
  error?: string
}

export function renderPlayerDetailOverlay(
  player: Player,
  assigned: boolean,
  callEnabled = true,
  options: PlayerOverlayOptions = {},
): string {
  const view = options.view ?? {
    flda: {
      player_id: null, name: player.name, team: player.team, role: player.role,
      fm_exp: player.fmv ?? null, integrita: null,
      titolarita_display: player.startingProbability ?? null,
    },
    legacy: player, legacyId: player.id, assigned,
    auctionLive: callEnabled || assigned, identityAvailable: false,
  }
  const role = view.flda.role.toUpperCase()
  const canCall = Boolean(view.legacyId) && callEnabled && !assigned
  const latest = latestHistory(view.detail)
  const roleFields: Array<[string, string]> = role === 'P'
    ? [['Presenze', 'presenze'], ['Minuti', 'min_playing_time'], ['Gol subiti', 'gol_subiti'], ['Rigori parati', 'rigori_parati']]
    : role === 'A'
      ? [['Presenze', 'presenze'], ['Gol', 'gol_fatti'], ['Assist', 'assist'], ['Tiri in porta', 'shots_on_target']]
      : [['Presenze', 'presenze'], ['Gol', 'gol_fatti'], ['Assist', 'assist'], ['Ammonizioni', 'amm']]

  return `<div id="playerDetailOverlay" class="player-detail-overlay" aria-hidden="false">
    <button type="button" class="player-detail-backdrop" data-close-player-detail aria-label="Chiudi"></button>
    <section class="player-detail-card player-quick-card" role="dialog" aria-modal="true" aria-labelledby="playerDetailTitle" tabindex="-1">
      <header class="player-detail-header">
        <div class="player-detail-identity"><span class="player-detail-role player-detail-role-${role.toLowerCase()}">${escapePlayerHtml(role)}</span><div><span class="player-detail-eyebrow">SNAPSHOT GIOCATORE</span><h2 id="playerDetailTitle">${escapePlayerHtml(view.flda.name)}</h2><p>${escapePlayerHtml(view.flda.team)}</p>${renderPlayerBadges(view)}</div></div>
        <div class="player-detail-header-actions"><span class="player-status player-status-${auctionStatusClass(view)}">${auctionStatusLabel(view)}</span><button type="button" class="player-detail-call-button" data-player-detail-call="${escapePlayerHtml(view.legacyId ?? '')}" ${canCall ? '' : 'disabled'}>${assigned ? 'ASSEGNATO' : callEnabled ? 'CHIAMA' : 'ASTA NON ATTIVA'}</button><button type="button" class="player-detail-close-button" data-close-player-detail aria-label="Chiudi">×</button></div>
      </header>
      ${renderCurrentMetrics(view)}
      ${!view.identityAvailable ? '<p class="player-data-alert">Dati FLDA non disponibili per questa identità. Sono mostrati i dati legacy disponibili.</p>' : ''}
      ${options.error ? `<p class="player-data-alert">${escapePlayerHtml(options.error)}</p>` : ''}
      ${options.loading ? '<p class="player-data-loading">Caricamento dettaglio FLDA…</p>' : `<div class="player-chart-grid">
        <section class="player-data-section"><h3>Prezzi dei Saggi</h3>${renderSageChart(view.detail)}</section>
        <section class="player-data-section"><h3>Storico MV / FMV</h3>${renderPerformanceChart(view.detail)}</section>
      </div><section class="player-overlay-stats"><h3>Ultima stagione</h3><div class="player-role-stats">${roleFields.map(([label, key]) => `<div><span>${label}</span><strong>${displayCount(field(latest, key))}</strong></div>`).join('')}</div></section>`}
      <footer class="player-detail-actions">
        ${options.view ? `<button type="button" class="player-detail-full-button" data-open-full-player="${escapePlayerHtml(view.flda.player_id ?? (view.legacyId ? `legacy:${view.legacyId}` : ''))}">Apri scheda completa</button>` : ''}
      </footer>
    </section>
  </div>`
}
