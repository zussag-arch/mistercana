import './style.css'

import './styles/dashboard.css'
import './styles/auction.css'
import './styles/competitors.css'
import './styles/players.css'
import './styles/playerDetail.css'
import './styles/objectives.css'
import './styles/insights.css'
import './styles/importExport.css'
import './styles/fonts.css'
import './styles/theme-v3.css'
import './styles/theme-v3-auction.css'
import './styles/theme-v3-dashboard.css'
import './styles/theme-v3-objectives.css'
import './styles/theme-v3-data.css'
import './styles/theme-light.css'
import './styles/theme-refine.css'
import './styles/theme-mobile.css'
import './styles/app-shell.css'
import { initTheme } from './theme'
import { initRoundSelects } from './components/roundSelect'
import { initAuctionShortcuts } from './components/auctionShortcuts'
import { initMobileApp } from './components/mobileApp'
import { initInstallPrompt } from './components/installPrompt'

initTheme()
initRoundSelects()
initAuctionShortcuts()
initMobileApp()
initInstallPrompt()

import {
  renderNavigation,
} from './components/navigation'

import {
  renderDashboardPage,
  bindDashboardEvents,
} from './pages/dashboard'

import {
  renderAuctionPage,
  bindAuctionEvents,
} from './pages/auction'

import {
  renderPlayersPage,
  bindPlayersEvents,
  setPlayersRoleFilter,
} from './pages/players'

import {
  renderFullPlayerPage,
  bindFullPlayerPage,
} from './pages/playerDetail'

import {
  renderObjectivesPage,
  bindObjectivesEvents,
} from './pages/objectives'

import {
  renderInsightsPage,
  bindInsightsEvents,
} from './pages/insights'
import { bindRosterEvents, renderRosterPage } from './pages/roster'
import './styles/roster.css'

import {
  renderImportExportPage,
} from './pages/importExport'

import {
  players,
} from './data/players'
import { getCachedPlayersDataset, loadPlayersDataset } from './services/playerRepository'
import { isFldaPlayerAssigned } from './services/auctionPlayerResolver'
import { buildAuctionStrategyContext } from './services/auctionStrategyAdapter'

import {
  renderCompetitorAnalysis,
} from './domain/competitorAnalysis'

import {
  loadState,
  saveState,
} from './app/storage'

import {
  getActivePage,
  navigateTo,
} from './app/router'

import {
  initializeFavicon,
  syncFavicon,
} from './app/favicon'

import type {
  PageId,
} from './components/navigation'

const state =
  loadState()

let selectedPlayerReference: string | null = null

initializeFavicon(
  state.auctionPhase ===
    'live',
)

/* =========================
   HELPERS
========================= */

function getBudgetTotal():
  number {
  return (
    state.budgetDistribution.P +
    state.budgetDistribution.D +
    state.budgetDistribution.C +
    state.budgetDistribution.A
  )
}

function getActiveManagersCount():
  number {
  return state.managers.filter(
    (manager) =>
      manager.active &&
      !manager.archived,
  ).length
}

function createArchiveId():
  string {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID()
  }

  return [
    'auction',
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2),
  ].join('_')
}

/* =========================
   PAGE CONTENT
========================= */

function getPageContent(
  page: PageId,
): string {
  switch (page) {
    case 'dashboard':
      return renderDashboardPage(
        state,
      )

    case 'auction':
      return renderAuctionPage(
        state,
      )

    case 'players':
      return renderPlayersPage(
        state,
      )

    case 'playerDetail':
      return renderFullPlayerPage(
        selectedPlayerReference,
        state,
      )

    case 'objectives':
      return renderObjectivesPage(
        state,
      )

    case 'roster':
      return renderRosterPage()

    case 'insights':
      return renderInsightsPage()

    case 'importExport':
      return renderImportExportPage()
  }
}

/* =========================
   COMPACT PAGE CHROME
========================= */

function isActionElement(
  element: Element,
): boolean {
  return (
    element.matches(
      'button, input, select',
    ) ||
    Boolean(
      element.querySelector(
        'button, input, select',
      ),
    )
  )
}

