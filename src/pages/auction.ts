import type {
  AppState,
  AuctionAssignment,
} from '../app/state'

import {
  runOverlayExit,
} from '../app/motion'

import {
  players,
} from '../data/players'

import {
  calculatePriceAdvice,
  ROSTER_SLOT_LIMITS,
} from '../domain/priceAdvice'

import type {
  PriceAdvice,
  PriceConstraint,
} from '../domain/priceAdvice'

import {
  calculateRecommendation,
} from '../domain/recommendation'

import type {
  Player,
  PlayerRole,
} from '../domain/player'

import {
  renderPlayerDetailOverlay,
} from '../components/playerDetailOverlay'
import { displayHistoricalAuctionPrices } from '../domain/historicalAuctionPrice'
import { getCachedPlayerDetail, getFldaIdForLegacyId, loadPlayerDetail, loadPlayersDataset } from '../services/playerRepository'

const loadingHistoricalPrices = new Set<string>()
const attemptedHistoricalPrices = new Set<string>()

type AuctionRole =
  PlayerRole

type SelectorMode =
  | 'team'
  | 'player'
  | null

type AuctionBidSignal =
  | 'go'
  | 'attention'
  | 'stop'

interface AuctionActions {
  onEndAuction: () => void
  onArchiveAuction: () => void
  onDiscardAuction: () => void

  onStateChange: () => void
  onRender: () => void

  onGoToPlayers: () => void
  onGoToObjectives: () => void
}

interface AuctionParticipantState {
  id: string
  name: string
  isOwner: boolean

  spent: Record<
    AuctionRole,
    number
  >

  slots: Record<
    AuctionRole,
    number
  >
}

interface AuctionBidSignalView {
  state: AuctionBidSignal

  icon: string
  label: string

  color: string
  borderColor: string
  background: string
}

const ROLE_ORDER:
  AuctionRole[] = [
    'P',
    'D',
    'C',
    'A',
  ]

let activeRole:
  AuctionRole = 'P'

let selectorMode:
  SelectorMode = null

let selectedTeamFilter = ''

let auctionFeedback = ''

let editingAssignmentId:
  string | null = null

let discardedPanelOpen =
  false

let awardOverlayOpen =
  false

let pendingAwardPrice:
  number | null = null

let detailPlayerId:
  string | null = null

/* =========================
   HELPERS
========================= */

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll(
      "'",
      '&#039;',
    )
}

function normalizeText(
  value: string,
): string {
  return value
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .trim()
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    Math.max(
      value,
      min,
    ),
    max,
  )
}

function formatNumber(
  value:
    | number
    | undefined,
  digits = 0,
): string {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return '—'
  }

  return value
    .toFixed(digits)
    .replace('.', ',')
}

function formatCredits(
  value:
    | number
    | undefined,
): string {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return '—'
  }

  return `${Math.round(
    value,
  )} cr`
}

function formatPercent(
  value:
    | number
    | undefined,
  digits = 1,
): string {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return '—'
  }

  return `${value
    .toFixed(digits)
    .replace('.', ',')}%`
}

function formatMarketFactor(
  value: number,
): string {
  return `×${value
    .toFixed(2)
    .replace('.', ',')}`
}

function getConstraintLabel(
  constraint:
    PriceConstraint,
): string {
  switch (constraint) {
    case 'financial':
      return 'finanziario'

    case 'role':
      return 'reparto'

    case 'value':
      return 'valore asta'
  }
}

function createAssignmentId():
  string {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID()
  }

  return [
    'assignment',
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2),
  ].join('_')
}

function getPlayer(
  playerId:
    | string
    | null,
):
  | Player
  | undefined {
  if (!playerId) {
    return undefined
  }

  return players.find(
    (player) =>
      player.id ===
      playerId,
  )
}

function getSelectedPlayer(
  state: AppState,
):
  | Player
  | undefined {
  return getPlayer(
    state.currentAuctionPlayerId,
  )
}

function getRolePlayers(
  role: AuctionRole,
): Player[] {
  return players.filter(
    (player) =>
      player.role === role,
  )
}

function getAssignmentByPlayer(
  state: AppState,
  playerId: string,
):
  | AuctionAssignment
  | undefined {
  return state
    .auctionAssignments
    .find(
      (assignment) =>
        assignment.playerId ===
        playerId,
    )
}

function getAssignmentById(
  state: AppState,
  assignmentId: string,
):
  | AuctionAssignment
  | undefined {
  return state
    .auctionAssignments
    .find(
      (assignment) =>
        assignment.id ===
        assignmentId,
    )
}

function isPlayerAssigned(
  state: AppState,
  playerId: string,
): boolean {
  return Boolean(
    getAssignmentByPlayer(
      state,
      playerId,
    ),
  )
}

function managerDisplayName(
  manager:
    AppState['managers'][number],
): string {
  const firstName =
    manager.firstName.trim()

  const lastName =
    manager.lastName.trim()

  const alias =
    manager.alias.trim()

  if (alias) {
    return [
      firstName,
      `"${alias}"`,
      lastName,
    ]
      .filter(Boolean)
      .join(' ')
  }

  return [
    firstName,
    lastName,
  ]
    .filter(Boolean)
    .join(' ') ||
    'Manager'
}

function getManagerById(
  state: AppState,
  managerId: string,
) {
  return state.managers.find(
    (manager) =>
      manager.id ===
      managerId,
  )
}

function getDiscardedPlayersForRole(
  state: AppState,
  role: AuctionRole,
): Player[] {
  return state
    .recommendedDiscards
    .map(
      (playerId) =>
        getPlayer(
          playerId,
        ),
    )
    .filter(
      (
        player,
      ): player is Player => {
        if (!player) {
          return false
        }

        return (
          player.role === role &&
          !isPlayerAssigned(
            state,
            player.id,
          )
        )
      },
    )
}

function callPlayer(
  state: AppState,
  playerId:
    | string
    | undefined,
  actions: AuctionActions,
): void {
  const player =
    getPlayer(
      playerId ?? null,
    )

  if (
    !player ||
    isPlayerAssigned(
      state,
      player.id,
    )
  ) {
    return
  }

  state.currentAuctionPlayerId =
    player.id

  activeRole =
    player.role

  selectorMode =
    null

  selectedTeamFilter =
    ''

  auctionFeedback =
    ''

  awardOverlayOpen =
    false

  pendingAwardPrice =
    null

  detailPlayerId =
    null

  actions.onStateChange()
}

/* =========================
   BID SIGNAL
========================= */

function getBidSignal(
  advice: PriceAdvice,
  currentPrice: number,
): AuctionBidSignalView {
  const safePrice =
    Number.isFinite(
      currentPrice,
    ) &&
    currentPrice > 0
      ? currentPrice
      : 0

  const financial =
    advice.financialLimit

  const value =
    advice.valueLimit

  const role =
    advice.roleLimit

  const ceiling =
    advice.recommendedCeiling

  if (
    financial !== undefined &&
    safePrice > financial
  ) {
    return {
      state: 'stop',
      icon: '⛔',
      label: 'STOP',
      color: '#E45E5E',
      borderColor:
        'rgba(228, 94, 94, 0.72)',
      background:
        'rgba(228, 94, 94, 0.10)',
    }
  }

  if (
    ceiling !== undefined &&
    safePrice > ceiling
  ) {
    return {
      state: 'stop',
      icon: '⛔',
      label: 'STOP',
      color: '#E45E5E',
      borderColor:
        'rgba(228, 94, 94, 0.72)',
      background:
        'rgba(228, 94, 94, 0.10)',
    }
  }

  const comfortLimits =
    [
      value,
      role,
    ].filter(
      (
        item,
      ): item is number =>
        item !== undefined,
    )

  const comfortLimit =
    comfortLimits.length
      ? Math.min(
          ...comfortLimits,
        )
      : undefined

  if (
    comfortLimit === undefined ||
    safePrice <=
      comfortLimit
  ) {
    return {
      state: 'go',
      icon: '↑',
      label: 'SALI',
      color: '#46E6A1',
      borderColor:
        'rgba(70, 230, 161, 0.72)',
      background:
        'rgba(70, 230, 161, 0.10)',
    }
  }

  return {
    state: 'attention',
    icon: '—',
    label: 'ATTENZIONE',
    color: '#FFFFFF',
    borderColor:
      'rgba(255, 255, 255, 0.52)',
    background:
      'rgba(255, 255, 255, 0.055)',
  }
}

function renderBidSignal(
  advice: PriceAdvice,
  currentPrice = 0,
): string {
  const signal =
    getBidSignal(
      advice,
      currentPrice,
    )

  return `
    <div
      id="auctionBidSignal"
      data-signal-state="${signal.state}"
      style="
        min-width: 168px;
        min-height: 116px;
        padding: 14px 18px;
        border-radius: 18px;
        border: 2px solid ${signal.borderColor};
        background: ${signal.background};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        text-align: center;
      "
    >
      <span
        id="auctionBidSignalIcon"
        style="
          display: block;
          color: ${signal.color};
          font-size: 46px;
          font-weight: 900;
          line-height: 0.95;
        "
      >
        ${signal.icon}
      </span>

      <strong
        id="auctionBidSignalLabel"
        style="
          color: ${signal.color};
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 0.12em;
        "
      >
        ${signal.label}
      </strong>
    </div>
  `
}

