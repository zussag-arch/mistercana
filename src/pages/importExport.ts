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
import bundledRivalsCsv from '../../database/avversari.csv?raw'
import { CSV_LABELS, clearCsvOverrides, getCsv, getCsvOverrides, saveCsvOverrides } from '../data/csvOverrides'
import type { CsvKey, CsvOverride } from '../data/csvOverrides'
import { analyzeCsv } from '../data/csvImport'
import type { CsvAnalysis } from '../data/csvImport'
import { getDataSources, getLastDataUpdate } from '../data/dataSources'
import { getICaV3Results } from '../data/icaV3Data'
import { icaVersion, setIcaVersion } from '../data/icaVersion'
import { localPlayers } from '../services/fantalabLocal'
import { getCachedPlayersDataset } from '../services/playerRepository'
import { getAssignmentFldaId } from '../services/auctionPlayerResolver'
import { profileForManager, removeRival, renameRival, rivalProfiles } from '../data/rivals'
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
  isFldaLocalMode,
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

/* =========================
   LOCAL UI STATE
========================= */

let feedback:
  FeedbackState | null = null

let pendingRestore:
  PendingRestore | null = null

let importExportEventsBound =
  false

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
          <div class="ica-version-switch" role="group" aria-label="Indice di valutazione"><span>Indice di valutazione</span>
            <button type="button" data-ica-version="v3" aria-pressed="${icaVersion() === 'v3'}">iCà 3</button>
            <button type="button" data-ica-version="v4" aria-pressed="${icaVersion() === 'v4'}">iCà 4 <small>in prova</small></button>
          </div>
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
  avversari: bundledRivalsCsv,
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

/* =========================
   ANAGRAFICA AVVERSARI
========================= */

const pctDiff = (index: number) => { const value = Math.round((index - 1) * 100); return value === 0 ? "0%" : `${value > 0 ? "+" : "−"}${Math.abs(value)}%` }

type Profile = ReturnType<typeof rivalProfiles> extends Map<string, infer P> ? P : never

interface RivalTile {
  nickname: string
  profile?: Profile
  manager?: Manager
}

function rivalTiles(state: AppState): RivalTile[] {
  const managers = state.managers.filter((manager) => !manager.archived)
  const tiles: RivalTile[] = [...rivalProfiles().values()].map((profile) => ({
    nickname: profile.nickname,
    profile,
    manager: managers.find((manager) => profileForManager(manager)?.nickname === profile.nickname),
  }))
  // allenatori senza storico (nuovi ingressi aggiunti da qui o già presenti in Dashboard)
  for (const manager of managers) {
    if (!tiles.some((tile) => tile.manager?.id === manager.id)) tiles.push({ nickname: manager.alias || manager.firstName, manager })
  }
  const isMe = (tile: RivalTile) => Number(Boolean(tile.profile?.me || tile.manager?.isOwner))
  return tiles.sort((a, b) => isMe(b) - isMe(a)
    || Number(Boolean(b.manager)) - Number(Boolean(a.manager))
    || tileTitle(a).localeCompare(tileTitle(b), 'it'))
}

function tileTitle(tile: RivalTile): string {
  const latest = tile.profile ? [...tile.profile.teams].sort((a, b) => a.season.localeCompare(b.season)).at(-1)?.team : undefined
  return tile.manager?.teamName || latest || tile.nickname
}

