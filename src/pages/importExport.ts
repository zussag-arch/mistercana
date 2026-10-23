import bundledPlayersCsv from '../../database/fantalab_giocatori.csv?raw'
import bundledCoachesCsv from '../../database/fantalab_allenatori.csv?raw'
import bundledGoalkeeperGridCsv from '../../database/griglia_portieri.csv?raw'
import bundledAttackerGridCsv from '../../database/griglia_attaccanti.csv?raw'
import bundledGoalkeeperCalendarCsv from '../../database/MisterCana_DB_Portieri_Calendario.csv?raw'
import bundledGoalkeeperHierarchyCsv from '../../database/MisterCana_DB_Portieri_Gerarchie.csv?raw'
import bundledSaggiCsv from '../../database/MisterCana_DB_Saggi.csv?raw'
import bundledPreviousSeasonCsv from '../../database/fantalab_stagione_precedente.csv?raw'
import bundledMatchdayVotesCsv from '../../database/voti_giornate.csv?raw'
import bundledSeasonHistoryCsv from '../../database/storico_stagioni.csv?raw'
import bundledAuctionsCsv from '../../database/aste.csv?raw'
import bundledProbablesCsv from '../../database/probabili.csv?raw'
import bundledSosProbablesCsv from '../../database/sos_probabili.csv?raw'
import bundledSosAdviceCsv from '../../database/sos_consigli.csv?raw'
import { CSV_LABELS, clearCsvOverrides, getCsv, getCsvOverrides, saveCsvOverrides } from '../data/csvOverrides'
import type { CsvKey, CsvOverride } from '../data/csvOverrides'
import { analyzeCsv } from '../data/csvImport'
import type { CsvAnalysis } from '../data/csvImport'
import { getDataSources, getLastDataUpdate } from '../data/dataSources'
import { getICaV3Results } from '../data/icaV3Data'
import { localPlayers } from '../services/fantalabLocal'
import { getCachedPlayersDataset } from '../services/playerRepository'
import { getAssignmentFldaId } from '../services/auctionPlayerResolver'
import { buildLeagueRosters } from '../domain/leagueExport'
import type { ExportPlayer } from '../domain/leagueExport'
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
  isFldaLocalMode,
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

/* =========================
   FONTI DATI
========================= */

function renderDataSourcesPanel(): string {
  const sources = getDataSources()
  const lastUpdate = getLastDataUpdate()
  const active = getCachedPlayersDataset()
  const label = active?.source === 'legacy'
    ? 'Vecchio listone (riserva)'
    : isFldaLocalMode() || !active
      ? (Object.keys(getCsvOverrides()).length ? 'Tabelle FantaLab (caricate nel browser)' : 'Tabelle FantaLab (locali)')
      : 'FLDA'
  return `
    <section class="data-transfer-section data-sources-section">
      <div class="data-transfer-section-header">
        <div>
          <span class="data-transfer-eyebrow">Dati</span>
          <h2>Fonti dati</h2>
          <p>Gli archivi che l'app sta usando, con i numeri reali. Si trovano nella cartella <code>database/</code> del progetto.</p>
          <p class="install-link-row">Link per installare l'app su Android: <code>zussag-arch.github.io/mistercana/?installa</code> <button type="button" class="install-open-button" data-install-open>Installa l'app</button></p>
          <p class="data-last-update">Ultimo aggiornamento dati: <strong>${escapeSourceHtml(lastUpdate.date)}</strong> · ${escapeSourceHtml(lastUpdate.source)}</p>
          <p class="data-last-update">Versione app: <strong>${new Date(__BUILD_DATE__).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</strong></p>
        </div>
        <span class="data-source-active">In uso: ${escapeSourceHtml(label)}</span>
      </div>
      <div class="data-sources-grid">
        ${sources.map((source) => `
          <article class="data-source-card">
            <span class="data-source-title">${escapeSourceHtml(source.title)}</span>
            <strong>${escapeSourceHtml(source.value)}</strong>
            <small>${escapeSourceHtml(source.detail)}</small>
            <p><b>Usato per:</b> ${escapeSourceHtml(source.usedBy)}</p>
            <code>${escapeSourceHtml(source.file)}</code>
            <small class="data-source-updated">${escapeSourceHtml(source.updated)}</small>
          </article>`).join('')}
      </div>
      ${renderCsvUpload()}
      <details class="data-sources-howto">
        <summary>Come aggiornare i dati</summary>
        <ol>
          <li>Scarica da FantaLab i nuovi <code>fantalab_giocatori.csv</code> e <code>fantalab_allenatori.csv</code> (o le griglie).</li>
          <li>Premi <b>Scegli file CSV</b> qui sopra, controlla l'anteprima e premi <b>Applica</b>: l'app li usa subito, solo in questo browser.</li>
          <li>Codici storici, obiettivi e assegnazioni restano collegati tramite l'ID FantaLab.</li>
          <li>Per renderli definitivi per tutti (anche online), sostituisci i file in <code>database/</code> e fai commit e push su GitHub.</li>
        </ol>
      </details>
    </section>
  `
}

