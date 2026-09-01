import type {
  AppState,
  BudgetProfile,
} from '../app/state'

interface DashboardActions {
  onStateChange: () => void
  onStartAuction: () => void
}

type BudgetRole =
  | 'P'
  | 'D'
  | 'C'
  | 'A'

type ManagerFormMode =
  | 'create'
  | 'edit'

const BUDGET_PROFILES = {
  prudente: {
    P: 13,
    D: 25,
    C: 26,
    A: 36,
  },

  equilibrata: {
    P: 10,
    D: 25,
    C: 30,
    A: 35,
  },

  aggressiva: {
    P: 8,
    D: 22,
    C: 30,
    A: 40,
  },
} as const

function getVisibleManagers(
  state: AppState,
) {
  return state.managers.filter(
    (manager) =>
      !manager.archived,
  )
}

function getActiveManagers(
  state: AppState,
) {
  return getVisibleManagers(
    state,
  ).filter(
    (manager) =>
      manager.active,
  )
}

function getDistributionTotal(
  state: AppState,
): number {
  return (
    state.budgetDistribution.P +
    state.budgetDistribution.D +
    state.budgetDistribution.C +
    state.budgetDistribution.A
  )
}

function isDashboardLocked(
  state: AppState,
): boolean {
  return (
    state.auctionPhase !==
    'setup'
  )
}

function getAuctionStatusLabel(
  state: AppState,
): string {
  switch (
    state.auctionPhase
  ) {
    case 'live':
      return 'LIVE'

    case 'finalizing':
      return 'DA FINALIZZARE'

    case 'archived':
      return 'REGISTRATA'

    case 'discarded':
      return 'SCARTATA'

    default:
      return 'SETUP'
  }
}

function getAuctionStatusSubLabel(
  state: AppState,
): string {
  switch (
    state.auctionPhase
  ) {
    case 'live':
      return 'Asta in corso'

    case 'finalizing':
      return 'Serve una decisione finale'

    case 'archived':
      return 'Sessione registrata'

    case 'discarded':
      return 'Sessione scartata'

    default:
      return 'Configurazione iniziale'
  }
}

function canStartAuction(
  state: AppState,
): boolean {
  if (
    state.auctionPhase !==
    'setup'
  ) {
    return false
  }

  return (
    getDistributionTotal(
      state,
    ) === 100 &&
    getActiveManagers(
      state,
    ).length > 0
  )
}

function getManagerDisplayName(
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
    .join(' ')
}

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
      '&#39;',
    )
}

function renderManagerCard(
  manager:
    AppState['managers'][number],
  locked: boolean,
): string {
  const teamName =
    manager.teamName.trim()

  return `
    <article
      class="
        dashboard-manager-card
        ${
          manager.isOwner
            ? 'is-owner'
            : ''
        }
      "
    >
      <div
        class="
          dashboard-manager-topline
        "
      ></div>

      <div
        class="
          dashboard-manager-card-top
        "
      >
        <div
          class="manager-info"
        >
          <h3
            class="
              dashboard-manager-name
            "
          >
            ${escapeHtml(
              getManagerDisplayName(
                manager,
              ),
            )}

            ${
              manager.isOwner
                ? `
                  <span
                    class="
                      dashboard-owner-badge
                    "
                  >
                    TU
                  </span>
                `
                : ''
            }
          </h3>

          <div
            class="
              dashboard-manager-team
            "
          >
            ${
              teamName
                ? escapeHtml(
                    teamName,
                  )
                : 'Squadra non impostata'
            }
          </div>
        </div>

        <div
          class="
            manager-menu-wrapper
          "
        >
          <button
            type="button"
            class="
              manager-menu-button
            "
            data-manager-menu-button="${manager.id}"
            aria-label="Apri menu"
            ${
              locked
                ? 'disabled'
                : ''
            }
          >
            ⋯
          </button>

          <div
            class="
              manager-menu
              hidden
            "
            id="managerMenu-${manager.id}"
          >
            <button
              type="button"
              data-manager-edit-id="${manager.id}"
            >
              Modifica
            </button>

            <button
              type="button"
              data-manager-archive-id="${manager.id}"
              class="
                archive-menu-action
              "
            >
              Archivia
            </button>
          </div>
        </div>
      </div>

      <div
        class="
          dashboard-manager-card-bottom
        "
      >
        <span
          class="
            dashboard-manager-label
          "
        >
          Partecipa all’asta
        </span>

        <label
          class="switch-control"
        >
          <input
            type="checkbox"
            data-manager-active-id="${manager.id}"
            ${
              manager.active
                ? 'checked'
                : ''
            }
            ${
              locked
                ? 'disabled'
                : ''
            }
          >

          <span
            class="switch-slider"
          ></span>
        </label>
      </div>
    </article>
  `
}