function moveElementToTopbar(
  element:
    | Element
    | null,
  target: HTMLElement,
): void {
  if (!element) {
    return
  }

  target.appendChild(
    element,
  )
}

/* =========================
   GENERIC PAGE HEADING
========================= */

function compactGenericPageHeading(
  target: HTMLElement,
): void {
  const heading =
    document.querySelector<HTMLElement>(
      '.page-heading',
    )

  if (!heading) {
    return
  }

  Array.from(
    heading.children,
  ).forEach(
    (child) => {
      if (
        isActionElement(
          child,
        )
      ) {
        moveElementToTopbar(
          child,
          target,
        )
      }
    },
  )

  heading.remove()
}

/* =========================
   DASHBOARD
========================= */

function compactDashboardChrome(
  target: HTMLElement,
): void {
  const hero =
    document.querySelector<HTMLElement>(
      '.dashboard-hero',
    )

  if (!hero) {
    return
  }

  const recapButton =
    hero.querySelector<HTMLElement>(
      '#openRecapButton',
    )

  moveElementToTopbar(
    recapButton,
    target,
  )

  hero.remove()
}

/* =========================
   AUCTION
========================= */

function compactAuctionChrome(
  target: HTMLElement,
): void {
  const toolbar =
    document.querySelector<HTMLElement>(
      '.auction-live-toolbar',
    )

  if (!toolbar) {
    return
  }

  if (
    state.auctionPhase ===
    'live'
  ) {
    const roleSwitcher =
      toolbar.querySelector<HTMLElement>(
        '.auction-role-switcher',
      )

    const ownerCredits =
      toolbar.querySelector<HTMLElement>(
        '.auction-toolbar-stat',
      )

    const actions =
      toolbar.querySelector<HTMLElement>(
        '.auction-toolbar-actions',
      )

    moveElementToTopbar(
      roleSwitcher,
      target,
    )

    moveElementToTopbar(
      ownerCredits,
      target,
    )

    moveElementToTopbar(
      actions,
      target,
    )
  }

  toolbar.remove()
}

/* =========================
   PLAYERS
========================= */

function compactPlayersChrome(
  target: HTMLElement,
): void {
  const header =
    document.querySelector<HTMLElement>(
      '.players-page-header',
    )

  if (!header) {
    return
  }

  /*
    Conserviamo soltanto il
    collegamento rapido all'Asta.

    DATABASE 2026/27,
    titolo, descrizione e conteggio
    superiore sono ridondanti.

    Il conteggio rimane comunque
    disponibile nel footer della
    pagina Giocatori.
  */
  const auctionButton =
    header.querySelector<HTMLElement>(
      '#playersGoToAuctionButton',
    )

  moveElementToTopbar(
    auctionButton,
    target,
  )

  header.remove()
}

/* =========================
   OBJECTIVES
========================= */

function compactObjectivesChrome(
  target: HTMLElement,
): void {
  const header =
    document.querySelector<HTMLElement>(
      '.objectives-page-header',
    )

  if (!header) {
    return
  }

  /*
    Il totale obiettivi è una
    informazione operativa breve:
    lo conserviamo in topbar.

    Conserviamo anche il pulsante
    Asta.

    Titolo, eyebrow e descrizione
    vengono invece eliminati.
  */
  const total =
    header.querySelector<HTMLElement>(
      '.objectives-total',
    )

  const auctionButton =
    header.querySelector<HTMLElement>(
      '#objectivesGoToAuctionButton',
    )

  moveElementToTopbar(
    total,
    target,
  )

  moveElementToTopbar(
    auctionButton,
    target,
  )

  header.remove()
}

/* =========================
   INSIGHTS
========================= */

function compactInsightsChrome():
  void {
  const header =
    document.querySelector<HTMLElement>(
      '.insights-page-header',
    )

  /*
    Insights non contiene azioni
    operative nella testata.

    La pagina può quindi partire
    direttamente dal primo blocco:
    Abbinamenti portieri.
  */
  header?.remove()
}

/* =========================
   IMPORT / EXPORT
========================= */