/* =========================
   CARICA NUOVI DATI (CSV)
========================= */

let pendingCsv: CsvAnalysis[] = []

const BUNDLED_CSV: Record<CsvKey, string> = {
  fantalab_giocatori: bundledPlayersCsv,
  fantalab_allenatori: bundledCoachesCsv,
  griglia_portieri: bundledGoalkeeperGridCsv,
  griglia_attaccanti: bundledAttackerGridCsv,
  portieri_calendario: bundledGoalkeeperCalendarCsv,
  portieri_gerarchie: bundledGoalkeeperHierarchyCsv,
  saggi: bundledSaggiCsv,
  stagione_precedente: bundledPreviousSeasonCsv,
  voti_giornate: bundledMatchdayVotesCsv,
  storico_stagioni: bundledSeasonHistoryCsv,
  aste: bundledAuctionsCsv,
  probabili: bundledProbablesCsv,
  sos_probabili: bundledSosProbablesCsv,
  sos_consigli: bundledSosAdviceCsv,
}

function renderCsvUpload(): string {
  const overrides = getCsvOverrides()
  const active = (Object.keys(overrides) as CsvKey[])
  return `
    <div class="csv-upload">
      <div class="csv-upload-copy">
        <strong>Carica nuovi dati</strong>
        <p><b>Aggiorna da FantaLab</b> apre il login FantaLab, scarica tutto da solo e lo pubblica online per tutti i dispositivi (serve FLDA acceso sul computer). In alternativa scegli i CSV a mano. In entrambi i casi vedi un'anteprima prima di applicare.</p>
      </div>
      <div class="csv-upload-actions">
        <button id="fantalabSyncButton" type="button" class="data-transfer-button data-transfer-button-primary" ${syncRunning ? 'disabled' : ''}>Aggiorna da FantaLab</button>
        <label class="data-transfer-button csv-upload-button">
          Scegli file CSV
          <input id="csvUploadInput" type="file" accept=".csv,text/csv" multiple hidden>
        </label>
      </div>
    </div>
    <div id="fantalabSyncStatus">${renderSyncStatus()}</div>
    <details class="saggi-creators" id="saggiCreatorsBox">
      <summary>Saggi da scaricare <small>${escapeSourceHtml(selectedCreatorsLabel())}</small></summary>
      <div id="saggiCreatorsList"><p class="saggi-creators-hint">Apri per scegliere i creator (serve FLDA acceso).</p></div>
    </details>
    ${active.length ? `
      <div class="csv-upload-active">
        <span>In uso dati caricati nel browser: ${active.map((key) => `<b>${escapeSourceHtml(CSV_LABELS[key])}</b> (${escapeSourceHtml(overrides[key]!.fileName)}, ${new Date(overrides[key]!.loadedAt).toLocaleDateString('it-IT')})`).join(' · ')}</span>
        <button id="csvResetOverrides" type="button" class="data-transfer-button">Torna ai dati originali</button>
      </div>` : ''}
    <div id="csvUploadPreview">${renderCsvPreview()}</div>
  `
}