function updateBidSignalElement(
  advice: PriceAdvice,
  currentPrice: number,
): void {
  const signal =
    getBidSignal(
      advice,
      currentPrice,
    )

  const container =
    document.querySelector<HTMLElement>(
      '#auctionBidSignal',
    )

  const icon =
    document.querySelector<HTMLElement>(
      '#auctionBidSignalIcon',
    )

  const label =
    document.querySelector<HTMLElement>(
      '#auctionBidSignalLabel',
    )

  if (
    !container ||
    !icon ||
    !label
  ) {
    return
  }

  const previousState =
    container.dataset
      .signalState

  container.dataset.signalState =
    signal.state

  if (
    previousState &&
    previousState !==
      signal.state
  ) {
    container.classList.remove(
      'is-changing',
    )

    void container.offsetWidth

    container.classList.add(
      'is-changing',
    )
  }

  container.style.borderColor =
    signal.borderColor

  container.style.background =
    signal.background

  icon.textContent =
    signal.icon

  icon.style.color =
    signal.color

  label.textContent =
    signal.label

  label.style.color =
    signal.color
}

function updateLiveBidPrice(
  state: AppState,
  amount: number,
): void {
  const input =
    document.querySelector<HTMLInputElement>(
      '#auctionPriceInput',
    )

  const player =
    getSelectedPlayer(
      state,
    )

  if (
    !input ||
    !player
  ) {
    return
  }

  const current =
    Number(
      input.value,
    )

  const safeCurrent =
    Number.isFinite(
      current,
    ) &&
    current > 0
      ? current
      : 0

  const next =
    Math.max(
      0,
      Math.round(
        safeCurrent +
        amount,
      ),
    )

  input.value =
    String(next)

  const advice =
    calculatePriceAdvice(
      state,
      player,
      players,
    )

  updateBidSignalElement(
    advice,
    next,
  )
}

/* =========================
   PARTICIPANTS
========================= */

function buildParticipants(
  state: AppState,
):
  AuctionParticipantState[] {
  const activeManagers =
    state.managers.filter(
      (manager) =>
        manager.active &&
        !manager.archived,
    )

  return activeManagers.map(
    (manager) => {
      const spent:
        Record<
          AuctionRole,
          number
        > = {
          P: 0,
          D: 0,
          C: 0,
          A: 0,
        }

      const slots:
        Record<
          AuctionRole,
          number
        > = {
          P: 0,
          D: 0,
          C: 0,
          A: 0,
        }

      state
        .auctionAssignments
        .forEach(
          (assignment) => {
            if (
              assignment.managerId !==
              manager.id
            ) {
              return
            }

            const player =
              getPlayer(
                assignment.playerId,
              )

            if (!player) {
              return
            }

            spent[
              player.role
            ] +=
              assignment.price

            slots[
              player.role
            ] += 1
          },
        )

      return {
        id:
          manager.id,

        name:
          managerDisplayName(
            manager,
          ),

        isOwner:
          manager.isOwner,

        spent,

        slots,
      }
    },
  )
}

function getParticipant(
  participants:
    AuctionParticipantState[],
  participantId: string,
):
  | AuctionParticipantState
  | undefined {
  return participants.find(
    (participant) =>
      participant.id ===
      participantId,
  )
}

function getTotalSpent(
  participant:
    AuctionParticipantState,
): number {
  return ROLE_ORDER.reduce(
    (
      total,
      role,
    ) =>
      total +
      participant.spent[
        role
      ],
    0,
  )
}

function getRemainingCredits(
  participant:
    AuctionParticipantState,
  state: AppState,
): number {
  return Math.max(
    0,
    state.initialCredits -
      getTotalSpent(
        participant,
      ),
  )
}

function getRoleTargetCredits(
  state: AppState,
  role: AuctionRole,
): number {
  return (
    state.initialCredits *
    state.budgetDistribution[
      role
    ]
  ) / 100
}

function getBudgetBarData(
  participant:
    AuctionParticipantState,
  state: AppState,
  role: AuctionRole,
): {
  width: number
  color: string
  description: string
} {
  const initialCredits =
    Math.max(
      1,
      state.initialCredits,
    )

  const remainingCredits =
    getRemainingCredits(
      participant,
      state,
    )

  const width =
    clamp(
      (
        remainingCredits /
        initialCredits
      ) * 100,
      0,
      100,
    )

  const roleIndex =
    ROLE_ORDER.indexOf(
      role,
    )

  const previousRoles =
    ROLE_ORDER.slice(
      0,
      roleIndex,
    )

  const plannedBefore =
    previousRoles.reduce(
      (
        total,
        previousRole,
      ) =>
        total +
        getRoleTargetCredits(
          state,
          previousRole,
        ),
      0,
    )

  const spentBefore =
    previousRoles.reduce(
      (
        total,
        previousRole,
      ) =>
        total +
        participant.spent[
          previousRole
        ],
      0,
    )

  const carry =
    plannedBefore -
    spentBefore

  const currentTarget =
    Math.max(
      1,
      getRoleTargetCredits(
        state,
        role,
      ),
    )

  const availableForRole =
    currentTarget +
    carry

  const roleMargin =
    availableForRole -
    participant.spent[
      role
    ]

  const ratio =
    roleMargin /
    currentTarget

  if (ratio > 1) {
    return {
      width,
      color: '#5AA8FF',
      description:
        'Più margine del piano nel ruolo attivo',
    }
  }

  if (ratio > 0.55) {
    return {
      width,
      color: '#46E6A1',
      description:
        'Margine alto nel ruolo attivo',
    }
  }

  if (ratio > 0.2) {
    return {
      width,
      color: '#E7C94C',
      description:
        'Margine ridotto nel ruolo attivo',
    }
  }

  return {
    width,
    color: '#E45E5E',
    description:
      'Budget del ruolo in tensione',
  }
}

/* =========================
   ROLE TABS
========================= */

function renderRoleTabs():
  string {
  return ROLE_ORDER
    .map(
      (role) => `
        <button
          type="button"
          class="
            auction-role-tab
            ${
              role ===
              activeRole
                ? 'active'
                : ''
            }
          "
          data-auction-role="${role}"
        >
          ${role}
        </button>
      `,
    )
    .join('')
}

/* =========================
   SELECTOR
========================= */

function getTeams():
  string[] {
  return Array.from(
    new Set(
      players.map(
        (player) =>
          player.team,
      ),
    ),
  ).sort(
    (first, second) =>
      first.localeCompare(
        second,
        'it',
      ),
  )
}

