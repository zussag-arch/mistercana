import type { AppState } from '../app/state'

type AuctionRole = 'P' | 'D' | 'C' | 'A'

interface AuctionActions {
  onEndAuction: () => void
  onArchiveAuction: () => void
  onDiscardAuction: () => void
  onNewAuction: () => void
  onRender: () => void
}

interface DemoPlayer {
  id: string
  name: string
  team: string
  role: AuctionRole

  pma: number
  consensus: number
  iCa: number

  startingProbability: number
  xMv: number
  xFmv: number

  financialLimit: number
  roleLimit: number
  maxValue: number

  nextScore: number
  expectedMin: number
  expectedMax: number

  reason: string
  interested: string[]
}

interface DemoParticipantState {
  id: string
  name: string
  isOwner: boolean

  spent: Record<AuctionRole, number>
  slots: Record<AuctionRole, number>
}

interface DemoAssignment {
  id: number
  playerId: string
  participantId: string
  price: number
}

const ROLE_ORDER: AuctionRole[] = [
  'P',
  'D',
  'C',
  'A',
]

const DEMO_SLOT_LIMITS: Record<
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

const DEMO_PLAYERS: DemoPlayer[] = [
  {
    id: 'svilar',
    name: 'Svilar',
    team: 'Roma',
    role: 'P',
    pma: 92,
    consensus: 88,
    iCa: 91,
    startingProbability: 97,
    xMv: 6.18,
    xFmv: 5.72,
    financialLimit: 96,
    roleLimit: 90,
    maxValue: 103,
    nextScore: 93,
    expectedMin: 84,
    expectedMax: 110,
    reason:
      'Profilo prioritario per il reparto.',
    interested: [
      'Gianluca',
      'Valerio',
    ],
  },
  {
    id: 'maignan',
    name: 'Maignan',
    team: 'Milan',
    role: 'P',
    pma: 84,
    consensus: 85,
    iCa: 87,
    startingProbability: 96,
    xMv: 6.12,
    xFmv: 5.68,
    financialLimit: 91,
    roleLimit: 86,
    maxValue: 94,
    nextScore: 91,
    expectedMin: 72,
    expectedMax: 93,
    reason:
      'Alternativa di alto livello ancora disponibile.',
    interested: [
      'Luca',
      'Marco',
    ],
  },
  {
    id: 'carnesecchi',
    name: 'Carnesecchi',
    team: 'Atalanta',
    role: 'P',
    pma: 76,
    consensus: 82,
    iCa: 83,
    startingProbability: 94,
    xMv: 6.09,
    xFmv: 5.63,
    financialLimit: 86,
    roleLimit: 80,
    maxValue: 88,
    nextScore: 78,
    expectedMin: 66,
    expectedMax: 92,
    reason:
      'Buona sostenibilità rispetto alle alternative.',
    interested: [
      'Stefano',
    ],
  },
  {
    id: 'provede',
    name: 'Provedel',
    team: 'Lazio',
    role: 'P',
    pma: 68,
    consensus: 77,
    iCa: 79,
    startingProbability: 93,
    xMv: 6.03,
    xFmv: 5.55,
    financialLimit: 78,
    roleLimit: 74,
    maxValue: 82,
    nextScore: 71,
    expectedMin: 58,
    expectedMax: 79,
    reason:
      'Alternativa più economica nel ruolo.',
    interested: [
      'Andrea',
    ],
  },

  {
    id: 'wesley',
    name: 'Wesley',
    team: 'Roma',
    role: 'D',
    pma: 70,
    consensus: 84,
    iCa: 86,
    startingProbability: 95,
    xMv: 6.12,
    xFmv: 6.47,
    financialLimit: 81,
    roleLimit: 86,
    maxValue: 90,
    nextScore: 92,
    expectedMin: 64,
    expectedMax: 82,
    reason:
      'Coerente con il piano del reparto.',
    interested: [
      'Valerio',
      'Gianluca',
    ],
  },
  {
    id: 'dimarco',
    name: 'Dimarco',
    team: 'Inter',
    role: 'D',
    pma: 75,
    consensus: 91,
    iCa: 93,
    startingProbability: 96,
    xMv: 6.31,
    xFmv: 6.88,
    financialLimit: 79,
    roleLimit: 88,
    maxValue: 94,
    nextScore: 96,
    expectedMin: 72,
    expectedMax: 96,
    reason:
      'Qualità alta e supply ridotta.',
    interested: [
      'Gianluca',
      'Marco',
      'Stefano',
    ],
  },
  {
    id: 'dilorenzo',
    name: 'Di Lorenzo',
    team: 'Napoli',
    role: 'D',
    pma: 63,
    consensus: 82,
    iCa: 84,
    startingProbability: 94,
    xMv: 6.08,
    xFmv: 6.31,
    financialLimit: 76,
    roleLimit: 79,
    maxValue: 82,
    nextScore: 86,
    expectedMin: 56,
    expectedMax: 74,
    reason:
      'Profilo affidabile per completare la fascia.',
    interested: [
      'Luca',
    ],
  },
  {
    id: 'bellanova',
    name: 'Bellanova',
    team: 'Atalanta',
    role: 'D',
    pma: 54,
    consensus: 76,
    iCa: 78,
    startingProbability: 91,
    xMv: 5.98,
    xFmv: 6.19,
    financialLimit: 66,
    roleLimit: 63,
    maxValue: 69,
    nextScore: 79,
    expectedMin: 45,
    expectedMax: 63,
    reason:
      'Alternativa efficiente nel reparto.',
    interested: [
      'Andrea',
      'Davide',
    ],
  },

  {
    id: 'calhanoglu',
    name: 'Calhanoglu',
    team: 'Inter',
    role: 'C',
    pma: 96,
    consensus: 94,
    iCa: 95,
    startingProbability: 96,
    xMv: 6.52,
    xFmv: 7.24,
    financialLimit: 106,
    roleLimit: 101,
    maxValue: 112,
    nextScore: 97,
    expectedMin: 88,
    expectedMax: 116,
    reason:
      'Obiettivo primario per qualità e centralità.',
    interested: [
      'Marco',
      'Valerio',
      'Stefano',
    ],
  },
  {
    id: 'pellegrini',
    name: 'Pellegrini',
    team: 'Roma',
    role: 'C',
    pma: 58,
    consensus: 78,
    iCa: 81,
    startingProbability: 87,
    xMv: 6.06,
    xFmv: 6.35,
    financialLimit: 68,
    roleLimit: 66,
    maxValue: 72,
    nextScore: 83,
    expectedMin: 48,
    expectedMax: 65,
    reason:
      'Alternativa sostenibile nel reparto.',
    interested: [
      'Gianluca',
    ],
  },
  {
    id: 'ricci',
    name: 'Ricci',
    team: 'Torino',
    role: 'C',
    pma: 34,
    consensus: 72,
    iCa: 74,
    startingProbability: 91,
    xMv: 5.91,
    xFmv: 5.98,
    financialLimit: 46,
    roleLimit: 43,
    maxValue: 48,
    nextScore: 74,
    expectedMin: 25,
    expectedMax: 39,
    reason:
      'Profilo efficiente per preservare budget.',
    interested: [
      'Luca',
    ],
  },
  {
    id: 'frattesi',
    name: 'Frattesi',
    team: 'Inter',
    role: 'C',
    pma: 49,
    consensus: 75,
    iCa: 77,
    startingProbability: 72,
    xMv: 6.02,
    xFmv: 6.42,
    financialLimit: 61,
    roleLimit: 58,
    maxValue: 64,
    nextScore: 77,
    expectedMin: 39,
    expectedMax: 56,
    reason:
      'Profilo offensivo con costo intermedio.',
    interested: [
      'Davide',
      'Simone',
    ],
  },

  {
    id: 'dovbyk',
    name: 'Dovbyk',
    team: 'Roma',
    role: 'A',
    pma: 86,
    consensus: 86,
    iCa: 88,
    startingProbability: 93,
    xMv: 6.34,
    xFmv: 7.01,
    financialLimit: 98,
    roleLimit: 94,
    maxValue: 104,
    nextScore: 91,
    expectedMin: 76,
    expectedMax: 101,
    reason:
      'Prima punta compatibile con il piano.',
    interested: [
      'Marco',
      'Valerio',
    ],
  },
  {
    id: 'lautaro',
    name: 'Lautaro',
    team: 'Inter',
    role: 'A',
    pma: 118,
    consensus: 96,
    iCa: 97,
    startingProbability: 97,
    xMv: 6.72,
    xFmv: 7.88,
    financialLimit: 126,
    roleLimit: 121,
    maxValue: 134,
    nextScore: 98,
    expectedMin: 108,
    expectedMax: 138,
    reason:
      'Top di reparto con forte pressione attesa.',
    interested: [
      'Gianluca',
      'Valerio',
      'Stefano',
    ],
  },
  {
    id: 'piccoli',
    name: 'Piccoli',
    team: 'Cagliari',
    role: 'A',
    pma: 46,
    consensus: 74,
    iCa: 76,
    startingProbability: 88,
    xMv: 5.94,
    xFmv: 6.21,
    financialLimit: 58,
    roleLimit: 55,
    maxValue: 61,
    nextScore: 77,
    expectedMin: 36,
    expectedMax: 53,
    reason:
      'Alternativa meno costosa nel ruolo.',
    interested: [
      'Luca',
    ],
  },
  {
    id: 'castellanos',
    name: 'Castellanos',
    team: 'Lazio',
    role: 'A',
    pma: 62,
    consensus: 78,
    iCa: 80,
    startingProbability: 89,
    xMv: 6.07,
    xFmv: 6.54,
    financialLimit: 73,
    roleLimit: 70,
    maxValue: 77,
    nextScore: 82,
    expectedMin: 52,
    expectedMax: 71,
    reason:
      'Seconda fascia interessante per costo e titolarità.',
    interested: [
      'Andrea',
      'Davide',
    ],
  },
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

let activeRole: AuctionRole =
  'D'

let selectedPlayerId =
  'wesley'

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
    Math.round(
      value,
    ),
  )
}

