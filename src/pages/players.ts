import battitoriCsv
  from '../../database/MisterCana_DB_Battitori.csv?raw'

import {
  players,
} from '../data/players'

import type {
  AppState,
} from '../app/state'

import type {
  Player,
  PlayerRole,
} from '../domain/player'

import {
  renderPlayerDetailOverlay,
} from '../components/playerDetailOverlay'

type RoleFilter =
  | 'ALL'
  | PlayerRole

type SortKey =
  | 'name'
  | 'iCa'
  | 'pmaPercent'
  | 'consensus'
  | 'startingProbability'
  | 'mv'
  | 'fmv'
  | 'status'

type SortDirection =
  | 'asc'
  | 'desc'

type SpecialistRank =
  | 1
  | 2
  | 3
  | 4

type PlayerAuctionStatus =
  | 'not-live'
  | 'free'
  | 'assigned'

interface PlayersViewState {
  role: RoleFilter

  penaltiesOnly: boolean
  freeOnly: boolean

  search: string

  sortKey: SortKey
  sortDirection: SortDirection

  defaultRoleIcaOrder: boolean
}

interface SpecialistEntry {
  team: string
  name: string
  rank: SpecialistRank
}

interface PlayerSpecialists {
  penaltyRank:
    SpecialistRank | null

  setPieceRank:
    SpecialistRank | null
}

interface PlayersActions {
  onRender: () => void

  onCallPlayer:
    (playerId: string) => void

  onGoToAuction: () => void
}

const viewState: PlayersViewState = {
  role: 'ALL',

  penaltiesOnly: false,
  freeOnly: false,

  search: '',

  sortKey: 'iCa',
  sortDirection: 'desc',

  defaultRoleIcaOrder: true,
}

let previewPlayerId:
  string | null = null

/* =========================
   HTML
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

/* =========================
   FORMATTERS
========================= */

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

