import type {
  AppState,
  BudgetDistribution,
  BudgetProfile,
  BudgetRole,
  Manager,
} from '../app/state'

interface DashboardActions {
  onStateChange: () => void
  onStartAuction: () => void
}

const PROFILE_VALUES: Record<
  Exclude<
    BudgetProfile,
    'personalizzata'
  >,
  BudgetDistribution
> = {
  prudente: {
    P: 14,
    D: 24,
    C: 26,
    A: 36,
  },

  equilibrata: {
    P: 11,
    D: 21,
    C: 23,
    A: 45,
  },

  aggressiva: {
    P: 8,
    D: 18,
    C: 22,
    A: 52,
  },
}

function getBudgetTotal(
  distribution: BudgetDistribution,
): number {
  return (
    distribution.P +
    distribution.D +
    distribution.C +
    distribution.A
  )
}

function createManagerId(): string {
  return `manager_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`
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

function getManagerDisplayName(
  manager: Manager,
): string {
  const firstName =
    manager.firstName.trim()

  const lastName =
    manager.lastName.trim()

  const alias =
    manager.alias.trim()

  const aliasPart =
    alias
      ? `"${alias}"`
      : ''

  return [
    firstName,
    aliasPart,
    lastName,
  ]
    .filter(Boolean)
    .join(' ')
}

function renderManagerCard(
  manager: Manager,
  locked: boolean,
): string {
  return `
    <article class="manager-card">

      <div class="manager-card-top">

        <div class="manager-info">

          <div class="manager-name-row">

            <strong>
              ${escapeHtml(
                getManagerDisplayName(manager),
              )}
            </strong>

            ${
              manager.isOwner
                ? `
                  <span class="owner-badge">
                    TU
                  </span>
                `
                : ''
            }

          </div>

          <div class="manager-team">

            ${
              manager.teamName
                ? escapeHtml(
                    manager.teamName,
                  )
                : 'Nessun nome squadra'
            }

          </div>

        </div>

        ${
          locked
            ? ''
            : `
              <div class="manager-menu-wrapper">

                <button
                  type="button"
                  class="manager-menu-button"
                  data-manager-menu-button="${manager.id}"
                  aria-label="Azioni allenatore"
                  aria-expanded="false"
                >
                  ⋯
                </button>

                <div
                  class="manager-menu hidden"
                  data-manager-menu="${manager.id}"
                >

                  <button
                    type="button"
                    data-edit-manager="${manager.id}"
                  >
                    Modifica
                  </button>

                  <button
                    type="button"
                    class="archive-menu-action"
                    data-archive-manager="${manager.id}"
                  >
                    Archivia
                  </button>

                </div>

              </div>
            `
        }

      </div>

      <div class="manager-card-bottom">

        <span class="manager-participation-label">
          Partecipa all’asta
        </span>

        <label class="switch-control">

          <input
            type="checkbox"
            data-manager-toggle="${manager.id}"
            ${manager.active ? 'checked' : ''}
            ${locked ? 'disabled' : ''}
          >

          <span class="switch-slider"></span>

        </label>

      </div>

    </article>
  `
}

export function renderDashboardPage(
  state: AppState,
): string {
  const locked =
    state.auctionPhase !== 'setup'

  const visibleManagers =
    state.managers.filter(
      (manager) =>
        !manager.archived,
    )

  const activeManagers =
    visibleManagers.filter(
      (manager) =>
        manager.active,
    )

  const totalPercentage =
    getBudgetTotal(
      state.budgetDistribution,
    )

  return `
    <section class="page dashboard-page">

      <div class="page-heading">

        <div>

          <h1>Dashboard</h1>

          <p>
            ${
              locked
                ? 'Configurazione dell’asta in sola consultazione.'
                : 'Configura l’asta prima di iniziare.'
            }
          </p>

        </div>

        ${
          locked
            ? `
              <span class="auction-state-badge">

                ${
                  state.auctionPhase === 'live'
                    ? 'ASTA IN CORSO'
                    : state.auctionPhase ===
                        'finalizing'
                      ? 'DA FINALIZZARE'
                      : state.auctionPhase ===
                          'archived'
                        ? 'ASTA REGISTRATA'
                        : 'ASTA SCARTATA'
                }

              </span>
            `
            : ''
        }

      </div>

      <div
        class="${
          locked
            ? 'dashboard-locked'
            : ''
        }"
      >

        <section class="panel">

          <div class="panel-header">

            <div>

              <h2>
                Distribuzione budget
              </h2>

              <p>
                Scegli un profilo iniziale
                oppure personalizza le
                percentuali.
              </p>

            </div>

            <label
              class="field compact-field"
            >

              <span>
                Crediti totali
              </span>

              <input
                id="initialCredits"
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

          <div class="profile-selector">

            ${(
              [
                'prudente',
                'equilibrata',
                'aggressiva',
                'personalizzata',
              ] as BudgetProfile[]
            )
              .map(
                (profile) => `
                  <button
                    type="button"
                    class="
                      profile-button
                      ${
                        state.budgetProfile ===
                        profile
                          ? 'selected'
                          : ''
                      }
                    "
                    data-budget-profile="${profile}"
                    ${
                      locked
                        ? 'disabled'
                        : ''
                    }
                  >

                    ${
                      profile
                        .charAt(0)
                        .toUpperCase() +
                      profile.slice(1)
                    }

                  </button>
                `,
              )
              .join('')}

          </div>

          <div class="budget-grid">

            ${(
              [
                'P',
                'D',
                'C',
                'A',
              ] as BudgetRole[]
            )
              .map(
                (role) => `
                  <label
                    class="field budget-field"
                  >

                    <span>
                      ${role}
                    </span>

                    <div
                      class="percentage-input"
                    >

                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        data-budget-role="${role}"
                        value="${
                          state
                            .budgetDistribution[
                            role
                          ]
                        }"
                        ${
                          locked
                            ? 'disabled'
                            : ''
                        }
                      >

                      <span>%</span>

                    </div>

                    <small>

                      ${Math.round(
                        state.initialCredits *
                          (state
                            .budgetDistribution[
                            role
                          ] /
                            100),
                      )}
                      cr

                    </small>

                  </label>
                `,
              )
              .join('')}

          </div>

          <div
            class="
              budget-total
              ${
                totalPercentage === 100
                  ? 'valid'
                  : 'invalid'
              }
            "
          >

            Totale distribuzione:

            <strong>
              ${totalPercentage}%
            </strong>

            ${
              totalPercentage === 100
                ? ''
                : `
                  <span>
                    Deve essere
                    esattamente 100%.
                  </span>
                `
            }

          </div>

        </section>

        <section class="panel">

          <div class="panel-header">

            <div>

              <h2>Allenatori</h2>

              <p>
                Seleziona chi partecipa
                a questa asta.
              </p>

            </div>

            <span
              class="manager-counter"
            >

              ${activeManagers.length}

              ${
                activeManagers.length ===
                1
                  ? 'partecipante'
                  : 'partecipanti'
              }

            </span>

          </div>

          <div class="manager-grid">

            ${visibleManagers
              .map((manager) =>
                renderManagerCard(
                  manager,
                  locked,
                ),
              )
              .join('')}

            ${
              locked
                ? ''
                : `
                  <button
                    type="button"
                    class="
                      manager-card
                      add-manager-card
                    "
                    id="addManagerButton"
                  >

                    <span
                      class="add-manager-icon"
                    >
                      +
                    </span>

                    <span>
                      Aggiungi allenatore
                    </span>

                  </button>
                `
            }

          </div>

        </section>

      </div>

      ${
        locked
          ? ''
          : `
            <div
              class="dashboard-actions"
            >

              <button
                id="recapButton"
                type="button"
                class="secondary-button"
              >
                Recap
              </button>

              <button
                id="startAuctionButton"
                type="button"
                class="primary-button"
                ${
                  totalPercentage !==
                    100 ||
                  activeManagers.length ===
                    0
                    ? 'disabled'
                    : ''
                }
              >
                Avvia asta
              </button>

            </div>
          `
      }

      <!-- RECAP -->

      <div
        id="recapOverlay"
        class="overlay hidden"
        aria-hidden="true"
      >

        <div
          class="overlay-backdrop"
        ></div>

        <div class="overlay-card">

          <div class="overlay-header">

            <div>

              <span class="eyebrow">
                RIEPILOGO
              </span>

              <h2>
                Recap asta
              </h2>

            </div>

            <button
              id="closeRecapButton"
              type="button"
              class="icon-button"
            >
              ×
            </button>

          </div>

          <div class="recap-grid">

            <div class="recap-item">

              <span>
                Crediti iniziali
              </span>

              <strong>
                ${state.initialCredits}
              </strong>

            </div>

            <div class="recap-item">

              <span>Profilo</span>

              <strong>
                ${state.budgetProfile}
              </strong>

            </div>

            ${(
              [
                'P',
                'D',
                'C',
                'A',
              ] as BudgetRole[]
            )
              .map(
                (role) => `
                  <div
                    class="recap-item"
                  >

                    <span>
                      ${role}
                    </span>

                    <strong>

                      ${
                        state
                          .budgetDistribution[
                          role
                        ]
                      }%

                      ·

                      ${Math.round(
                        state.initialCredits *
                          (state
                            .budgetDistribution[
                            role
                          ] /
                            100),
                      )}

                      cr

                    </strong>

                  </div>
                `,
              )
              .join('')}

          </div>

          <div
            class="recap-managers"
          >

            <h3>
              Partecipanti
              (${activeManagers.length})
            </h3>

            <div
              class="recap-manager-list"
            >

              ${
                activeManagers.length
                  ? activeManagers
                      .map(
                        (manager) => `
                          <div
                            class="recap-manager-row"
                          >

                            <span>

                              ${escapeHtml(
                                getManagerDisplayName(
                                  manager,
                                ),
                              )}

                              ${
                                manager.isOwner
                                  ? `
                                    <small>
                                      Tu
                                    </small>
                                  `
                                  : ''
                              }

                            </span>

                            <span>

                              ${
                                manager.teamName
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
                    <p>
                      Nessun partecipante
                      selezionato.
                    </p>
                  `
              }

            </div>

          </div>

          <div class="overlay-actions">

            <button
              id="closeRecapSecondaryButton"
              type="button"
              class="secondary-button"
            >
              Modifica
            </button>

            <button
              id="startAuctionFromRecapButton"
              type="button"
              class="primary-button"
              ${
                totalPercentage !== 100 ||
                activeManagers.length === 0
                  ? 'disabled'
                  : ''
              }
            >
              Avvia asta
            </button>

          </div>

        </div>

      </div>

      <!-- ADD / EDIT MANAGER -->

      <div
        id="managerFormOverlay"
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

              <span
                id="managerFormEyebrow"
                class="eyebrow"
              >
                NUOVO ALLENATORE
              </span>

              <h2
                id="managerFormTitle"
              >
                Aggiungi allenatore
              </h2>

            </div>

            <button
              id="closeManagerFormButton"
              type="button"
              class="icon-button"
            >
              ×
            </button>

          </div>

          <input
            id="editingManagerId"
            type="hidden"
          >

          <div class="form-stack">

            <label class="field">

              <span>Nome</span>

              <input
                id="managerFirstNameInput"
                type="text"
                autocomplete="off"
              >

            </label>

            <label class="field">

              <span>Cognome</span>

              <input
                id="managerLastNameInput"
                type="text"
                autocomplete="off"
              >

            </label>

            <label class="field">

              <span>Alias</span>

              <input
                id="managerAliasInput"
                type="text"
                autocomplete="off"
                placeholder="Es. Gabri"
              >

            </label>

            <label class="field">

              <span>
                Nome squadra
              </span>

              <input
                id="managerTeamInput"
                type="text"
                autocomplete="off"
              >

            </label>

          </div>

          <div class="overlay-actions">

            <button
              id="cancelManagerFormButton"
              type="button"
              class="secondary-button"
            >
              Annulla
            </button>

            <button
              id="saveManagerButton"
              type="button"
              class="primary-button"
            >
              Salva
            </button>

          </div>

        </div>

      </div>

      <!-- ARCHIVE -->

      <div
        id="archiveManagerOverlay"
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
                ARCHIVIA ALLENATORE
              </span>

              <h2>
                Conferma archiviazione
              </h2>

            </div>

            <button
              id="closeArchiveManagerButton"
              type="button"
              class="icon-button"
            >
              ×
            </button>

          </div>

          <input
            id="archiveManagerId"
            type="hidden"
          >

          <div class="warning-panel">

            <strong
              id="archiveManagerName"
            >
              Allenatore
            </strong>

            <p>
              L’allenatore verrà rimosso
              dall’elenco disponibile per
              le prossime aste.
            </p>

            <p>
              <strong>
                Lo storico e i dati
                associati non verranno
                cancellati.
              </strong>
            </p>

          </div>

          <div class="overlay-actions">

            <button
              id="cancelArchiveManagerButton"
              type="button"
              class="secondary-button"
            >
              Annulla
            </button>

            <button
              id="confirmArchiveManagerButton"
              type="button"
              class="archive-button"
            >
              Archivia
            </button>

          </div>

        </div>

      </div>

    </section>
  `
}

export function bindDashboardEvents(
  state: AppState,
  actions: DashboardActions,
): void {
  if (
    state.auctionPhase !== 'setup'
  ) {
    return
  }

  const creditsInput =
    document.querySelector<HTMLInputElement>(
      '#initialCredits',
    )

  creditsInput?.addEventListener(
    'change',
    () => {
      const value =
        Number(creditsInput.value)

      if (
        !Number.isFinite(value) ||
        value < 1
      ) {
        creditsInput.value =
          state.initialCredits.toString()

        return
      }

      state.initialCredits =
        Math.round(value)

      actions.onStateChange()
    },
  )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-budget-profile]',
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const profile =
            button.dataset
              .budgetProfile as
              BudgetProfile

          state.budgetProfile =
            profile

          if (
            profile !==
            'personalizzata'
          ) {
            state.budgetDistribution = {
              ...PROFILE_VALUES[
                profile
              ],
            }
          }

          actions.onStateChange()
        },
      )
    })

  document
    .querySelectorAll<HTMLInputElement>(
      '[data-budget-role]',
    )
    .forEach((input) => {
      input.addEventListener(
        'change',
        () => {
          const role =
            input.dataset
              .budgetRole as
              BudgetRole

          const value =
            Number(input.value)

          if (
            !Number.isFinite(value)
          ) {
            return
          }

          state.budgetDistribution[
            role
          ] = Math.max(
            0,
            Math.min(
              100,
              Math.round(value),
            ),
          )

          state.budgetProfile =
            'personalizzata'

          actions.onStateChange()
        },
      )
    })

  document
    .querySelectorAll<HTMLInputElement>(
      '[data-manager-toggle]',
    )
    .forEach((input) => {
      input.addEventListener(
        'change',
        () => {
          const id =
            input.dataset
              .managerToggle

          const manager =
            state.managers.find(
              (item) =>
                item.id === id,
            )

          if (!manager) {
            return
          }

          manager.active =
            input.checked

          actions.onStateChange()
        },
      )
    })

  const hideAllManagerMenus =
    () => {
      document
        .querySelectorAll<HTMLElement>(
          '[data-manager-menu]',
        )
        .forEach((menu) => {
          menu.classList.add(
            'hidden',
          )
        })

      document
        .querySelectorAll<HTMLButtonElement>(
          '[data-manager-menu-button]',
        )
        .forEach((button) => {
          button.setAttribute(
            'aria-expanded',
            'false',
          )
        })
    }

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-manager-menu-button]',
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        (event) => {
          event.stopPropagation()

          const id =
            button.dataset
              .managerMenuButton

          const menu =
            document.querySelector<HTMLElement>(
              `[data-manager-menu="${id}"]`,
            )

          const isHidden =
            menu?.classList.contains(
              'hidden',
            )

          hideAllManagerMenus()

          if (isHidden) {
            menu?.classList.remove(
              'hidden',
            )

            button.setAttribute(
              'aria-expanded',
              'true',
            )
          }
        },
      )
    })

  document.addEventListener(
    'click',
    hideAllManagerMenus,
    {
      once: true,
    },
  )

  const managerFormOverlay =
    document.querySelector<HTMLElement>(
      '#managerFormOverlay',
    )

  const editingManagerId =
    document.querySelector<HTMLInputElement>(
      '#editingManagerId',
    )

  const firstNameInput =
    document.querySelector<HTMLInputElement>(
      '#managerFirstNameInput',
    )

  const lastNameInput =
    document.querySelector<HTMLInputElement>(
      '#managerLastNameInput',
    )

  const aliasInput =
    document.querySelector<HTMLInputElement>(
      '#managerAliasInput',
    )

  const teamInput =
    document.querySelector<HTMLInputElement>(
      '#managerTeamInput',
    )

  const formTitle =
    document.querySelector<HTMLElement>(
      '#managerFormTitle',
    )

  const formEyebrow =
    document.querySelector<HTMLElement>(
      '#managerFormEyebrow',
    )

  const openManagerForm = (
    manager?: Manager,
  ) => {
    if (editingManagerId) {
      editingManagerId.value =
        manager?.id ?? ''
    }

    if (firstNameInput) {
      firstNameInput.value =
        manager?.firstName ?? ''
    }

    if (lastNameInput) {
      lastNameInput.value =
        manager?.lastName ?? ''
    }

    if (aliasInput) {
      aliasInput.value =
        manager?.alias ?? ''
    }

    if (teamInput) {
      teamInput.value =
        manager?.teamName ?? ''
    }

    if (formTitle) {
      formTitle.textContent =
        manager
          ? 'Modifica allenatore'
          : 'Aggiungi allenatore'
    }

    if (formEyebrow) {
      formEyebrow.textContent =
        manager
          ? 'MODIFICA ALLENATORE'
          : 'NUOVO ALLENATORE'
    }

    managerFormOverlay?.classList.remove(
      'hidden',
    )

    managerFormOverlay?.setAttribute(
      'aria-hidden',
      'false',
    )

    setTimeout(() => {
      firstNameInput?.focus()
    })
  }

  const closeManagerForm = () => {
    managerFormOverlay?.classList.add(
      'hidden',
    )

    managerFormOverlay?.setAttribute(
      'aria-hidden',
      'true',
    )
  }

  document
    .querySelector(
      '#addManagerButton',
    )
    ?.addEventListener(
      'click',
      () => openManagerForm(),
    )

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-edit-manager]',
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const manager =
            state.managers.find(
              (item) =>
                item.id ===
                button.dataset
                  .editManager,
            )

          if (!manager) {
            return
          }

          openManagerForm(manager)
        },
      )
    })

  document
    .querySelector(
      '#closeManagerFormButton',
    )
    ?.addEventListener(
      'click',
      closeManagerForm,
    )

  document
    .querySelector(
      '#cancelManagerFormButton',
    )
    ?.addEventListener(
      'click',
      closeManagerForm,
    )

  document
    .querySelector(
      '#saveManagerButton',
    )
    ?.addEventListener(
      'click',
      () => {
        const firstName =
          firstNameInput?.value.trim() ??
          ''

        const lastName =
          lastNameInput?.value.trim() ??
          ''

        const alias =
          aliasInput?.value.trim() ??
          ''

        const teamName =
          teamInput?.value.trim() ??
          ''

        if (!firstName) {
          firstNameInput?.focus()
          return
        }

        const id =
          editingManagerId?.value ??
          ''

        if (id) {
          const manager =
            state.managers.find(
              (item) =>
                item.id === id,
            )

          if (!manager) {
            return
          }

          manager.firstName =
            firstName

          manager.lastName =
            lastName

          manager.alias =
            alias

          manager.teamName =
            teamName
        } else {
          state.managers.push({
            id:
              createManagerId(),

            firstName,
            lastName,
            alias,

            teamName,

            isOwner: false,
            active: true,
            archived: false,
          })
        }

        closeManagerForm()
        actions.onStateChange()
      },
    )

  const archiveOverlay =
    document.querySelector<HTMLElement>(
      '#archiveManagerOverlay',
    )

  const archiveIdInput =
    document.querySelector<HTMLInputElement>(
      '#archiveManagerId',
    )

  const archiveName =
    document.querySelector<HTMLElement>(
      '#archiveManagerName',
    )

  const closeArchive = () => {
    archiveOverlay?.classList.add(
      'hidden',
    )

    archiveOverlay?.setAttribute(
      'aria-hidden',
      'true',
    )
  }

  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-archive-manager]',
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const manager =
            state.managers.find(
              (item) =>
                item.id ===
                button.dataset
                  .archiveManager,
            )

          if (!manager) {
            return
          }

          if (archiveIdInput) {
            archiveIdInput.value =
              manager.id
          }

          if (archiveName) {
            archiveName.textContent =
              getManagerDisplayName(
                manager,
              )
          }

          archiveOverlay?.classList.remove(
            'hidden',
          )

          archiveOverlay?.setAttribute(
            'aria-hidden',
            'false',
          )
        },
      )
    })

  document
    .querySelector(
      '#closeArchiveManagerButton',
    )
    ?.addEventListener(
      'click',
      closeArchive,
    )

  document
    .querySelector(
      '#cancelArchiveManagerButton',
    )
    ?.addEventListener(
      'click',
      closeArchive,
    )

  document
    .querySelector(
      '#confirmArchiveManagerButton',
    )
    ?.addEventListener(
      'click',
      () => {
        const id =
          archiveIdInput?.value

        const manager =
          state.managers.find(
            (item) =>
              item.id === id,
          )

        if (!manager) {
          return
        }

        manager.archived = true
        manager.active = false

        closeArchive()
        actions.onStateChange()
      },
    )

  const recapOverlay =
    document.querySelector<HTMLElement>(
      '#recapOverlay',
    )

  const openRecap = () => {
    recapOverlay?.classList.remove(
      'hidden',
    )

    recapOverlay?.setAttribute(
      'aria-hidden',
      'false',
    )
  }

  const closeRecap = () => {
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
      '#recapButton',
    )
    ?.addEventListener(
      'click',
      openRecap,
    )

  document
    .querySelector(
      '#closeRecapButton',
    )
    ?.addEventListener(
      'click',
      closeRecap,
    )

  document
    .querySelector(
      '#closeRecapSecondaryButton',
    )
    ?.addEventListener(
      'click',
      closeRecap,
    )

  document
    .querySelector(
      '#startAuctionButton',
    )
    ?.addEventListener(
      'click',
      actions.onStartAuction,
    )

  document
    .querySelector(
      '#startAuctionFromRecapButton',
    )
    ?.addEventListener(
      'click',
      actions.onStartAuction,
    )
}