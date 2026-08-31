import type {
  AppState,
} from '../app/state'

import {
  players,
} from '../data/players'

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

interface AuctionActions {
  onEndAuction: () => void
  onArchiveAuction: () => void
  onDiscardAuction: () => void
  onNewAuction: () => void

  onStateChange: () => void
  onRender: () => void
}

interface DemoParticipantState {
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

interface DemoAssignment {
  id: number

  playerId: string
  participantId: string

  price: number
}

const ROLE_ORDER:
  AuctionRole[] = [
    'P',
    'D',
    'C',
    'A',
  ]

const DEMO_SLOT_LIMITS:
  Record<
    AuctionRole,
    number
  > = {
    P: 3,
    D: 8,
    C: 8,
    A: 6,
  }

const DEMO_NAMES = [
  'Gianluca',
  'Valerio',
  'Marco',
  'Stefano',
  'Luca',
  'Andrea',
  'Davide',
  'Simone',
  'Matteo',
  'Fabio',
  'Paolo',
  'Nicola',
]

const DEMO_SPENDING_FACTORS = [
  {
    P: 0.82,
    D: 0.32,
    C: 0.08,
    A: 0,
  },
  {
    P: 0.96,
    D: 0.18,
    C: 0,
    A: 0,
  },
  {
    P: 1,
    D: 0.5,
    C: 0.12,
    A: 0,
  },
  {
    P: 1.1,
    D: 0.68,
    C: 0.2,
    A: 0,
  },
  {
    P: 0.72,
    D: 0.82,
    C: 0.28,
    A: 0,
  },
  {
    P: 1,
    D: 0.95,
    C: 0.36,
    A: 0,
  },
  {
    P: 1.18,
    D: 1.05,
    C: 0.4,
    A: 0,
  },
  {
    P: 0.9,
    D: 1.2,
    C: 0.52,
    A: 0,
  },
  {
    P: 0.75,
    D: 0.42,
    C: 0.12,
    A: 0,
  },
  {
    P: 1,
    D: 0.62,
    C: 0.22,
    A: 0,
  },
  {
    P: 1.08,
    D: 0.74,
    C: 0.3,
    A: 0,
  },
  {
    P: 0.88,
    D: 0.92,
    C: 0.44,
    A: 0,
  },
]

let activeRole:
  AuctionRole = 'P'

let selectorMode:
  SelectorMode = null

let selectedTeamFilter = ''

let auctionFeedback = ''

let nextAssignmentId = 1

let editingAssignmentId:
  number | null = null

const participantStates =
  new Map<
    string,
    DemoParticipantState
  >()

const assignments:
  DemoAssignment[] = []

const discardedRecommendations =
  new Set<string>()

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

function roundCredits(
  value: number,
): number {
  return Math.max(
    0,
    Math.round(value),
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

function getParticipant(
  participantId: string,
):
  | DemoParticipantState
  | undefined {
  return participantStates.get(
    participantId,
  )
}

function getAssignmentByPlayer(
  playerId: string,
):
  | DemoAssignment
  | undefined {
  return assignments.find(
    (assignment) =>
      assignment.playerId ===
      playerId,
  )
}

function isPlayerAssigned(
  playerId: string,
): boolean {
  return Boolean(
    getAssignmentByPlayer(
      playerId,
    ),
  )
}

function managerDisplayName(
  manager:
    AppState['managers'][number],
): string {
  const firstName =
    manager.firstName?.trim() ??
    ''

  const lastName =
    manager.lastName?.trim() ??
    ''

  const alias =
    manager.alias?.trim() ??
    ''

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

/* =========================
   PARTICIPANTS DEMO
========================= */

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

function createParticipant(
  id: string,
  name: string,
  isOwner: boolean,
  state: AppState,
  index: number,
): DemoParticipantState {
  const factors =
    DEMO_SPENDING_FACTORS[
      index %
      DEMO_SPENDING_FACTORS.length
    ]

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

  ROLE_ORDER.forEach(
    (role) => {
      const target =
        getRoleTargetCredits(
          state,
          role,
        )

      spent[role] =
        roundCredits(
          target *
          factors[role],
        )

      slots[role] =
        Math.min(
          DEMO_SLOT_LIMITS[
            role
          ],
          Math.floor(
            DEMO_SLOT_LIMITS[
              role
            ] *
            clamp(
              factors[role],
              0,
              1,
            ),
          ),
        )
    },
  )

  return {
    id,
    name,
    isOwner,
    spent,
    slots,
  }
}

function ensureParticipants(
  state: AppState,
):
  DemoParticipantState[] {
  if (
    participantStates.size ===
    0
  ) {
    const managers =
      state.managers.filter(
        (manager) =>
          !manager.archived &&
          manager.active,
      )

    managers.forEach(
      (
        manager,
        index,
      ) => {
        const id =
          `manager-${manager.id}`

        participantStates.set(
          id,
          createParticipant(
            id,
            managerDisplayName(
              manager,
            ),
            manager.isOwner,
            state,
            index,
          ),
        )
      },
    )

    let demoIndex = 0

    while (
      participantStates.size <
      8
    ) {
      const id =
        `demo-manager-${demoIndex}`

      participantStates.set(
        id,
        createParticipant(
          id,
          DEMO_NAMES[
            demoIndex
          ] ??
            `Manager ${
              demoIndex + 1
            }`,
          false,
          state,
          participantStates.size,
        ),
      )

      demoIndex += 1
    }
  }

  return Array.from(
    participantStates.values(),
  )
}

function getTotalSpent(
  participant:
    DemoParticipantState,
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
    DemoParticipantState,
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

function getBudgetBarData(
  participant:
    DemoParticipantState,
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
        'rgb(63, 174, 216)',
      description:
        'Più margine del piano nel ruolo attivo',
    }
  }

  const hue =
    Math.round(
      clamp(
        ratio,
        0,
        1,
      ) * 120,
    )

  return {
    width,
    color:
      `hsl(${hue} 72% 52%)`,
    description:
      ratio > 0
        ? 'Margine del ruolo in progressiva riduzione'
        : 'Budget del ruolo oltre il piano',
  }
}

/* =========================
   ASSIGNMENTS DEMO
========================= */

function applyAssignment(
  assignment:
    DemoAssignment,
): void {
  const player =
    getPlayer(
      assignment.playerId,
    )

  const participant =
    getParticipant(
      assignment.participantId,
    )

  if (
    !player ||
    !participant
  ) {
    return
  }

  participant.spent[
    player.role
  ] +=
    assignment.price

  participant.slots[
    player.role
  ] =
    Math.min(
      DEMO_SLOT_LIMITS[
        player.role
      ],
      participant.slots[
        player.role
      ] + 1,
    )
}

function reverseAssignment(
  assignment:
    DemoAssignment,
): void {
  const player =
    getPlayer(
      assignment.playerId,
    )

  const participant =
    getParticipant(
      assignment.participantId,
    )

  if (
    !player ||
    !participant
  ) {
    return
  }

  participant.spent[
    player.role
  ] =
    Math.max(
      0,
      participant.spent[
        player.role
      ] -
        assignment.price,
    )

  participant.slots[
    player.role
  ] =
    Math.max(
      0,
      participant.slots[
        player.role
      ] - 1,
    )
}

function removeAssignment(
  assignmentId: number,
): boolean {
  const index =
    assignments.findIndex(
      (assignment) =>
        assignment.id ===
        assignmentId,
    )

  if (index < 0) {
    return false
  }

  reverseAssignment(
    assignments[index],
  )

  assignments.splice(
    index,
    1,
  )

  return true
}

/* =========================
   ROLE TABS
========================= */

function renderRoleTabs():
  string {
  return ROLE_ORDER.map(
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
  ).join('')
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
    (a, b) =>
      a.localeCompare(
        b,
        'it',
      ),
  )
}

function renderSelector():
  string {
  if (!selectorMode) {
    return ''
  }

  const teamMode =
    selectorMode === 'team'

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
                    (player) => `
                      <button
                        type="button"
                        class="
                          auction-selector-player
                          ${
                            isPlayerAssigned(
                              player.id,
                            )
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
                          isPlayerAssigned(
                            player.id,
                          )
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
                            isPlayerAssigned(
                              player.id,
                            )
                              ? 'Assegnato'
                              : formatNumber(
                                  player.iCa,
                                  2,
                                )
                          }
                        </em>
                      </button>
                    `,
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
  player: Player,
  participants:
    DemoParticipantState[],
): string {
  const assignment =
    getAssignmentByPlayer(
      player.id,
    )

  const isAssigned =
    Boolean(
      assignment,
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
                : 'LIBERO'
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
        class="
          auction-recommendation
          auction-recommendation-pending
        "
      >
        <div
          class="
            auction-recommendation-primary
          "
        >
          <span>
            Indicazione operativa
          </span>

          <strong>
            ALGORITMO PREZZO
            NON ANCORA ATTIVO
          </strong>
        </div>

        <div
          class="auction-price-limits"
        >
          <div
            class="
              auction-price-limit
              financial
            "
          >
            <span>
              Limite finanziario
            </span>

            <strong>—</strong>
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

            <strong>—</strong>
          </div>

          <div
            class="
              auction-price-limit
              value
            "
          >
            <span>
              Massimo valore
            </span>

            <strong>—</strong>
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
            Prezzo finale
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
                  getParticipant(
                    assignment.participantId,
                  )?.name ??
                    'Manager',
                )}
              </strong>

              per

              <strong>
                ${assignment.price}
                crediti
              </strong>

              <button
                type="button"
                data-edit-assignment="${assignment.id}"
              >
                Modifica
              </button>

              <button
                type="button"
                data-remove-assignment="${assignment.id}"
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
   RECOMMENDATIONS
========================= */

function renderRecommendations():
  string {
  const candidates =
    getRolePlayers(
      activeRole,
    )
      .filter(
        (player) =>
          !isPlayerAssigned(
            player.id,
          ) &&
          !discardedRecommendations.has(
            player.id,
          ),
      )
      .sort(
        (a, b) =>
          (
            b.iCa ??
            -Infinity
          ) -
          (
            a.iCa ??
            -Infinity
          ),
      )
      .slice(
        0,
        3,
      )

  return `
    <aside
      class="auction-next-panel"
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
            Prossime chiamate
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
        ${candidates
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
                    data-select-recommended="${escapeHtml(
                      player.id,
                    )}"
                  >
                    Chiama
                  </button>

                  <button
                    type="button"
                    data-discard-recommended="${escapeHtml(
                      player.id,
                    )}"
                  >
                    Scarta
                  </button>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </aside>
  `
}

/* =========================
   PARTICIPANTS
========================= */

function renderParticipants(
  state: AppState,
  participants:
    DemoParticipantState[],
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
                    ${ROLE_ORDER.map(
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
                            DEMO_SLOT_LIMITS[
                              role
                            ]
                          }
                        </span>
                      `,
                    ).join('')}
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

function renderAssignmentHistory():
  string {
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
              registrata nella demo.
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

                    const participant =
                      getParticipant(
                        assignment.participantId,
                      )

                    if (
                      !player ||
                      !participant
                    ) {
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
                              participant.name,
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
                            data-edit-assignment="${assignment.id}"
                          >
                            Modifica
                          </button>

                          <button
                            type="button"
                            class="danger"
                            data-remove-assignment="${assignment.id}"
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
   EDIT OVERLAY
========================= */

function renderEditAssignmentOverlay(
  participants:
    DemoParticipantState[],
): string {
  if (
    editingAssignmentId ===
    null
  ) {
    return ''
  }

  const assignment =
    assignments.find(
      (item) =>
        item.id ===
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
                        assignment.participantId
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
   LIVE PAGE
========================= */

function renderLiveAuction(
  state: AppState,
): string {
  const participants =
    ensureParticipants(
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
            class="live-badge"
          >
            LIVE
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
            id="undoLastAssignmentButton"
            type="button"
            class="auction-toolbar-button"
            ${
              assignments.length
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

        ${renderRecommendations()}
      </div>

      ${renderParticipants(
        state,
        participants,
      )}

      ${renderAssignmentHistory()}

      <div
        class="auction-prototype-note"
      >
        Partecipanti, budget e
        assegnazioni sono ancora
        memoria demo.
      </div>

      ${renderEditAssignmentOverlay(
        participants,
      )}

      ${renderSelector()}
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
    )
  }

  if (
    state.auctionPhase ===
    'finalizing'
  ) {
    return `
      <section class="page">
        <div class="page-heading">
          <div>
            <h1>Asta</h1>
            <p>
              Sessione terminata.
            </p>
          </div>

          <span
            class="finalizing-badge"
          >
            DA FINALIZZARE
          </span>
        </div>

        <section
          class="
            panel
            finalization-panel
          "
        >
          <div
            class="finalization-icon"
          >
            !
          </div>

          <div
            class="finalization-copy"
          >
            <h2>
              Asta terminata
            </h2>

            <p>
              La sessione non è ancora
              stata registrata.
            </p>

            <p>
              Prima di iniziare una
              nuova asta devi scegliere
              se salvare definitivamente
              i dati nello storico
              oppure scartare questa
              sessione.
            </p>
          </div>
        </section>

        <div
          class="auction-actions"
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
              >
                ×
              </button>
            </div>

            <div
              class="danger-panel"
            >
              <p>
                Questa sessione
                non verrà aggiunta
                allo storico.
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
      </section>
    `
  }

  if (
    state.auctionPhase ===
      'archived' ||
    state.auctionPhase ===
      'discarded'
  ) {
    const archived =
      state.auctionPhase ===
      'archived'

    return `
      <section class="page">
        <div class="page-heading">
          <div>
            <h1>Asta</h1>

            <p>
              ${
                archived
                  ? 'Sessione registrata.'
                  : 'Sessione scartata.'
              }
            </p>
          </div>
        </div>

        <section class="panel">
          <h2>
            ${
              archived
                ? 'Asta registrata'
                : 'Asta scartata'
            }
          </h2>
        </section>

        <div
          class="auction-actions"
        >
          <button
            id="newAuctionButton"
            type="button"
            class="primary-button"
          >
            Nuova asta
          </button>
        </div>
      </section>
    `
  }

  return `
    <section class="page">
      <h1>Asta</h1>

      <p>
        Asta non ancora avviata.
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
  if (
    state.auctionPhase !==
    'live'
  ) {
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

      const overlay =
        document.querySelector<HTMLElement>(
          '#discardAuctionOverlay',
        )

      const openOverlay =
        () => {
          overlay?.classList.remove(
            'hidden',
          )

          overlay?.setAttribute(
            'aria-hidden',
            'false',
          )
        }

      const closeOverlay =
        () => {
          overlay?.classList.add(
            'hidden',
          )

          overlay?.setAttribute(
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
          openOverlay,
        )

      document
        .querySelector(
          '#closeDiscardAuctionButton',
        )
        ?.addEventListener(
          'click',
          closeOverlay,
        )

      document
        .querySelector(
          '#cancelDiscardAuctionButton',
        )
        ?.addEventListener(
          'click',
          closeOverlay,
        )

      document
        .querySelector(
          '#confirmDiscardAuctionButton',
        )
        ?.addEventListener(
          'click',
          actions.onDiscardAuction,
        )
    }

    if (
      state.auctionPhase ===
        'archived' ||
      state.auctionPhase ===
        'discarded'
    ) {
      document
        .querySelector(
          '#newAuctionButton',
        )
        ?.addEventListener(
          'click',
          actions.onNewAuction,
        )
    }

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

            /*
              Cambiare ruolo NON
              avvia automaticamente
              una chiamata.
            */
            activeRole =
              role

            state.currentAuctionPlayerId =
              null

            auctionFeedback = ''

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

  document
    .querySelector(
      '#closeAuctionSelectorButton',
    )
    ?.addEventListener(
      'click',
      () => {
        selectorMode =
          null

        selectedTeamFilter =
          ''

        actions.onRender()
      },
    )

  document
    .querySelector(
      '#auctionPlayerSelectorOverlay .overlay-backdrop',
    )
    ?.addEventListener(
      'click',
      () => {
        selectorMode =
          null

        selectedTeamFilter =
          ''

        actions.onRender()
      },
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

  selectorSearch?.addEventListener(
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
      '[data-select-recommended]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const player =
              getPlayer(
                button.dataset
                  .selectRecommended ??
                  null,
              )

            if (!player) {
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
    .querySelectorAll<HTMLButtonElement>(
      '[data-discard-recommended]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const playerId =
              button.dataset
                .discardRecommended

            if (!playerId) {
              return
            }

            discardedRecommendations.add(
              playerId,
            )

            actions.onRender()
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
          `${player.name} segnato come invenduto nella demo.`

        state.currentAuctionPlayerId =
          null

        actions.onStateChange()
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
            player.id,
          )
        ) {
          auctionFeedback =
            'Il giocatore è già assegnato.'

          actions.onRender()

          return
        }

        const participant =
          getParticipant(
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
          DEMO_SLOT_LIMITS[
            player.role
          ]
        ) {
          auctionFeedback =
            `Il manager non ha più slot ${player.role} disponibili.`

          actions.onRender()

          return
        }

        const assignment:
          DemoAssignment = {
            id:
              nextAssignmentId,

            playerId:
              player.id,

            participantId:
              participant.id,

            price,
          }

        nextAssignmentId += 1

        assignments.push(
          assignment,
        )

        applyAssignment(
          assignment,
        )

        auctionFeedback =
          `${player.name} aggiudicato a ${participant.name} per ${price} crediti.`

        actions.onRender()
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
          assignments[
            assignments.length -
            1
          ]

        if (!last) {
          return
        }

        const player =
          getPlayer(
            last.playerId,
          )

        removeAssignment(
          last.id,
        )

        auctionFeedback =
          player
            ? `Annullata l'ultima assegnazione: ${player.name}.`
            : 'Ultima assegnazione annullata.'

        actions.onRender()
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
            const id =
              Number(
                button.dataset
                  .removeAssignment,
              )

            if (
              !Number.isFinite(id)
            ) {
              return
            }

            removeAssignment(
              id,
            )

            actions.onRender()
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
            const id =
              Number(
                button.dataset
                  .editAssignment,
              )

            if (
              !assignments.some(
                (item) =>
                  item.id === id,
              )
            ) {
              return
            }

            editingAssignmentId =
              id

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
          assignments.find(
            (item) =>
              item.id ===
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

        const newParticipant =
          getParticipant(
            buyerSelect.value,
          )

        const newPrice =
          Number(
            priceInput.value,
          )

        if (
          !player ||
          !newParticipant ||
          !Number.isInteger(
            newPrice,
          ) ||
          newPrice <= 0
        ) {
          return
        }

        reverseAssignment(
          assignment,
        )

        const availableCredits =
          getRemainingCredits(
            newParticipant,
            state,
          )

        const roleHasSpace =
          newParticipant.slots[
            player.role
          ] <
          DEMO_SLOT_LIMITS[
            player.role
          ]

        if (
          newPrice >
            availableCredits ||
          !roleHasSpace
        ) {
          applyAssignment(
            assignment,
          )

          auctionFeedback =
            !roleHasSpace
              ? `Il manager selezionato non ha più slot ${player.role} disponibili.`
              : `Il manager selezionato ha solo ${availableCredits} crediti disponibili.`

          editingAssignmentId =
            null

          actions.onRender()

          return
        }

        assignment.participantId =
          newParticipant.id

        assignment.price =
          newPrice

        applyAssignment(
          assignment,
        )

        editingAssignmentId =
          null

        actions.onRender()
      },
    )
}