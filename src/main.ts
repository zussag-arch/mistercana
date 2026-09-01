import './style.css'

import './styles/dashboard.css'
import './styles/auction.css'
import './styles/competitors.css'
import './styles/players.css'
import './styles/objectives.css'
import './styles/insights.css'
import './styles/importExport.css'

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
} from './pages/players'

import {
  renderObjectivesPage,
  bindObjectivesEvents,
} from './pages/objectives'

import {
  renderInsightsPage,
  bindInsightsEvents,
} from './pages/insights'

import {
  renderImportExportPage,
} from './pages/importExport'

import {
  players,
} from './data/players'

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

    case 'objectives':
      return renderObjectivesPage(
        state,
      )

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

  if (
    page === 'dashboard'
  ) {
    compactDashboardChrome(
      target,
    )
  }

  if (
    page === 'auction'
  ) {
    compactAuctionChrome(
      target,
    )
  }

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

  const playerId =
    state.currentAuctionPlayerId

  if (!playerId) {
    return
  }

  const player =
    players.find(
      (item) =>
        item.id ===
        playerId,
    )

  if (!player) {
    return
  }

  /*
    Inseriamo la fascia dentro
    la colonna principale del
    workspace.

    Quindi resta esattamente
    sotto il blocco giocatore /
    prezzo e prima della sezione
    Partecipanti, come nello
    screenshot.
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
      state,
      player,
      players,
    )

  if (!markup.trim()) {
    return
  }

  workspaceMain.insertAdjacentHTML(
    'beforeend',
    markup,
  )
}

/* =========================
   SAVE / NAVIGATION
========================= */

function saveAndRender():
  void {
  saveState(state)

  render()
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

  const player =
    players.find(
      (item) =>
        item.id ===
        playerId,
    )

  if (!player) {
    return
  }

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
            () => {
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

  app.innerHTML = `
    ${renderNavigation(
      activePage,
      state.auctionPhase,
    )}

    <main class="app-main">
      ${getPageContent(
        activePage,
      )}
    </main>
  `

  /*
    1. Spostiamo gli elementi
       della pagina nella topbar.

    2. Inseriamo le tessere
       concorrenti nella colonna
       principale dell'asta.

    3. Solo dopo colleghiamo
       tutti gli eventi.
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