function renderCsvPreview(): string {
  if (!pendingCsv.length) return ''
  const valid = pendingCsv.filter((item) => item.ok)
  return `
    <div class="csv-preview">
      ${pendingCsv.map((item) => `
        <article class="csv-preview-item ${item.ok ? 'is-ok' : 'is-error'}">
          <header>
            <strong>${escapeSourceHtml(item.key ? CSV_LABELS[item.key] : 'File non riconosciuto')}</strong>
            <small>${escapeSourceHtml(item.fileName)}</small>
            <span>${item.ok ? 'OK' : 'Da correggere'}</span>
          </header>
          <ul>
            ${item.errors.map((error) => `<li class="error">${escapeSourceHtml(error)}</li>`).join('')}
            ${item.summary.map((line) => `<li>${escapeSourceHtml(line)}</li>`).join('')}
          </ul>
        </article>`).join('')}
      <div class="csv-preview-actions">
        <button id="csvUploadCancel" type="button" class="data-transfer-button">Annulla</button>
        <button id="csvUploadApply" type="button" class="data-transfer-button data-transfer-button-primary" ${valid.length ? '' : 'disabled'}>Applica ${valid.length} file e ricarica</button>
      </div>
    </div>`
}

function refreshCsvPreview(): void {
  const container = document.querySelector<HTMLElement>('#csvUploadPreview')
  if (container) container.innerHTML = renderCsvPreview()
}

async function handleCsvFiles(files: FileList): Promise<void> {
  const current = (key: CsvKey) => getCsv(key, BUNDLED_CSV[key])
  pendingCsv = await Promise.all([...files].map(async (file) => analyzeCsv(file.name, await file.text(), current)))
  refreshCsvPreview()
}

function applyCsvFiles(): void {
  const loadedAt = new Date().toISOString()
  const files: Partial<Record<CsvKey, CsvOverride>> = {}
  for (const item of pendingCsv) {
    if (item.ok && item.key) files[item.key] = { fileName: item.fileName, content: item.content, loadedAt }
  }
  if (!saveCsvOverrides(files)) {
    window.alert('Spazio del browser insufficiente per salvare i file.')
    return
  }
  window.location.reload()
}

/* =========================
   AGGIORNA DA FANTALAB (via FLDA locale)
========================= */

// Il login apre Chrome sul computer: serve sempre il FLDA locale, mai quello online.
const LOCAL_FLDA_URL = 'http://127.0.0.1:8765'
const SYNC_STEPS: Record<string, string> = {
  login: 'Login FantaLab',
  download: 'Download da FantaLab',
  export: 'Preparazione file',
  publish: 'Pubblicazione per tutti i dispositivi',
}

interface SyncState {
  status: 'idle' | 'running' | 'done' | 'error' | 'offline'
  step?: string | null
  message: string
}

let syncState: SyncState = { status: 'idle', message: '' }
let syncRunning = false

function renderSyncStatus(): string {
  if (syncState.status === 'idle') return ''
  const steps = Object.entries(SYNC_STEPS)
  const current = steps.findIndex(([key]) => key === syncState.step)
  return `
    <div class="fantalab-sync sync-${syncState.status}">
      ${syncState.status === 'running' ? `<ol class="fantalab-sync-steps">${steps.map(([, label], index) => `<li class="${index < current ? 'done' : index === current ? 'active' : ''}">${escapeSourceHtml(label)}</li>`).join('')}</ol>` : ''}
      <p>${escapeSourceHtml(syncState.message)}</p>
    </div>`
}

function refreshSyncUi(): void {
  const status = document.querySelector<HTMLElement>('#fantalabSyncStatus')
  if (status) status.innerHTML = renderSyncStatus()
  const button = document.querySelector<HTMLButtonElement>('#fantalabSyncButton')
  if (button) button.disabled = syncRunning
}

async function syncRequest(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 8000)
  try {
    return await fetch(`${LOCAL_FLDA_URL}${path}`, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
  }
}

