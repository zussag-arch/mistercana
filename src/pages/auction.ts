import type {
  AppState,
  AuctionAssignment,
} from '../app/state'

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

import type {
  Player,
  PlayerRole,
} from '../domain/player'

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

/* =========================
   HELPERS
========================= */

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll(
      '&',
      '&amp;',
    )
    .replaceAll(
      '<',
      '&lt;',
    )
    .replaceAll(
      '>',
      '&gt;',
    )
    .replaceAll(
      '"',
      '&quot;',
    )
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
    .replace(
      '.',
      ',',
    )
}

function formatCredits(
  value:
    | number
    | undefined,
): string {
  if (
    value === undefined ||
    !Number.isFinite(
      value,
    )
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
    .replace(
      '.',
      ',',
    )}%`
}

function formatMarketFactor(
  value: number,
): string {
  return `×${value
    .toFixed(2)
    .replace(
      '.',
      ',',
    )}`
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
      player.role ===
      role,
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

  /*
    Il limite finanziario
    è sempre hard cap.
  */
  if (
    financial !== undefined &&
    safePrice > financial
  ) {
    return {
      state:
        'stop',

      icon:
        '⛔',

      label:
        'STOP',

      color:
        '#E45E5E',

      borderColor:
        'rgba(228, 94, 94, 0.72)',

      background:
        'rgba(228, 94, 94, 0.10)',
    }
  }

  /*
    Superamento del tetto
    operativo dinamico.
  */
  if (
    ceiling !== undefined &&
    safePrice > ceiling
  ) {
    return {
      state:
        'stop',

      icon:
        '⛔',

      label:
        'STOP',

      color:
        '#E45E5E',

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
        item !==
        undefined,
    )

  const comfortLimit =
    comfortLimits.length
      ? Math.min(
          ...comfortLimits,
        )
      : undefined

  /*
    Dentro sia Valore asta
    sia Limite reparto:
    si può continuare a salire.
  */
  if (
    comfortLimit === undefined ||
    safePrice <=
      comfortLimit
  ) {
    return {
      state:
        'go',

      icon:
        '↑',

      label:
        'SALI',

      color:
        '#46E6A1',

      borderColor:
        'rgba(70, 230, 161, 0.72)',

      background:
        'rgba(70, 230, 161, 0.10)',
    }
  }

  /*
    Almeno un segnale morbido
    è stato superato, ma il tetto
    dinamico non è ancora superato.
  */
  return {
    state:
      'attention',

    icon:
      '—',

    label:
      'ATTENZIONE',

    color:
      '#FFFFFF',

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

  container.dataset
    .signalState =
    signal.state

  container.style
    .borderColor =
    signal.borderColor

  container.style
    .background =
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

/* =========================
   REAL PARTICIPANTS
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

      color:
        '#5AA8FF',

      description:
        'Più margine del piano nel ruolo attivo',
    }
  }

  if (ratio > 0.55) {
    return {
      width,

      color:
        '#46E6A1',

      description:
        'Margine alto nel ruolo attivo',
    }
  }

  if (ratio > 0.2) {
    return {
      width,

      color:
        '#E7C94C',

      description:
        'Margine ridotto nel ruolo attivo',
    }
  }

  return {
    width,

    color:
      '#E45E5E',

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
        <div
          class="overlay-header"
        >
          <div>
            <span
              class="eyebrow"
            >
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
                class="
                  auction-selector-search
                "
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
                      class="
                        auction-selected-team
                      "
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
                class="
                  auction-selector-results
                "
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
              <p
                class="muted-text"
              >
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
        <span
          class="auction-kicker"
        >
          CHIAMATA CORRENTE
        </span>

        <strong>
          Seleziona il giocatore
          chiamato
        </strong>
      </div>

      <div
        class="
          auction-call-selectors
        "
      >
        <button
          id="selectAuctionTeamButton"
          type="button"
          class="
            auction-call-selector
          "
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
  participants:
    AuctionParticipantState[],
): string {
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
            <span
              class="auction-kicker"
            >
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
              ·
              ${player.role}

              ${
                priceAdvice
                  .playerSlot
                  ? ` · Slot ${priceAdvice.playerSlot}`
                  : ''
              }
            </p>
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

          <span
            class="auction-real-label"
          >
            DATABASE REALE
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
          <span>
            iCà
          </span>

          <strong>
            ${formatNumber(
              player.iCa,
              2,
            )}
          </strong>

          <small>
            indice prospettico
          </small>
        </div>

        <div
          class="auction-main-value"
        >
          <span>
            PMA
          </span>

          <strong>
            ${formatPercent(
              player.pmaPercent,
              1,
            )}
          </strong>

          <small>
            ${formatCredits(
              priceAdvice
                .pmaCredits,
            )}
          </small>
        </div>

        <div
          class="auction-main-value"
        >
          <span>
            Consenso
          </span>

          <strong>
            ${formatNumber(
              player.consensus,
              2,
            )}
          </strong>
        </div>

        <div
          class="auction-main-value"
        >
          <span>
            Titolarità
          </span>

          <strong>
            ${formatPercent(
              player.startingProbability,
              0,
            )}
          </strong>
        </div>
      </div>

      <div
        class="auction-insight-row"
      >
        <div
          class="auction-starting-insight"
        >
          <span>
            Titolarità
          </span>

          <strong>
            ${formatPercent(
              player.startingProbability,
              0,
            )}
          </strong>

          <div
            class="auction-insight-progress"
          >
            <span
              style="
                width:
                ${
                  player.startingProbability ??
                  0
                }%;
              "
            ></span>
          </div>
        </div>

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
      </div>

      <div
        class="auction-recommendation"
      >
        <div
          style="
            display: flex;
            gap: 18px;
            align-items: stretch;
            justify-content: space-between;
            flex-wrap: wrap;
          "
        >
          <div
            class="
              auction-recommendation-primary
            "
            style="
              flex: 1 1 260px;
            "
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
              Segnale dominante:
              ${escapeHtml(
                bindingLabel,
              )}
            </small>

            <small>
              Il limite finanziario
              resta l'hard cap.
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
            style="
              border-color:
              rgba(70, 230, 161, 0.45);
            "
          >
            <span>
              Valore asta
            </span>

            <strong
              style="
                color: #46E6A1;
              "
            >
              ${formatCredits(
                priceAdvice
                  .valueLimit,
              )}
            </strong>

            <small>
              PMA
              ${formatCredits(
                priceAdvice
                  .pmaCredits,
              )}
            </small>

            <small>
              Mercato
              ${formatMarketFactor(
                priceAdvice
                  .auctionMarketFactor,
              )}
              ·
              ${escapeHtml(
                marketSourceLabel,
              )}
            </small>

            <small>
              Scarsità
              ${formatMarketFactor(
                priceAdvice
                  .scarcityFactor,
              )}
            </small>

            <small>
              Supply
              ${
                priceAdvice
                  .supply ??
                '—'
              }
              ·
              Domanda
              ${
                priceAdvice
                  .demand ??
                '—'
              }
            </small>

            <small>
              ${
                priceAdvice
                  .pressure !==
                  undefined
                  ? `Pressione ${formatNumber(
                      priceAdvice
                        .pressure,
                      2,
                    )}`
                  : 'Pressione —'
              }
            </small>

            <small>
              ${escapeHtml(
                marketSampleLabel,
              )}
            </small>
          </div>

          <div
            class="
              auction-price-limit
              role
            "
            style="
              border-color:
              rgba(231, 201, 76, 0.52);
            "
          >
            <span>
              Limite reparto
            </span>

            <strong
              style="
                color: #E7C94C;
              "
            >
              ${formatCredits(
                priceAdvice
                  .roleLimit,
              )}
            </strong>

            <small>
              linea strategica
              ${player.role}
            </small>
          </div>

          <div
            class="
              auction-price-limit
              financial
            "
            style="
              border-color:
              rgba(228, 94, 94, 0.52);
            "
          >
            <span>
              Limite finanziario
            </span>

            <strong
              style="
                color: #E45E5E;
              "
            >
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
        class="auction-sale-form"
      >
        <label>
          <span>
            Acquirente
          </span>

          <select
            id="auctionBuyerSelect"
            ${
              isAssigned
                ? 'disabled'
                : ''
            }
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

        <label>
          <span>
            Prezzo corrente
          </span>

          <input
            id="auctionPriceInput"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            placeholder="0"
            ${
              isAssigned
                ? 'disabled'
                : ''
            }
          >
        </label>

        <button
          id="auctionAssignButton"
          type="button"
          class="
            auction-primary-action
          "
          ${
            isAssigned
              ? 'disabled'
              : ''
          }
        >
          Aggiudica
        </button>

        <button
          id="auctionUnsoldButton"
          type="button"
          class="
            auction-secondary-action
          "
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
          class="
            auction-secondary-action
          "
        >
          Annulla chiamata
        </button>
      </div>

      ${
        assignment
          ? `
            <div
              class="
                auction-current-assignment
              "
            >
              Assegnato a

              <strong>
                ${escapeHtml(
                  assignedManager
                    ? managerDisplayName(
                        assignedManager,
                      )
                    : 'Manager non disponibile',
                )}
              </strong>

              per

              <strong>
                ${assignment.price}
                crediti
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
                Annulla assegnazione
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
   SIDE PANELS
========================= */

function renderSuggestedPlayersPanel():
  string {
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
            Giocatori consigliati
          </h3>
        </div>

        <span
          class="
            auction-demo-label
          "
        >
          NON ATTIVO
        </span>
      </div>

      <div
        class="
          auction-next-list
        "
      >
        <div
          class="
            auction-recommendation-placeholder
          "
        >
          La chiamata consigliata
          verrà calcolata da un
          algoritmo dedicato e
          resterà distinta dall’iCà.
        </div>
      </div>
    </aside>
  `
}

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
        3,
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
          <span
            class="auction-kicker"
          >
            SOLO NON ASSEGNATI
          </span>

          <h3>
            Top iCà · ${activeRole}
          </h3>
        </div>

        <span
          class="auction-real-label"
        >
          iCà
        </span>
      </div>

      <div
        class="auction-next-list"
      >
        ${
          candidates.length
            ? candidates
                .map(
                  (
                    player,
                    index,
                  ) => `
                    <article
                      class="
                        auction-next-card
                        ${
                          index === 0
                            ? 'primary'
                            : ''
                        }
                      "
                    >
                      <div
                        class="
                          auction-next-card-top
                        "
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

                        <b>
                          ${formatNumber(
                            player.iCa,
                            2,
                          )}
                        </b>
                      </div>

                      <p>
                        Consenso
                        ${formatNumber(
                          player.consensus,
                          2,
                        )}
                        · Titolarità
                        ${formatPercent(
                          player.startingProbability,
                          0,
                        )}
                      </p>

                      <div
                        class="
                          auction-next-actions
                        "
                      >
                        <button
                          type="button"
                          data-call-top-ica="${escapeHtml(
                            player.id,
                          )}"
                        >
                          Chiama
                        </button>
                      </div>
                    </article>
                  `,
                )
                .join('')
            : `
              <div
                class="
                  auction-recommendation-placeholder
                "
              >
                Nessun giocatore
                disponibile nel ruolo
                ${activeRole}.
              </div>
            `
        }
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
      ${renderSuggestedPlayersPanel()}

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
      class="
        auction-participants-section
      "
    >
      <div
        class="auction-section-heading"
      >
        <div>
          <span
            class="auction-kicker"
          >
            MERCATO LIVE
          </span>

          <h3>
            Partecipanti
          </h3>
        </div>

        <div
          class="auction-bar-legend"
        >
          <span
            class="legend-blue"
          >
            sopra piano
          </span>

          <span
            class="legend-green"
          >
            margine alto
          </span>

          <span
            class="legend-yellow"
          >
            margine ridotto
          </span>

          <span
            class="legend-red"
          >
            tensione
          </span>
        </div>
      </div>

      ${
        participants.length === 0
          ? `
            <div
              class="
                auction-history-empty
              "
            >
              Nessun partecipante
              attivo configurato.
            </div>
          `
          : `
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
                          class="
                            auction-participant-top
                          "
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
                          class="
                            auction-budget-track
                          "
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
          `
      }
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
      class="
        auction-history-section
      "
    >
      <div
        class="auction-history-heading"
      >
        <div>
          <span
            class="auction-kicker"
          >
            SESSIONE LIVE
          </span>

          <h3>
            Storico assegnazioni
          </h3>
        </div>

        <span
          class="
            auction-history-count
          "
        >
          ${assignments.length}
          assegnazioni
        </span>
      </div>

      ${
        assignments.length ===
        0
          ? `
            <div
              class="
                auction-history-empty
              "
            >
              Nessuna assegnazione
              registrata in questa
              sessione.
            </div>
          `
          : `
            <div
              class="
                auction-history-list
              "
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

                    if (!player) {
                      return ''
                    }

                    return `
                      <article
                        class="
                          auction-history-row
                        "
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
                          class="
                            auction-history-player
                          "
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
                          class="
                            auction-history-manager
                          "
                        >
                          <span>
                            Acquirente
                          </span>

                          <strong>
                            ${escapeHtml(
                              manager
                                ? managerDisplayName(
                                    manager,
                                  )
                                : 'Manager non disponibile',
                            )}
                          </strong>
                        </div>

                        <div
                          class="
                            auction-history-price
                          "
                        >
                          <span>
                            Prezzo
                          </span>

                          <strong>
                            ${assignment.price}
                          </strong>
                        </div>

                        <div
                          class="
                            auction-history-actions
                          "
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
          small-overlay-card
          auction-edit-overlay
        "
      >
        <div
          class="overlay-header"
        >
          <div>
            <span
              class="eyebrow"
            >
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
          class="auction-edit-form"
        >
          <label>
            <span>
              Acquirente
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
              Prezzo
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
        </div>

        <div
          class="overlay-actions"
        >
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
            Salva modifica
          </button>
        </div>
      </div>
    </div>
  `
}

