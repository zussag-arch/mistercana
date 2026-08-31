import './style.css'
import './styles/dashboard.css'
import './styles/players.css'
import './styles/objectives.css'
import './styles/insights.css'
import './styles/importExport.css'
import './styles/auction.css'

import {
  renderNavigation,
  type PageId,
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
} from './pages/insights'

import {
  renderImportExportPage,
} from './pages/importExport'

import {
  players,
} from './data/players'

import {
  loadState,
  saveState,
} from './app/storage'

import {
  getActivePage,
  isActivePage,
  navigateTo,
} from './app/router'

const state =
  loadState()

const appElement =
  document.querySelector<HTMLDivElement>(
    '#app',
  )

if (!appElement) {
  throw new Error(
    'Elemento #app non trovato',
  )
}

const app =
  appElement

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

    default:
      return renderDashboardPage(
        state,
      )
  }
}

function saveAndRender(): void {
  saveState(
    state,
  )

  render()
}

function navigateAndRender(
  page: PageId,
): void {
  navigateTo(
    page,
  )

  render()
}

function callPlayerInAuction(
  playerId: string,
): void {
  if (
    state.auctionPhase !==
    'live'
  ) {
    return
  }

  const playerExists =
    players.some(
      (player) =>
        player.id ===
        playerId,
    )

  if (!playerExists) {
    return
  }

  state.currentAuctionPlayerId =
    playerId

  navigateTo(
    'auction',
  )

  saveAndRender()
}

function startAuction(): void {
  const total =
    state.budgetDistribution.P +
    state.budgetDistribution.D +
    state.budgetDistribution.C +
    state.budgetDistribution.A

  const activeManagers =
    state.managers.filter(
      (manager) =>
        !manager.archived &&
        manager.active,
    )

  if (
    total !== 100
  ) {
    return
  }

  if (
    activeManagers.length === 0
  ) {
    return
  }

  state.auctionPhase =
    'live'

  state.currentAuctionPlayerId =
    null

  navigateTo(
    'auction',
  )

  saveAndRender()
}

function endAuction(): void {
  state.auctionPhase =
    'finalizing'

  state.currentAuctionPlayerId =
    null

  navigateTo(
    'auction',
  )

  saveAndRender()
}

function archiveAuction(): void {
  state.auctionPhase =
    'archived'

  state.currentAuctionPlayerId =
    null

  navigateTo(
    'auction',
  )

  saveAndRender()
}

function discardAuction(): void {
  state.auctionPhase =
    'discarded'

  state.currentAuctionPlayerId =
    null

  navigateTo(
    'auction',
  )

  saveAndRender()
}

function newAuction(): void {
  state.auctionPhase =
    'setup'

  state.currentAuctionPlayerId =
    null

  navigateTo(
    'dashboard',
  )

  saveAndRender()
}

function bindPageEvents(): void {
  if (
    isActivePage(
      'dashboard',
    )
  ) {
    bindDashboardEvents(
      state,
      {
        onStateChange:
          saveAndRender,

        onStartAuction:
          startAuction,
      },
    )
  }

  if (
    isActivePage(
      'auction',
    )
  ) {
    bindAuctionEvents(
      state,
      {
        onEndAuction:
          endAuction,

        onArchiveAuction:
          archiveAuction,

        onDiscardAuction:
          discardAuction,

        onNewAuction:
          newAuction,

        onStateChange:
          saveAndRender,

        onRender:
          render,
      },
    )
  }

  if (
    isActivePage(
      'players',
    )
  ) {
    bindPlayersEvents(
      state,
      {
        onRender:
          render,

        onCallPlayer:
          callPlayerInAuction,
      },
    )
  }

  if (
    isActivePage(
      'objectives',
    )
  ) {
    bindObjectivesEvents(
      state,
      {
        onStateChange:
          saveAndRender,
      },
    )
  }
}

function bindNavigation(): void {
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

function render(): void {
  const activePage =
    getActivePage()

  app.innerHTML = `
    ${renderNavigation(
      activePage,
      state.auctionPhase,
    )}

    <main class="app-content">
      ${getPageContent(
        activePage,
      )}
    </main>
  `

  bindNavigation()
  bindPageEvents()
}

render()