function formatItalianNumber(
  value:
    | number
    | undefined,
  digits = 2,
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

/* =========================
   CSV
========================= */

function parseCsvRow(
  line: string,
): string[] {
  const values: string[] = []

  let current = ''
  let quoted = false

  for (
    let index = 0;
    index < line.length;
    index += 1
  ) {
    const character =
      line[index]

    if (
      character === '"'
    ) {
      if (
        quoted &&
        line[index + 1] === '"'
      ) {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }

      continue
    }

    if (
      character === ';' &&
      !quoted
    ) {
      values.push(
        current.trim(),
      )

      current = ''

      continue
    }

    current += character
  }

  values.push(
    current.trim(),
  )

  return values
}

function parseCsv(
  csv: string,
): string[][] {
  return csv
    .replace(/\r/g, '')
    .split('\n')
    .map(
      (line) =>
        line.trim(),
    )
    .filter(Boolean)
    .map(parseCsvRow)
}

/* =========================
   SPECIALISTS
========================= */

function parseSpecialistsCsv(
  csv: string,
): {
  penalties: SpecialistEntry[]
  setPieces: SpecialistEntry[]
} {
  const rows =
    parseCsv(csv)

  const penalties:
    SpecialistEntry[] = []

  const setPieces:
    SpecialistEntry[] = []

  if (
    rows.length < 2
  ) {
    return {
      penalties,
      setPieces,
    }
  }

  rows
    .slice(1)
    .forEach(
      (columns) => {
        const [
          team,
          penalty1,
          penalty2,
          penalty3,
          penalty4,
          setPiece1,
          setPiece2,
          setPiece3,
        ] = columns

        if (!team) {
          return
        }

        ;[
          penalty1,
          penalty2,
          penalty3,
          penalty4,
        ].forEach(
          (
            name,
            index,
          ) => {
            if (!name) {
              return
            }

            penalties.push({
              team,
              name,

              rank:
                (
                  index + 1
                ) as SpecialistRank,
            })
          },
        )

        ;[
          setPiece1,
          setPiece2,
          setPiece3,
        ].forEach(
          (
            name,
            index,
          ) => {
            if (!name) {
              return
            }

            setPieces.push({
              team,
              name,

              rank:
                (
                  index + 1
                ) as SpecialistRank,
            })
          },
        )
      },
    )

  return {
    penalties,
    setPieces,
  }
}

const SPECIALISTS =
  parseSpecialistsCsv(
    battitoriCsv,
  )

/* =========================
   MATCHING
========================= */

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

function getNameTokens(
  value: string,
): string[] {
  return normalizeText(
    value,
  )
    .split(' ')
    .filter(Boolean)
}

function namesLikelyMatch(
  playerName: string,
  specialistName: string,
): boolean {
  const playerNormalized =
    normalizeText(
      playerName,
    )

  const specialistNormalized =
    normalizeText(
      specialistName,
    )

  if (
    !playerNormalized ||
    !specialistNormalized
  ) {
    return false
  }

  if (
    playerNormalized ===
    specialistNormalized
  ) {
    return true
  }

  const playerTokens =
    getNameTokens(
      playerName,
    )

  const specialistTokens =
    getNameTokens(
      specialistName,
    )

  if (
    specialistTokens.length === 0
  ) {
    return false
  }

  return specialistTokens.every(
    (specialistToken) => {
      if (
        specialistToken.length <= 2
      ) {
        return playerTokens.some(
          (playerToken) =>
            playerToken.startsWith(
              specialistToken,
            ),
        )
      }

      return playerTokens.some(
        (playerToken) =>
          playerToken ===
          specialistToken,
      )
    },
  )
}

function teamsLikelyMatch(
  playerTeam: string,
  specialistTeam: string,
): boolean {
  return (
    normalizeText(
      playerTeam,
    ) ===
    normalizeText(
      specialistTeam,
    )
  )
}

function findSpecialistRank(
  player: Player,
  entries: SpecialistEntry[],
): SpecialistRank | null {
  const match =
    entries.find(
      (entry) =>
        teamsLikelyMatch(
          player.team,
          entry.team,
        ) &&
        namesLikelyMatch(
          player.name,
          entry.name,
        ),
    )

  return (
    match?.rank ??
    null
  )
}

function getPlayerSpecialists(
  player: Player,
): PlayerSpecialists {
  return {
    penaltyRank:
      findSpecialistRank(
        player,
        SPECIALISTS.penalties,
      ),

    setPieceRank:
      findSpecialistRank(
        player,
        SPECIALISTS.setPieces,
      ),
  }
}

/* =========================
   AUCTION STATUS
========================= */

function isPlayerAssigned(
  state: AppState,
  playerId: string,
): boolean {
  return state
    .auctionAssignments
    .some(
      (assignment) =>
        assignment.playerId ===
        playerId,
    )
}

function getPlayerAuctionStatus(
  state: AppState,
  playerId: string,
): PlayerAuctionStatus {
  if (
    state.auctionPhase !==
    'live'
  ) {
    return 'not-live'
  }

  return isPlayerAssigned(
    state,
    playerId,
  )
    ? 'assigned'
    : 'free'
}

function getAuctionStatusSortValue(
  state: AppState,
  playerId: string,
): number {
  const status =
    getPlayerAuctionStatus(
      state,
      playerId,
    )

  switch (status) {
    case 'free':
      return 2

    case 'assigned':
      return 1

    default:
      return 0
  }
}

/* =========================
   INDICATORS
========================= */

function getRankClass(
  rank:
    SpecialistRank | null,
): string {
  switch (rank) {
    case 1:
      return 'rank-gold'

    case 2:
      return 'rank-silver'

    case 3:
      return 'rank-bronze'

    case 4:
      return 'rank-neutral'

    default:
      return ''
  }
}

function getRankLabel(
  rank:
    SpecialistRank | null,
): string {
  if (!rank) {
    return ''
  }

  return `${rank}°`
}

function renderPlayerIndicators(
  player: Player,
): string {
  const specialists =
    getPlayerSpecialists(
      player,
    )

  const indicators:
    string[] = []

  if (
    player.startingProbability !==
      undefined &&
    player.startingProbability >= 90
  ) {
    indicators.push(`
      <span
        class="
          player-indicator
          player-indicator-xi
        "
        title="Titolarità almeno 90%"
        aria-label="
          Titolarità almeno 90 per cento
        "
      >
        XI
      </span>
    `)
  }

  if (
    specialists.penaltyRank
  ) {
    indicators.push(`
      <span
        class="
          player-indicator
          player-indicator-specialist
          ${getRankClass(
            specialists.penaltyRank,
          )}
        "
        title="${getRankLabel(
          specialists.penaltyRank,
        )} rigorista"
        aria-label="${getRankLabel(
          specialists.penaltyRank,
        )} rigorista"
      >
        🥅
      </span>
    `)
  }

  if (
    specialists.setPieceRank
  ) {
    indicators.push(`
      <span
        class="
          player-indicator
          player-indicator-specialist
          ${getRankClass(
            specialists.setPieceRank,
          )}
        "
        title="${getRankLabel(
          specialists.setPieceRank,
        )} battitore piazzati"
        aria-label="${getRankLabel(
          specialists.setPieceRank,
        )} battitore piazzati"
      >
        ⚽
      </span>
    `)
  }

  if (
    indicators.length === 0
  ) {
    return ''
  }

  return `
    <span
      class="
        players-player-indicators
      "
    >
      ${indicators.join('')}
    </span>
  `
}

/* =========================
   FILTERS
========================= */

function isPenaltyTaker(
  player: Player,
): boolean {
  return (
    getPlayerSpecialists(
      player,
    ).penaltyRank !==
    null
  )
}

function getFilteredPlayers(
  state: AppState,
):
  Player[] {
  const search =
    normalizeText(
      viewState.search,
    )

  const filtered =
    players.filter(
      (player) => {
        if (
          viewState.role !== 'ALL' &&
          player.role !==
            viewState.role
        ) {
          return false
        }

        if (
          viewState.penaltiesOnly &&
          !isPenaltyTaker(
            player,
          )
        ) {
          return false
        }

        if (
          state.auctionPhase ===
            'live' &&
          viewState.freeOnly &&
          isPlayerAssigned(
            state,
            player.id,
          )
        ) {
          return false
        }

        if (search) {
          const searchable =
            normalizeText(
              `${player.name} ${player.team}`,
            )

          if (
            !searchable.includes(
              search,
            )
          ) {
            return false
          }
        }

        return true
      },
    )

  return filtered.sort(
    (
      first,
      second,
    ) =>
      comparePlayers(
        state,
        first,
        second,
      ),
  )
}

/* =========================
   SORT
========================= */

const ROLE_ORDER:
  Record<
    PlayerRole,
    number
  > = {
    P: 0,
    D: 1,
    C: 2,
    A: 3,
  }

function compareDefaultRoleIca(
  first: Player,
  second: Player,
): number {
  const roleDifference =
    ROLE_ORDER[first.role] -
    ROLE_ORDER[second.role]

  if (
    roleDifference !== 0
  ) {
    return roleDifference
  }

  const firstIca =
    first.iCa

  const secondIca =
    second.iCa

  const firstHasIca =
    typeof firstIca ===
      'number' &&
    Number.isFinite(firstIca)

  const secondHasIca =
    typeof secondIca ===
      'number' &&
    Number.isFinite(secondIca)

  if (
    firstHasIca &&
    !secondHasIca
  ) {
    return -1
  }

  if (
    !firstHasIca &&
    secondHasIca
  ) {
    return 1
  }

  if (
    firstHasIca &&
    secondHasIca &&
    firstIca !== secondIca
  ) {
    return (
      (secondIca ?? 0) -
      (firstIca ?? 0)
    )
  }

  return first.name.localeCompare(
    second.name,
    'it',
  )
}

function getSortableValue(
  state: AppState,
  player: Player,
  key: SortKey,
): string | number {
  switch (key) {
    case 'name':
      return player.name
        .toLowerCase()

    case 'iCa':
      return (
        player.iCa ??
        -Infinity
      )

    case 'pmaPercent':
      return (
        player.pmaPercent ??
        -Infinity
      )

    case 'consensus':
      return (
        player.consensus ??
        -Infinity
      )

    case 'startingProbability':
      return (
        player
          .startingProbability ??
        -Infinity
      )

    case 'mv':
      return (
        player.mv ??
        -Infinity
      )

    case 'fmv':
      return (
        player.fmv ??
        -Infinity
      )

    case 'status':
      return getAuctionStatusSortValue(
        state,
        player.id,
      )
  }
}

function comparePlayers(
  state: AppState,
  first: Player,
  second: Player,
): number {
  if (
    viewState.defaultRoleIcaOrder
  ) {
    return compareDefaultRoleIca(
      first,
      second,
    )
  }

  const firstValue =
    getSortableValue(
      state,
      first,
      viewState.sortKey,
    )

  const secondValue =
    getSortableValue(
      state,
      second,
      viewState.sortKey,
    )

  let result: number

  if (
    typeof firstValue ===
      'number' &&
    typeof secondValue ===
      'number'
  ) {
    result =
      firstValue -
      secondValue
  } else {
    result =
      String(
        firstValue,
      ).localeCompare(
        String(
          secondValue,
        ),
        'it',
      )
  }

  return (
    viewState.sortDirection ===
    'asc'
      ? result
      : -result
  )
}

function sortIndicator(
  key: SortKey,
): string {
  if (
    viewState.defaultRoleIcaOrder ||
    viewState.sortKey !== key
  ) {
    return `
      <span
        class="
          players-sort-neutral
        "
      >
        ↕
      </span>
    `
  }

  return `
    <span
      class="
        players-sort-active
      "
    >
      ${
        viewState
          .sortDirection ===
        'asc'
          ? '↑'
          : '↓'
      }
    </span>
  `
}

function renderSortHeader(
  label: string,
  key: SortKey,
): string {
  return `
    <button
      type="button"
      class="
        players-table-sort
      "
      data-player-sort="${key}"
    >
      <span>
        ${label}
      </span>

      ${sortIndicator(
        key,
      )}
    </button>
  `
}

/* =========================
   PLAYER STATUS
========================= */

function renderPlayerStatus(
  state: AppState,
  player: Player,
): string {
  const status =
    getPlayerAuctionStatus(
      state,
      player.id,
    )

  if (
    status === 'not-live'
  ) {
    return `
      <span
        class="
          player-status
          player-status-not-live
        "
      >
        NO LIVE
      </span>
    `
  }

  if (
    status === 'assigned'
  ) {
    return `
      <span
        class="
          player-status
          player-status-assigned
        "
      >
        ASSEGNATO
      </span>
    `
  }

  return `
    <span
      class="
        player-status
        player-status-free
      "
    >
      DA ASSEGNARE
    </span>
  `
}

/* =========================
   PLAYER ROW
========================= */

function renderPlayerRow(
  state: AppState,
  player: Player,
): string {
  return `
    <button
      type="button"
      class="
        players-table-row
      "
      data-player-id="${escapeHtml(
        player.id,
      )}"
      aria-label="Apri scheda di ${escapeHtml(
        player.name,
      )}"
    >
      <div
        class="
          players-cell
          players-player-cell
        "
      >
        <span
          class="
            role-badge
            role-${player.role.toLowerCase()}
          "
        >
          ${player.role}
        </span>

        <div
          class="
            players-player-info
          "
        >
          <div
            class="
              players-player-name-row
            "
          >
            <strong>
              ${escapeHtml(
                player.name,
              )}
            </strong>

            ${renderPlayerIndicators(
              player,
            )}
          </div>

          <small>
            ${escapeHtml(
              player.team,
            )}
          </small>
        </div>
      </div>

      <div
        class="
          players-cell
          players-number-cell
          players-ica-cell
        "
      >
        ${formatNumber(
          player.iCa,
          2,
        )}
      </div>

      <div
        class="
          players-cell
          players-number-cell
          players-pma-cell
        "
      >
        ${formatPercent(
          player.pmaPercent,
          1,
        )}
      </div>

      <div
        class="
          players-cell
          players-number-cell
          players-consensus-cell
        "
      >
        ${formatNumber(
          player.consensus,
          2,
        )}
      </div>

      <div
        class="
          players-cell
          players-number-cell
          players-starting-cell
        "
      >
        ${formatPercent(
          player.startingProbability,
          0,
        )}
      </div>

      <div
        class="
          players-cell
          players-number-cell
          players-mv-cell
        "
      >
        <span
          class="
            players-mv-primary
          "
        >
          ${formatItalianNumber(
            player.mv,
            2,
          )}
        </span>

        <span
          class="
            players-mv-separator
          "
        >
          /
        </span>

        <span
          class="
            players-mv-secondary
          "
        >
          ${formatItalianNumber(
            player.fmv,
            2,
          )}
        </span>
      </div>

      <div
        class="
          players-cell
          players-status-cell
        "
      >
        ${renderPlayerStatus(
          state,
          player,
        )}
      </div>
    </button>
  `
}

/* =========================
   PLAYER DETAIL
========================= */

function renderPlayersDetail(
  state: AppState,
): string {
  if (!previewPlayerId) {
    return ''
  }

  const player =
    players.find(
      (item) =>
        item.id ===
        previewPlayerId,
    )

  if (!player) {
    return ''
  }

  const auctionLive =
    state.auctionPhase ===
    'live'

  const assigned =
    auctionLive &&
    isPlayerAssigned(
      state,
      player.id,
    )

  return renderPlayerDetailOverlay(
    player,
    assigned,
    auctionLive &&
      !assigned,
  )
}

/* =========================
   PAGE
========================= */

export function renderPlayersPage(
  state: AppState,
): string {
  const auctionLive =
    state.auctionPhase ===
    'live'

  if (
    !auctionLive &&
    viewState.freeOnly
  ) {
    viewState.freeOnly =
      false
  }

  const filteredPlayers =
    getFilteredPlayers(
      state,
    )

  return `
    <section
      class="
        page
        players-page
      "
    >
      <div
        class="
          players-page-header
        "
      >
        <div>
          <span
            class="
              players-eyebrow
            "
          >
            DATABASE 2026/27
          </span>

          <h1>
            Giocatori
          </h1>

          <p>
            ${filteredPlayers.length}
            di
            ${players.length}
            nel listone attivo
          </p>
        </div>

        <div
          class="
            players-header-actions
          "
        >
          <button
            id="playersGoToAuctionButton"
            type="button"
            class="
              players-auction-nav-button
              ${
                auctionLive
                  ? 'is-live'
                  : 'is-disabled'
              }
            "
            ${
              auctionLive
                ? ''
                : 'disabled'
            }
          >
            <span
              class="
                players-auction-nav-dot
              "
            ></span>

            Asta
          </button>
        </div>
      </div>

      <div
        class="
          players-toolbar
        "
      >
        <div
          class="
            players-toolbar-left
          "
        >
          <div
            class="
              players-role-filter
            "
          >
            ${(
              [
                [
                  'ALL',
                  'Tutti',
                ],
                [
                  'P',
                  'P',
                ],
                [
                  'D',
                  'D',
                ],
                [
                  'C',
                  'C',
                ],
                [
                  'A',
                  'A',
                ],
              ] as Array<
                [
                  RoleFilter,
                  string,
                ]
              >
            )
              .map(
                (
                  [
                    value,
                    label,
                  ],
                ) => `
                  <button
                    type="button"
                    class="
                      players-filter-button
                      players-role-${value.toLowerCase()}
                      ${
                        viewState.role ===
                        value
                          ? 'selected'
                          : ''
                      }
                    "
                    data-player-role="${value}"
                  >
                    ${label}
                  </button>
                `,
              )
              .join('')}
          </div>

          <div
            class="
              players-toggle-group
            "
          >
            <label
              class="
                players-simple-toggle
                ${
                  viewState.freeOnly &&
                  auctionLive
                    ? 'selected'
                    : ''
                }
                ${
                  auctionLive
                    ? ''
                    : 'disabled'
                }
              "
              title="${
                auctionLive
                  ? 'Mostra solo i giocatori da assegnare'
                  : 'Disponibile solo durante un’asta LIVE'
              }"
            >
              <input
                id="freeOnly"
                type="checkbox"
                ${
                  viewState.freeOnly &&
                  auctionLive
                    ? 'checked'
                    : ''
                }
                ${
                  auctionLive
                    ? ''
                    : 'disabled'
                }
              >

              <span
                class="
                  players-toggle-dot
                "
              ></span>

              <span>
                Solo liberi
              </span>
            </label>

            <label
              class="
                players-simple-toggle
                players-penalty-toggle
                ${
                  viewState
                    .penaltiesOnly
                    ? 'selected'
                    : ''
                }
              "
            >
              <input
                id="penaltiesOnly"
                type="checkbox"
                ${
                  viewState
                    .penaltiesOnly
                    ? 'checked'
                    : ''
                }
              >

              <span
                class="
                  players-penalty-symbol
                "
              >
                🥅
              </span>

              <span>
                Rigoristi
              </span>
            </label>
          </div>
        </div>

        <div
          class="
            players-search
          "
        >
          <span
            class="
              players-search-icon
            "
          >
            ⌕
          </span>

          <input
            id="playersSearch"
            type="search"
            placeholder="Cerca nome o squadra..."
            value="${escapeHtml(
              viewState.search,
            )}"
            autocomplete="off"
          >

          <button
            id="clearPlayersSearch"
            type="button"
            class="
              players-search-clear
              ${
                viewState.search
                  ? ''
                  : 'hidden'
              }
            "
            aria-label="Cancella ricerca"
            title="Cancella ricerca"
          >
            ×
          </button>
        </div>
      </div>

      <div
        class="
          players-table-card
        "
      >
        <div
          class="
            players-table-header
          "
        >
          <div>
            ${renderSortHeader(
              'Giocatore',
              'name',
            )}
          </div>

          <div>
            ${renderSortHeader(
              'iCà',
              'iCa',
            )}
          </div>

          <div>
            ${renderSortHeader(
              'PMA',
              'pmaPercent',
            )}
          </div>

          <div>
            ${renderSortHeader(
              'Consenso',
              'consensus',
            )}
          </div>

          <div>
            ${renderSortHeader(
              'Titolarità',
              'startingProbability',
            )}
          </div>

          <div>
            ${renderSortHeader(
              'MV / FMV',
              'fmv',
            )}
          </div>

          <div>
            ${renderSortHeader(
              'Stato',
              'status',
            )}
          </div>
        </div>

        <div
          class="
            players-table-body
          "
        >
          ${
            filteredPlayers.length
              ? filteredPlayers
                  .map(
                    (
                      player:
                        Player,
                    ) =>
                      renderPlayerRow(
                        state,
                        player,
                      ),
                  )
                  .join('')
              : `
                <div
                  class="
                    players-empty
                  "
                >
                  Nessun giocatore
                  corrisponde ai filtri
                  selezionati.
                </div>
              `
          }
        </div>
      </div>

      <div
        class="
          players-footer-info
        "
      >
        <span>
          ${filteredPlayers.length}

          ${
            filteredPlayers.length ===
            1
              ? 'giocatore'
              : 'giocatori'
          }
        </span>

        <span>
          Listone MisterCanà 2026/27
        </span>
      </div>

      ${renderPlayersDetail(
        state,
      )}
    </section>
  `
}

/* =========================
   EVENTS
========================= */

function focusSearchAtEnd():
  void {
  const newSearchInput =
    document.querySelector<HTMLInputElement>(
      '#playersSearch',
    )

  if (!newSearchInput) {
    return
  }

  newSearchInput.focus()

  const end =
    newSearchInput
      .value
      .length

  newSearchInput
    .setSelectionRange(
      end,
      end,
    )
}

export function bindPlayersEvents(
  state: AppState,
  actions: PlayersActions,
): void {
  document
    .querySelector(
      '#playersGoToAuctionButton',
    )
    ?.addEventListener(
      'click',
      () => {
        if (
          state.auctionPhase !==
          'live'
        ) {
          return
        }

        actions.onGoToAuction()
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-player-role]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const role =
              button.dataset
                .playerRole as
                | RoleFilter
                | undefined

            if (!role) {
              return
            }

            viewState.role =
              role

            actions.onRender()
          },
        )
      },
    )

  document
    .querySelector<HTMLInputElement>(
      '#penaltiesOnly',
    )
    ?.addEventListener(
      'change',
      (event) => {
        const target =
          event.currentTarget as
            HTMLInputElement

        viewState
          .penaltiesOnly =
          target.checked

        actions.onRender()
      },
    )

  document
    .querySelector<HTMLInputElement>(
      '#freeOnly',
    )
    ?.addEventListener(
      'change',
      (event) => {
        if (
          state.auctionPhase !==
          'live'
        ) {
          viewState.freeOnly =
            false

          return
        }

        const target =
          event.currentTarget as
            HTMLInputElement

        viewState.freeOnly =
          target.checked

        actions.onRender()
      },
    )

  const searchInput =
    document.querySelector<HTMLInputElement>(
      '#playersSearch',
    )

  searchInput?.addEventListener(
    'input',
    () => {
      viewState.search =
        searchInput.value

      actions.onRender()

      focusSearchAtEnd()
    },
  )

  searchInput?.addEventListener(
    'search',
    () => {
      if (
        viewState.search ===
        searchInput.value
      ) {
        return
      }

      viewState.search =
        searchInput.value

      actions.onRender()

      focusSearchAtEnd()
    },
  )

  document
    .querySelector<HTMLButtonElement>(
      '#clearPlayersSearch',
    )
    ?.addEventListener(
      'click',
      () => {
        viewState.search = ''

        actions.onRender()

        const newSearchInput =
          document.querySelector<HTMLInputElement>(
            '#playersSearch',
          )

        newSearchInput?.focus()
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-player-sort]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const key =
              button.dataset
                .playerSort as
                | SortKey
                | undefined

            if (!key) {
              return
            }

            if (
              !viewState
                .defaultRoleIcaOrder &&
              viewState.sortKey ===
              key
            ) {
              viewState
                .sortDirection =
                viewState
                  .sortDirection ===
                'asc'
                  ? 'desc'
                  : 'asc'
            } else {
              viewState.sortKey =
                key

              viewState
                .sortDirection =
                key === 'name'
                  ? 'asc'
                  : 'desc'
            }

            viewState
              .defaultRoleIcaOrder =
              false

            actions.onRender()
          },
        )
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-player-id]',
    )
    .forEach(
      (row) => {
        row.addEventListener(
          'click',
          () => {
            const playerId =
              row.dataset
                .playerId

            if (!playerId) {
              return
            }

            previewPlayerId =
              playerId

            actions.onRender()
          },
        )
      },
    )

  const closePreview =
    (): void => {
      previewPlayerId =
        null

      actions.onRender()
    }

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-close-player-detail]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          closePreview,
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
        if (
          state.auctionPhase !==
          'live'
        ) {
          return
        }

        const button =
          event.currentTarget as
            HTMLButtonElement | null

        const playerId =
          button?.dataset
            .playerDetailCall

        if (!playerId) {
          return
        }

        if (
          isPlayerAssigned(
            state,
            playerId,
          )
        ) {
          return
        }

        previewPlayerId =
          null

        actions.onCallPlayer(
          playerId,
        )
      },
    )
}