function renderManagerOverlay():
  string {
  return `
    <div
      id="managerOverlay"
      class="overlay hidden"
      aria-hidden="true"
    >
      <div
        class="overlay-backdrop"
        data-close-manager-overlay="true"
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
              ALLENATORE
            </span>

            <h2
              id="managerOverlayTitle"
            >
              Nuovo allenatore
            </h2>
          </div>

          <button
            id="closeManagerOverlayButton"
            type="button"
            class="icon-button"
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <form
          id="managerForm"
          class="form-stack"
        >
          <input
            id="managerFormMode"
            type="hidden"
            value="create"
          >

          <input
            id="managerIdInput"
            type="hidden"
            value=""
          >

          <label
            class="field"
          >
            <span>
              Nome
            </span>

            <input
              id="managerFirstNameInput"
              type="text"
              placeholder="Es. Gabriele"
            >
          </label>

          <label
            class="field"
          >
            <span>
              Cognome
            </span>

            <input
              id="managerLastNameInput"
              type="text"
              placeholder="Es. Zussa"
            >
          </label>

          <label
            class="field"
          >
            <span>
              Alias
            </span>

            <input
              id="managerAliasInput"
              type="text"
              placeholder="Es. Gabri"
            >
          </label>

          <label
            class="field"
          >
            <span>
              Squadra
            </span>

            <input
              id="managerTeamNameInput"
              type="text"
              placeholder="Es. Arcamado"
            >
          </label>

          <div
            class="
              dashboard-toggle-chip
            "
          >
            <span
              class="
                dashboard-toggle-copy
              "
            >
              <span
                class="
                  dashboard-toggle-label
                "
              >
                Questa è la mia squadra
              </span>

              <span
                class="
                  dashboard-toggle-hint
                "
              >
                Mostra il badge TU
              </span>
            </span>

            <label
              class="switch-control"
            >
              <input
                id="managerOwnerInput"
                type="checkbox"
              >

              <span
                class="switch-slider"
              ></span>
            </label>
          </div>

          <div
            class="
              dashboard-toggle-chip
            "
          >
            <span
              class="
                dashboard-toggle-copy
              "
            >
              <span
                class="
                  dashboard-toggle-label
                "
              >
                Partecipa all’asta
              </span>

              <span
                class="
                  dashboard-toggle-hint
                "
              >
                Attiva o disattiva
                il partecipante
              </span>
            </span>

            <label
              class="switch-control"
            >
              <input
                id="managerActiveInput"
                type="checkbox"
                checked
              >

              <span
                class="switch-slider"
              ></span>
            </label>
          </div>

          <div
            class="overlay-actions"
          >
            <button
              id="cancelManagerOverlayButton"
              type="button"
              class="
                secondary-button
              "
            >
              Annulla
            </button>

            <button
              id="saveManagerButton"
              type="submit"
              class="
                primary-button
              "
            >
              Salva
            </button>
          </div>
        </form>
      </div>
    </div>
  `
}

function renderArchiveOverlay():
  string {
  return `
    <div
      id="archiveManagerOverlay"
      class="overlay hidden"
      aria-hidden="true"
    >
      <div
        class="overlay-backdrop"
        data-close-archive-overlay="true"
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
              ARCHIVIA ALLENATORE
            </span>

            <h2>
              Conferma archiviazione
            </h2>
          </div>

          <button
            id="closeArchiveManagerOverlayButton"
            type="button"
            class="icon-button"
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div
          class="warning-panel"
        >
          <p>
            L’allenatore verrà
            rimosso dalla lista
            attiva.
          </p>

          <p>
            La sua identità resta
            conservata per lo
            storico delle aste.
          </p>
        </div>

        <input
          id="archiveManagerIdInput"
          type="hidden"
          value=""
        >

        <div
          class="overlay-actions"
        >
          <button
            id="cancelArchiveManagerButton"
            type="button"
            class="
              secondary-button
            "
          >
            Annulla
          </button>

          <button
            id="confirmArchiveManagerButton"
            type="button"
            class="
              archive-button
            "
          >
            Archivia
          </button>
        </div>
      </div>
    </div>
  `
}

