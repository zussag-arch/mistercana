import {
  players,
} from '../data/players'

import type {
  Player,
  PlayerRole,
} from '../domain/player'

type RoleFilter =
  | 'ALL'
  | PlayerRole

type SortKey =
  | 'name'
  | 'iCa'
  | 'pma'
  | 'consensus'
  | 'startingProbability'
  | 'xMv'
  | 'xFmv'
  | 'status'

type SortDirection =
  | 'asc'
  | 'desc'

interface PlayersViewState {
  role: RoleFilter
  penaltiesOnly: boolean
  freeOnly: boolean
  search: string

  sortKey: SortKey
  sortDirection: SortDirection
}

const viewState: PlayersViewState = {
  role: 'ALL',

  penaltiesOnly: false,
  freeOnly: false,

  search: '',

  sortKey: 'name',
  sortDirection: 'asc',
}

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatNumber(
  value: number | undefined,
  digits = 0,
): string {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return '—'
  }

  return value.toFixed(digits)
}

function getFilteredPlayers(): Player[] {
  const search =
    viewState.search
      .trim()
      .toLowerCase()

  const filtered =
    players.filter(
      (player: Player) => {
        if (
          viewState.role !== 'ALL' &&
          player.role !== viewState.role
        ) {
          return false
        }

        if (
          viewState.penaltiesOnly &&
          !player.penaltyTaker
        ) {
          return false
        }

        if (
          viewState.freeOnly &&
          player.status !== 'free'
        ) {
          return false
        }

        if (search) {
          const searchable =
            `${player.name} ${player.team}`
              .toLowerCase()

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
    comparePlayers,
  )
}

function getSortableValue(
  player: Player,
  key: SortKey,
): string | number {
  switch (key) {
    case 'name':
      return player.name.toLowerCase()

    case 'iCa':
      return player.iCa ?? -Infinity

    case 'pma':
      return player.pma ?? -Infinity

    case 'consensus':
      return (
        player.consensus ??
        -Infinity
      )

    case 'startingProbability':
      return (
        player.startingProbability ??
        -Infinity
      )

    case 'xMv':
      return (
        player.xMv ??
        -Infinity
      )

    case 'xFmv':
      return (
        player.xFmv ??
        -Infinity
      )

    case 'status':
      return player.status
  }
}

function comparePlayers(
  first: Player,
  second: Player,
): number {
  const firstValue =
    getSortableValue(
      first,
      viewState.sortKey,
    )

  const secondValue =
    getSortableValue(
      second,
      viewState.sortKey,
    )

  let result: number

  if (
    typeof firstValue === 'number' &&
    typeof secondValue === 'number'
  ) {
    result =
      firstValue - secondValue
  } else {
    result =
      String(firstValue).localeCompare(
        String(secondValue),
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
    viewState.sortKey !== key
  ) {
    return `
      <span
        class="players-sort-neutral"
      >
        ↕
      </span>
    `
  }

  return `
    <span
      class="players-sort-active"
    >
      ${
        viewState.sortDirection ===
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
      class="players-table-sort"
      data-player-sort="${key}"
    >
      <span>${label}</span>

      ${sortIndicator(key)}
    </button>
  `
}

function renderPlayerRow(
  player: Player,
): string {
  return `
    <button
      type="button"
      class="players-table-row"
      data-player-id="${player.id}"
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
          class="players-player-info"
        >

          <strong>
            ${escapeHtml(player.name)}
          </strong>

          <small>
            ${escapeHtml(player.team)}
          </small>

        </div>

      </div>

      <div
        class="
          players-cell
          players-number-cell
        "
      >
        ${formatNumber(
          player.iCa,
          0,
        )}
      </div>

      <div
        class="
          players-cell
          players-number-cell
        "
      >
        ${formatNumber(
          player.pma,
          0,
        )}
      </div>

      <div
        class="
          players-cell
          players-number-cell
        "
      >
        ${formatNumber(
          player.consensus,
          0,
        )}
      </div>

      <div
        class="
          players-cell
          players-number-cell
        "
      >
        ${
          player
            .startingProbability ===
          undefined
            ? '—'
            : `${formatNumber(
                player.startingProbability,
                0,
              )}%`
        }
      </div>

      <div
        class="
          players-cell
          players-number-cell
          players-x-cell
        "
      >

        ${formatNumber(
          player.xMv,
          2,
        )}

        <span>/</span>

        ${formatNumber(
          player.xFmv,
          2,
        )}

      </div>

      <div
        class="
          players-cell
          players-status-cell
        "
      >

        <span
          class="
            player-status

            ${
              player.status ===
              'free'
                ? 'player-status-free'
                : 'player-status-assigned'
            }
          "
        >

          ${
            player.status === 'free'
              ? 'Libero'
              : 'Assegnato'
          }

        </span>

      </div>

    </button>
  `
}

export function renderPlayersPage(): string {
  const filteredPlayers =
    getFilteredPlayers()

  return `
    <section
      class="page players-page"
    >

      <div
        class="players-page-header"
      >

        <div>

          <h1>Giocatori</h1>

          <p>
            Database giocatori.
          </p>

        </div>

        <div
          class="players-header-tools"
        >

          <label
            class="players-search"
          >

            <span>⌕</span>

            <input
              id="playersSearch"
              type="search"
              placeholder="Cerca giocatore..."
              value="${escapeHtml(
                viewState.search,
              )}"
              autocomplete="off"
            >

          </label>

        </div>

      </div>

      <div
        class="players-toolbar"
      >

        <div
          class="players-role-filter"
        >

          ${(
            [
              ['ALL', 'Tutti'],
              ['P', 'P'],
              ['D', 'D'],
              ['C', 'C'],
              ['A', 'A'],
            ] as Array<
              [RoleFilter, string]
            >
          )
            .map(
              ([value, label]) => `
                <button
                  type="button"
                  class="
                    players-filter-button

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
          class="players-toggle-group"
        >

          <label
            class="
              players-simple-toggle

              ${
                viewState.penaltiesOnly
                  ? 'selected'
                  : ''
              }
            "
          >

            <input
              id="penaltiesOnly"
              type="checkbox"
              ${
                viewState.penaltiesOnly
                  ? 'checked'
                  : ''
              }
            >

            <span>
              Rigoristi
            </span>

          </label>

          <label
            class="
              players-simple-toggle

              ${
                viewState.freeOnly
                  ? 'selected'
                  : ''
              }
            "
          >

            <input
              id="freeOnly"
              type="checkbox"
              ${
                viewState.freeOnly
                  ? 'checked'
                  : ''
              }
            >

            <span>
              Liberi
            </span>

          </label>

        </div>

      </div>

      <div
        class="players-table-card"
      >

        <div
          class="players-table-header"
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
              'pma',
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
              'xMV/xFMV',
              'xFmv',
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
          class="players-table-body"
        >

          ${
            filteredPlayers.length
              ? filteredPlayers
                  .map(
                    (
                      player: Player,
                    ) =>
                      renderPlayerRow(
                        player,
                      ),
                  )
                  .join('')
              : `
                <div
                  class="players-empty"
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
        class="players-footer-info"
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
          Dataset demo temporaneo
        </span>

      </div>

      <div
        id="playerPreviewOverlay"
        class="overlay hidden"
        aria-hidden="true"
      >

        <div
          class="overlay-backdrop"
        ></div>

        <div
          class="
            overlay-card
            player-preview-card
          "
        >

          <div
            class="overlay-header"
          >

            <div>

              <span
                class="eyebrow"
              >
                GIOCATORE
              </span>

              <h2
                id="playerPreviewName"
              >
                Giocatore
              </h2>

            </div>

            <button
              id="closePlayerPreviewButton"
              type="button"
              class="icon-button"
              aria-label="Chiudi"
            >
              ×
            </button>

          </div>

          <p class="muted-text">
            Questa è una predisposizione
            temporanea.

            In seguito il click aprirà
            la pagina dettaglio completa
            del giocatore.
          </p>

        </div>

      </div>

    </section>
  `
}

interface PlayersActions {
  onRender: () => void
}

export function bindPlayersEvents(
  actions: PlayersActions,
): void {
  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-player-role]',
    )
    .forEach((button) => {
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

          viewState.role = role

          actions.onRender()
        },
      )
    })

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

        viewState.penaltiesOnly =
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

      const newSearchInput =
        document.querySelector<HTMLInputElement>(
          '#playersSearch',
        )

      if (newSearchInput) {
        newSearchInput.focus()

        const end =
          newSearchInput.value.length

        newSearchInput.setSelectionRange(
          end,
          end,
        )
      }
    },
  )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-player-sort]',
    )
    .forEach((button) => {
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
            viewState.sortKey === key
          ) {
            viewState.sortDirection =
              viewState.sortDirection ===
              'asc'
                ? 'desc'
                : 'asc'
          } else {
            viewState.sortKey = key

            viewState.sortDirection =
              key === 'name'
                ? 'asc'
                : 'desc'
          }

          actions.onRender()
        },
      )
    })

  const overlay =
    document.querySelector<HTMLElement>(
      '#playerPreviewOverlay',
    )

  const previewName =
    document.querySelector<HTMLElement>(
      '#playerPreviewName',
    )

  const closeOverlay = () => {
    overlay?.classList.add(
      'hidden',
    )

    overlay?.setAttribute(
      'aria-hidden',
      'true',
    )
  }

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-player-id]',
    )
    .forEach((row) => {
      row.addEventListener(
        'click',
        () => {
          const player =
            players.find(
              (
                item: Player,
              ) =>
                item.id ===
                row.dataset.playerId,
            )

          if (!player) {
            return
          }

          if (previewName) {
            previewName.textContent =
              player.name
          }

          overlay?.classList.remove(
            'hidden',
          )

          overlay?.setAttribute(
            'aria-hidden',
            'false',
          )
        },
      )
    })

  document
    .querySelector(
      '#closePlayerPreviewButton',
    )
    ?.addEventListener(
      'click',
      closeOverlay,
    )

  document
    .querySelector(
      '#playerPreviewOverlay .overlay-backdrop',
    )
    ?.addEventListener(
      'click',
      closeOverlay,
    )
}