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

import type {
  ObjectivePriority,
  PlayerObjective,
} from '../domain/objective'

interface ObjectivesActions {
  onStateChange: () => void
}

const PRIORITIES:
  Array<{
    id: ObjectivePriority
    label: string
  }> = [
    {
      id: 'primary',
      label: 'Primari',
    },
    {
      id: 'secondary',
      label: 'Secondari',
    },
    {
      id: 'third',
      label: 'Terzi',
    },
    {
      id: 'fourth',
      label: 'Quarti',
    },
    {
      id: 'bet',
      label: 'Scommesse',
    },
  ]

const ROLES:
  PlayerRole[] = [
    'P',
    'D',
    'C',
    'A',
  ]

let searchValue = ''

let selectedPriority:
  ObjectivePriority =
  'primary'

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

function getPlayerById(
  playerId: string,
): Player | undefined {
  return players.find(
    (player) =>
      player.id ===
      playerId,
  )
}

function getObjectiveByPlayerId(
  state: AppState,
  playerId: string,
): PlayerObjective | undefined {
  return state.objectives.find(
    (objective) =>
      objective.playerId ===
      playerId,
  )
}

function renderSearchResults(
  state: AppState,
): string {
  const normalizedSearch =
    searchValue
      .trim()
      .toLowerCase()

  if (
    normalizedSearch.length < 2
  ) {
    return ''
  }

  const results =
    players
      .filter(
        (player) => {
          const searchable =
            `${player.name} ${player.team}`
              .toLowerCase()

          return searchable.includes(
            normalizedSearch,
          )
        },
      )
      .slice(
        0,
        8,
      )

  if (
    results.length === 0
  ) {
    return `
      <div
        class="objectives-search-results"
      >
        <div
          class="objectives-search-empty"
        >
          Nessun giocatore trovato.
        </div>
      </div>
    `
  }

  return `
    <div
      class="objectives-search-results"
    >
      ${results
        .map(
          (player) => {
            const existing =
              getObjectiveByPlayerId(
                state,
                player.id,
              )

            return `
              <div
                class="
                  objectives-search-result
                  ${
                    existing
                      ? 'already-added'
                      : ''
                  }
                "
              >
                <div
                  class="
                    objectives-search-player
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

                  <div>
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
                </div>

                ${
                  existing
                    ? `
                      <span
                        class="
                          objective-existing-label
                        "
                      >
                        Già negli obiettivi
                      </span>
                    `
                    : `
                      <button
                        type="button"
                        class="
                          objective-add-button
                        "
                        data-add-objective="${player.id}"
                      >
                        Aggiungi
                      </button>
                    `
                }
              </div>
            `
          },
        )
        .join('')}
    </div>
  `
}

function renderObjectiveCard(
  objective: PlayerObjective,
): string {
  const player =
    getPlayerById(
      objective.playerId,
    )

  if (!player) {
    return ''
  }

  return `
    <article
      class="
        objective-player-card
      "
    >
      <div
        class="
          objective-player-main
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
          objective-player-actions
        "
      >
        <select
          class="
            objective-priority-select
          "
          data-objective-priority="${player.id}"
          aria-label="Cambia priorità"
        >
          ${PRIORITIES
            .map(
              (priority) => `
                <option
                  value="${priority.id}"
                  ${
                    objective.priority ===
                    priority.id
                      ? 'selected'
                      : ''
                  }
                >
                  ${priority.label}
                </option>
              `,
            )
            .join('')}
        </select>

        <button
          type="button"
          class="
            objective-remove-button
          "
          data-remove-objective="${player.id}"
          aria-label="Rimuovi ${escapeHtml(
            player.name,
          )}"
          title="Rimuovi"
        >
          ×
        </button>
      </div>
    </article>
  `
}

function getRoleObjectives(
  state: AppState,
  role: PlayerRole,
  priority:
    ObjectivePriority,
): PlayerObjective[] {
  return state.objectives.filter(
    (objective) => {
      if (
        objective.priority !==
        priority
      ) {
        return false
      }

      const player =
        getPlayerById(
          objective.playerId,
        )

      return (
        player?.role === role
      )
    },
  )
}

function renderPrioritySection(
  state: AppState,
  role: PlayerRole,
  priority: {
    id: ObjectivePriority
    label: string
  },
): string {
  const objectives =
    getRoleObjectives(
      state,
      role,
      priority.id,
    )

  return `
    <section
      class="
        objective-priority-section
        priority-${priority.id}
      "
    >
      <div
        class="
          objective-priority-header
        "
      >
        <span>
          ${priority.label}
        </span>

        <small>
          ${objectives.length}
        </small>
      </div>

      <div
        class="
          objective-priority-list
        "
      >
        ${
          objectives.length
            ? objectives
                .map(
                  (
                    objective,
                  ) =>
                    renderObjectiveCard(
                      objective,
                    ),
                )
                .join('')
            : `
              <div
                class="
                  objective-priority-empty
                "
              >
                Nessun giocatore
              </div>
            `
        }
      </div>
    </section>
  `
}

function getRoleTotal(
  state: AppState,
  role: PlayerRole,
): number {
  return state.objectives.filter(
    (objective) => {
      const player =
        getPlayerById(
          objective.playerId,
        )

      return (
        player?.role === role
      )
    },
  ).length
}

function getRoleLabel(
  role: PlayerRole,
): string {
  if (role === 'P') {
    return 'Portieri'
  }

  if (role === 'D') {
    return 'Difensori'
  }

  if (role === 'C') {
    return 'Centrocampisti'
  }

  return 'Attaccanti'
}