async function startFantalabSync(): Promise<void> {
  if (syncRunning) return
  syncRunning = true
  syncState = { status: 'running', step: 'login', message: 'Avvio dell\'aggiornamento…' }
  refreshSyncUi()
  try {
    const creators = loadSelectedCreators()
    const response = await syncRequest('/api/fantalab/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creators: creators.length ? creators : null }),
    })
    if (!response.ok) throw new Error(`FLDA ha risposto con errore ${response.status}.`)
  } catch {
    syncRunning = false
    syncState = { status: 'offline', message: 'FLDA non risponde. Avvialo con run-local.ps1 (o "flda serve") e riprova.' }
    refreshSyncUi()
    return
  }
  while (syncRunning) {
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
    let state: { status: string; step?: string | null; message?: string; warnings?: string[]; files?: Record<string, string> }
    try {
      state = await (await syncRequest('/api/fantalab/sync')).json()
    } catch {
      continue
    }
    if (state.status === 'running') {
      syncState = { status: 'running', step: state.step, message: state.message ?? '' }
      refreshSyncUi()
      continue
    }
    syncRunning = false
    if (state.status !== 'done') {
      syncState = { status: 'error', message: state.message || 'Aggiornamento non riuscito.' }
      refreshSyncUi()
      return
    }
    try {
      const current = (key: CsvKey) => getCsv(key, BUNDLED_CSV[key])
      const names = Object.keys(state.files ?? {}).length ? Object.keys(state.files ?? {}) : ['fantalab_giocatori', 'fantalab_allenatori']
      pendingCsv = await Promise.all(names.map(async (name) => {
        const text = await (await syncRequest(`/api/fantalab/export/${name}.csv`)).text()
        return analyzeCsv(`${name}.csv`, text, current)
      }))
      const warnings = state.warnings ?? []
      syncState = {
        status: 'done',
        message: 'Dati scaricati da FantaLab: controlla l\'anteprima qui sotto e premi Applica.'
          + (warnings.length ? ` Avvisi (${warnings.length}): ${warnings.slice(0, 5).join(' · ')}${warnings.length > 5 ? ' …' : ''}` : ''),
      }
    } catch {
      syncState = { status: 'error', message: 'Dati scaricati ma file non leggibili da FLDA.' }
    }
    refreshSyncUi()
    refreshCsvPreview()
  }
}

/* =========================
   SAGGI: SCELTA DEI CREATOR
========================= */

const CREATORS_KEY = 'mistercana_saggi_creators_v1'
const DEFAULT_CREATOR_NAMES = ['CarmySpecial', 'Luca Diddi | Il Tattico', 'Recosta', 'SOS Fanta', 'Il Profeta']

interface CreatorOption {
  strategy_id: string
  creator: string | null
  name: string | null
  type: string | null
  participants: string | null
  credits: number | null
  season: string | null
}

function loadSelectedCreators(): string[] {
  try {
    const raw = window.localStorage.getItem(CREATORS_KEY)
    return raw ? JSON.parse(raw) as string[] : []
  } catch {
    return []
  }
}

function saveSelectedCreators(values: string[]): void {
  try { window.localStorage.setItem(CREATORS_KEY, JSON.stringify(values)) } catch { /* solo comodità */ }
}

function selectedCreatorsLabel(): string {
  const selected = loadSelectedCreators()
  return selected.length ? `${selected.length} liste scelte` : 'i 5 di sempre: Carmy, Il Tattico, Recosta, SOS Fanta, Il Profeta'
}