function renderSelector(
  state: AppState,
):
  string {
  if (!selectorMode) {
    return ''
  }

  const teamMode =
    selectorMode ===
    'team'

  const visiblePlayers =
    teamMode &&
    selectedTeamFilter
      ? players.filter(
          (player) =>
            normalizeText(
              player.team,
            ) ===
            normalizeText(
              selectedTeamFilter,
            ),
        )
      : players

  return `
    <div
      id="auctionPlayerSelectorOverlay"
      class="overlay"
      aria-hidden="false"
    >
      <div
        class="overlay-backdrop"
      ></div>

      <div
        class="
          overlay-card
          auction-selector-card
        "
      >
        <div class="overlay-header">
          <div>
            <span class="eyebrow">
              CHIAMATA
            </span>

            <h2>
              ${
                teamMode
                  ? 'Seleziona squadra'
                  : 'Seleziona giocatore'
              }
            </h2>
          </div>

          <button
            id="closeAuctionSelectorButton"
            type="button"
            class="icon-button"
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        ${
          teamMode
            ? `
              <div
                class="auction-team-selector"
              >
                ${getTeams()
                  .map(
                    (team) => `
                      <button
                        type="button"
                        class="
                          auction-team-choice
                          ${
                            normalizeText(
                              team,
                            ) ===
                            normalizeText(
                              selectedTeamFilter,
                            )
                              ? 'selected'
                              : ''
                          }
                        "
                        data-auction-team="${escapeHtml(
                          team,
                        )}"
                      >
                        ${escapeHtml(
                          team,
                        )}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
            `
            : ''
        }

        ${
          !teamMode ||
          selectedTeamFilter
            ? `
              <div
                class="auction-selector-search"
              >
                <input
                  id="auctionSelectorSearch"
                  type="search"
                  placeholder="Cerca giocatore..."
                  autocomplete="off"
                >
              </div>

              ${
                teamMode
                  ? `
                    <div
                      class="auction-selected-team"
                    >
                      <span>
                        Squadra
                      </span>

                      <strong>
                        ${escapeHtml(
                          selectedTeamFilter,
                        )}
                      </strong>

                      <button
                        id="changeAuctionTeamButton"
                        type="button"
                      >
                        Cambia
                      </button>
                    </div>
                  `
                  : ''
              }

              <div
                id="auctionSelectorResults"
                class="auction-selector-results"
              >
                ${visiblePlayers
                  .map(
                    (player) => {
                      const assigned =
                        isPlayerAssigned(
                          state,
                          player.id,
                        )

                      return `
                        <button
                          type="button"
                          class="
                            auction-selector-player
                            ${
                              assigned
                                ? 'assigned'
                                : ''
                            }
                          "
                          data-auction-select-player="${escapeHtml(
                            player.id,
                          )}"
                          data-search="${escapeHtml(
                            normalizeText(
                              `${player.name} ${player.team}`,
                            ),
                          )}"
                          ${
                            assigned
                              ? 'disabled'
                              : ''
                          }
                        >
                          <span
                            class="
                              auction-role-badge
                              role-${player.role.toLowerCase()}
                            "
                          >
                            ${player.role}
                          </span>

                          <span>
                            <strong>
                              ${escapeHtml(
                                player.name,
                              )}
                            </strong>

                            <small>
                              ${escapeHtml(
                                player.team,
                              )}
                            </small>
                          </span>

                          <em>
                            ${
                              assigned
                                ? 'Assegnato'
                                : formatNumber(
                                    player.iCa,
                                    2,
                                  )
                            }
                          </em>
                        </button>
                      `
                    },
                  )
                  .join('')}
              </div>
            `
            : `
              <p class="muted-text">
                Scegli prima una squadra.
              </p>
            `
        }
      </div>
    </div>
  `
}

function renderPlayerSearchStrip():
  string {
  return `
    <section
      class="auction-search-strip"
    >
      <div
        class="auction-search-copy"
      >
        <span class="auction-kicker">
          CHIAMATA CORRENTE
        </span>

        <strong>
          Seleziona il giocatore
          chiamato
        </strong>
      </div>

      <div
        class="auction-call-selectors"
      >
        <button
          id="selectAuctionTeamButton"
          type="button"
          class="auction-call-selector"
        >
          <span>▦</span>

          <div>
            <small>
              Ricerca rapida
            </small>

            <strong>
              Seleziona squadra
            </strong>
          </div>
        </button>

        <button
          id="selectAuctionPlayerButton"
          type="button"
          class="
            auction-call-selector
            primary
          "
        >
          <span>⌕</span>

          <div>
            <small>
              Tutto il listone
            </small>

            <strong>
              Seleziona giocatore
            </strong>
          </div>
        </button>
      </div>
    </section>
  `
}

/* =========================
   PLAYER CARD
========================= */

function renderPlayerCard(
  state: AppState,
  player: Player,
): string {
  const fldaId = getFldaIdForLegacyId(player.id)
  const historicalDetail = fldaId ? getCachedPlayerDetail(fldaId) : undefined
  const assignment =
    getAssignmentByPlayer(
      state,
      player.id,
    )

  const isAssigned =
    Boolean(
      assignment,
    )

  const assignedManager =
    assignment
      ? getManagerById(
          state,
          assignment.managerId,
        )
      : undefined

  const priceAdvice =
    calculatePriceAdvice(
      state,
      player,
      players,
    )

  const bindingLabel =
    priceAdvice
      .bindingConstraints
      .length
      ? priceAdvice
          .bindingConstraints
          .map(
            getConstraintLabel,
          )
          .join(' + ')
      : 'dinamico'

  const marketSourceLabel =
    priceAdvice
      .auctionMarketSource ===
      'role'
      ? `ruolo ${player.role}`
      : priceAdvice
          .auctionMarketSource ===
          'overall'
        ? 'asta generale'
        : 'PMA base'

  const marketSampleLabel =
    priceAdvice
      .auctionMarketSampleSize >
    0
      ? `${priceAdvice.auctionMarketSampleSize} acquisti`
      : 'nessun acquisto utile'

  const startingWidth =
    clamp(
      player.startingProbability ??
        0,
      0,
      100,
    )

  return `
    <section
      class="auction-player-card"
    >
      <div
        class="auction-player-header"
      >
        <div
          class="auction-player-identity"
        >
          <span
            class="
              auction-role-badge
              large
              role-${player.role.toLowerCase()}
            "
          >
            ${player.role}
          </span>

          <div>
            <span class="auction-kicker">
              GIOCATORE IN ASTA
            </span>

            <h2>
              ${escapeHtml(
                player.name,
              )}
            </h2>

            <p>
              ${escapeHtml(
                player.team,
              )}
              · ${player.role}

              ${
                priceAdvice.playerSlot
                  ? ` · Slot ${priceAdvice.playerSlot}`
                  : ''
              }
            </p>

            <button
              type="button"
              class="auction-player-detail-trigger"
              data-open-player-detail="${escapeHtml(
                player.id,
              )}"
            >
              Apri scheda completa
            </button>
          </div>
        </div>

        <div
          class="auction-player-status"
        >
          <span
            class="
              auction-availability
              ${
                isAssigned
                  ? 'assigned'
                  : ''
              }
            "
          >
            ${
              isAssigned
                ? 'ASSEGNATO'
                : 'DA ASSEGNARE'
            }
          </span>
        </div>
      </div>

      <div
        class="auction-main-values"
      >
        <div
          class="
            auction-main-value
            featured
          "
        >
          <span>iCà</span>

          <strong>
            ${formatNumber(
              player.iCa,
              2,
            )}
          </strong>
        </div>

        <div class="auction-main-value">
          <span>PMA</span>

          <strong>
            ${formatPercent(
              player.pmaPercent,
              1,
            )}
          </strong>
        </div>

        <div class="auction-main-value">
          <span>Consenso</span>

          <strong>
            ${formatNumber(
              player.consensus,
              2,
            )}
          </strong>
        </div>

        <div
          class="
            auction-main-value
            auction-history-value
          "
        >
          <span>
            Prezzo storico A/B
          </span>

          <strong>
            ${displayHistoricalAuctionPrices(historicalDetail)}
          </strong>

          <small>
            ${historicalDetail?.auction_prices?.length ? 'stagione 2025/26' : 'storico non disponibile'}
          </small>
        </div>
      </div>

      <div
        class="auction-insight-row"
      >
        <div
          class="auction-insight-metric"
        >
          <span>
            MV
          </span>

          <strong>
            ${formatNumber(
              player.mv,
              2,
            )}
          </strong>
        </div>

        <div
          class="auction-insight-metric"
        >
          <span>
            FMV
          </span>

          <strong>
            ${formatNumber(
              player.fmv,
              2,
            )}
          </strong>
        </div>

        <div
          class="auction-starting-insight"
        >
          <span>
            Titolarità
          </span>

          <div
            class="auction-insight-progress"
            aria-label="Titolarità ${formatPercent(
              player.startingProbability,
              0,
            )}"
          >
            <span
              style="
                width:
                ${startingWidth}%;
              "
            ></span>
          </div>

          <strong>
            ${formatPercent(
              player.startingProbability,
              0,
            )}
          </strong>
        </div>
      </div>

      <div
        class="auction-recommendation"
      >
        <div
          class="auction-price-summary"
        >
          <div
            class="auction-recommendation-primary"
          >
            <span>
              Tetto consigliato
            </span>

            <strong>
              ${formatCredits(
                priceAdvice
                  .recommendedCeiling,
              )}
            </strong>

            <small>
              ${escapeHtml(
                bindingLabel,
              )}
              · hard cap finanziario
            </small>
          </div>

          ${renderBidSignal(
            priceAdvice,
          )}
        </div>

        <div
          class="auction-price-limits"
        >
          <div
            class="
              auction-price-limit
              value
            "
          >
            <span>
              Valore asta
            </span>

            <strong>
              ${formatCredits(
                priceAdvice.valueLimit,
              )}
            </strong>

            <small>
              PMA
              ${formatCredits(
                priceAdvice.pmaCredits,
              )}
              ·
              ${formatMarketFactor(
                priceAdvice
                  .auctionMarketFactor,
              )}
            </small>

            <small>
              ${escapeHtml(
                marketSourceLabel,
              )}
              ·
              ${escapeHtml(
                marketSampleLabel,
              )}
            </small>

            <small>
              Supply
              ${
                priceAdvice.supply ??
                '—'
              }
              · Domanda
              ${
                priceAdvice.demand ??
                '—'
              }
            </small>
          </div>

          <div
            class="
              auction-price-limit
              role
            "
          >
            <span>
              Limite reparto
            </span>

            <strong>
              ${formatCredits(
                priceAdvice.roleLimit,
              )}
            </strong>

            <small>
              strategia
              ${player.role}
            </small>
          </div>

          <div
            class="
              auction-price-limit
              financial
            "
          >
            <span>
              Limite finanziario
            </span>

            <strong>
              ${formatCredits(
                priceAdvice
                  .financialLimit,
              )}
            </strong>

            <small>
              hard cap rosa
            </small>
          </div>
        </div>
      </div>

      <div
        class="auction-live-price-row"
      >
        <label
          class="auction-live-price-field"
        >
          <span>
            Prezzo corrente
          </span>

          <input
            id="auctionPriceInput"
            type="number"
            inputmode="numeric"
            min="0"
            step="1"
            placeholder="0"
            ${
              isAssigned
                ? 'disabled'
                : ''
            }
          >
        </label>

        <div
          class="auction-price-stepper"
        >
          <button
            id="auctionPricePlusOneButton"
            type="button"
            ${
              isAssigned
                ? 'disabled'
                : ''
            }
          >
            +1
          </button>

          <button
            id="auctionPricePlusTenButton"
            type="button"
            ${
              isAssigned
                ? 'disabled'
                : ''
            }
          >
            +10
          </button>
        </div>

        <button
          id="auctionOpenAwardButton"
          type="button"
          class="auction-primary-action"
          ${
            isAssigned
              ? 'disabled'
              : ''
          }
        >
          Aggiudicato
        </button>

        <button
          id="auctionUnsoldButton"
          type="button"
          class="auction-secondary-action"
          ${
            isAssigned
              ? 'disabled'
              : ''
          }
        >
          Invenduto
        </button>

        <button
          id="auctionCancelCallButton"
          type="button"
          class="auction-secondary-action"
        >
          Annulla
        </button>
      </div>

      ${
        assignment
          ? `
            <div
              class="auction-current-assignment"
            >
              <span>
                Assegnato a
              </span>

              <strong>
                ${escapeHtml(
                  assignedManager
                    ? managerDisplayName(
                        assignedManager,
                      )
                    : 'Manager non disponibile',
                )}
              </strong>

              <span>
                per
              </span>

              <strong>
                ${assignment.price} cr
              </strong>

              <button
                type="button"
                data-edit-assignment="${escapeHtml(
                  assignment.id,
                )}"
              >
                Modifica
              </button>

              <button
                type="button"
                data-remove-assignment="${escapeHtml(
                  assignment.id,
                )}"
              >
                Annulla
              </button>
            </div>
          `
          : ''
      }

      ${
        auctionFeedback
          ? `
            <div
              class="auction-feedback"
              aria-live="polite"
            >
              ${escapeHtml(
                auctionFeedback,
              )}
            </div>
          `
          : ''
      }
    </section>
  `
}

/* =========================
   AWARD OVERLAY
========================= */

function renderAwardOverlay(
  state: AppState,
  participants:
    AuctionParticipantState[],
): string {
  if (!awardOverlayOpen) {
    return ''
  }

  const player =
    getSelectedPlayer(
      state,
    )

  if (!player) {
    return ''
  }

  const price =
    pendingAwardPrice ??
    0

  return `
    <div
      id="auctionAwardOverlay"
      class="overlay"
      aria-hidden="false"
    >
      <div
        class="overlay-backdrop"
      ></div>

      <div
        class="
          overlay-card
          auction-award-overlay
        "
      >
        <div
          class="overlay-header"
        >
          <div>
            <span class="eyebrow">
              AGGIUDICAZIONE
            </span>

            <h2>
              ${escapeHtml(
                player.name,
              )}
            </h2>

            <p>
              ${escapeHtml(
                player.team,
              )}
              · ${player.role}
            </p>
          </div>

          <button
            id="closeAuctionAwardButton"
            type="button"
            class="icon-button"
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <section
          class="
            auction-award-section
            auction-award-winner-section
          "
        >
          <div
            class="auction-award-section-heading"
          >
            <div>
              <span
                class="auction-award-section-kicker"
              >
                VINCITORE
              </span>

              <strong>
                Assegnazione definitiva
              </strong>
            </div>

            <span
              class="auction-award-winner-icon"
              aria-hidden="true"
            >
              ✓
            </span>
          </div>

          <div
            class="auction-award-winner-grid"
          >
            <label
              class="auction-award-field"
            >
              <span>
                Prezzo finale
              </span>

              <div
                class="
                  auction-award-price-input-wrap
                "
              >
                <input
                  id="auctionAwardPrice"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  step="1"
                  value="${price}"
                >

                <span>
                  cr
                </span>
              </div>
            </label>

            <label
              class="auction-award-field"
            >
              <span>
                Manager vincitore
              </span>

              <select
                id="auctionAwardWinner"
              >
                <option value="">
                  Seleziona manager
                </option>

                ${participants
                  .map(
                    (participant) => `
                      <option
                        value="${escapeHtml(
                          participant.id,
                        )}"
                      >
                        ${escapeHtml(
                          participant.name,
                        )}
                      </option>
                    `,
                  )
                  .join('')}
              </select>
            </label>
          </div>
        </section>

        <section
          class="
            auction-award-section
            auction-award-rival-section
          "
        >
          <div
            class="auction-award-section-heading"
          >
            <div>
              <div
                class="auction-award-rival-title-row"
              >
                <span
                  class="auction-award-section-kicker"
                >
                  ULTIMO RILANCIO AVVERSARIO
                </span>

                <span
                  class="auction-award-optional-badge"
                >
                  OPZIONALE
                </span>
              </div>

              <strong>
                Informazione di mercato
              </strong>
            </div>
          </div>

          <div
            class="auction-award-rival-grid"
          >
            <label
              class="auction-award-field"
            >
              <span>
                Manager
              </span>

              <select
                id="auctionSecondBidder"
              >
                <option value="">
                  Nessuno / non inserito
                </option>

                ${participants
                  .map(
                    (participant) => `
                      <option
                        value="${escapeHtml(
                          participant.id,
                        )}"
                      >
                        ${escapeHtml(
                          participant.name,
                        )}
                      </option>
                    `,
                  )
                  .join('')}
              </select>
            </label>

            <label
              class="auction-award-field"
            >
              <span>
                Sua ultima offerta
              </span>

              <div
                class="
                  auction-award-price-input-wrap
                  auction-award-rival-price-wrap
                "
              >
                <input
                  id="auctionSecondBidPrice"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  step="1"
                  placeholder="—"
                >

                <span>
                  cr
                </span>
              </div>
            </label>
          </div>
        </section>

        <div
          class="auction-award-note"
        >
          <strong>
            Il giocatore viene assegnato
            solo al vincitore.
          </strong>

          <span>
            L'ultimo rilancio avversario
            è un dato opzionale salvato
            nello storico e non modifica
            ancora gli algoritmi.
          </span>
        </div>

        <div
          class="
            overlay-actions
            auction-award-actions
          "
        >
          <button
            id="cancelAuctionAwardButton"
            type="button"
            class="secondary-button"
          >
            Annulla
          </button>

          <button
            id="confirmAuctionAwardButton"
            type="button"
            class="
              primary-button
              auction-award-confirm-button
            "
          >
            Registra aggiudicazione
          </button>
        </div>
      </div>
    </div>
  `
}

/* =========================
   DISCARDS
========================= */

function renderDiscardedPlayers(
  state: AppState,
): string {
  const discarded =
    getDiscardedPlayersForRole(
      state,
      activeRole,
    )

  if (
    discarded.length === 0
  ) {
    return ''
  }

  return `
    <div
      class="auction-discarded-block"
    >
      <button
        type="button"
        class="auction-discarded-toggle"
        id="toggleDiscardedPlayersButton"
      >
        <span>
          Scartati ${activeRole}
          · ${discarded.length}
        </span>

        <b>
          ${
            discardedPanelOpen
              ? '−'
              : '+'
          }
        </b>
      </button>

      ${
        discardedPanelOpen
          ? `
            <div
              class="auction-discarded-list"
            >
              ${discarded
                .map(
                  (player) => `
                    <div
                      class="auction-discarded-row"
                    >
                      <div>
                        <strong>
                          ${escapeHtml(
                            player.name,
                          )}
                        </strong>

                        <span>
                          ${escapeHtml(
                            player.team,
                          )}
                        </span>
                      </div>

                      <button
                        type="button"
                        data-restore-recommended="${escapeHtml(
                          player.id,
                        )}"
                      >
                        Riabilita
                      </button>
                    </div>
                  `,
                )
                .join('')}

              <button
                type="button"
                id="restoreAllRecommendedButton"
                class="auction-restore-all"
              >
                Riabilita tutti
              </button>
            </div>
          `
          : ''
      }
    </div>
  `
}

/* =========================
   RECOMMENDED CALL
========================= */

function renderSuggestedPlayersPanel(
  state: AppState,
): string {
  const recommendation =
    calculateRecommendation(
      state,
      activeRole,
      players,
    )

  const recommended =
    recommendation.recommended

  const discarded =
    getDiscardedPlayersForRole(
      state,
      activeRole,
    )

  if (!recommended) {
    const roleCompleted =
      activeRole === 'P'
        ? state
            .auctionAssignments
            .filter(
              (assignment) => {
                const player =
                  getPlayer(
                    assignment.playerId,
                  )

                const manager =
                  getManagerById(
                    state,
                    assignment.managerId,
                  )

                return Boolean(
                  player &&
                  player.role ===
                    'P' &&
                  manager?.isOwner,
                )
              },
            )
            .length >=
          ROSTER_SLOT_LIMITS.P
        : recommendation.targetSlot ===
          undefined

    return `
      <aside
        class="
          auction-next-panel
          auction-suggested-panel
        "
      >
        <div
          class="auction-panel-title"
        >
          <div>
            <span
              class="auction-kicker"
            >
              RUOLO ${activeRole}
            </span>

            <h3>
              Chiamata consigliata
            </h3>
          </div>
        </div>

        <div
          class="auction-next-list"
        >
          <div
            class="auction-recommendation-placeholder"
          >
            ${
              roleCompleted
                ? `Il reparto ${activeRole} è già completo.`
                : activeRole === 'P'
                  ? discarded.length
                    ? 'Non ci sono altre terne strategiche disponibili: controlla gli scartati P.'
                    : 'Nessuna terna portieri valida disponibile con le gerarchie e le fasce correnti.'
                  : discarded.length
                    ? `Non ci sono altri candidati automatici: controlla gli scartati ${activeRole}.`
                    : 'Nessun candidato disponibile.'
            }
          </div>
        </div>

        ${renderDiscardedPlayers(
          state,
        )}
      </aside>
    `
  }

  const player =
    recommended.player

  const targetLabel =
    activeRole === 'P'
      ? 'P'
      : recommendation.targetSlot
        ? `${activeRole}${recommendation.targetSlot}`
        : activeRole

  const slotLabel =
    activeRole === 'P'
      ? recommended.playerSlot
        ? `P${recommended.playerSlot}`
        : 'P'
      : recommended.playerSlot
        ? `${player.role}${recommended.playerSlot}`
        : player.role

  return `
    <aside
      class="
        auction-next-panel
        auction-suggested-panel
      "
    >
      <div
        class="auction-panel-title"
      >
        <div>
          <span
            class="auction-kicker"
          >
            ${
              activeRole === 'P'
                ? 'STRATEGIA PORTIERI · AUTO'
                : `SERVE ${targetLabel}`
            }
          </span>

          <h3>
            Chiamata consigliata
          </h3>
        </div>
      </div>

      <div
        class="auction-call-recommendation"
      >
        <div
          class="auction-call-recommendation-head"
        >
          <div>
            <button
              type="button"
              class="auction-recommendation-name-button"
              data-open-player-detail="${escapeHtml(
                player.id,
              )}"
            >
              <strong>
                ${escapeHtml(
                  player.name,
                )}
              </strong>
            </button>

            <span>
              ${escapeHtml(
                player.team,
              )}
              ·
              ${slotLabel}
            </span>
          </div>

          <span
            class="
              auction-role-badge
              role-${player.role.toLowerCase()}
            "
          >
            ${player.role}
          </span>
        </div>

        <div
          class="auction-call-reasons"
        >
          ${recommended.reasons
            .map(
              (reason) => `
                <div
                  class="auction-call-reason"
                >
                  <span>✓</span>

                  <p>
                    ${escapeHtml(
                      reason,
                    )}
                  </p>
                </div>
              `,
            )
            .join('')}
        </div>

        <div
          class="auction-call-meta"
        >
          ${
            activeRole === 'P'
              ? `
                <span>
                  Gerarchia
                  <strong>
                    ${
                      recommended.playerSlot
                        ? `P${recommended.playerSlot}`
                        : '—'
                    }
                  </strong>
                </span>

                <span>
                  Consenso
                  <strong>
                    ${formatNumber(
                      player.consensus,
                      2,
                    )}
                  </strong>
                </span>

                <span>
                  Valore
                  <strong>
                    ${formatCredits(
                      recommended
                        .priceAdvice
                        .valueLimit,
                    )}
                  </strong>
                </span>
              `
              : `
                <span>
                  iCà
                  <strong>
                    ${formatNumber(
                      player.iCa,
                      2,
                    )}
                  </strong>
                </span>

                <span>
                  Valore
                  <strong>
                    ${formatCredits(
                      recommended
                        .priceAdvice
                        .valueLimit,
                    )}
                  </strong>
                </span>

                <span>
                  Slot
                  <strong>
                    ${
                      recommended.playerSlot ??
                      '—'
                    }
                  </strong>
                </span>
              `
          }
        </div>

        <div
          class="auction-call-actions"
        >
          <button
            type="button"
            class="auction-call-primary-button"
            data-call-recommended="${escapeHtml(
              player.id,
            )}"
          >
            CHIAMA
          </button>

          <button
            type="button"
            class="auction-call-discard-button"
            data-discard-recommended="${escapeHtml(
              player.id,
            )}"
          >
            SCARTA
          </button>
        </div>
      </div>

      ${
        recommendation
          .alternatives
          .length
          ? `
            <div
              class="auction-call-alternatives"
            >
              <span
                class="auction-call-alternatives-title"
              >
                Alternative
              </span>

              ${recommendation
                .alternatives
                .map(
                  (candidate) => `
                    <div
                      class="auction-call-alternative"
                    >
                      <div>
                        <button
                          type="button"
                          class="auction-recommendation-name-button"
                          data-open-player-detail="${escapeHtml(
                            candidate
                              .player
                              .id,
                          )}"
                        >
                          <strong>
                            ${escapeHtml(
                              candidate
                                .player
                                .name,
                            )}
                          </strong>
                        </button>

                        <span>
                          ${escapeHtml(
                            candidate
                              .player
                              .team,
                          )}
                          ${
                            activeRole === 'P' &&
                            candidate.playerSlot
                              ? ` · P${candidate.playerSlot}`
                              : ''
                          }
                        </span>
                      </div>

                      <button
                        type="button"
                        data-call-recommended="${escapeHtml(
                          candidate
                            .player
                            .id,
                        )}"
                      >
                        Chiama
                      </button>
                    </div>
                  `,
                )
                .join('')}
            </div>
          `
          : ''
      }

      ${renderDiscardedPlayers(
        state,
      )}
    </aside>
  `
}

/* =========================
   TOP ICA
========================= */

function renderTopICaPanel(
  state: AppState,
): string {
  const candidates =
    getRolePlayers(
      activeRole,
    )
      .filter(
        (player) =>
          !isPlayerAssigned(
            state,
            player.id,
          ) &&
          player.iCa !==
            undefined &&
          Number.isFinite(
            player.iCa,
          ),
      )
      .sort(
        (
          first,
          second,
        ) =>
          (
            second.iCa ??
            -Infinity
          ) -
          (
            first.iCa ??
            -Infinity
          ),
      )
      .slice(
        0,
        5,
      )

  return `
    <aside
      class="
        auction-next-panel
        auction-top-ica-panel
      "
    >
      <div
        class="auction-panel-title"
      >
        <div>
          <span class="auction-kicker">
            NON ASSEGNATI
          </span>

          <h3>
            Top iCà · ${activeRole}
          </h3>
        </div>
      </div>

      <div
        class="auction-top-ica-list"
      >
        ${candidates
          .map(
            (player) => `
              <div
                class="auction-top-ica-row"
              >
                <button
                  type="button"
                  class="auction-top-ica-name-button"
                  data-open-player-detail="${escapeHtml(
                    player.id,
                  )}"
                >
                  <strong>
                    ${escapeHtml(
                      player.name,
                    )}
                  </strong>
                </button>

                <b>
                  ${formatNumber(
                    player.iCa,
                    2,
                  )}
                </b>

                <button
                  type="button"
                  data-call-top-ica="${escapeHtml(
                    player.id,
                  )}"
                >
                  Chiama
                </button>
              </div>
            `,
          )
          .join('')}
      </div>
    </aside>
  `
}

function renderSidePanels(
  state: AppState,
): string {
  return `
    <div
      class="auction-side-panels"
    >
      ${renderSuggestedPlayersPanel(
        state,
      )}

      ${renderTopICaPanel(
        state,
      )}
    </div>
  `
}

/* =========================
   PARTICIPANTS
========================= */

function renderParticipants(
  state: AppState,
  participants:
    AuctionParticipantState[],
): string {
  return `
    <section
      class="auction-participants-section"
    >
      <div
        class="auction-section-heading"
      >
        <div>
          <span class="auction-kicker">
            MERCATO LIVE
          </span>

          <h3>
            Partecipanti
          </h3>
        </div>
      </div>

      <div
        class="auction-participant-grid"
      >
        ${participants
          .map(
            (participant) => {
              const remaining =
                getRemainingCredits(
                  participant,
                  state,
                )

              const bar =
                getBudgetBarData(
                  participant,
                  state,
                  activeRole,
                )

              return `
                <article
                  class="
                    auction-participant-card
                    ${
                      participant.isOwner
                        ? 'owner'
                        : ''
                    }
                  "
                >
                  <div
                    class="auction-participant-top"
                  >
                    <strong>
                      ${escapeHtml(
                        participant.name,
                      )}
                    </strong>

                    <span>
                      ${remaining}
                    </span>
                  </div>

                  <div
                    class="auction-budget-track"
                    title="${escapeHtml(
                      bar.description,
                    )}"
                  >
                    <span
                      style="
                        width:
                        ${bar.width.toFixed(
                          2,
                        )}%;

                        background:
                        ${bar.color};
                      "
                    ></span>
                  </div>

                  <div
                    class="auction-slot-row"
                  >
                    ${ROLE_ORDER
                      .map(
                        (role) => `
                          <span
                            class="
                              auction-slot
                              role-${role.toLowerCase()}
                              ${
                                role ===
                                activeRole
                                  ? 'active'
                                  : ''
                              }
                            "
                          >
                            ${role}

                            ${
                              participant.slots[
                                role
                              ]
                            }/${
                              ROSTER_SLOT_LIMITS[
                                role
                              ]
                            }
                          </span>
                        `,
                      )
                      .join('')}
                  </div>
                </article>
              `
            },
          )
          .join('')}
      </div>
    </section>
  `
}

/* =========================
   HISTORY
========================= */

function renderAssignmentHistory(
  state: AppState,
): string {
  const assignments =
    state.auctionAssignments

  return `
    <section
      class="auction-history-section"
    >
      <div
        class="auction-history-heading"
      >
        <div>
          <span class="auction-kicker">
            SESSIONE LIVE
          </span>

          <h3>
            Storico assegnazioni
          </h3>
        </div>

        <span
          class="auction-history-count"
        >
          ${assignments.length}
        </span>
      </div>

      ${
        assignments.length ===
        0
          ? `
            <div
              class="auction-history-empty"
            >
              Nessuna assegnazione.
            </div>
          `
          : `
            <div
              class="auction-history-list"
            >
              ${[...assignments]
                .reverse()
                .map(
                  (assignment) => {
                    const player =
                      getPlayer(
                        assignment.playerId,
                      )

                    const manager =
                      getManagerById(
                        state,
                        assignment.managerId,
                      )

                    const secondManager =
                      assignment
                        .secondBidderManagerId
                        ? getManagerById(
                            state,
                            assignment
                              .secondBidderManagerId,
                          )
                        : undefined

                    if (!player) {
                      return ''
                    }

                    return `
                      <article
                        class="auction-history-row"
                      >
                        <span
                          class="
                            auction-role-badge
                            role-${player.role.toLowerCase()}
                          "
                        >
                          ${player.role}
                        </span>

                        <div
                          class="auction-history-player"
                        >
                          <strong>
                            ${escapeHtml(
                              player.name,
                            )}
                          </strong>

                          <small>
                            ${escapeHtml(
                              player.team,
                            )}
                          </small>
                        </div>

                        <div
                          class="auction-history-manager"
                        >
                          <span>
                            Vincitore
                          </span>

                          <strong>
                            ${escapeHtml(
                              manager
                                ? managerDisplayName(
                                    manager,
                                  )
                                : '—',
                            )}
                          </strong>

                          ${
                            secondManager
                              ? `
                                <small>
                                  2° rilancio:
                                  ${escapeHtml(
                                    managerDisplayName(
                                      secondManager,
                                    ),
                                  )}
                                  ${
                                    assignment
                                      .secondBidPrice !==
                                    undefined
                                      ? ` · ${assignment.secondBidPrice} cr`
                                      : ''
                                  }
                                </small>
                              `
                              : ''
                          }
                        </div>

                        <div
                          class="auction-history-price"
                        >
                          <span>Prezzo</span>

                          <strong>
                            ${assignment.price}
                          </strong>
                        </div>

                        <div
                          class="auction-history-actions"
                        >
                          <button
                            type="button"
                            data-edit-assignment="${escapeHtml(
                              assignment.id,
                            )}"
                          >
                            Modifica
                          </button>

                          <button
                            type="button"
                            class="danger"
                            data-remove-assignment="${escapeHtml(
                              assignment.id,
                            )}"
                          >
                            Annulla
                          </button>
                        </div>
                      </article>
                    `
                  },
                )
                .join('')}
            </div>
          `
      }
    </section>
  `
}

/* =========================
   EDIT ASSIGNMENT
========================= */

function renderEditAssignmentOverlay(
  state: AppState,
  participants:
    AuctionParticipantState[],
): string {
  if (
    editingAssignmentId ===
    null
  ) {
    return ''
  }

  const assignment =
    getAssignmentById(
      state,
      editingAssignmentId,
    )

  if (!assignment) {
    return ''
  }

  const player =
    getPlayer(
      assignment.playerId,
    )

  if (!player) {
    return ''
  }

  return `
    <div
      id="editAssignmentOverlay"
      class="overlay"
      aria-hidden="false"
    >
      <div
        class="overlay-backdrop"
      ></div>

      <div
        class="
          overlay-card
          auction-award-overlay
        "
      >
        <div class="overlay-header">
          <div>
            <span class="eyebrow">
              MODIFICA ASSEGNAZIONE
            </span>

            <h2>
              ${escapeHtml(
                player.name,
              )}
            </h2>
          </div>

          <button
            id="closeEditAssignmentButton"
            type="button"
            class="icon-button"
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div
          class="auction-award-grid"
        >
          <label>
            <span>
              Prezzo finale
            </span>

            <input
              id="editAssignmentPrice"
              type="number"
              inputmode="numeric"
              min="1"
              step="1"
              value="${assignment.price}"
            >
          </label>

          <label>
            <span>
              Vincitore
            </span>

            <select
              id="editAssignmentBuyer"
            >
              ${participants
                .map(
                  (participant) => `
                    <option
                      value="${escapeHtml(
                        participant.id,
                      )}"
                      ${
                        participant.id ===
                        assignment.managerId
                          ? 'selected'
                          : ''
                      }
                    >
                      ${escapeHtml(
                        participant.name,
                      )}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </label>

          <label>
            <span>
              Secondo offerente
            </span>

            <select
              id="editSecondBidder"
            >
              <option value="">
                Nessuno
              </option>

              ${participants
                .map(
                  (participant) => `
                    <option
                      value="${escapeHtml(
                        participant.id,
                      )}"
                      ${
                        participant.id ===
                        assignment
                          .secondBidderManagerId
                          ? 'selected'
                          : ''
                      }
                    >
                      ${escapeHtml(
                        participant.name,
                      )}
                    </option>
                  `,
                )
                .join('')}
            </select>
          </label>

          <label>
            <span>
              Offerta secondo
            </span>

            <input
              id="editSecondBidPrice"
              type="number"
              inputmode="numeric"
              min="1"
              step="1"
              value="${
                assignment
                  .secondBidPrice ??
                ''
              }"
              placeholder="—"
            >
          </label>
        </div>

        <div class="overlay-actions">
          <button
            id="cancelEditAssignmentButton"
            type="button"
            class="secondary-button"
          >
            Annulla
          </button>

          <button
            id="saveEditAssignmentButton"
            type="button"
            class="primary-button"
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  `
}

