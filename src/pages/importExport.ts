import {
  players,
} from '../data/players'

import {
  createStateBackup,
  loadState,
  parseStateBackup,
  saveState,
} from '../app/storage'

import {
  FLDA_API_URL,
  FldaApiError,
  getFldaHealth,
  getFldaStatus,
  updateFlda,
} from '../services/flda'

import type {
  FldaDatasetState,
  FldaHealth,
  FldaUpdateTarget,
} from '../services/flda'

import type {
  AppState,
  Manager,
} from '../app/state'

/* =========================
   TYPES
========================= */

type FeedbackType =
  | 'success'
  | 'error'
  | 'info'

interface FeedbackState {
  type: FeedbackType

  title: string

  message: string
}

interface PendingRestore {
  fileName: string

  state: AppState

  exportedAt: string
}

type FldaConnectionState =
  | 'loading'
  | 'connected'
  | 'unreachable'
  | 'api-error'

interface FldaDatasetDefinition {
  key: string
  label: string
  updateTarget?: FldaUpdateTarget
  updateLabel?: string
  note?: string
}

/* =========================
   LOCAL UI STATE
========================= */

let feedback:
  FeedbackState | null = null

let pendingRestore:
  PendingRestore | null = null

let importExportEventsBound =
  false

let fldaConnection:
  FldaConnectionState = 'loading'

let fldaHealth:
  FldaHealth | null = null

let fldaDatasets:
  FldaDatasetState[] = []

let fldaError:
  string | null = null

let fldaFeedback:
  FeedbackState | null = null

let fldaUpdating:
  FldaUpdateTarget | 'all' | null = null

let fldaLoading = false

const FLDA_DATASETS:
  FldaDatasetDefinition[] = [
    {
      key: 'players_current',
      label: 'Listone',
      updateTarget: 'players',
      updateLabel: 'Aggiorna Listone',
    },
    {
      key: 'guide',
      label: 'Guida Asta',
      updateTarget: 'guide',
      updateLabel: 'Aggiorna Guida',
    },
    {
      key: 'hierarchies',
      label: 'Gerarchie',
      note: 'Aggiornate insieme alla Guida',
    },
    {
      key: 'calendar_grid',
      label: 'Calendario / Griglie',
      updateTarget: 'grid',
      updateLabel: 'Aggiorna Calendario',
    },
    {
      key: 'history',
      label: 'Storico',
      updateTarget: 'history',
      updateLabel: 'Aggiorna Storico',
    },
    {
      key: 'saggi',
      label: 'Saggi',
      note: 'Gestito da FLDA, non aggiornabile da questa pagina',
    },
  ]

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

function formatDateTime(
  value: string,
): string {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value
  }

  return new Intl.DateTimeFormat(
    'it-IT',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  ).format(date)
}

function normalizeFldaStatus(
  value: string | undefined,
): FldaDatasetState['status'] {
  switch (value) {
    case 'success':
    case 'warning':
    case 'failed':
    case 'never':
      return value

    default:
      return 'never'
  }
}

function getFldaStatusLabel(
  status: FldaDatasetState['status'],
): string {
  switch (status) {
    case 'success':
      return 'Aggiornato'

    case 'warning':
      return 'Con avvisi'

    case 'failed':
      return 'Errore'

    case 'never':
      return 'Mai aggiornato'
  }
}

function getFldaDataset(
  key: string,
): FldaDatasetState {
  const dataset =
    fldaDatasets.find(
      (candidate) =>
        candidate.dataset_name === key,
    )

  if (!dataset) {
    return {
      dataset_name: key,
      status: 'never',
      record_count: 0,
      warning_count: 0,
      blocking_count: 0,
      last_success_at: null,
    }
  }

  return {
    ...dataset,
    status: normalizeFldaStatus(
      dataset.status,
    ),
  }
}

function renderFldaFeedback(): string {
  if (!fldaFeedback) {
    return ''
  }

  return `
    <div
      class="
        data-transfer-feedback
        data-transfer-feedback-${fldaFeedback.type}
      "
      role="status"
    >
      <strong>
        ${escapeHtml(fldaFeedback.title)}
      </strong>

      <span>
        ${escapeHtml(fldaFeedback.message)}
      </span>
    </div>
  `
}