async function loadCreatorOptions(): Promise<void> {
  const list = document.querySelector<HTMLElement>('#saggiCreatorsList')
  if (!list) return
  let options: CreatorOption[] = []
  try {
    options = await (await syncRequest('/api/fantalab/creators')).json()
  } catch {
    list.innerHTML = '<p class="saggi-creators-hint">FLDA non risponde: avvialo per scegliere i creator.</p>'
    return
  }
  const current = options.filter((item) => item.season === 's_26_27')
  if (!current.length) {
    list.innerHTML = '<p class="saggi-creators-hint">L’elenco dei creator compare dopo il primo “Aggiorna da FantaLab”. Fino ad allora vengono scaricati i 5 di sempre.</p>'
    return
  }
  let selected = loadSelectedCreators()
  if (!selected.length) {
    // i 5 di sempre: la loro lista Classic più recente
    selected = DEFAULT_CREATOR_NAMES.flatMap((name) => {
      const found = current.filter((item) => item.creator === name && item.type === 'classic')
      return found.length ? [found[0].strategy_id] : []
    })
  }
  const sorted = [...current].sort((a, b) => String(a.creator).localeCompare(String(b.creator), 'it'))
  list.innerHTML = `
    <p class="saggi-creators-hint">Spunta le liste da scaricare (ogni creator può averne più di una: Classic, Mantra…).</p>
    <div class="saggi-creators-grid">
      ${sorted.map((item) => `
        <label class="saggi-creator">
          <input type="checkbox" value="${escapeSourceHtml(item.strategy_id)}" ${selected.includes(item.strategy_id) ? 'checked' : ''}>
          <span><b>${escapeSourceHtml(item.creator ?? '—')}</b><small>${escapeSourceHtml(item.name ?? '')} · ${escapeSourceHtml(item.type ?? '')} ${escapeSourceHtml(item.participants ?? '')} · ${item.credits ?? ''} cr</small></span>
        </label>`).join('')}
    </div>`
}

function bindCsvUpload(): void {
  document.addEventListener('toggle', (event) => {
    if (event.target instanceof HTMLDetailsElement && event.target.id === 'saggiCreatorsBox' && event.target.open) void loadCreatorOptions()
  }, true)
  document.addEventListener('change', (event) => {
    const box = event.target
    if (box instanceof HTMLInputElement && box.closest('.saggi-creators-grid')) {
      const values = [...document.querySelectorAll<HTMLInputElement>('.saggi-creators-grid input:checked')].map((item) => item.value)
      saveSelectedCreators(values)
      const label = document.querySelector<HTMLElement>('#saggiCreatorsBox summary small')
      if (label) label.textContent = selectedCreatorsLabel()
      return
    }
    const input = event.target
    if (input instanceof HTMLInputElement && input.id === 'csvUploadInput' && input.files?.length) {
      void handleCsvFiles(input.files)
      input.value = ''
    }
  })
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('#csvUploadCancel')) { pendingCsv = []; refreshCsvPreview() }
    if (target.closest('#csvUploadApply')) applyCsvFiles()
    if (target.closest('#fantalabSyncButton')) void startFantalabSync()
    if (target.closest('#csvResetOverrides') && window.confirm('Tornare ai dati originali del progetto? I CSV caricati nel browser verranno eliminati.')) {
      clearCsvOverrides()
      window.location.reload()
    }
  })
}

function escapeSourceHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function exportPlayerRatings(): void {
  const roleOrder = ['P', 'D', 'C', 'A']
  const results = getICaV3Results()
  const csvCell = (value: unknown) => {
    const text = typeof value === 'number' ? value.toFixed(1).replace('.', ',') : String(value ?? '')
    return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  const rows = localPlayers().players
    .map((player) => ({ player, ica: results.get(player.player_id ?? '') }))
    .sort((a, b) => roleOrder.indexOf(a.player.role) - roleOrder.indexOf(b.player.role)
      || (b.ica?.score ?? -1) - (a.ica?.score ?? -1))
  const header = ['Ruolo', 'Giocatore', 'Squadra', 'iCà', 'Posizione nel ruolo %', 'Affare', 'PMA %', 'Titolarità %', 'FM attesa', 'FM corretta']
  const lines = [header.join(';'), ...rows.map(({ player, ica }) => [
    player.role, player.name, player.team, ica?.score, ica?.rolePercentile, ica?.affare,
    player.classic_8_mod_median_value, player.titolarita_display, ica?.expectedFm, ica?.adjustedFm,
  ].map(csvCell).join(';'))]
  downloadTextFile(`mistercana-valutazioni-${getSafeFileStamp()}.csv`, '\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8')
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

function exportLeagueRosters(): void {
  const state = loadState()
  const players = new Map<string, ExportPlayer>(localPlayers().players.filter((player) => player.player_id).map((player) => [String(player.player_id), {
    fantalabId: String(player.player_id), fantacalcioId: player.fantacalcio_id, name: player.name, role: player.role.toUpperCase(),
  }]))
  const result = buildLeagueRosters(state, players, getAssignmentFldaId)
  if (!state.auctionAssignments.length) {
    feedback = { type: 'info', title: 'Nessun dato da esportare', message: 'L’asta corrente non contiene ancora acquisti.' }
    updateDynamicUi()
    return
  }
  if (result.errors.length) {
    feedback = { type: 'error', title: 'Rose non esportate', message: result.errors.slice(0, 6).join(' ') + (result.errors.length > 6 ? ` …e altri ${result.errors.length - 6}.` : '') }
    updateDynamicUi()
    return
  }
  if (result.warnings.length && !window.confirm(`Alcune rose non sono complete:\n\n${result.warnings.join('\n')}\n\nEsportare lo stesso?`)) return
  downloadTextFile(`rose-${getSafeFileStamp()}.csv`, result.csv, 'text/csv;charset=utf-8')
  feedback = { type: 'success', title: 'Rose esportate', message: `${result.players} giocatori di ${result.teams} squadre, pronti per l’import.` }
  updateDynamicUi()
}

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

      ${renderDataSourcesPanel()}

      <details class="flda-optional">
        <summary>
          <span>Servizio FLDA <small>facoltativo</small></span>
          <small>${isFldaLocalMode() ? 'non in uso: l\'app usa le tabelle FantaLab' : 'apri per stato e aggiornamenti'}</small>
        </summary>
        ${renderFldaPanel()}
      </details>

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
            data-transfer-grid-double
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
          <article class="data-transfer-card">
            <div class="data-transfer-card-header">
              <div class="data-transfer-icon data-transfer-icon-export">↑</div>
              <span class="data-transfer-status ${hasCurrentAuctionData ? 'status-ready' : 'status-neutral'}">${hasCurrentAuctionData ? 'Pronto' : 'Vuoto'}</span>
            </div>
            <div class="data-transfer-card-body">
              <h3>Rose per l'app della stagione</h3>
              <p>Il file da importare nell'app che gestisce campionato e competizioni: per ogni squadra ID fantacalcio e prezzo. Prima controlla che non manchi nulla.</p>
            </div>
            <div class="data-transfer-card-footer">
              <div><span>Formato</span><strong>CSV rose · $,$,$</strong></div>
              <button type="button" class="data-transfer-button ${hasCurrentAuctionData ? 'data-transfer-button-primary' : ''}" data-export-league ${hasCurrentAuctionData ? '' : 'disabled'}>Esporta rose</button>
            </div>
          </article>
        </div>
      </section>
      <section class="data-transfer-section">
        <div class="data-transfer-section-header">
          <div>
            <span class="data-transfer-eyebrow">Export analisi</span>
            <h2>Valutazioni giocatori</h2>
            <p>Tutti i giocatori del listone con iCà, posizione nel ruolo, Affare, PMA e titolarità, da aprire con Excel.</p>
          </div>
        </div>
        <div class="data-transfer-grid data-transfer-grid-single">
          <article class="data-transfer-card">
            <div class="data-transfer-card-header">
              <div class="data-transfer-icon data-transfer-icon-export">↑</div>
              <span class="data-transfer-status status-ready">Pronto</span>
            </div>
            <div class="data-transfer-card-body">
              <h3>iCà e affari</h3>
              <p>Una riga per giocatore, ordinata per ruolo e iCà. Utile per preparare l'asta o confrontare le valutazioni.</p>
            </div>
            <div class="data-transfer-card-footer">
              <div><span>Formato</span><strong>CSV · separatore ;</strong></div>
              <button id="exportPlayerRatingsButton" type="button" class="data-transfer-button data-transfer-button-primary">Esporta valutazioni</button>
            </div>
          </article>
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

function bindImportExportEvents():
  void {
  if (
    importExportEventsBound
  ) {
    return
  }

  importExportEventsBound =
    true

  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('#exportPlayerRatingsButton')) exportPlayerRatings()
  })
  bindCsvUpload()

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

      if (target.closest('[data-export-league]')) {
        exportLeagueRosters()
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