function renderRivalTile(tile: RivalTile): string {
  const { profile, manager } = tile
  const me = Boolean(profile?.me || manager?.isOwner)
  const roles = ['P', 'D', 'C', 'A'] as const
  const person = manager ? [manager.firstName, manager.lastName].filter(Boolean).join(' ') : ''
  const id = escapeSourceHtml(tile.nickname)
  // titolo = nome della squadra (si cambia solo da ⋯ → Gestisci profilo); sotto nome e cognome
  const latestTeam = profile ? [...profile.teams].sort((a, b) => a.season.localeCompare(b.season)).at(-1)?.team : undefined
  const title = escapeSourceHtml(manager?.teamName || latestTeam || tile.nickname)
  const subtitle = person ? escapeSourceHtml(person) : 'Profilo da completare'
  return `<article class="rival-card${me ? ' is-me' : ''}${manager ? ' is-coach' : ''}">
    <header>
      <div class="rival-title"><h3>${title}</h3><p>${subtitle}</p></div>
      ${me ? '<span class="rival-tag">Tu</span>' : manager ? '<span class="rival-tag linked">Allenatore</span>' : ''}
      <div class="rival-menu">
        <button type="button" class="rival-menu-button" data-rival-menu aria-label="Gestisci ${title}">⋯</button>
        <div class="rival-menu-list" hidden>
          <button type="button" data-rival-edit="${id}" data-manager-id="${manager?.id ?? ''}">Gestisci profilo</button>
          <button type="button" class="danger" data-rival-delete="${id}" data-manager-id="${manager?.id ?? ''}">Elimina profilo</button>
        </div>
      </div>
    </header>
    ${profile ? `
      <p class="rival-history">Storico: <b>${profile.seasons.length} ${profile.seasons.length === 1 ? 'stagione' : 'stagioni'}</b> in archivio</p>
      <div class="rival-index"><span>Spesa rispetto alla lega</span><strong class="${profile.spendIndex >= 1.05 ? 'up' : profile.spendIndex <= 0.95 ? 'down' : ''}">${pctDiff(profile.spendIndex)}</strong><small>${profile.comparisons} confronti</small></div>
      <div class="rival-roles">${roles.map((role) => `<div><span class="role-${role.toLowerCase()}">${role}</span><strong>${pctDiff(profile.spendIndexByRole[role])}</strong><small>${Math.round(profile.distribution[role])}% budget</small></div>`).join('')}</div>
      <p class="rival-traits">Top 3: <b>${Math.round(profile.topThreeShare * 100)}%</b> dei crediti · a 1 credito: <b>${Math.round(profile.oneCreditShare * 100)}%</b> dei giocatori</p>`
    : '<p class="rival-empty">Nessuna asta registrata: il profilo si costruisce dalla prossima.</p>'}
  </article>`
}

function renderRivalsSection(state: AppState): string {
  const tiles = rivalTiles(state)
  const coaches = tiles.filter((tile) => tile.manager).length
  return `<section class="data-transfer-section rivals-section">
    <div class="data-transfer-section-header">
      <div>
        <span class="data-transfer-eyebrow">Allenatori e storico</span>
        <h2>Anagrafica avversari</h2>
        <p>Ogni persona con le sue squadre negli anni e come si comporta in asta. Da ⋯ → Gestisci profilo inserisci soprannome (è l'ID, quello tra virgolette), nome e squadra: il profilo diventa un allenatore della Dashboard.</p>
      </div>
      <div class="rivals-header-actions">
        <span class="data-transfer-status status-ready">${coaches} allenatori · ${tiles.length} profili</span>
        <button type="button" class="data-transfer-button data-transfer-button-primary" data-rival-add>Aggiungi allenatore</button>
      </div>
    </div>
    <div class="rivals-grid">${tiles.map(renderRivalTile).join('')}</div>
    <div id="rivalOverlay" class="overlay hidden" aria-hidden="true">
      <div class="overlay-backdrop" data-rival-close></div>
      <form id="rivalForm" class="overlay-card rival-form" autocomplete="off">
        <div class="overlay-header"><h2 id="rivalFormTitle">Profilo</h2><button type="button" class="icon-button" data-rival-close aria-label="Chiudi">×</button></div>
        <input type="hidden" name="original"><input type="hidden" name="managerId">
        <label><span>Soprannome (ID)</span><input name="nickname" required maxlength="40" placeholder="es. Brosky"></label>
        <div class="rival-form-row">
          <label><span>Nome</span><input name="firstName" required maxlength="40" placeholder="es. Ivan"></label>
          <label><span>Cognome</span><input name="lastName" maxlength="40" placeholder="es. Sordi"></label>
        </div>
        <label><span>Nome squadra</span><input name="teamName" maxlength="60" placeholder="es. Arcamado"></label>
        <label class="rival-form-check"><input type="checkbox" name="me"> <span>Sono io</span></label>
        <div class="overlay-actions"><button type="button" class="secondary-button" data-rival-close>Annulla</button><button type="submit" class="primary-button">Salva</button></div>
      </form>
    </div>
  </section>`
}

/** modifica lo stato dell'app (vive in main.ts): salva e ridisegna */
function updateAppState(update: (current: AppState) => void): void {
  document.dispatchEvent(new CustomEvent('mistercana:update-state', { detail: update }))
}

function rivalField(form: HTMLFormElement, name: string): HTMLInputElement {
  return form.elements.namedItem(name) as HTMLInputElement
}

function openRivalForm(nickname: string, managerId: string): void {
  const form = document.querySelector<HTMLFormElement>('#rivalForm')
  const overlay = document.querySelector<HTMLElement>('#rivalOverlay')
  if (!form || !overlay) return
  const manager = loadState().managers.find((item) => item.id === managerId)
  const profile = nickname ? rivalProfiles().get(nickname) : undefined
  rivalField(form, 'original').value = profile ? nickname : ''
  rivalField(form, 'managerId').value = managerId
  rivalField(form, 'nickname').value = manager?.alias || nickname
  rivalField(form, 'firstName').value = manager?.firstName ?? ''
  rivalField(form, 'lastName').value = manager?.lastName ?? ''
  rivalField(form, 'teamName').value = manager?.teamName || profile?.teams.at(-1)?.team || ''
  rivalField(form, 'me').checked = Boolean(manager?.isOwner || profile?.me)
  const title = document.querySelector('#rivalFormTitle')
  if (title) title.textContent = nickname ? `Profilo · ${nickname}` : 'Nuovo allenatore'
  overlay.classList.remove('hidden')
  overlay.setAttribute('aria-hidden', 'false')
  rivalField(form, nickname ? 'firstName' : 'nickname').focus({ preventScroll: true })
}