/* =========================
   FINALIZATION
========================= */

function renderFinalizationOverlay():
  string {
  return `
    <div
      id="finalizeAuctionOverlay"
      class="overlay"
      aria-hidden="false"
    >
      <div
        class="
          overlay-backdrop
          auction-finalization-backdrop
        "
      ></div>

      <div
        class="
          overlay-card
          small-overlay-card
          auction-finalization-overlay
        "
      >
        <div class="overlay-header">
          <div>
            <span class="eyebrow">
              ASTA TERMINATA
            </span>

            <h2>
              Come vuoi chiudere
              la sessione?
            </h2>
          </div>
        </div>

        <div
          class="auction-finalization-summary"
        >
          <p>
            Registra conserva le
            assegnazioni nello storico.
          </p>

          <p>
            Scarta elimina la sessione
            corrente.
          </p>
        </div>

        <div class="overlay-actions">
          <button
            id="discardAuctionButton"
            type="button"
            class="danger-button"
          >
            Scarta asta
          </button>

          <button
            id="archiveAuctionButton"
            type="button"
            class="primary-button"
          >
            Registra asta
          </button>
        </div>
      </div>
    </div>

    <div
      id="discardAuctionOverlay"
      class="overlay hidden"
      aria-hidden="true"
    >
      <div
        class="overlay-backdrop"
      ></div>

      <div
        class="
          overlay-card
          small-overlay-card
        "
      >
        <div class="overlay-header">
          <div>
            <span class="eyebrow">
              SCARTA ASTA
            </span>

            <h2>
              Conferma eliminazione
            </h2>
          </div>

          <button
            id="closeDiscardAuctionButton"
            type="button"
            class="icon-button"
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div class="danger-panel">
          <p>
            Le assegnazioni della
            sessione corrente verranno
            eliminate.
          </p>
        </div>

        <div class="overlay-actions">
          <button
            id="cancelDiscardAuctionButton"
            type="button"
            class="secondary-button"
          >
            Annulla
          </button>

          <button
            id="confirmDiscardAuctionButton"
            type="button"
            class="danger-button"
          >
            Scarta asta
          </button>
        </div>
      </div>
    </div>
  `
}