/* =========================
   FINALIZATION OVERLAYS
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
        <div
          class="overlay-header"
        >
          <div>
            <span
              class="eyebrow"
            >
              ASTA TERMINATA
            </span>

            <h2>
              Come vuoi chiudere
              la sessione?
            </h2>
          </div>
        </div>

        <div
          class="
            auction-finalization-summary
          "
        >
          <p>
            Registra conserva le
            assegnazioni nello storico.
          </p>

          <p>
            Scarta elimina la sessione
            corrente senza archiviarla.
          </p>
        </div>

        <div
          class="overlay-actions"
        >
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
        <div
          class="overlay-header"
        >
          <div>
            <span
              class="eyebrow"
            >
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

        <div
          class="danger-panel"
        >
          <p>
            Le assegnazioni della
            sessione corrente verranno
            eliminate e l’asta non
            entrerà nello storico.
          </p>
        </div>

        <div
          class="overlay-actions"
        >
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
   LIVE CONTEXT
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
      <div
        class="auction-live-toolbar"
      >
        <div
          class="auction-live-title"
        >
          <div>
            <span
              class="auction-kicker"
            >
              MISTERCANÀ
            </span>

            <h1>
              Asta
            </h1>
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

      <div
        class="auction-workspace"
      >
        <div
          class="
            auction-workspace-main
          "
        >
          ${
            selectedPlayer
              ? renderPlayerCard(
                  state,
                  selectedPlayer,
                  participants,
                )
              : `
                <section
                  class="
                    auction-player-card
                    auction-no-player
                  "
                >
                  <span
                    class="auction-kicker"
                  >
                    CHIAMATA CORRENTE
                  </span>

                  <h2>
                    Nessun giocatore
                    selezionato
                  </h2>

                  <p>
                    Usa “Seleziona squadra”
                    o “Seleziona giocatore”.
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

      <div
        class="auction-prototype-note"
      >
        Valore asta, limite reparto,
        limite finanziario e tetto
        consigliato vengono ricalcolati
        in tempo reale.

        Il Valore asta incorpora PMA,
        andamento osservato del mercato,
        supply, domanda e scarsità.

        La chiamata consigliata resta
        un algoritmo separato e non è
        ancora attiva.
      </div>

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
      <h1>
        Asta
      </h1>

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
  /*
    In finalizzazione l'asta resta
    visibile come contesto, ma tutte
    le operazioni live sono bloccate.

    Restano attivi solo Registra e
    Scarta.
  */
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
        actions.onArchiveAuction,
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
        discardOverlay
          ?.classList
          .add(
            'hidden',
          )

        discardOverlay
          ?.setAttribute(
            'aria-hidden',
            'true',
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
        '#discardAuctionOverlay .overlay-backdrop',
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
        actions.onDiscardAuction,
      )

    return
  }

  if (
    state.auctionPhase !==
    'live'
  ) {
    return
  }

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

        actions.onRender()
      },
    )

  const closeSelector =
    (): void => {
      selectorMode =
        null

      selectedTeamFilter =
        ''

      actions.onRender()
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
            const playerId =
              button.dataset
                .auctionSelectPlayer

            const player =
              getPlayer(
                playerId ??
                null,
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

            actions.onStateChange()
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
            const player =
              getPlayer(
                button.dataset
                  .callTopIca ??
                  null,
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

            auctionFeedback =
              ''

            actions.onStateChange()
          },
        )
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

        actions.onStateChange()
      },
    )

  /*
    SEGNALE LIVE DEL PREZZO

    Viene aggiornato ad ogni
    variazione del campo numerico,
    senza modificare lo stato
    persistente dell'asta.
  */
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
      '#auctionAssignButton',
    )
    ?.addEventListener(
      'click',
      () => {
        const player =
          getSelectedPlayer(
            state,
          )

        const buyerSelect =
          document.querySelector<HTMLSelectElement>(
            '#auctionBuyerSelect',
          )

        const priceInput =
          document.querySelector<HTMLInputElement>(
            '#auctionPriceInput',
          )

        if (
          !player ||
          !buyerSelect ||
          !priceInput
        ) {
          return
        }

        if (
          isPlayerAssigned(
            state,
            player.id,
          )
        ) {
          auctionFeedback =
            'Il giocatore è già assegnato.'

          actions.onRender()

          return
        }

        const participants =
          buildParticipants(
            state,
          )

        const participant =
          getParticipant(
            participants,
            buyerSelect.value,
          )

        const price =
          Number(
            priceInput.value,
          )

        if (!participant) {
          auctionFeedback =
            'Seleziona un acquirente.'

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
            'Inserisci un prezzo intero positivo.'

          actions.onRender()

          return
        }

        const remaining =
          getRemainingCredits(
            participant,
            state,
          )

        if (
          price >
          remaining
        ) {
          auctionFeedback =
            `Il manager ha solo ${remaining} crediti residui.`

          actions.onRender()

          return
        }

        if (
          participant.slots[
            player.role
          ] >=
          ROSTER_SLOT_LIMITS[
            player.role
          ]
        ) {
          auctionFeedback =
            `Il manager non ha più slot ${player.role} disponibili.`

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
              participant.id,

            price,
          })

        auctionFeedback =
          `${player.name} aggiudicato a ${participant.name} per ${price} crediti.`

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

        const player =
          getPlayer(
            last.playerId,
          )

        state
          .auctionAssignments
          .pop()

        auctionFeedback =
          player
            ? `Annullata l'ultima assegnazione: ${player.name}.`
            : 'Ultima assegnazione annullata.'

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

            const index =
              state
                .auctionAssignments
                .findIndex(
                  (assignment) =>
                    assignment.id ===
                    assignmentId,
                )

            if (index < 0) {
              return
            }

            const assignment =
              state
                .auctionAssignments[
                index
              ]

            const player =
              getPlayer(
                assignment.playerId,
              )

            state
              .auctionAssignments
              .splice(
                index,
                1,
              )

            auctionFeedback =
              player
                ? `Assegnazione annullata: ${player.name} torna da assegnare.`
                : 'Assegnazione annullata.'

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
            const assignmentId =
              button.dataset
                .editAssignment

            if (
              !assignmentId ||
              !getAssignmentById(
                state,
                assignmentId,
              )
            ) {
              return
            }

            editingAssignmentId =
              assignmentId

            actions.onRender()
          },
        )
      },
    )

  const closeEdit =
    (): void => {
      editingAssignmentId =
        null

      actions.onRender()
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
      '#editAssignmentOverlay .overlay-backdrop',
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

        if (
          !assignment ||
          !buyerSelect ||
          !priceInput
        ) {
          return
        }

        const player =
          getPlayer(
            assignment.playerId,
          )

        const newPrice =
          Number(
            priceInput.value,
          )

        if (
          !player ||
          !Number.isInteger(
            newPrice,
          ) ||
          newPrice <= 0
        ) {
          return
        }

        /*
          Per verificare correttamente
          crediti e slot togliamo
          temporaneamente l'assegnazione
          che stiamo modificando dal
          calcolo.
        */
        const originalManagerId =
          assignment.managerId

        const originalPrice =
          assignment.price

        assignment.managerId =
          '__editing__'

        assignment.price =
          0

        const participants =
          buildParticipants(
            state,
          )

        assignment.managerId =
          originalManagerId

        assignment.price =
          originalPrice

        const newParticipant =
          getParticipant(
            participants,
            buyerSelect.value,
          )

        if (!newParticipant) {
          return
        }

        const availableCredits =
          getRemainingCredits(
            newParticipant,
            state,
          )

        const roleHasSpace =
          newParticipant.slots[
            player.role
          ] <
          ROSTER_SLOT_LIMITS[
            player.role
          ]

        if (
          newPrice >
            availableCredits ||
          !roleHasSpace
        ) {
          auctionFeedback =
            !roleHasSpace
              ? `Il manager selezionato non ha più slot ${player.role} disponibili.`
              : `Il manager selezionato ha solo ${availableCredits} crediti disponibili.`

          editingAssignmentId =
            null

          actions.onRender()

          return
        }

        assignment.managerId =
          newParticipant.id

        assignment.price =
          newPrice

        editingAssignmentId =
          null

        auctionFeedback =
          `${player.name}: assegnazione aggiornata.`

        actions.onStateChange()
      },
    )
}