function closeRivalForm(): void {
  const overlay = document.querySelector<HTMLElement>('#rivalOverlay')
  overlay?.classList.add('hidden')
  overlay?.setAttribute('aria-hidden', 'true')
}

function saveRivalForm(form: HTMLFormElement): void {
  const value = (name: string) => rivalField(form, name).value.replace(/[;"\r\n]/g, '').trim()
  const original = value('original')
  const managerId = value('managerId')
  const nickname = value('nickname')
  const firstName = value('firstName')
  if (!nickname || !firstName) return
  const me = rivalField(form, 'me').checked
  const taken = rivalTiles(loadState()).some((tile) =>
    tile.nickname.toLowerCase() === nickname.toLowerCase() && tile.nickname !== original && tile.manager?.id !== managerId)
  if (taken) {
    window.alert(`Il soprannome "${nickname}" è già usato da un altro profilo.`)
    return
  }
  if (original && original !== nickname) renameRival(original, nickname)
  closeRivalForm()
  updateAppState((state) => {
    if (me) state.managers.forEach((manager) => { manager.isOwner = false })
    const data = { alias: nickname, firstName, lastName: value('lastName'), teamName: value('teamName'), isOwner: me, archived: false }
    const manager = state.managers.find((item) => item.id === managerId)
    if (manager) Object.assign(manager, data)
    else state.managers.push({ id: `manager-${Date.now().toString(36)}`, active: true, ...data })
  })
}

function deleteRival(nickname: string, managerId: string): void {
  const message = `Eliminare il profilo "${nickname}"?\n\nSparisce dall'anagrafica e dagli allenatori della Dashboard. Le sue aste restano nello storico, ma non più collegate a lui.`
  if (!window.confirm(message)) return
  removeRival(nickname)
  updateAppState((state) => {
    const index = state.managers.findIndex((item) => item.id === managerId)
    if (index < 0) return
    // con acquisti già registrati l'allenatore resta nell'asta, ma archiviato
    if (state.auctionAssignments.some((item) => item.managerId === managerId)) state.managers[index].archived = true
    else state.managers.splice(index, 1)
  })
}

let rivalsBound = false

function bindRivals(): void {
  if (rivalsBound) return
  rivalsBound = true
  const closeMenus = () => document.querySelectorAll<HTMLElement>('.rival-menu-list').forEach((menu) => { menu.hidden = true })
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (!target?.closest('.rivals-section')) {
      closeMenus()
      return
    }
    const menuButton = target.closest<HTMLElement>('[data-rival-menu]')
    if (menuButton) {
      const list = menuButton.nextElementSibling as HTMLElement | null
      const wasHidden = list?.hidden
      closeMenus()
      if (list && wasHidden) list.hidden = false
      return
    }
    closeMenus()
    const edit = target.closest<HTMLElement>('[data-rival-edit]')
    if (edit) return openRivalForm(edit.dataset.rivalEdit ?? '', edit.dataset.managerId ?? '')
    const remove = target.closest<HTMLElement>('[data-rival-delete]')
    if (remove) return deleteRival(remove.dataset.rivalDelete ?? '', remove.dataset.managerId ?? '')
    if (target.closest('[data-rival-add]')) return openRivalForm('', '')
    if (target.closest('[data-rival-close]')) closeRivalForm()
  })
  document.addEventListener('submit', (event) => {
    const form = event.target
    if (form instanceof HTMLFormElement && form.id === 'rivalForm') {
      event.preventDefault()
      saveRivalForm(form)
    }
  })
}

function bindCsvUpload(): void {
  bindRivals()
  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-ica-version]')
    if (!button) return
    const version = button.dataset.icaVersion === 'v4' ? 'v4' : 'v3'
    if (version === icaVersion()) return
    setIcaVersion(version)
    // tutti i calcoli (lista, Asta, consigli) ripartono con il nuovo indice
    window.location.reload()
  })
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
            Dati
          </h1>

          <p>
            Gestione dei dati principali
            di MisterCanà.
          </p>
        </div>
      </div>

      ${renderDataSourcesPanel()}

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
      ${renderRivalsSection(state)}
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