/* =========================
   LIVE
========================= */

function renderLiveAuction(
  state: AppState,
  finalizing = false,
): string {
  const participants =
    buildParticipants(
      state,
    )

  const selectedPlayer =
    getSelectedPlayer(
      state,
    )

  if (selectedPlayer) {
    activeRole =
      selectedPlayer.role
  }

  const owner =
    participants.find(
      (participant) =>
        participant.isOwner,
    ) ??
    participants[0]

  const ownerCredits =
    owner
      ? getRemainingCredits(
          owner,
          state,
        )
      : state.initialCredits

  const detailPlayer =
    getPlayer(
      detailPlayerId,
    )

  return `
    <section
      class="
        page
        auction-live-page
        ${
          finalizing
            ? 'is-finalizing'
            : ''
        }
      "
    >
      <div class="auction-live-toolbar">
        <div class="auction-live-title">
          <div>
            <span class="auction-kicker">
              MISTERCANÀ
            </span>

            <h1>Asta</h1>
          </div>

          <span
            class="
              live-badge
              ${
                finalizing
                  ? 'finalizing-badge'
                  : ''
              }
            "
          >
            ${
              finalizing
                ? 'CHIUSURA'
                : 'LIVE'
            }
          </span>
        </div>

        <div
          class="auction-role-switcher"
        >
          <span>
            Ruolo attivo
          </span>

          <div>
            ${renderRoleTabs()}
          </div>
        </div>

        <div
          class="auction-toolbar-stat"
        >
          <span>
            Crediti owner
          </span>

          <strong>
            ${ownerCredits}
          </strong>
        </div>

        <div
          class="auction-toolbar-actions"
        >
          <button
            id="goToPlayersButton"
            type="button"
            class="
              auction-toolbar-button
              auction-quick-nav
            "
          >
            Giocatori
          </button>

          <button
            id="goToObjectivesButton"
            type="button"
            class="
              auction-toolbar-button
              auction-quick-nav
            "
          >
            Obiettivi
          </button>

          <button
            id="undoLastAssignmentButton"
            type="button"
            class="auction-toolbar-button"
            ${
              state
                .auctionAssignments
                .length
                ? ''
                : 'disabled'
            }
          >
            ↶ Annulla ultima
          </button>

          <button
            id="endAuctionButton"
            type="button"
            class="danger-button"
          >
            Termina asta
          </button>
        </div>
      </div>

      ${renderPlayerSearchStrip()}

      <div class="auction-workspace">
        <div
          class="auction-workspace-main"
        >
          ${
            selectedPlayer
              ? renderPlayerCard(
                  state,
                  selectedPlayer,
                )
              : `
                <section
                  class="
                    auction-player-card
                    auction-no-player
                  "
                >
                  <span class="auction-kicker">
                    CHIAMATA CORRENTE
                  </span>

                  <h2>
                    Nessun giocatore
                    selezionato
                  </h2>

                  <p>
                    Seleziona squadra
                    o giocatore.
                  </p>
                </section>
              `
          }
        </div>

        ${renderSidePanels(
          state,
        )}
      </div>

      ${renderParticipants(
        state,
        participants,
      )}

      ${renderAssignmentHistory(
        state,
      )}

      ${
        finalizing
          ? ''
          : renderAwardOverlay(
              state,
              participants,
            )
      }

      ${
        finalizing
          ? ''
          : renderEditAssignmentOverlay(
              state,
              participants,
            )
      }

      ${
        finalizing
          ? ''
          : renderSelector(
              state,
            )
      }

      ${
        !finalizing &&
        detailPlayer
          ? renderPlayerDetailOverlay(
              detailPlayer,
              isPlayerAssigned(
                state,
                detailPlayer.id,
              ),
            )
          : ''
      }

      ${
        finalizing
          ? renderFinalizationOverlay()
          : ''
      }
    </section>
  `
}