function renderRecapOverlay(
  state: AppState,
): string {
  const activeManagers =
    getActiveManagers(
      state,
    )

  const total =
    getDistributionTotal(
      state,
    )

  const startAllowed =
    canStartAuction(
      state,
    )

  const isSetup =
    state.auctionPhase ===
    'setup'

  return `
    <div
      id="recapOverlay"
      class="overlay hidden"
      aria-hidden="true"
    >
      <div
        class="overlay-backdrop"
        data-close-recap-overlay="true"
      ></div>

      <div
        class="overlay-card"
      >
        <div
          class="overlay-header"
        >
          <div>
            <span
              class="eyebrow"
            >
              RECAP ASTA
            </span>

            <h2>
              Riepilogo configurazione
            </h2>
          </div>

          <button
            id="closeRecapOverlayButton"
            type="button"
            class="icon-button"
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div
          class="
            dashboard-recap-kpis
          "
        >
          <div
            class="
              dashboard-recap-kpi
            "
          >
            <span>
              Crediti iniziali
            </span>

            <strong>
              ${state.initialCredits}
            </strong>
          </div>

          <div
            class="
              dashboard-recap-kpi
            "
          >
            <span>
              Distribuzione
            </span>

            <strong>
              ${total}%
            </strong>
          </div>

          <div
            class="
              dashboard-recap-kpi
            "
          >
            <span>
              Partecipanti attivi
            </span>

            <strong>
              ${activeManagers.length}
            </strong>
          </div>

          <div
            class="
              dashboard-recap-kpi
            "
          >
            <span>
              Mod difesa
            </span>

            <strong>
              ${
                state
                  .defenseModifierEnabled
                  ? 'Attivo'
                  : 'Disattivo'
              }
            </strong>
          </div>
        </div>

        <div
          class="recap-managers"
        >
          <h3>
            Allenatori attivi
          </h3>

          <div
            class="
              recap-manager-list
            "
          >
            ${
              activeManagers.length >
              0
                ? activeManagers
                    .map(
                      (
                        manager,
                      ) => `
                        <div
                          class="
                            recap-manager-row
                          "
                        >
                          <span>
                            ${escapeHtml(
                              getManagerDisplayName(
                                manager,
                              ),
                            )}
                          </span>

                          <span>
                            ${
                              manager.teamName.trim()
                                ? escapeHtml(
                                    manager.teamName,
                                  )
                                : '—'
                            }
                          </span>
                        </div>
                      `,
                    )
                    .join('')
                : `
                  <div
                    class="
                      recap-manager-row
                    "
                  >
                    <span>
                      Nessun partecipante
                      attivo
                    </span>

                    <span>
                      —
                    </span>
                  </div>
                `
            }
          </div>
        </div>

        ${
          isSetup &&
          !startAllowed
            ? `
              <div
                class="
                  warning-panel
                  dashboard-recap-warning
                "
              >
                <p>
                  Per avviare l’asta
                  servono una
                  distribuzione budget
                  pari al 100% e almeno
                  un partecipante attivo.
                </p>
              </div>
            `
            : ''
        }

        <div
          class="overlay-actions"
        >
          <button
            id="closeRecapSecondaryButton"
            type="button"
            class="
              secondary-button
            "
          >
            Chiudi
          </button>

          ${
            isSetup
              ? `
                <button
                  id="recapStartAuctionButton"
                  type="button"
                  class="
                    dashboard-cta-button
                  "
                  ${
                    startAllowed
                      ? ''
                      : 'disabled'
                  }
                >
                  Avvia asta
                </button>
              `
              : ''
          }
        </div>
      </div>
    </div>
  `
}

