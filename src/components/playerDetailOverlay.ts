import type { Player } from '../domain/player'
import type { PlayerViewModel } from './playerDataView'
import {
  auctionStatusLabel, escapePlayerHtml, renderCurrentMetrics,
  renderFixtures, renderHierarchies, renderHistory, renderSaggi,
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

  return `<div id="playerDetailOverlay" class="player-detail-overlay" aria-hidden="false">
    <button type="button" class="player-detail-backdrop" data-close-player-detail aria-label="Chiudi"></button>
    <section class="player-detail-card player-quick-card" role="dialog" aria-modal="true" aria-labelledby="playerDetailTitle" tabindex="-1">
      <header class="player-detail-header">
        <div class="player-detail-identity"><span class="player-detail-role player-detail-role-${role.toLowerCase()}">${escapePlayerHtml(role)}</span><div><span class="player-detail-eyebrow">SNAPSHOT GIOCATORE</span><h2 id="playerDetailTitle">${escapePlayerHtml(view.flda.name)}</h2><p>${escapePlayerHtml(view.flda.team)} · ${escapePlayerHtml(role)} · ${auctionStatusLabel(view)}</p></div></div>
        <button type="button" class="player-detail-close-button" data-close-player-detail aria-label="Chiudi">×</button>
      </header>
      ${renderCurrentMetrics(view)}
      ${!view.identityAvailable ? '<p class="player-data-alert">Dati FLDA non disponibili per questa identità. Sono mostrati i dati legacy disponibili.</p>' : ''}
      ${options.error ? `<p class="player-data-alert">${escapePlayerHtml(options.error)}</p>` : ''}
      ${options.loading ? '<p class="player-data-loading">Caricamento dettaglio FLDA…</p>' : `<div class="player-quick-grid">
        <section class="player-data-section"><h3>Gerarchie</h3>${renderHierarchies(view.detail)}</section>
        <section class="player-data-section"><h3>Saggi</h3>${renderSaggi(view.detail)}</section>
        <section class="player-data-section"><h3>Storico breve</h3>${renderHistory(view.detail)}</section>
        ${(role === 'P' || role === 'A') ? `<section class="player-data-section"><h3>Calendario breve</h3>${renderFixtures(view.fixtures)}</section>` : ''}
      </div>`}
      <footer class="player-detail-actions">
        <button type="button" class="player-detail-call-button" data-player-detail-call="${escapePlayerHtml(view.legacyId ?? '')}" ${canCall ? '' : 'disabled'}>${assigned ? 'ASSEGNATO' : callEnabled ? 'CHIAMA' : 'ASTA NON ATTIVA'}</button>
        ${options.view ? `<button type="button" class="player-detail-full-button" data-open-full-player="${escapePlayerHtml(view.flda.player_id ?? (view.legacyId ? `legacy:${view.legacyId}` : ''))}">Apri scheda completa</button>` : ''}
      </footer>
    </section>
  </div>`
}
