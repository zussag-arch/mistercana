import type { Player } from '../domain/player'
import type { PlayerViewModel } from './playerDataView'
import {
  displayCount, escapePlayerHtml,
  field, latestHistory, renderCurrentMetrics,
  renderPlayerHead, renderSageSection, renderTeamContext, renderICaExplanation,
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
  const latest = latestHistory(view.detail)
  const roleFields: Array<[string, string]> = role === 'P'
    ? [['Presenze', 'presenze'], ['Minuti', 'min_playing_time'], ['Gol subiti', 'gol_subiti'], ['Rigori parati', 'rigori_parati']]
    : role === 'A'
      ? [['Presenze', 'presenze'], ['Gol', 'gol_fatti'], ['Assist', 'assist'], ['Tiri in porta', 'shots_on_target']]
      : [['Presenze', 'presenze'], ['Gol', 'gol_fatti'], ['Assist', 'assist'], ['Ammonizioni', 'amm']]

  return `<div id="playerDetailOverlay" class="player-detail-overlay" aria-hidden="false">
    <button type="button" class="player-detail-backdrop" data-close-player-detail aria-label="Chiudi"></button>
    <div class="player-detail-shell">
      <button type="button" class="player-detail-close-button sheet-x" data-close-player-detail aria-label="Chiudi">×</button>
    <section class="player-detail-card player-quick-card" role="dialog" aria-modal="true" aria-labelledby="playerDetailTitle" tabindex="-1">
      ${renderPlayerHead(view, view.flda.player_id ?? (view.legacyId ? `legacy:${view.legacyId}` : ''))}
      ${renderCurrentMetrics(view)}
      ${!view.identityAvailable ? '<p class="player-data-alert">Dati FLDA non disponibili per questa identità. Sono mostrati i dati legacy disponibili.</p>' : ''}
      ${options.error ? `<p class="player-data-alert">${escapePlayerHtml(options.error)}</p>` : ''}
      ${options.loading ? '<p class="player-data-loading">Caricamento dettaglio FLDA…</p>' : `<div class="player-chart-grid">
        <section class="player-data-section player-sage-section"><h3>Prezzo e Saggi</h3>${renderSageSection(view)}</section>
        <section class="player-data-section player-ica-section"><h3>Perché questo iCà</h3>${renderICaExplanation(view)}</section><section class="player-data-section player-history-section"><h3>Contesto squadra</h3>${renderTeamContext(view)}</section>
      </div><section class="player-overlay-stats"><h3>Ultima stagione</h3><div class="player-role-stats">${roleFields.map(([label, key]) => `<div><span>${label}</span><strong>${displayCount(field(latest, key))}</strong></div>`).join('')}</div></section>`}
      <footer class="player-detail-actions">

      </footer>
    </section>
    </div>
  </div>`
}