function getPlayer(
  playerId: string,
):
  | DemoPlayer
  | undefined {
  return DEMO_PLAYERS.find(
    (player) =>
      player.id ===
      playerId,
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

      const progress =
        clamp(
          factors[role],
          0,
          1,
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
            progress,
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

  const normalized =
    clamp(
      ratio,
      0,
      1,
    )

  const hue =
    Math.round(
      normalized * 120,
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

function getSelectedPlayer():
  DemoPlayer | undefined {
  return getPlayer(
    selectedPlayerId,
  )
}

function getRolePlayers(
  role: AuctionRole,
):
  DemoPlayer[] {
  return DEMO_PLAYERS.filter(
    (player) =>
      player.role === role,
  )
}

function getRecommendedPlayers(
  role: AuctionRole,
):
  DemoPlayer[] {
  return getRolePlayers(
    role,
  )
    .filter(
      (player) =>
        player.id !==
          selectedPlayerId &&
        !isPlayerAssigned(
          player.id,
        ) &&
        !discardedRecommendations.has(
          player.id,
        ),
    )
    .sort(
      (a, b) =>
        b.nextScore -
        a.nextScore,
    )
    .slice(
      0,
      3,
    )
}

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

  const assignment =
    assignments[index]

  reverseAssignment(
    assignment,
  )

  assignments.splice(
    index,
    1,
  )

  return true
}

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

function renderPlayerSearch():
  string {
  const players =
    getRolePlayers(
      activeRole,
    )

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
        class="auction-player-search"
      >
        <input
          id="auctionPlayerSearch"
          type="search"
          placeholder="Cerca giocatore o squadra..."
          autocomplete="off"
        >

        <div
          id="auctionSearchResults"
          class="auction-search-results"
        >
          ${players
            .map(
              (player) => `
                <button
                  type="button"
                  class="
                    auction-search-result
                    ${
                      player.id ===
                      selectedPlayerId
                        ? 'selected'
                        : ''
                    }
                  "
                  data-player-id="${player.id}"
                  data-search="${escapeHtml(
                    (
                      player.name +
                      ' ' +
                      player.team
                    ).toLowerCase(),
                  )}"
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

                  ${
                    isPlayerAssigned(
                      player.id,
                    )
                      ? `
                        <em>
                          Assegnato
                        </em>
                      `
                      : ''
                  }
                </button>
              `,
            )
            .join('')}
        </div>
      </div>
    </section>
  `
}

function renderPlayerCard(
  player: DemoPlayer,
  participants:
    DemoParticipantState[],
): string {
  const ceiling =
    Math.min(
      player.financialLimit,
      player.roleLimit,
      player.maxValue,
    )

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
            class="auction-demo-label"
          >
            DATI DEMO
          </span>

          <button
            type="button"
            class="auction-text-button"
            disabled
          >
            Scheda completa
          </button>
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
            Tetto consigliato
          </span>

          <strong>
            ${ceiling}
          </strong>

          <small>
            vincolo più restrittivo
          </small>
        </div>

        <div
          class="auction-main-value"
        >
          <span>
            PMA
          </span>

          <strong>
            ${player.pma}
          </strong>
        </div>

        <div
          class="auction-main-value"
        >
          <span>
            Consenso
          </span>

          <strong>
            ${player.consensus}
          </strong>
        </div>

        <div
          class="auction-main-value"
        >
          <span>
            iCà
          </span>

          <strong>
            ${player.iCa}
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
            ${player.startingProbability}%
          </strong>

          <div
            class="auction-insight-progress"
            aria-label="Titolarità ${player.startingProbability}%"
          >
            <span
              style="
                width:
                ${player.startingProbability}%;
              "
            ></span>
          </div>
        </div>

        <div
          class="auction-insight-metric"
        >
          <span>
            xMV
          </span>

          <strong>
            ${player.xMv.toFixed(
              2,
            )}
          </strong>
        </div>

        <div
          class="auction-insight-metric"
        >
          <span>
            xFMV
          </span>

          <strong>
            ${player.xFmv.toFixed(
              2,
            )}
          </strong>
        </div>
      </div>

      <div
        class="auction-recommendation"
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
            RILANCIA FINO A
            ${ceiling}
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

            <strong>
              ${player.financialLimit}
            </strong>
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
              ${player.roleLimit}
            </strong>
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

            <strong>
              ${player.maxValue}
            </strong>
          </div>
        </div>

        <div
          class="auction-reasons"
        >
          <span>
            Qualità

            <strong>
              Consenso
              ${player.consensus}
            </strong>
          </span>

          <span>
            Sostenibilità

            <strong>
              Tetto
              ${ceiling}
            </strong>
          </span>

          <span>
            Reparto

            <strong>
              ${escapeHtml(
                player.reason,
              )}
            </strong>
          </span>
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

function renderRecommendations():
  string {
  const recommendations =
    getRecommendedPlayers(
      activeRole,
    )

  const discardedCount =
    getRolePlayers(
      activeRole,
    ).filter(
      (player) =>
        discardedRecommendations.has(
          player.id,
        ),
    ).length

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
            consigliate
          </h3>
        </div>

        <span
          class="auction-demo-label"
        >
          DEMO
        </span>
      </div>

      <div
        class="auction-next-list"
      >
        ${
          recommendations.length
            ? recommendations
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
                          ~${player.nextScore}
                        </b>
                      </div>

                      <div
                        class="
                          auction-next-range
                        "
                      >
                        Fascia
                        ${player.expectedMin}
                        –
                        ${player.expectedMax}
                      </div>

                      <p>
                        ${escapeHtml(
                          player.reason,
                        )}
                      </p>

                      <small>
                        Interessati:
                        ${
                          player.interested.length
                            ? escapeHtml(
                                player.interested.join(
                                  ', ',
                                ),
                              )
                            : '—'
                        }
                      </small>

                      <div
                        class="
                          auction-next-actions
                        "
                      >
                        <button
                          type="button"
                          data-select-recommended="${player.id}"
                        >
                          Chiama
                        </button>

                        <button
                          type="button"
                          data-discard-recommended="${player.id}"
                        >
                          Scarta
                        </button>
                      </div>
                    </article>
                  `,
                )
                .join('')
            : `
              <div
                class="
                  auction-empty-state
                "
              >
                Nessun altro candidato
                disponibile nel ruolo
                ${activeRole}.
              </div>
            `
        }
      </div>

      ${
        discardedCount > 0
          ? `
            <button
              id="restoreDiscardedButton"
              type="button"
              class="
                auction-restore-button
              "
            >
              Riabilita scartati
              (${discardedCount})
            </button>
          `
          : ''
      }
    </aside>
  `
}

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
        class="
          auction-section-heading
        "
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
          class="
            auction-bar-legend
          "
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
        class="
          auction-participant-grid
        "
      >
        ${participants
          .map(
            (
              participant,
            ) => {
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
                    class="
                      auction-slot-row
                    "
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

function renderAssignmentHistory():
  string {
  return `
    <section
      class="
        auction-history-section
      "
    >
      <div
        class="
          auction-history-heading
        "
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
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div
          class="
            auction-edit-form
          "
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

function renderLiveAuction(
  state: AppState,
): string {
  const participants =
    ensureParticipants(
      state,
    )

  const selectedPlayer =
    getSelectedPlayer()

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

  const hasAssignments =
    assignments.length > 0

  return `
    <section
      class="
        page
        auction-live-page
      "
    >
      <div
        class="
          auction-live-toolbar
        "
      >
        <div
          class="
            auction-live-title
          "
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
          class="
            auction-role-switcher
          "
        >
          <span>
            Ruolo attivo
          </span>

          <div>
            ${renderRoleTabs()}
          </div>
        </div>

        <div
          class="
            auction-toolbar-stat
          "
        >
          <span>
            Crediti owner
          </span>

          <strong>
            ${ownerCredits}
          </strong>
        </div>

        <div
          class="
            auction-toolbar-actions
          "
        >
          <button
            id="undoLastAssignmentButton"
            type="button"
            class="
              auction-toolbar-button
            "
            ${
              hasAssignments
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

      ${renderPlayerSearch()}

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
                    class="
                      auction-kicker
                    "
                  >
                    CHIAMATA CORRENTE
                  </span>

                  <h2>
                    Nessun giocatore
                    selezionato
                  </h2>

                  <p>
                    Cerca un giocatore
                    del ruolo
                    ${activeRole}.
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
        class="
          auction-prototype-note
        "
      >
        Prototipo visivo:
        assegnazioni e correzioni
        restano solo nella memoria
        della demo.
      </div>

      ${renderEditAssignmentOverlay(
        participants,
      )}
    </section>
  `
}

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
            <h1>
              Asta
            </h1>

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
            class="
              finalization-icon
            "
          >
            !
          </div>

          <div
            class="
              finalization-copy
            "
          >
            <h2>
              Asta terminata
            </h2>

            <p>
              La sessione non è
              ancora stata
              registrata.
            </p>

            <p>
              Prima di iniziare
              una nuova asta devi
              scegliere se salvare
              definitivamente i
              dati nello storico
              oppure scartare
              questa sessione.
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
            class="
              overlay-backdrop
            "
          ></div>

          <div
            class="
              overlay-card
              small-overlay-card
            "
          >
            <div
              class="
                overlay-header
              "
            >
              <div>
                <span
                  class="eyebrow"
                >
                  SCARTA ASTA
                </span>

                <h2>
                  Conferma
                  eliminazione
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
                Questa sessione
                non verrà aggiunta
                allo storico.
              </p>

              <p>
                <strong>
                  I dati
                  appartenenti
                  esclusivamente
                  a questa asta
                  verranno
                  scartati.
                </strong>
              </p>
            </div>

            <div
              class="
                overlay-actions
              "
            >
              <button
                id="cancelDiscardAuctionButton"
                type="button"
                class="
                  secondary-button
                "
              >
                Annulla
              </button>

              <button
                id="confirmDiscardAuctionButton"
                type="button"
                class="
                  danger-button
                "
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
    'archived'
  ) {
    return `
      <section class="page">
        <div class="page-heading">
          <div>
            <h1>
              Asta
            </h1>

            <p>
              Sessione registrata.
            </p>
          </div>

          <span
            class="archived-badge"
          >
            REGISTRATA
          </span>
        </div>

        <section
          class="panel"
        >
          <h2>
            Asta registrata
          </h2>

          <p
            class="muted-text"
          >
            La sessione è stata
            chiusa correttamente
            ed è pronta per essere
            conservata nello
            storico.
          </p>
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

  if (
    state.auctionPhase ===
    'discarded'
  ) {
    return `
      <section class="page">
        <div class="page-heading">
          <div>
            <h1>
              Asta
            </h1>

            <p>
              Sessione scartata.
            </p>
          </div>

          <span
            class="discarded-badge"
          >
            SCARTATA
          </span>
        </div>

        <section
          class="panel"
        >
          <h2>
            Asta scartata
          </h2>

          <p
            class="muted-text"
          >
            La sessione non verrà
            aggiunta allo storico.
          </p>
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
      <h1>
        Asta
      </h1>

      <p>
        Asta non ancora avviata.
      </p>
    </section>
  `
}

export function bindAuctionEvents(
  state: AppState,
  actions: AuctionActions,
): void {
  if (
    state.auctionPhase ===
    'live'
  ) {
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

              activeRole = role

              const nextPlayer =
                getRolePlayers(
                  role,
                ).find(
                  (player) =>
                    !isPlayerAssigned(
                      player.id,
                    ),
                )

              selectedPlayerId =
                nextPlayer?.id ??
                ''

              auctionFeedback =
                ''

              actions.onRender()
            },
          )
        },
      )

    const searchInput =
      document.querySelector<HTMLInputElement>(
        '#auctionPlayerSearch',
      )

    const searchResults =
      document.querySelector<HTMLElement>(
        '#auctionSearchResults',
      )

    searchInput?.addEventListener(
      'input',
      () => {
        const query =
          searchInput.value
            .trim()
            .toLowerCase()

        searchResults
          ?.querySelectorAll<HTMLElement>(
            '[data-search]',
          )
          .forEach(
            (result) => {
              const value =
                result.dataset
                  .search ??
                ''

              result.hidden =
                Boolean(
                  query,
                ) &&
                !value.includes(
                  query,
                )
            },
          )
      },
    )

    document
      .querySelectorAll<HTMLButtonElement>(
        '[data-player-id]',
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            () => {
              const playerId =
                button.dataset
                  .playerId

              if (!playerId) {
                return
              }

              selectedPlayerId =
                playerId

              auctionFeedback =
                ''

              actions.onRender()
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
              const playerId =
                button.dataset
                  .selectRecommended

              if (!playerId) {
                return
              }

              selectedPlayerId =
                playerId

              auctionFeedback =
                ''

              actions.onRender()
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
        '#restoreDiscardedButton',
      )
      ?.addEventListener(
        'click',
        () => {
          getRolePlayers(
            activeRole,
          ).forEach(
            (player) => {
              discardedRecommendations.delete(
                player.id,
              )
            },
          )

          actions.onRender()
        },
      )

    document
      .querySelector(
        '#auctionCancelCallButton',
      )
      ?.addEventListener(
        'click',
        () => {
          selectedPlayerId =
            ''

          auctionFeedback =
            ''

          actions.onRender()
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
            getSelectedPlayer()

          if (!player) {
            return
          }

          auctionFeedback =
            `${player.name} segnato come invenduto nella demo.`

          selectedPlayerId =
            ''

          actions.onRender()
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
            getSelectedPlayer()

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

              const assignment =
                assignments.find(
                  (item) =>
                    item.id === id,
                )

              const player =
                assignment
                  ? getPlayer(
                      assignment.playerId,
                    )
                  : undefined

              if (
                !assignment ||
                !removeAssignment(
                  id,
                )
              ) {
                return
              }

              auctionFeedback =
                player
                  ? `Assegnazione di ${player.name} annullata.`
                  : 'Assegnazione annullata.'

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

    document
      .querySelector(
        '#closeEditAssignmentButton',
      )
      ?.addEventListener(
        'click',
        () => {
          editingAssignmentId =
            null

          actions.onRender()
        },
      )

    document
      .querySelector(
        '#cancelEditAssignmentButton',
      )
      ?.addEventListener(
        'click',
        () => {
          editingAssignmentId =
            null

          actions.onRender()
        },
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
            !newParticipant
          ) {
            return
          }

          if (
            !Number.isInteger(
              newPrice,
            ) ||
            newPrice <= 0
          ) {
            auctionFeedback =
              'Inserisci un prezzo intero positivo.'

            editingAssignmentId =
              null

            actions.onRender()

            return
          }

          /*
            Prima annulliamo
            temporaneamente il
            vecchio movimento,
            così il controllo
            economico viene fatto
            sullo stato corretto.
          */
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
            /*
              Ripristino completo
              del vecchio stato.
            */
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

          auctionFeedback =
            `Assegnazione di ${player.name} modificata: ${newParticipant.name}, ${newPrice} crediti.`

          editingAssignmentId =
            null

          actions.onRender()
        },
      )

    return
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

    return
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
}