function compactImportExportChrome():
  void {
  const header =
    document.querySelector<HTMLElement>(
      '.import-export-page-header',
    )

  /*
    Anche qui la testata contiene
    soltanto titolo e descrizione.

    Il primo contenuto utile diventa
    direttamente IMPORT / Carica dati.
  */
  header?.remove()
}

/* =========================
   PAGE CHROME CONTROLLER
========================= */

function compactPageChrome(
  page: PageId,
): void {
  const target =
    document.querySelector<HTMLElement>(
      '#topbarPageActions',
    )

  if (!target) {
    return
  }

  switch (page) {
    case 'dashboard':
      compactDashboardChrome(
        target,
      )
      break

    case 'auction':
      compactAuctionChrome(
        target,
      )
      break

    case 'players':
      compactPlayersChrome(
        target,
      )
      break

    case 'playerDetail':
      break

    case 'objectives':
      compactObjectivesChrome(
        target,
      )
      break

    case 'insights':
      compactInsightsChrome()
      break

    case 'importExport':
      compactImportExportChrome()
      break
  }

  /*
    Compatibilità con eventuali
    pagine/componenti che utilizzano
    ancora la vecchia classe generica.
  */
  compactGenericPageHeading(
    target,
  )
}

/* =========================
   AUCTION COMPETITORS
========================= */

function mountAuctionCompetitors(
  page: PageId,
): void {
  if (
    page !== 'auction' ||
    state.auctionPhase !==
      'live'
  ) {
    return
  }

  const strategy = buildAuctionStrategyContext(
    state,
    getCachedPlayersDataset(),
  )
  const player = strategy.currentPlayer

  if (!player) {
    return
  }

  /*
    Le tessere concorrenti vengono
    inserite nella colonna principale
    dell'Asta sotto il blocco
    giocatore/prezzo.
  */
  const workspaceMain =
    document.querySelector<HTMLElement>(
      '.auction-workspace-main',
    )

  if (!workspaceMain) {
    return
  }

  const markup =
    renderCompetitorAnalysis(
      strategy.state,
      player,
      strategy.players,
    )

  if (!markup.trim()) {
    return
  }

  // sopra lo storico assegnazioni, se presente
  const historySlot =
    workspaceMain.querySelector<HTMLElement>(
      '.auction-history-slot',
    )

  if (historySlot) {
    historySlot.insertAdjacentHTML('beforebegin', markup)
  } else {
    workspaceMain.insertAdjacentHTML('beforeend', markup)
  }
}

/* =========================
   SAVE / NAVIGATION
========================= */

function saveAndRender():
  void {
  const saved =
    saveState(state)

  render()

  if (!saved) {
    showSaveWarning()
  }
}

// avviso ben visibile se il telefono non riesce a salvare
function showSaveWarning(): void {
  if (document.querySelector('.save-warning')) return
  const warning = document.createElement('div')
  warning.className = 'save-warning'
  warning.setAttribute('role', 'alert')
  warning.innerHTML = "<strong>Salvataggio non riuscito</strong> La memoria del dispositivo è piena o bloccata. Le modifiche restano finché l'app è aperta: esporta un backup da Dati."
  document.body.append(warning)
  window.setTimeout(() => warning.remove(), 9000)
}

function navigateAndRender(
  page: PageId,
): void {
  navigateTo(page)

  render()
}

/* =========================
   PLAYER -> AUCTION
========================= */

function callPlayerInAuction(
  playerId: string,
): void {
  if (
    state.auctionPhase !==
    'live'
  ) {
    return
  }

  const dataset = getCachedPlayersDataset()
  const fldaPlayer = dataset?.source === 'flda'
    ? dataset.byId.get(playerId)
    : undefined

  if (fldaPlayer) {
    if (isFldaPlayerAssigned(state.auctionAssignments, playerId)) return
    state.currentAuctionFldaPlayerId = playerId
    state.currentAuctionPlayerId = null
    navigateTo('auction')
    saveState(state)
    render()
    return
  }

  const player = players.find((item) => item.id === playerId)
  if (!player) return

  const alreadyAssigned =
    state.auctionAssignments.some(
      (assignment) =>
        assignment.playerId ===
        playerId,
    )

  if (alreadyAssigned) {
    return
  }

  state.currentAuctionPlayerId =
    playerId
  state.currentAuctionFldaPlayerId = null

  navigateTo('auction')

  saveState(state)

  render()
}