export function renderDashboardPage(
  state: AppState,
): string {
  const totalDistribution =
    getDistributionTotal(
      state,
    )

  const distributionIsValid =
    totalDistribution ===
    100

  const visibleManagers =
    getVisibleManagers(
      state,
    )

  const activeManagers =
    getActiveManagers(
      state,
    )

  const locked =
    isDashboardLocked(
      state,
    )

  return `
    <section
      class="
        page
        dashboard-page
      "
    >
      <div
        class="dashboard-hero"
      >
        <div>
          <span
            class="
              dashboard-eyebrow
            "
          >
            MISTERCANÀ
          </span>

          <div
            class="
              dashboard-hero-title-row
            "
          >
            <h1>
              Dashboard
            </h1>

            ${
              state.auctionPhase ===
              'live'
                ? `
                  <span
                    class="
                      dashboard-live-pill
                    "
                  >
                    LIVE
                  </span>
                `
                : ''
            }
          </div>

          <p>
            Configura la tua asta:
            budget, partecipanti e
            impostazioni generali.
          </p>
        </div>

        <div
          class="
            dashboard-hero-actions
          "
        >
          <button
            id="openRecapButton"
            type="button"
            class="
              dashboard-cta-button
            "
          >
            Recap
          </button>
        </div>
      </div>

      <section
        class="
          dashboard-stats-grid
        "
      >
        <article
          class="
            dashboard-stat-card
            ${
              state.auctionPhase ===
              'live'
                ? 'is-positive'
                : ''
            }
          "
        >
          <span
            class="
              dashboard-stat-label
            "
          >
            Stato asta
          </span>

          <span
            class="
              dashboard-stat-value
              ${
                state.auctionPhase ===
                'live'
                  ? 'is-green'
                  : ''
              }
            "
          >
            ${getAuctionStatusLabel(
              state,
            )}
          </span>

          <div
            class="
              dashboard-stat-foot
            "
          >
            ${getAuctionStatusSubLabel(
              state,
            )}
          </div>
        </article>

        <article
          class="
            dashboard-stat-card
          "
        >
          <span
            class="
              dashboard-stat-label
            "
          >
            Partecipanti attivi
          </span>

          <span
            class="
              dashboard-stat-value
            "
          >
            ${activeManagers.length}
            /
            ${visibleManagers.length}
          </span>

          <div
            class="
              dashboard-stat-foot
            "
          >
            Allenatori pronti
            per l’asta
          </div>
        </article>

        <article
          class="
            dashboard-stat-card
          "
        >
          <span
            class="
              dashboard-stat-label
            "
          >
            Crediti iniziali
          </span>

          <span
            class="
              dashboard-stat-value
            "
          >
            ${state.initialCredits}
          </span>

          <div
            class="
              dashboard-stat-foot
            "
          >
            Budget iniziale
            per squadra
          </div>
        </article>

        <article
          class="
            dashboard-stat-card
          "
        >
          <span
            class="
              dashboard-stat-label
            "
          >
            Modificatore difesa
          </span>

          <span
            class="
              dashboard-stat-value
              ${
                state
                  .defenseModifierEnabled
                  ? 'is-green'
                  : ''
              }
            "
          >
            ${
              state
                .defenseModifierEnabled
                ? 'ATTIVO'
                : 'OFF'
            }
          </span>

          <div
            class="
              dashboard-stat-foot
            "
          >
            ${
              state
                .defenseModifierEnabled
                ? 'Regola abilitata'
                : 'Regola disabilitata'
            }
          </div>
        </article>
      </section>

      <div
        class="
          ${
            locked
              ? 'dashboard-locked'
              : ''
          }
        "
      >
        <section
          class="
            panel
            dashboard-panel
          "
        >
          <div
            class="
              dashboard-panel-header-row
            "
          >
            <div>
              <h2>
                Distribuzione budget
              </h2>

              <p>
                Scegli un profilo
                iniziale oppure
                personalizza la
                ripartizione per
                reparto.
              </p>
            </div>

            <div
              class="
                dashboard-settings-inline
              "
            >
              <div
                class="
                  dashboard-toggle-chip
                "
              >
                <span
                  class="
                    dashboard-toggle-copy
                  "
                >
                  <span
                    class="
                      dashboard-toggle-label
                    "
                  >
                    Modificatore difesa
                  </span>

                  <span
                    class="
                      dashboard-toggle-hint
                    "
                  >
                    Parametro della
                    singola asta
                  </span>
                </span>

                <label
                  class="
                    switch-control
                  "
                >
                  <input
                    id="defenseModifierEnabledInput"
                    type="checkbox"
                    ${
                      state
                        .defenseModifierEnabled
                        ? 'checked'
                        : ''
                    }
                    ${
                      locked
                        ? 'disabled'
                        : ''
                    }
                  >

                  <span
                    class="
                      switch-slider
                    "
                  ></span>
                </label>
              </div>
            </div>
          </div>

          <div
            class="
              dashboard-budget-top
            "
          >
            <div>
              <div
                class="
                  profile-selector
                "
              >
                <button
                  type="button"
                  class="
                    profile-button
                    ${
                      state
                        .budgetProfile ===
                      'prudente'
                        ? 'selected'
                        : ''
                    }
                  "
                  data-profile="prudente"
                  ${
                    locked
                      ? 'disabled'
                      : ''
                  }
                >
                  Prudente
                </button>

                <button
                  type="button"
                  class="
                    profile-button
                    ${
                      state
                        .budgetProfile ===
                      'equilibrata'
                        ? 'selected'
                        : ''
                    }
                  "
                  data-profile="equilibrata"
                  ${
                    locked
                      ? 'disabled'
                      : ''
                  }
                >
                  Equilibrata
                </button>

                <button
                  type="button"
                  class="
                    profile-button
                    ${
                      state
                        .budgetProfile ===
                      'aggressiva'
                        ? 'selected'
                        : ''
                    }
                  "
                  data-profile="aggressiva"
                  ${
                    locked
                      ? 'disabled'
                      : ''
                  }
                >
                  Aggressiva
                </button>

                <button
                  type="button"
                  class="
                    profile-button
                    ${
                      state
                        .budgetProfile ===
                      'personalizzata'
                        ? 'selected'
                        : ''
                    }
                  "
                  data-profile="personalizzata"
                  ${
                    locked
                      ? 'disabled'
                      : ''
                  }
                >
                  Personalizzata
                </button>
              </div>

              <div
                class="
                  dashboard-budget-total-pill
                  ${
                    distributionIsValid
                      ? 'valid'
                      : 'invalid'
                  }
                "
              >
                Totale distribuzione:
                ${totalDistribution}%
              </div>
            </div>

            <label
              class="
                field
                dashboard-credits-box
              "
            >
              <span>
                Crediti iniziali
              </span>

              <input
                id="initialCreditsInput"
                type="number"
                min="1"
                step="1"
                value="${state.initialCredits}"
                ${
                  locked
                    ? 'disabled'
                    : ''
                }
              >
            </label>
          </div>

          <div
            class="budget-grid"
          >
            ${(
              [
                'P',
                'D',
                'C',
                'A',
              ] as BudgetRole[]
            )
              .map(
                (role) => {
                  const value =
                    state
                      .budgetDistribution[
                      role
                    ]

                  const credits =
                    Math.round(
                      (
                        state
                          .initialCredits *
                        value
                      ) /
                        100,
                    )

                  return `
                    <div
                      class="
                        budget-field
                      "
                    >
                      <span>
                        ${role}
                      </span>

                      <div
                        class="
                          percentage-input
                        "
                      >
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value="${value}"
                          data-budget-role="${role}"
                          ${
                            locked
                              ? 'disabled'
                              : ''
                          }
                        >

                        <span>
                          %
                        </span>
                      </div>

                      <small>
                        ${credits} cr
                      </small>
                    </div>
                  `
                },
              )
              .join('')}
          </div>
        </section>

        <section
          class="
            panel
            dashboard-panel
          "
        >
          <div
            class="
              dashboard-manager-header
            "
          >
            <div>
              <h2>
                Allenatori
              </h2>

              <p
                class="muted-text"
              >
                Seleziona chi
                partecipa a questa
                asta.
              </p>
            </div>

            <div
              class="
                dashboard-manager-counter
              "
            >
              ${activeManagers.length}
              partecipanti attivi
            </div>
          </div>

          <div
            class="
              dashboard-manager-grid
            "
          >
            ${visibleManagers
              .map(
                (manager) =>
                  renderManagerCard(
                    manager,
                    locked,
                  ),
              )
              .join('')}

            <button
              id="openCreateManagerOverlayButton"
              type="button"
              class="
                dashboard-add-manager-card
              "
              ${
                locked
                  ? 'disabled'
                  : ''
              }
            >
              <span
                class="
                  dashboard-add-manager-inner
                "
              >
                <span
                  class="
                    dashboard-add-manager-icon
                  "
                >
                  ＋
                </span>

                <span>
                  Aggiungi allenatore
                </span>
              </span>
            </button>
          </div>
        </section>
      </div>

      ${renderManagerOverlay()}

      ${renderArchiveOverlay()}

      ${renderRecapOverlay(
        state,
      )}
    </section>
  `
}