/* =========================
   PAGE
========================= */

export function renderAuctionPage(
  state: AppState,
): string {
  if (
    state.auctionPhase ===
    'live'
  ) {
    return renderLiveAuction(
      state,
      false,
    )
  }

  if (
    state.auctionPhase ===
    'finalizing'
  ) {
    return renderLiveAuction(
      state,
      true,
    )
  }

  return `
    <section class="page">
      <h1>Asta</h1>

      <p>
        Asta non attiva.
      </p>
    </section>
  `
}

/* =========================
   EVENTS
========================= */

export function bindAuctionEvents(
  state: AppState,
  actions: AuctionActions,
): void {
  const selectedLegacyId = state.currentAuctionPlayerId
  const selectedFldaId = selectedLegacyId ? getFldaIdForLegacyId(selectedLegacyId) : undefined
  if (selectedLegacyId && (!selectedFldaId || !getCachedPlayerDetail(selectedFldaId))
      && !loadingHistoricalPrices.has(selectedLegacyId)
      && !attemptedHistoricalPrices.has(selectedLegacyId)) {
    loadingHistoricalPrices.add(selectedLegacyId)
    void loadPlayersDataset().then(() => {
      const fldaId = getFldaIdForLegacyId(selectedLegacyId)
      return fldaId ? loadPlayerDetail(fldaId) : undefined
    }).finally(() => {
      loadingHistoricalPrices.delete(selectedLegacyId)
      attemptedHistoricalPrices.add(selectedLegacyId)
      actions.onStateChange()
    })
  }
  if (
    state.auctionPhase ===
    'finalizing'
  ) {
    document
      .querySelector(
        '#archiveAuctionButton',
      )
      ?.addEventListener(
        'click',
        () => {
          state.recommendedDiscards =
            []

          actions.onArchiveAuction()
        },
      )

    const discardOverlay =
      document.querySelector<HTMLElement>(
        '#discardAuctionOverlay',
      )

    const openDiscardOverlay =
      (): void => {
        discardOverlay
          ?.classList
          .remove(
            'is-closing',
          )

        discardOverlay
          ?.classList
          .remove(
            'hidden',
          )

        discardOverlay
          ?.setAttribute(
            'aria-hidden',
            'false',
          )
      }

    const closeDiscardOverlay =
      (): void => {
        runOverlayExit(
          '#discardAuctionOverlay',
          () => {
            discardOverlay
              ?.classList
              .add(
                'hidden',
              )

            discardOverlay
              ?.classList
              .remove(
                'is-closing',
              )

            discardOverlay
              ?.setAttribute(
                'aria-hidden',
                'true',
              )
          },
        )
      }

    document
      .querySelector(
        '#discardAuctionButton',
      )
      ?.addEventListener(
        'click',
        openDiscardOverlay,
      )

    document
      .querySelector(
        '#closeDiscardAuctionButton',
      )
      ?.addEventListener(
        'click',
        closeDiscardOverlay,
      )

    document
      .querySelector(
        '#cancelDiscardAuctionButton',
      )
      ?.addEventListener(
        'click',
        closeDiscardOverlay,
      )

    document
      .querySelector(
        '#confirmDiscardAuctionButton',
      )
      ?.addEventListener(
        'click',
        () => {
          state.recommendedDiscards =
            []

          actions.onDiscardAuction()
        },
      )

    return
  }

  if (
    state.auctionPhase !==
    'live'
  ) {
    return
  }

  /* =========================
     PLAYER DETAIL
  ========================= */

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-open-player-detail]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const playerId =
              button.dataset
                .openPlayerDetail

            if (
              !playerId ||
              !getPlayer(
                playerId,
              )
            ) {
              return
            }

            detailPlayerId =
              playerId

            actions.onRender()
          },
        )
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-close-player-detail]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            runOverlayExit(
              '#playerDetailOverlay',
              () => {
                detailPlayerId =
                  null

                actions.onRender()
              },
            )
          },
        )
      },
    )

  document
    .querySelector<HTMLButtonElement>(
      '[data-player-detail-call]',
    )
    ?.addEventListener(
      'click',
      (event) => {
        const button =
          event.currentTarget as
            HTMLButtonElement | null

        const playerId =
          button?.dataset
            .playerDetailCall

        if (!playerId) {
          return
        }

        callPlayer(
          state,
          playerId,
          actions,
        )
      },
    )

  document
    .querySelector(
      '#endAuctionButton',
    )
    ?.addEventListener(
      'click',
      actions.onEndAuction,
    )

  document
    .querySelector(
      '#goToPlayersButton',
    )
    ?.addEventListener(
      'click',
      actions.onGoToPlayers,
    )

  document
    .querySelector(
      '#goToObjectivesButton',
    )
    ?.addEventListener(
      'click',
      actions.onGoToObjectives,
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-auction-role]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const role =
              button.dataset
                .auctionRole as
                | AuctionRole
                | undefined

            if (!role) {
              return
            }

            activeRole =
              role

            discardedPanelOpen =
              false

            awardOverlayOpen =
              false

            pendingAwardPrice =
              null

            detailPlayerId =
              null

            state.currentAuctionPlayerId =
              null

            auctionFeedback =
              ''

            actions.onStateChange()
          },
        )
      },
    )

  document
    .querySelector(
      '#selectAuctionTeamButton',
    )
    ?.addEventListener(
      'click',
      () => {
        selectorMode =
          'team'

        selectedTeamFilter =
          ''

        detailPlayerId =
          null

        actions.onRender()
      },
    )

  document
    .querySelector(
      '#selectAuctionPlayerButton',
    )
    ?.addEventListener(
      'click',
      () => {
        selectorMode =
          'player'

        selectedTeamFilter =
          ''

        detailPlayerId =
          null

        actions.onRender()
      },
    )

  const closeSelector =
    (): void => {
      runOverlayExit(
        '#auctionPlayerSelectorOverlay',
        () => {
          selectorMode =
            null

          selectedTeamFilter =
            ''

          actions.onRender()
        },
      )
    }

  document
    .querySelector(
      '#closeAuctionSelectorButton',
    )
    ?.addEventListener(
      'click',
      closeSelector,
    )

  document
    .querySelector(
      '#auctionPlayerSelectorOverlay .overlay-backdrop',
    )
    ?.addEventListener(
      'click',
      closeSelector,
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-auction-team]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            selectedTeamFilter =
              button.dataset
                .auctionTeam ??
              ''

            actions.onRender()
          },
        )
      },
    )

  document
    .querySelector(
      '#changeAuctionTeamButton',
    )
    ?.addEventListener(
      'click',
      () => {
        selectedTeamFilter =
          ''

        actions.onRender()
      },
    )

  const selectorSearch =
    document.querySelector<HTMLInputElement>(
      '#auctionSelectorSearch',
    )

  const selectorResults =
    document.querySelector<HTMLElement>(
      '#auctionSelectorResults',
    )

  selectorSearch
    ?.addEventListener(
      'input',
      () => {
        const query =
          normalizeText(
            selectorSearch.value,
          )

        selectorResults
          ?.querySelectorAll<HTMLElement>(
            '[data-search]',
          )
          .forEach(
            (result) => {
              const searchable =
                result.dataset
                  .search ??
                ''

              result.hidden =
                Boolean(query) &&
                !searchable.includes(
                  query,
                )
            },
          )
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-auction-select-player]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            callPlayer(
              state,
              button.dataset
                .auctionSelectPlayer,
              actions,
            )
          },
        )
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-call-top-ica]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            callPlayer(
              state,
              button.dataset
                .callTopIca,
              actions,
            )
          },
        )
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-call-recommended]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            callPlayer(
              state,
              button.dataset
                .callRecommended,
              actions,
            )
          },
        )
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-discard-recommended]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const player =
              getPlayer(
                button.dataset
                  .discardRecommended ??
                  null,
              )

            if (!player) {
              return
            }

            if (
              !state
                .recommendedDiscards
                .includes(
                  player.id,
                )
            ) {
              state
                .recommendedDiscards
                .push(
                  player.id,
                )
            }

            auctionFeedback =
              `${player.name} escluso dalla Chiamata consigliata.`

            actions.onStateChange()
          },
        )
      },
    )

  document
    .querySelector(
      '#toggleDiscardedPlayersButton',
    )
    ?.addEventListener(
      'click',
      () => {
        discardedPanelOpen =
          !discardedPanelOpen

        actions.onRender()
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-restore-recommended]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const playerId =
              button.dataset
                .restoreRecommended

            if (!playerId) {
              return
            }

            state.recommendedDiscards =
              state
                .recommendedDiscards
                .filter(
                  (id) =>
                    id !==
                    playerId,
                )

            actions.onStateChange()
          },
        )
      },
    )

  document
    .querySelector(
      '#restoreAllRecommendedButton',
    )
    ?.addEventListener(
      'click',
      () => {
        state.recommendedDiscards =
          state
            .recommendedDiscards
            .filter(
              (playerId) => {
                const player =
                  getPlayer(
                    playerId,
                  )

                return (
                  !player ||
                  player.role !==
                    activeRole
                )
              },
            )

        discardedPanelOpen =
          false

        actions.onStateChange()
      },
    )

  const livePriceInput =
    document.querySelector<HTMLInputElement>(
      '#auctionPriceInput',
    )

  livePriceInput
    ?.addEventListener(
      'input',
      () => {
        const player =
          getSelectedPlayer(
            state,
          )

        if (!player) {
          return
        }

        const advice =
          calculatePriceAdvice(
            state,
            player,
            players,
          )

        const currentPrice =
          Number(
            livePriceInput.value,
          )

        updateBidSignalElement(
          advice,
          Number.isFinite(
            currentPrice,
          )
            ? currentPrice
            : 0,
        )
      },
    )

  document
    .querySelector(
      '#auctionPricePlusOneButton',
    )
    ?.addEventListener(
      'click',
      () => {
        updateLiveBidPrice(
          state,
          1,
        )
      },
    )

  document
    .querySelector(
      '#auctionPricePlusTenButton',
    )
    ?.addEventListener(
      'click',
      () => {
        updateLiveBidPrice(
          state,
          10,
        )
      },
    )

  document
    .querySelector(
      '#auctionOpenAwardButton',
    )
    ?.addEventListener(
      'click',
      () => {
        const player =
          getSelectedPlayer(
            state,
          )

        const priceInput =
          document.querySelector<HTMLInputElement>(
            '#auctionPriceInput',
          )

        if (
          !player ||
          !priceInput
        ) {
          return
        }

        const price =
          Number(
            priceInput.value,
          )

        if (
          !Number.isInteger(
            price,
          ) ||
          price <= 0
        ) {
          auctionFeedback =
            'Inserisci prima il prezzo finale.'

          actions.onRender()

          return
        }

        pendingAwardPrice =
          price

        awardOverlayOpen =
          true

        detailPlayerId =
          null

        actions.onRender()
      },
    )

  const closeAwardOverlay =
    (): void => {
      runOverlayExit(
        '#auctionAwardOverlay',
        () => {
          awardOverlayOpen =
            false

          actions.onRender()
        },
      )
    }

  document
    .querySelector(
      '#closeAuctionAwardButton',
    )
    ?.addEventListener(
      'click',
      closeAwardOverlay,
    )

  document
    .querySelector(
      '#cancelAuctionAwardButton',
    )
    ?.addEventListener(
      'click',
      closeAwardOverlay,
    )

  document
    .querySelector(
      '#auctionAwardOverlay .overlay-backdrop',
    )
    ?.addEventListener(
      'click',
      closeAwardOverlay,
    )

  const awardWinnerSelect =
    document.querySelector<HTMLSelectElement>(
      '#auctionAwardWinner',
    )

  const awardSecondSelect =
    document.querySelector<HTMLSelectElement>(
      '#auctionSecondBidder',
    )

  const syncAwardSecondBidder =
    (): void => {
      if (
        !awardWinnerSelect ||
        !awardSecondSelect
      ) {
        return
      }

      const winnerId =
        awardWinnerSelect.value

      Array.from(
        awardSecondSelect.options,
      ).forEach(
        (option) => {
          if (!option.value) {
            option.disabled =
              false

            return
          }

          option.disabled =
            Boolean(
              winnerId &&
              option.value ===
                winnerId,
            )
        },
      )

      if (
        winnerId &&
        awardSecondSelect.value ===
          winnerId
      ) {
        awardSecondSelect.value =
          ''
      }
    }

  awardWinnerSelect
    ?.addEventListener(
      'change',
      syncAwardSecondBidder,
    )

  syncAwardSecondBidder()

  document
    .querySelector(
      '#confirmAuctionAwardButton',
    )
    ?.addEventListener(
      'click',
      () => {
        const player =
          getSelectedPlayer(
            state,
          )

        const winnerSelect =
          document.querySelector<HTMLSelectElement>(
            '#auctionAwardWinner',
          )

        const priceInput =
          document.querySelector<HTMLInputElement>(
            '#auctionAwardPrice',
          )

        const secondBidderSelect =
          document.querySelector<HTMLSelectElement>(
            '#auctionSecondBidder',
          )

        const secondPriceInput =
          document.querySelector<HTMLInputElement>(
            '#auctionSecondBidPrice',
          )

        if (
          !player ||
          !winnerSelect ||
          !priceInput ||
          !secondBidderSelect ||
          !secondPriceInput
        ) {
          return
        }

        const participants =
          buildParticipants(
            state,
          )

        const winner =
          getParticipant(
            participants,
            winnerSelect.value,
          )

        const price =
          Number(
            priceInput.value,
          )

        if (!winner) {
          auctionFeedback =
            'Seleziona il vincitore.'

          awardOverlayOpen =
            false

          actions.onRender()

          return
        }

        if (
          !Number.isInteger(
            price,
          ) ||
          price <= 0
        ) {
          auctionFeedback =
            'Inserisci un prezzo finale valido.'

          awardOverlayOpen =
            false

          actions.onRender()

          return
        }

        const remaining =
          getRemainingCredits(
            winner,
            state,
          )

        if (
          price >
          remaining
        ) {
          auctionFeedback =
            `${winner.name} ha solo ${remaining} crediti residui.`

          awardOverlayOpen =
            false

          actions.onRender()

          return
        }

        if (
          winner.slots[
            player.role
          ] >=
          ROSTER_SLOT_LIMITS[
            player.role
          ]
        ) {
          auctionFeedback =
            `${winner.name} non ha più slot ${player.role}.`

          awardOverlayOpen =
            false

          actions.onRender()

          return
        }

        const secondBidderId =
          secondBidderSelect
            .value
            .trim()

        const secondBidPriceRaw =
          secondPriceInput
            .value
            .trim()

        const secondBidPrice =
          secondBidPriceRaw
            ? Number(
                secondBidPriceRaw,
              )
            : undefined

        if (
          secondBidderId &&
          secondBidderId ===
            winner.id
        ) {
          auctionFeedback =
            'Il vincitore non può essere anche il manager dell’ultimo rilancio avversario.'

          awardOverlayOpen =
            false

          actions.onRender()

          return
        }

        if (
          secondBidderId &&
          (
            secondBidPrice ===
              undefined ||
            !Number.isInteger(
              secondBidPrice,
            ) ||
            secondBidPrice <= 0
          )
        ) {
          auctionFeedback =
            'Inserisci l’ultima offerta del manager avversario.'

          awardOverlayOpen =
            false

          actions.onRender()

          return
        }

        if (
          !secondBidderId &&
          secondBidPrice !==
            undefined
        ) {
          auctionFeedback =
            'Seleziona il manager dell’ultimo rilancio oppure cancella la sua offerta.'

          awardOverlayOpen =
            false

          actions.onRender()

          return
        }

        if (
          secondBidPrice !==
            undefined &&
          secondBidPrice >
            price
        ) {
          auctionFeedback =
            'L’ultimo rilancio avversario non può superare il prezzo finale.'

          awardOverlayOpen =
            false

          actions.onRender()

          return
        }

        state
          .auctionAssignments
          .push({
            id:
              createAssignmentId(),

            playerId:
              player.id,

            managerId:
              winner.id,

            price,

            ...(secondBidderId
              ? {
                  secondBidderManagerId:
                    secondBidderId,
                }
              : {}),

            ...(secondBidPrice !==
            undefined
              ? {
                  secondBidPrice,
                }
              : {}),
          })

        state.recommendedDiscards =
          state
            .recommendedDiscards
            .filter(
              (playerId) =>
                playerId !==
                player.id,
            )

        awardOverlayOpen =
          false

        pendingAwardPrice =
          null

        auctionFeedback =
          `${player.name} aggiudicato a ${winner.name} per ${price} crediti.`

        actions.onStateChange()
      },
    )

  document
    .querySelector(
      '#auctionCancelCallButton',
    )
    ?.addEventListener(
      'click',
      () => {
        state.currentAuctionPlayerId =
          null

        awardOverlayOpen =
          false

        pendingAwardPrice =
          null

        detailPlayerId =
          null

        auctionFeedback =
          ''

        actions.onStateChange()
      },
    )

  document
    .querySelector(
      '#auctionUnsoldButton',
    )
    ?.addEventListener(
      'click',
      () => {
        const player =
          getSelectedPlayer(
            state,
          )

        if (!player) {
          return
        }

        auctionFeedback =
          `${player.name} non assegnato.`

        state.currentAuctionPlayerId =
          null

        awardOverlayOpen =
          false

        pendingAwardPrice =
          null

        detailPlayerId =
          null

        actions.onStateChange()
      },
    )

  document
    .querySelector(
      '#undoLastAssignmentButton',
    )
    ?.addEventListener(
      'click',
      () => {
        const last =
          state
            .auctionAssignments[
            state
              .auctionAssignments
              .length - 1
          ]

        if (!last) {
          return
        }

        state
          .auctionAssignments
          .pop()

        actions.onStateChange()
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-remove-assignment]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const assignmentId =
              button.dataset
                .removeAssignment

            if (!assignmentId) {
              return
            }

            state.auctionAssignments =
              state
                .auctionAssignments
                .filter(
                  (assignment) =>
                    assignment.id !==
                    assignmentId,
                )

            actions.onStateChange()
          },
        )
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-edit-assignment]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            editingAssignmentId =
              button.dataset
                .editAssignment ??
              null

            detailPlayerId =
              null

            actions.onRender()
          },
        )
      },
    )

  const closeEdit =
    (): void => {
      runOverlayExit(
        '#editAssignmentOverlay',
        () => {
          editingAssignmentId =
            null

          actions.onRender()
        },
      )
    }

  document
    .querySelector(
      '#closeEditAssignmentButton',
    )
    ?.addEventListener(
      'click',
      closeEdit,
    )

  document
    .querySelector(
      '#cancelEditAssignmentButton',
    )
    ?.addEventListener(
      'click',
      closeEdit,
    )

  document
    .querySelector(
      '#saveEditAssignmentButton',
    )
    ?.addEventListener(
      'click',
      () => {
        if (
          editingAssignmentId ===
          null
        ) {
          return
        }

        const assignment =
          getAssignmentById(
            state,
            editingAssignmentId,
          )

        const buyerSelect =
          document.querySelector<HTMLSelectElement>(
            '#editAssignmentBuyer',
          )

        const priceInput =
          document.querySelector<HTMLInputElement>(
            '#editAssignmentPrice',
          )

        const secondSelect =
          document.querySelector<HTMLSelectElement>(
            '#editSecondBidder',
          )

        const secondPriceInput =
          document.querySelector<HTMLInputElement>(
            '#editSecondBidPrice',
          )

        if (
          !assignment ||
          !buyerSelect ||
          !priceInput ||
          !secondSelect ||
          !secondPriceInput
        ) {
          return
        }

        const price =
          Number(
            priceInput.value,
          )

        if (
          !Number.isInteger(
            price,
          ) ||
          price <= 0
        ) {
          return
        }

        const secondBidderId =
          secondSelect
            .value
            .trim()

        const secondPriceText =
          secondPriceInput
            .value
            .trim()

        const secondBidPrice =
          secondPriceText
            ? Number(
                secondPriceText,
              )
            : undefined

        if (
          secondBidderId ===
          buyerSelect.value
        ) {
          return
        }

        assignment.managerId =
          buyerSelect.value

        assignment.price =
          price

        if (secondBidderId) {
          assignment.secondBidderManagerId =
            secondBidderId
        } else {
          delete assignment
            .secondBidderManagerId
        }

        if (
          secondBidPrice !==
            undefined &&
          Number.isInteger(
            secondBidPrice,
          ) &&
          secondBidPrice > 0
        ) {
          assignment.secondBidPrice =
            secondBidPrice
        } else {
          delete assignment
            .secondBidPrice
        }

        editingAssignmentId =
          null

        actions.onStateChange()
      },
    )
}