/* =========================
   AUCTION LIFECYCLE
========================= */

function startAuction():
  void {
  if (
    state.auctionPhase !==
    'setup'
  ) {
    return
  }

  if (
    getBudgetTotal() !==
    100
  ) {
    return
  }

  if (
    getActiveManagersCount() <
    1
  ) {
    return
  }

  state.auctionAssignments = []

  state.currentAuctionPlayerId =
    null
  state.currentAuctionFldaPlayerId = null

  state.auctionPhase =
    'live'

  navigateTo('auction')

  saveState(state)

  render()
}

function endAuction():
  void {
  if (
    state.auctionPhase !==
    'live'
  ) {
    return
  }

  state.auctionPhase =
    'finalizing'

  saveState(state)

  render()
}

function archiveAuction():
  void {
  if (
    state.auctionPhase !==
    'finalizing'
  ) {
    return
  }

  state.archivedAuctions.push({
    id:
      createArchiveId(),

    archivedAt:
      new Date()
        .toISOString(),

    assignments:
      state.auctionAssignments.map(
        (assignment) => ({
          ...assignment,
        }),
      ),
  })

  state.auctionAssignments = []

  state.currentAuctionPlayerId =
    null
  state.currentAuctionFldaPlayerId = null

  state.auctionPhase =
    'setup'

  navigateTo('dashboard')

  saveState(state)

  render()
}

function discardAuction():
  void {
  if (
    state.auctionPhase !==
    'finalizing'
  ) {
    return
  }

  state.auctionAssignments = []

  state.currentAuctionPlayerId =
    null
  state.currentAuctionFldaPlayerId = null

  state.auctionPhase =
    'setup'

  navigateTo('dashboard')

  saveState(state)

  render()
}

/* =========================
   PAGE EVENTS
========================= */

function bindPageEvents(
  page: PageId,
): void {
  switch (page) {
    case 'dashboard':
      bindDashboardEvents(
        state,
        {
          onStateChange:
            saveAndRender,

          onStartAuction:
            startAuction,
        },
      )

      break

    case 'auction':
      bindAuctionEvents(
        state,
        {
          onEndAuction:
            endAuction,

          onArchiveAuction:
            archiveAuction,

          onDiscardAuction:
            discardAuction,

          onStateChange:
            saveAndRender,

          onRender:
            render,

          onGoToPlayers:
            (role) => {
              setPlayersRoleFilter(role)
              navigateAndRender(
                'players',
              )
            },

          onGoToObjectives:
            () => {
              navigateAndRender(
                'objectives',
              )
            },

          onOpenFullPlayer:
            (reference) => {
              selectedPlayerReference = reference
              navigateAndRender('playerDetail')
            },
        },
      )

      break

    case 'players':
      bindPlayersEvents(
        state,
        {
          onRender:
            render,

          onCallPlayer:
            callPlayerInAuction,

          onOpenFullPlayer:
            (reference) => {
              selectedPlayerReference =
                reference

              navigateAndRender(
                'playerDetail',
              )
            },

          onGoToAuction:
            () => {
              if (
                state.auctionPhase !==
                'live'
              ) {
                return
              }

              navigateAndRender(
                'auction',
              )
            },
        },
      )

      break

    case 'playerDetail':
      bindFullPlayerPage(
        selectedPlayerReference,
        {
          onBack: () =>
            navigateAndRender(
              'players',
            ),

          onRender:
            render,

          onCallPlayer:
            callPlayerInAuction,
        },
      )

      break

    case 'objectives':
      bindObjectivesEvents(
        state,
        {
          onStateChange:
            saveAndRender,

          onGoToAuction:
            () => {
              if (
                state.auctionPhase !==
                'live'
              ) {
                return
              }

              navigateAndRender(
                'auction',
              )
            },
        },
      )

      break

    case 'roster':
      bindRosterEvents({
        onRender: render,
        onOpenPlayer: (reference) => {
          selectedPlayerReference = reference
          navigateAndRender('playerDetail')
        },
      })
      if (!getCachedPlayersDataset()) {
        void loadPlayersDataset().then(() => render())
      }

      break

    case 'insights':
      bindInsightsEvents()

      break

    case 'importExport':
      /*
        La pagina Import / Export
        attuale è puramente visiva:
        non espone ancora eventi
        applicativi.
      */
      break
  }
}