function renderFldaDatasetCard(
  definition: FldaDatasetDefinition,
): string {
  const dataset =
    getFldaDataset(definition.key)

  const updating =
    fldaUpdating === 'all' ||
    fldaUpdating === definition.updateTarget

  const lastSuccess =
    dataset.last_success_at
      ? formatDateTime(
          dataset.last_success_at,
        )
      : 'Non disponibile'

  return `
    <article class="flda-dataset-card">
      <div class="flda-dataset-heading">
        <div>
          <h3>
            ${escapeHtml(definition.label)}
          </h3>

          ${
            definition.note
              ? `<p>${escapeHtml(definition.note)}</p>`
              : ''
          }
        </div>

        <span
          class="
            data-transfer-status
            flda-status-${dataset.status}
          "
        >
          ${getFldaStatusLabel(dataset.status)}
        </span>
      </div>

      <dl class="flda-dataset-metrics">
        <div>
          <dt>Record</dt>
          <dd>${dataset.record_count}</dd>
        </div>

        <div>
          <dt>Warning</dt>
          <dd>${dataset.warning_count}</dd>
        </div>

        <div>
          <dt>Bloccanti</dt>
          <dd>${dataset.blocking_count}</dd>
        </div>
      </dl>

      <div class="flda-dataset-footer">
        <span>
          Ultimo aggiornamento riuscito
        </span>

        <strong>
          ${escapeHtml(lastSuccess)}
        </strong>

        ${
          definition.updateTarget
            ? `
              <button
                type="button"
                class="
                  data-transfer-button
                  data-transfer-button-secondary
                "
                data-flda-update="${definition.updateTarget}"
                ${
                  fldaConnection !== 'connected' ||
                  fldaUpdating
                    ? 'disabled'
                    : ''
                }
              >
                ${
                  updating
                    ? 'Aggiornamento...'
                    : definition.updateLabel
                }
              </button>
            `
            : ''
        }
      </div>
    </article>
  `
}

function renderFldaPanel(): string {
  const connected =
    fldaConnection === 'connected'

  const connectionLabel =
    fldaConnection === 'loading'
      ? 'Verifica in corso'
      : connected
        ? 'FLDA connesso'
        : fldaConnection === 'unreachable'
          ? 'FLDA non raggiungibile'
          : 'Errore API FLDA'

  const connectionClass =
    fldaConnection === 'loading'
      ? 'status-neutral'
      : connected
        ? 'status-ready'
        : 'flda-status-failed'

  return `
    <section
      id="fldaPanel"
      class="data-transfer-section"
    >
      <div class="data-transfer-section-header">
        <div>
          <span class="data-transfer-eyebrow">
            DATI FLDA
          </span>

          <h2>
            Fonti dati locali
          </h2>

          <p>
            Stato e aggiornamento dei dataset gestiti da FLDA.
            Questi dati sono separati dal backup dell'app.
          </p>

          <code class="flda-api-url">
            ${escapeHtml(FLDA_API_URL)}
          </code>
        </div>

        <div class="flda-panel-actions">
          <span
            class="
              data-transfer-status
              ${connectionClass}
            "
          >
            ${connectionLabel}
          </span>

          <button
            type="button"
            class="
              data-transfer-button
              data-transfer-button-primary
            "
            data-flda-update="all"
            ${
              !connected || fldaUpdating
                ? 'disabled'
                : ''
            }
          >
            ${
              fldaUpdating === 'all'
                ? 'Aggiornamento...'
                : 'Aggiorna tutto'
            }
          </button>
        </div>
      </div>

      ${
        fldaHealth?.version
          ? `
            <p class="flda-service-meta">
              API FLDA ${escapeHtml(fldaHealth.version)}
            </p>
          `
          : ''
      }

      ${
        fldaError
          ? `
            <div class="flda-connection-error" role="alert">
              ${escapeHtml(fldaError)}
            </div>
          `
          : ''
      }

      <div class="flda-dataset-grid">
        ${
          FLDA_DATASETS
            .map(renderFldaDatasetCard)
            .join('')
        }
      </div>

      <div id="fldaFeedback">
        ${renderFldaFeedback()}
      </div>
    </section>
  `
}