export function renderObjectivesPage(
  state: AppState,
): string {
  return `
    <section
      class="
        page
        objectives-page
      "
    >
      <div
        class="
          objectives-page-header
        "
      >
        <div>
          <span
            class="
              objectives-eyebrow
            "
          >
            STRATEGIA
          </span>

          <h1>
            Obiettivi
          </h1>

          <p>
            Costruisci la tua shortlist
            strategica per ruolo.
          </p>
        </div>

        <span
          class="
            objectives-total
          "
        >
          ${state.objectives.length}

          ${
            state.objectives.length === 1
              ? 'obiettivo'
              : 'obiettivi'
          }
        </span>
      </div>

      <section
        class="
          objectives-search-panel
        "
      >
        <div
          class="
            objectives-search-row
          "
        >
          <label
            class="
              objectives-search-box
            "
          >
            <span
              class="
                objectives-search-icon
              "
            >
              ⌕
            </span>

            <input
              id="objectivesSearch"
              type="search"
              placeholder="Cerca nome o squadra..."
              autocomplete="off"
              value="${escapeHtml(
                searchValue,
              )}"
            >
          </label>

          <select
            id="objectiveAddPriority"
            class="
              objective-add-priority
            "
            aria-label="Priorità obiettivo"
          >
            ${PRIORITIES
              .map(
                (priority) => `
                  <option
                    value="${priority.id}"
                    ${
                      selectedPriority ===
                      priority.id
                        ? 'selected'
                        : ''
                    }
                  >
                    ${priority.label}
                  </option>
                `,
              )
              .join('')}
          </select>
        </div>

        <p
          class="
            objectives-search-help
          "
        >
          Cerca il giocatore e scegli
          subito il livello di priorità.
          Il ruolo deriva automaticamente
          dal database.
        </p>

        ${renderSearchResults(
          state,
        )}
      </section>

      <div
        class="
          objectives-role-grid
        "
      >
        ${ROLES
          .map(
            (role) => `
              <section
                class="
                  objective-role-column
                  objective-role-${role.toLowerCase()}
                "
              >
                <div
                  class="
                    objective-role-header
                  "
                >
                  <div
                    class="
                      objective-role-title
                    "
                  >
                    <span
                      class="
                        role-badge
                        role-${role.toLowerCase()}
                      "
                    >
                      ${role}
                    </span>

                    <strong>
                      ${getRoleLabel(
                        role,
                      )}
                    </strong>
                  </div>

                  <span
                    class="
                      objective-role-count
                    "
                  >
                    ${getRoleTotal(
                      state,
                      role,
                    )}
                  </span>
                </div>

                <div
                  class="
                    objective-role-content
                  "
                >
                  ${PRIORITIES
                    .map(
                      (
                        priority,
                      ) =>
                        renderPrioritySection(
                          state,
                          role,
                          priority,
                        ),
                    )
                    .join('')}
                </div>
              </section>
            `,
          )
          .join('')}
      </div>

      <div
        class="
          objectives-footer-note
        "
      >
        Le priorità sono per ora
        classificazioni strategiche.
      </div>
    </section>
  `
}

export function bindObjectivesEvents(
  state: AppState,
  actions: ObjectivesActions,
): void {
  const searchInput =
    document.querySelector<HTMLInputElement>(
      '#objectivesSearch',
    )

  searchInput?.addEventListener(
    'input',
    () => {
      searchValue =
        searchInput.value

      actions.onStateChange()

      const newInput =
        document.querySelector<HTMLInputElement>(
          '#objectivesSearch',
        )

      if (newInput) {
        newInput.focus()

        const end =
          newInput.value.length

        newInput.setSelectionRange(
          end,
          end,
        )
      }
    },
  )

  document
    .querySelector<HTMLSelectElement>(
      '#objectiveAddPriority',
    )
    ?.addEventListener(
      'change',
      (event) => {
        const target =
          event.currentTarget as
            HTMLSelectElement

        selectedPriority =
          target.value as
            ObjectivePriority

        actions.onStateChange()
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-add-objective]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const playerId =
              button.dataset
                .addObjective

            if (!playerId) {
              return
            }

            const player =
              getPlayerById(
                playerId,
              )

            if (!player) {
              return
            }

            const existing =
              getObjectiveByPlayerId(
                state,
                playerId,
              )

            if (existing) {
              return
            }

            state.objectives.push({
              playerId,

              priority:
                selectedPriority,

              /*
                Placeholder tecnico
                neutro.

                Non viene mostrato
                nella UI e non viene
                utilizzato da alcun
                algoritmo.
              */
              weight: 1,
            })

            searchValue = ''

            actions.onStateChange()
          },
        )
      },
    )

  document
    .querySelectorAll<HTMLSelectElement>(
      '[data-objective-priority]',
    )
    .forEach(
      (select) => {
        select.addEventListener(
          'change',
          () => {
            const playerId =
              select.dataset
                .objectivePriority

            if (!playerId) {
              return
            }

            const objective =
              getObjectiveByPlayerId(
                state,
                playerId,
              )

            if (!objective) {
              return
            }

            objective.priority =
              select.value as
                ObjectivePriority

            objective.weight = 1

            actions.onStateChange()
          },
        )
      },
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-remove-objective]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const playerId =
              button.dataset
                .removeObjective

            if (!playerId) {
              return
            }

            state.objectives =
              state.objectives.filter(
                (objective) =>
                  objective.playerId !==
                  playerId,
              )

            actions.onStateChange()
          },
        )
      },
    )
}