/* =========================
   GLOBAL NAVIGATION
========================= */

function bindNavigationEvents():
  void {
  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-page]',
    )
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            const page =
              button.dataset
                .page as
                | PageId
                | undefined

            if (
              !page ||
              button.disabled
            ) {
              return
            }

            navigateAndRender(
              page,
            )
          },
        )
      },
    )
}

/* =========================
   RENDER
========================= */

function render():
  void {
  const activePage =
    getActivePage()

  syncFavicon(
    state.auctionPhase ===
      'live',
  )

  const app =
    document.querySelector<HTMLElement>(
      '#app',
    )

  if (!app) {
    return
  }

  // la pagina attiva (data-view) decide se il contenuto è fisso (Dashboard, Asta, Rosa) o scorre.
  // L'attributo sta su un contenitore ricreato a ogni disegno: cambiarlo sul documento
  // rallentava progressivamente il browser a ogni cambio pagina.
  // ridisegnando la stessa pagina si resta dove si era: l'area contenuti e i riquadri interni
  // che scorrono (colonne di Asta, Rosa, Dashboard su computer) tornerebbero altrimenti in cima
  const scrollers = ['.app-main', '.auction-workspace-main', '.auction-side-panels', '.roster-section', '.dashboard-page > div', '.dashboard-participants']
  const samePage = app.querySelector<HTMLElement>('.app-shell')?.dataset.view === activePage
  const savedScroll = samePage
    ? scrollers.map((selector) => [...app.querySelectorAll<HTMLElement>(selector)].map((element) => element.scrollTop))
    : []

  app.innerHTML = `<div class="app-shell" data-view="${activePage}">
    ${renderNavigation(
      activePage,
      state.auctionPhase,
    )}

    <main class="app-main">
      ${getPageContent(
        activePage,
      )}
    </main>
  </div>`

  // a disegno finito (dopo lo spostamento delle azioni e la rimozione delle testate doppie)
  queueMicrotask(() => savedScroll.forEach((values, which) => {
    app.querySelectorAll<HTMLElement>(scrollers[which]).forEach((element, index) => {
      if (values[index]) element.scrollTop = values[index]
    })
  }))

  /*
    ORDINE IMPORTANTE

    1. Render della pagina.

    2. Spostamento delle azioni
       utili nella topbar e rimozione
       delle testate ridondanti.

    3. Inserimento delle tessere
       concorrenti nell'Asta.

    4. Binding degli eventi.

    In questo modo gli elementi
    conservano gli ID originali
    e i binder delle pagine li
    trovano nella nuova posizione.
  */

  compactPageChrome(
    activePage,
  )

  mountAuctionCompetitors(
    activePage,
  )

  bindNavigationEvents()

  bindPageEvents(
    activePage,
  )
}

render()

// niente zoom col pizzico (iOS ignora user-scalable=no in alcuni casi)
for (const name of ['gesturestart', 'gesturechange']) {
  document.addEventListener(name, (event) => event.preventDefault(), { passive: false })
}

// chiede al dispositivo di non cancellare i dati dell'app quando manca spazio
if (navigator.storage?.persist) {
  void navigator.storage.persisted().then((already) => (already ? true : navigator.storage.persist())).catch(() => false)
}

// PWA: registra il service worker solo nella versione pubblicata
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        // passa al service worker i file già caricati: copia offline completa dal primo avvio
        const urls = [
          window.location.origin + import.meta.env.BASE_URL,
          ...performance.getEntriesByType('resource').map((entry) => entry.name),
        ].filter((url) => url.startsWith(window.location.origin + import.meta.env.BASE_URL))
        registration.active?.postMessage({ type: 'precache', urls })
      })
      .catch(() => { /* senza copia offline l'app funziona lo stesso */ })
  })
}