export function bindDashboardEvents(
  state: AppState,
  actions: DashboardActions,
): void {
  const locked =
    isDashboardLocked(
      state,
    )

  const applyProfile = (
    profile:
      keyof typeof BUDGET_PROFILES,
  ): void => {
    const values =
      BUDGET_PROFILES[
        profile
      ]

    state.budgetDistribution.P =
      values.P

    state.budgetDistribution.D =
      values.D

    state.budgetDistribution.C =
      values.C

    state.budgetDistribution.A =
      values.A

    state.budgetProfile =
      profile

    actions.onStateChange()
  }

  if (!locked) {
    document
      .querySelectorAll<HTMLButtonElement>(
        '[data-profile]',
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            () => {
              const profile =
                button.dataset
                  .profile as
                  | BudgetProfile
                  | undefined

              if (!profile) {
                return
              }

              if (
                profile ===
                'personalizzata'
              ) {
                state.budgetProfile =
                  'personalizzata'

                actions.onStateChange()

                return
              }

              if (
                profile ===
                  'prudente' ||
                profile ===
                  'equilibrata' ||
                profile ===
                  'aggressiva'
              ) {
                applyProfile(
                  profile,
                )
              }
            },
          )
        },
      )

    document
      .querySelectorAll<HTMLInputElement>(
        '[data-budget-role]',
      )
      .forEach(
        (input) => {
          input.addEventListener(
            'change',
            () => {
              const role =
                input.dataset
                  .budgetRole as
                  | BudgetRole
                  | undefined

              if (!role) {
                return
              }

              const value =
                Number.parseInt(
                  input.value,
                  10,
                )

              state
                .budgetDistribution[
                role
              ] =
                Number.isNaN(
                  value,
                )
                  ? 0
                  : Math.min(
                      100,
                      Math.max(
                        0,
                        value,
                      ),
                    )

              state.budgetProfile =
                'personalizzata'

              actions.onStateChange()
            },
          )
        },
      )

    const initialCreditsInput =
      document.querySelector<HTMLInputElement>(
        '#initialCreditsInput',
      )

    initialCreditsInput
      ?.addEventListener(
        'change',
        () => {
          const nextValue =
            Number.parseInt(
              initialCreditsInput
                .value,
              10,
            )

          state.initialCredits =
            Number.isNaN(
              nextValue,
            )
              ? state.initialCredits
              : Math.max(
                  1,
                  nextValue,
                )

          actions.onStateChange()
        },
      )

    const defenseModifierInput =
      document.querySelector<HTMLInputElement>(
        '#defenseModifierEnabledInput',
      )

    defenseModifierInput
      ?.addEventListener(
        'change',
        () => {
          state
            .defenseModifierEnabled =
            defenseModifierInput
              .checked

          actions.onStateChange()
        },
      )
  }

  const triggerAuctionStart =
    (): void => {
      if (
        !canStartAuction(
          state,
        )
      ) {
        return
      }

      actions.onStartAuction()
    }

  document
    .querySelector(
      '#recapStartAuctionButton',
    )
    ?.addEventListener(
      'click',
      triggerAuctionStart,
    )

  document
    .querySelector(
      '#openRecapButton',
    )
    ?.addEventListener(
      'click',
      () => {
        const recapOverlay =
          document.querySelector<HTMLElement>(
            '#recapOverlay',
          )

        recapOverlay?.classList.remove(
          'hidden',
        )

        recapOverlay?.setAttribute(
          'aria-hidden',
          'false',
        )
      },
    )

  if (!locked) {
    document
      .querySelectorAll<HTMLInputElement>(
        '[data-manager-active-id]',
      )
      .forEach(
        (input) => {
          input.addEventListener(
            'change',
            () => {
              const managerId =
                input.dataset
                  .managerActiveId

              const manager =
                state.managers.find(
                  (item) =>
                    item.id ===
                    managerId,
                )

              if (!manager) {
                return
              }

              manager.active =
                input.checked

              actions.onStateChange()
            },
          )
        },
      )
  }

  const closeAllMenus =
    (): void => {
      document
        .querySelectorAll<HTMLElement>(
          '.manager-menu',
        )
        .forEach(
          (menu) => {
            menu.classList.add(
              'hidden',
            )
          },
        )
    }

  if (!locked) {
    document
      .querySelectorAll<HTMLButtonElement>(
        '[data-manager-menu-button]',
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            (event) => {
              event.stopPropagation()

              const managerId =
                button.dataset
                  .managerMenuButton

              const menu =
                document.querySelector<HTMLElement>(
                  `#managerMenu-${managerId}`,
                )

              if (!menu) {
                return
              }

              const willOpen =
                menu.classList.contains(
                  'hidden',
                )

              closeAllMenus()

              if (willOpen) {
                menu.classList.remove(
                  'hidden',
                )
              }
            },
          )
        },
      )
  }

  document.addEventListener(
    'click',
    closeAllMenus,
  )

  const managerOverlay =
    document.querySelector<HTMLElement>(
      '#managerOverlay',
    )

  const managerOverlayTitle =
    document.querySelector<HTMLElement>(
      '#managerOverlayTitle',
    )

  const managerFormMode =
    document.querySelector<HTMLInputElement>(
      '#managerFormMode',
    )

  const managerIdInput =
    document.querySelector<HTMLInputElement>(
      '#managerIdInput',
    )

  const managerFirstNameInput =
    document.querySelector<HTMLInputElement>(
      '#managerFirstNameInput',
    )

  const managerLastNameInput =
    document.querySelector<HTMLInputElement>(
      '#managerLastNameInput',
    )

  const managerAliasInput =
    document.querySelector<HTMLInputElement>(
      '#managerAliasInput',
    )

  const managerTeamNameInput =
    document.querySelector<HTMLInputElement>(
      '#managerTeamNameInput',
    )

  const managerOwnerInput =
    document.querySelector<HTMLInputElement>(
      '#managerOwnerInput',
    )

  const managerActiveInput =
    document.querySelector<HTMLInputElement>(
      '#managerActiveInput',
    )

  const openManagerOverlay = (
    mode: ManagerFormMode,
    managerId?: string,
  ): void => {
    if (
      locked ||
      !managerOverlay ||
      !managerOverlayTitle ||
      !managerFormMode ||
      !managerIdInput ||
      !managerFirstNameInput ||
      !managerLastNameInput ||
      !managerAliasInput ||
      !managerTeamNameInput ||
      !managerOwnerInput ||
      !managerActiveInput
    ) {
      return
    }

    if (
      mode === 'edit' &&
      managerId
    ) {
      const manager =
        state.managers.find(
          (item) =>
            item.id ===
            managerId,
        )

      if (!manager) {
        return
      }

      managerOverlayTitle
        .textContent =
        'Modifica allenatore'

      managerFormMode.value =
        'edit'

      managerIdInput.value =
        manager.id

      managerFirstNameInput.value =
        manager.firstName

      managerLastNameInput.value =
        manager.lastName

      managerAliasInput.value =
        manager.alias

      managerTeamNameInput.value =
        manager.teamName

      managerOwnerInput.checked =
        manager.isOwner

      managerActiveInput.checked =
        manager.active
    } else {
      managerOverlayTitle
        .textContent =
        'Nuovo allenatore'

      managerFormMode.value =
        'create'

      managerIdInput.value =
        ''

      managerFirstNameInput.value =
        ''

      managerLastNameInput.value =
        ''

      managerAliasInput.value =
        ''

      managerTeamNameInput.value =
        ''

      managerOwnerInput.checked =
        false

      managerActiveInput.checked =
        true
    }

    managerOverlay.classList.remove(
      'hidden',
    )

    managerOverlay.setAttribute(
      'aria-hidden',
      'false',
    )
  }

  const closeManagerOverlay =
    (): void => {
      managerOverlay?.classList.add(
        'hidden',
      )

      managerOverlay?.setAttribute(
        'aria-hidden',
        'true',
      )
    }

  document
    .querySelector(
      '#openCreateManagerOverlayButton',
    )
    ?.addEventListener(
      'click',
      () => {
        openManagerOverlay(
          'create',
        )
      },
    )

  document
    .querySelector(
      '#closeManagerOverlayButton',
    )
    ?.addEventListener(
      'click',
      closeManagerOverlay,
    )

  document
    .querySelector(
      '#cancelManagerOverlayButton',
    )
    ?.addEventListener(
      'click',
      closeManagerOverlay,
    )

  document
    .querySelector(
      '[data-close-manager-overlay="true"]',
    )
    ?.addEventListener(
      'click',
      closeManagerOverlay,
    )

  if (!locked) {
    document
      .querySelectorAll<HTMLButtonElement>(
        '[data-manager-edit-id]',
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            () => {
              const managerId =
                button.dataset
                  .managerEditId

              closeAllMenus()

              if (!managerId) {
                return
              }

              openManagerOverlay(
                'edit',
                managerId,
              )
            },
          )
        },
      )
  }

  const managerForm =
    document.querySelector<HTMLFormElement>(
      '#managerForm',
    )

  managerForm?.addEventListener(
    'submit',
    (event) => {
      event.preventDefault()

      if (
        locked ||
        !managerFormMode ||
        !managerIdInput ||
        !managerFirstNameInput ||
        !managerLastNameInput ||
        !managerAliasInput ||
        !managerTeamNameInput ||
        !managerOwnerInput ||
        !managerActiveInput
      ) {
        return
      }

      const firstName =
        managerFirstNameInput
          .value
          .trim()

      const lastName =
        managerLastNameInput
          .value
          .trim()

      const alias =
        managerAliasInput
          .value
          .trim()

      const teamName =
        managerTeamNameInput
          .value
          .trim()

      if (!firstName) {
        return
      }

      const nextData = {
        firstName,
        lastName,
        alias,
        teamName,

        active:
          managerActiveInput.checked,

        isOwner:
          managerOwnerInput.checked,
      }

      if (
        nextData.isOwner
      ) {
        state.managers.forEach(
          (manager) => {
            manager.isOwner =
              false
          },
        )
      }

      if (
        managerFormMode.value ===
          'edit' &&
        managerIdInput.value
      ) {
        const manager =
          state.managers.find(
            (item) =>
              item.id ===
              managerIdInput.value,
          )

        if (!manager) {
          return
        }

        manager.firstName =
          nextData.firstName

        manager.lastName =
          nextData.lastName

        manager.alias =
          nextData.alias

        manager.teamName =
          nextData.teamName

        manager.active =
          nextData.active

        manager.isOwner =
          nextData.isOwner
      } else {
        state.managers.push({
          id:
            crypto.randomUUID(),

          firstName:
            nextData.firstName,

          lastName:
            nextData.lastName,

          alias:
            nextData.alias,

          teamName:
            nextData.teamName,

          active:
            nextData.active,

          isOwner:
            nextData.isOwner,

          archived:
            false,
        })
      }

      closeManagerOverlay()

      actions.onStateChange()
    },
  )

  const archiveOverlay =
    document.querySelector<HTMLElement>(
      '#archiveManagerOverlay',
    )

  const archiveManagerIdInput =
    document.querySelector<HTMLInputElement>(
      '#archiveManagerIdInput',
    )

  const openArchiveOverlay = (
    managerId: string,
  ): void => {
    if (
      locked ||
      !archiveOverlay ||
      !archiveManagerIdInput
    ) {
      return
    }

    archiveManagerIdInput.value =
      managerId

    archiveOverlay.classList.remove(
      'hidden',
    )

    archiveOverlay.setAttribute(
      'aria-hidden',
      'false',
    )
  }

  const closeArchiveOverlay =
    (): void => {
      archiveOverlay?.classList.add(
        'hidden',
      )

      archiveOverlay?.setAttribute(
        'aria-hidden',
        'true',
      )

      if (
        archiveManagerIdInput
      ) {
        archiveManagerIdInput.value =
          ''
      }
    }

  if (!locked) {
    document
      .querySelectorAll<HTMLButtonElement>(
        '[data-manager-archive-id]',
      )
      .forEach(
        (button) => {
          button.addEventListener(
            'click',
            () => {
              const managerId =
                button.dataset
                  .managerArchiveId

              closeAllMenus()

              if (!managerId) {
                return
              }

              openArchiveOverlay(
                managerId,
              )
            },
          )
        },
      )
  }

  document
    .querySelector(
      '#closeArchiveManagerOverlayButton',
    )
    ?.addEventListener(
      'click',
      closeArchiveOverlay,
    )

  document
    .querySelector(
      '#cancelArchiveManagerButton',
    )
    ?.addEventListener(
      'click',
      closeArchiveOverlay,
    )

  document
    .querySelector(
      '[data-close-archive-overlay="true"]',
    )
    ?.addEventListener(
      'click',
      closeArchiveOverlay,
    )

  document
    .querySelector(
      '#confirmArchiveManagerButton',
    )
    ?.addEventListener(
      'click',
      () => {
        if (
          locked ||
          !archiveManagerIdInput
            ?.value
        ) {
          return
        }

        const manager =
          state.managers.find(
            (item) =>
              item.id ===
              archiveManagerIdInput
                .value,
          )

        if (!manager) {
          return
        }

        manager.archived =
          true

        manager.active =
          false

        closeArchiveOverlay()

        actions.onStateChange()
      },
    )

  const recapOverlay =
    document.querySelector<HTMLElement>(
      '#recapOverlay',
    )

  const closeRecapOverlay =
    (): void => {
      recapOverlay?.classList.add(
        'hidden',
      )

      recapOverlay?.setAttribute(
        'aria-hidden',
        'true',
      )
    }

  document
    .querySelector(
      '#closeRecapOverlayButton',
    )
    ?.addEventListener(
      'click',
      closeRecapOverlay,
    )

  document
    .querySelector(
      '#closeRecapSecondaryButton',
    )
    ?.addEventListener(
      'click',
      closeRecapOverlay,
    )

  document
    .querySelector(
      '[data-close-recap-overlay="true"]',
    )
    ?.addEventListener(
      'click',
      closeRecapOverlay,
    )
}