function getManagerName(
  manager:
    Manager | undefined,
): string {
  if (!manager) {
    return ''
  }

  if (
    manager.alias.trim()
  ) {
    return manager.alias.trim()
  }

  const fullName =
    [
      manager.firstName,
      manager.lastName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()

  return (
    fullName ||
    manager.teamName ||
    manager.id
  )
}

function getSafeFileStamp():
  string {
  const now =
    new Date()

  const year =
    now.getFullYear()

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(
      2,
      '0',
    )

  const day =
    String(
      now.getDate(),
    ).padStart(
      2,
      '0',
    )

  const hour =
    String(
      now.getHours(),
    ).padStart(
      2,
      '0',
    )

  const minute =
    String(
      now.getMinutes(),
    ).padStart(
      2,
      '0',
    )

  return [
    year,
    month,
    day,
    '-',
    hour,
    minute,
  ].join('')
}

/* =========================
   DOWNLOAD
========================= */

function downloadTextFile(
  fileName: string,
  content: string,
  mimeType: string,
): void {
  const blob =
    new Blob(
      [content],
      {
        type:
          mimeType,
      },
    )

  const url =
    URL.createObjectURL(
      blob,
    )

  const link =
    document.createElement(
      'a',
    )

  link.href =
    url

  link.download =
    fileName

  document.body.appendChild(
    link,
  )

  link.click()

  link.remove()

  URL.revokeObjectURL(
    url,
  )
}

/* =========================
   CSV
========================= */

function csvValue(
  value:
    | string
    | number
    | undefined,
): string {
  const text =
    value === undefined
      ? ''
      : String(value)

  return `"${text.replaceAll(
    '"',
    '""',
  )}"`
}

function buildCurrentAuctionCsv(
  state: AppState,
): string {
  const header = [
    'assignment_id',
    'player_id',
    'giocatore',
    'squadra_reale',
    'ruolo',
    'manager_id',
    'manager',
    'squadra_fantasy',
    'prezzo',
    'second_bidder_manager_id',
    'second_bidder',
    'second_bid_price',
  ]

  const rows =
    state.auctionAssignments.map(
      (assignment) => {
        const player =
          players.find(
            (item) =>
              item.id ===
              assignment.playerId,
          )

        const manager =
          state.managers.find(
            (item) =>
              item.id ===
              assignment.managerId,
          )

        const secondBidder =
          assignment
            .secondBidderManagerId
            ? state.managers.find(
                (item) =>
                  item.id ===
                  assignment
                    .secondBidderManagerId,
              )
            : undefined

        return [
          assignment.id,
          assignment.playerId,
          player?.name ??
            '',
          player?.team ??
            '',
          player?.role ??
            '',
          assignment.managerId,
          getManagerName(
            manager,
          ),
          manager?.teamName ??
            '',
          assignment.price,
          assignment
            .secondBidderManagerId ??
            '',
          getManagerName(
            secondBidder,
          ),
          assignment
            .secondBidPrice ??
            '',
        ]
      },
    )

  return [
    header
      .map(csvValue)
      .join(';'),

    ...rows.map(
      (row) =>
        row
          .map(
            (value) =>
              csvValue(
                value,
              ),
          )
          .join(';'),
    ),
  ].join('\n')
}

/* =========================
   FEEDBACK
========================= */

function renderFeedback():
  string {
  if (!feedback) {
    return ''
  }

  return `
    <div
      class="
        data-transfer-feedback
        data-transfer-feedback-${feedback.type}
      "
    >
      <strong>
        ${escapeHtml(
          feedback.title,
        )}
      </strong>

      <span>
        ${escapeHtml(
          feedback.message,
        )}
      </span>
    </div>
  `
}

/* =========================
   RESTORE PREVIEW
========================= */

function renderRestorePreview():
  string {
  if (!pendingRestore) {
    return ''
  }

  const state =
    pendingRestore.state

  const totalArchivedAssignments =
    state.archivedAuctions.reduce(
      (
        total,
        auction,
      ) =>
        total +
        auction.assignments.length,
      0,
    )

  return `
    <div
      class="restore-preview"
    >
      <div
        class="restore-preview-header"
      >
        <div>
          <span
            class="data-transfer-eyebrow"
          >
            BACKUP VALIDATO
          </span>

          <strong>
            ${escapeHtml(
              pendingRestore.fileName,
            )}
          </strong>

          <small>
            Creato il
            ${escapeHtml(
              formatDateTime(
                pendingRestore
                  .exportedAt,
              ),
            )}
          </small>
        </div>

        <span
          class="
            data-transfer-status
            status-ready
          "
        >
          Valido
        </span>
      </div>

      <div
        class="restore-preview-grid"
      >
        <div>
          <span>
            Fase asta
          </span>

          <strong>
            ${escapeHtml(
              state.auctionPhase,
            )}
          </strong>
        </div>

        <div>
          <span>
            Manager
          </span>

          <strong>
            ${state.managers.length}
          </strong>
        </div>

        <div>
          <span>
            Acquisti correnti
          </span>

          <strong>
            ${state.auctionAssignments.length}
          </strong>
        </div>

        <div>
          <span>
            Aste archiviate
          </span>

          <strong>
            ${state.archivedAuctions.length}
          </strong>
        </div>

        <div>
          <span>
            Acquisti storici
          </span>

          <strong>
            ${totalArchivedAssignments}
          </strong>
        </div>

        <div>
          <span>
            Obiettivi
          </span>

          <strong>
            ${state.objectives.length}
          </strong>
        </div>
      </div>

      <div
        class="restore-preview-warning"
      >
        Confermando, lo stato attuale
        dell'app verrà sostituito con
        quello contenuto nel backup.
      </div>

      <div
        class="restore-preview-actions"
      >
        <button
          type="button"
          class="
            data-transfer-button
            data-transfer-button-secondary
          "
          data-cancel-restore
        >
          Annulla
        </button>

        <button
          type="button"
          class="
            data-transfer-button
            data-transfer-button-danger
          "
          data-confirm-restore
        >
          Ripristina backup
        </button>
      </div>
    </div>
  `
}

/* =========================
   PAGE
========================= */

export function renderImportExportPage():
  string {
  const state =
    loadState()

  const hasCurrentAuctionData =
    state.auctionAssignments
      .length > 0

  window.setTimeout(
    () => {
      if (
        document.querySelector(
          '#fldaPanel',
        )
      ) {
        void refreshFldaData()
      }
    },
    0,
  )

  return `
    <section
      class="
        page
        import-export-page
      "
    >
      <div
        class="
          import-export-page-header
        "
      >
        <div>
          <h1>
            Import / Export
          </h1>

          <p>
            Gestione dei dati principali
            di MisterCanà.
          </p>
        </div>
      </div>

      ${renderFldaPanel()}

      <section
        class="data-transfer-section"
      >
        <div
          class="
            data-transfer-section-header
          "
        >
          <div>
            <span
              class="
                data-transfer-eyebrow
              "
            >
              BACKUP APP
            </span>

            <h2>
              Backup e ripristino
            </h2>

            <p>
              Salva lo stato completo
              dell'app oppure ripristina
              un backup validato.
            </p>
          </div>
        </div>

        <div
          class="data-transfer-grid"
        >
          <article
            class="data-transfer-card"
          >
            <div
              class="
                data-transfer-card-header
              "
            >
              <div
                class="
                  data-transfer-icon
                  data-transfer-icon-export
                "
              >
                ↑
              </div>

              <span
                class="
                  data-transfer-status
                  status-ready
                "
              >
                Operativo
              </span>
            </div>

            <div
              class="
                data-transfer-card-body
              "
            >
              <h3>
                Backup completo
              </h3>

              <p>
                Esporta configurazione,
                manager, obiettivi,
                acquisti correnti e aste
                archiviate in un unico
                file MisterCanà.
              </p>
            </div>

            <div
              class="
                data-transfer-card-footer
              "
            >
              <div>
                <span>
                  Formato
                </span>

                <strong>
                  JSON MisterCanà v1
                </strong>
              </div>

              <button
                type="button"
                class="
                  data-transfer-button
                  data-transfer-button-primary
                "
                data-export-backup
              >
                Esporta backup
              </button>
            </div>
          </article>

          <article
            class="data-transfer-card"
          >
            <div
              class="
                data-transfer-card-header
              "
            >
              <div
                class="
                  data-transfer-icon
                  data-transfer-icon-import
                "
              >
                ↓
              </div>

              <span
                class="
                  data-transfer-status
                  status-ready
                "
              >
                Operativo
              </span>
            </div>

            <div
              class="
                data-transfer-card-body
              "
            >
              <h3>
                Ripristina backup
              </h3>

              <p>
                Il file viene controllato
                prima di modificare i dati.
                Nessun backup viene
                applicato automaticamente.
              </p>
            </div>

            <div
              class="
                data-transfer-card-footer
              "
            >
              <div>
                <span>
                  Formato
                </span>

                <strong>
                  JSON MisterCanà v1
                </strong>
              </div>

              <button
                type="button"
                class="
                  data-transfer-button
                  data-transfer-button-primary
                "
                data-import-backup
              >
                Scegli backup
              </button>

              <input
                id="mistercanaBackupInput"
                class="
                  data-transfer-file-input
                "
                type="file"
                accept="
                  application/json,.json
                "
              >
            </div>
          </article>
        </div>

        <div
          id="importExportFeedback"
        >
          ${renderFeedback()}
        </div>

        <div
          id="restorePreviewContainer"
        >
          ${renderRestorePreview()}
        </div>
      </section>

      <section
        class="data-transfer-section"
      >
        <div
          class="
            data-transfer-section-header
          "
        >
          <div>
            <span
              class="
                data-transfer-eyebrow
              "
            >
              EXPORT ASTA
            </span>

            <h2>
              Asta corrente
            </h2>

            <p>
              Esporta gli acquisti
              registrati nell'asta attiva
              in un formato leggibile
              anche da Excel.
            </p>
          </div>

          <span
            class="
              data-transfer-status
              ${
                hasCurrentAuctionData
                  ? 'status-ready'
                  : 'status-neutral'
              }
            "
          >
            ${
              hasCurrentAuctionData
                ? `${state.auctionAssignments.length} acquisti`
                : 'Nessun acquisto'
            }
          </span>
        </div>

        <div
          class="
            data-transfer-grid
            data-transfer-grid-single
          "
        >
          <article
            class="data-transfer-card"
          >
            <div
              class="
                data-transfer-card-header
              "
            >
              <div
                class="
                  data-transfer-icon
                  data-transfer-icon-export
                "
              >
                ↑
              </div>

              <span
                class="
                  data-transfer-status
                  ${
                    hasCurrentAuctionData
                      ? 'status-ready'
                      : 'status-neutral'
                  }
                "
              >
                ${
                  hasCurrentAuctionData
                    ? 'Pronto'
                    : 'Vuoto'
                }
              </span>
            </div>

            <div
              class="
                data-transfer-card-body
              "
            >
              <h3>
                Acquisti asta corrente
              </h3>

              <p>
                Include giocatore,
                squadra reale, ruolo,
                manager, squadra fantasy,
                prezzo e secondo offerente
                quando registrato.
              </p>
            </div>

            <div
              class="
                data-transfer-card-footer
              "
            >
              <div>
                <span>
                  Formato
                </span>

                <strong>
                  CSV · separatore ;
                </strong>
              </div>

              <button
                type="button"
                class="
                  data-transfer-button
                  ${
                    hasCurrentAuctionData
                      ? 'data-transfer-button-primary'
                      : ''
                  }
                "
                data-export-auction
                ${
                  hasCurrentAuctionData
                    ? ''
                    : 'disabled'
                }
              >
                Esporta asta
              </button>
            </div>
          </article>
        </div>
      </section>

      <section
        class="data-integrity-panel"
      >
        <div
          class="data-integrity-icon"
        >
          ✓
        </div>

        <div>
          <span
            class="
              data-transfer-eyebrow
            "
          >
            VALIDAZIONE
          </span>

          <h2>
            Prima validare, poi applicare
          </h2>

          <p>
            Il ripristino verifica tipo,
            versione e struttura minima
            del backup prima di proporre
            la conferma.

            Un file non valido non modifica
            il localStorage corrente.
          </p>
        </div>
      </section>
    </section>
  `
}

/* =========================
   UI UPDATE
========================= */

function updateDynamicUi():
  void {
  const feedbackContainer =
    document.querySelector<HTMLElement>(
      '#importExportFeedback',
    )

  if (feedbackContainer) {
    feedbackContainer.innerHTML =
      renderFeedback()
  }

  const previewContainer =
    document.querySelector<HTMLElement>(
      '#restorePreviewContainer',
    )

  if (previewContainer) {
    previewContainer.innerHTML =
      renderRestorePreview()
  }
}

function updateFldaUi(): void {
  const panel =
    document.querySelector<HTMLElement>(
      '#fldaPanel',
    )

  if (panel) {
    panel.outerHTML =
      renderFldaPanel()
  }
}

async function refreshFldaData():
  Promise<void> {
  if (fldaLoading) {
    return
  }

  fldaLoading = true
  fldaConnection = 'loading'
  fldaError = null
  updateFldaUi()

  try {
    const [health, datasets] =
      await Promise.all([
        getFldaHealth(),
        getFldaStatus(),
      ])

    fldaHealth = health
    fldaDatasets = datasets

    if (health.status === 'ok') {
      fldaConnection = 'connected'
    } else {
      fldaConnection = 'api-error'
      fldaError =
        `FLDA segnala lo stato “${health.status}”.`
    }
  } catch (error) {
    fldaHealth = null

    if (
      error instanceof FldaApiError &&
      (
        error.kind === 'unreachable' ||
        error.kind === 'timeout'
      )
    ) {
      fldaConnection = 'unreachable'
    } else {
      fldaConnection = 'api-error'
    }

    fldaError =
      error instanceof Error
        ? error.message
        : 'Errore imprevisto durante il collegamento a FLDA.'
  } finally {
    fldaLoading = false
    updateFldaUi()
  }
}

async function runFldaUpdate(
  target: FldaUpdateTarget | 'all',
): Promise<void> {
  if (
    fldaUpdating ||
    fldaConnection !== 'connected'
  ) {
    return
  }

  fldaUpdating = target
  fldaFeedback = {
    type: 'info',
    title: 'Aggiornamento in corso',
    message:
      'FLDA sta aggiornando i dataset richiesti.',
  }
  updateFldaUi()

  try {
    await updateFlda(
      target === 'all'
        ? undefined
        : target,
    )

    fldaFeedback = {
      type: 'success',
      title: 'Aggiornamento completato',
      message:
        'Lo stato dei dataset è stato ricaricato da FLDA.',
    }
  } catch (error) {
    fldaFeedback = {
      type: 'error',
      title: 'Aggiornamento fallito',
      message:
        error instanceof Error
          ? error.message
          : 'FLDA non ha completato l’aggiornamento.',
    }
  } finally {
    fldaUpdating = null
    await refreshFldaData()
  }
}

/* =========================
   ACTIONS
========================= */

function exportBackup():
  void {
  const state =
    loadState()

  const backup =
    createStateBackup(
      state,
    )

  downloadTextFile(
    `mistercana-backup-${getSafeFileStamp()}.json`,
    backup,
    'application/json;charset=utf-8',
  )

  feedback = {
    type:
      'success',

    title:
      'Backup creato',

    message:
      'Il file contiene lo stato completo attuale di MisterCanà.',
  }

  updateDynamicUi()
}

function exportCurrentAuction():
  void {
  const state =
    loadState()

  if (
    !state.auctionAssignments.length
  ) {
    feedback = {
      type:
        'info',

      title:
        'Nessun dato da esportare',

      message:
        'L’asta corrente non contiene ancora acquisti.',
    }

    updateDynamicUi()

    return
  }

  const csv =
    buildCurrentAuctionCsv(
      state,
    )

  /*
    BOM UTF-8:
    migliora l'apertura diretta
    del CSV in Excel.
  */
  downloadTextFile(
    `mistercana-asta-${getSafeFileStamp()}.csv`,
    `\uFEFF${csv}`,
    'text/csv;charset=utf-8',
  )

  feedback = {
    type:
      'success',

    title:
      'Asta esportata',

    message:
      `${state.auctionAssignments.length} acquisti inseriti nel CSV.`,
  }

  updateDynamicUi()
}

async function readBackupFile(
  file: File,
): Promise<void> {
  let raw:
    string

  try {
    raw =
      await file.text()
  } catch {
    pendingRestore =
      null

    feedback = {
      type:
        'error',

      title:
        'Lettura fallita',

      message:
        'Non è stato possibile leggere il file selezionato.',
    }

    updateDynamicUi()

    return
  }

  const result =
    parseStateBackup(
      raw,
    )

  if (!result.ok) {
    pendingRestore =
      null

    feedback = {
      type:
        'error',

      title:
        'Backup non valido',

      message:
        result.error,
    }

    updateDynamicUi()

    return
  }

  pendingRestore = {
    fileName:
      file.name,

    state:
      result.state,

    exportedAt:
      result.exportedAt,
  }

  feedback = {
    type:
      'success',

    title:
      'Backup validato',

    message:
      'Controlla il riepilogo prima di confermare il ripristino.',
  }

  updateDynamicUi()
}

function cancelRestore():
  void {
  pendingRestore =
    null

  feedback = {
    type:
      'info',

    title:
      'Ripristino annullato',

    message:
      'I dati attuali non sono stati modificati.',
  }

  const input =
    document.querySelector<HTMLInputElement>(
      '#mistercanaBackupInput',
    )

  if (input) {
    input.value = ''
  }

  updateDynamicUi()
}

function confirmRestore():
  void {
  if (!pendingRestore) {
    return
  }

  saveState(
    pendingRestore.state,
  )

  /*
    Il main mantiene lo state
    in memoria.

    Dopo il restore ricarichiamo
    l'app affinché venga eseguito
    nuovamente loadState().
  */
  window.location.reload()
}

/* =========================
   EVENTS
========================= */

export function bindImportExportEvents():
  void {
  if (
    importExportEventsBound
  ) {
    return
  }

  importExportEventsBound =
    true

  document.addEventListener(
    'click',
    (event) => {
      const target =
        event.target

      if (
        !(
          target instanceof
          Element
        )
      ) {
        return
      }

      if (
        target.closest(
          '[data-export-backup]',
        )
      ) {
        exportBackup()

        return
      }

      const fldaUpdateButton =
        target.closest<HTMLElement>(
          '[data-flda-update]',
        )

      if (fldaUpdateButton) {
        const updateTarget =
          fldaUpdateButton.dataset
            .fldaUpdate

        if (
          updateTarget === 'all' ||
          updateTarget === 'players' ||
          updateTarget === 'guide' ||
          updateTarget === 'grid' ||
          updateTarget === 'history'
        ) {
          void runFldaUpdate(
            updateTarget,
          )
        }

        return
      }

      if (
        target.closest(
          '[data-export-auction]',
        )
      ) {
        exportCurrentAuction()

        return
      }

      if (
        target.closest(
          '[data-import-backup]',
        )
      ) {
        const input =
          document.querySelector<HTMLInputElement>(
            '#mistercanaBackupInput',
          )

        input?.click()

        return
      }

      if (
        target.closest(
          '[data-cancel-restore]',
        )
      ) {
        cancelRestore()

        return
      }

      if (
        target.closest(
          '[data-confirm-restore]',
        )
      ) {
        confirmRestore()
      }
    },
  )

  document.addEventListener(
    'change',
    (event) => {
      const target =
        event.target

      if (
        !(
          target instanceof
          HTMLInputElement
        ) ||
        target.id !==
          'mistercanaBackupInput'
      ) {
        return
      }

      const file =
        target.files?.[0]

      if (!file) {
        return
      }

      void readBackupFile(
        file,
      )
    },
  )
}

/*
  Come Insights, questa pagina
  usa event delegation e può
  registrare il binder una sola
  volta al caricamento del modulo.

  Non è quindi necessario
  modificare main.ts.
*/
bindImportExportEvents()
