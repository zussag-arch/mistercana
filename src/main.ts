import './style.css'

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
} from './pages/players'

import {
  renderObjectivesPage,
} from './pages/objectives'

import {
  renderInsightsPage,
} from './pages/insights'

import {
  renderImportExportPage,
} from './pages/importExport'

import {
  loadState,
  saveState,
} from './app/storage'

let activePage: PageId =
  'dashboard'

const state = loadState()

const appElement =
  document.querySelector<HTMLDivElement>(
    '#app',
  )

if (!appElement) {
  throw new Error(
    'Elemento #app non trovato',
  )
}

const app = appElement

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
      return renderPlayersPage()

    case 'objectives':
      return renderObjectivesPage()

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
  saveState(state)
  render()
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

  if (total !== 100) {
    return
  }

  if (
    activeManagers.length === 0
  ) {
    return
  }

  state.auctionPhase = 'live'

  activePage = 'auction'

  saveAndRender()
}

function endAuction(): void {
  state.auctionPhase =
    'finalizing'

  activePage = 'auction'

  saveAndRender()
}

function archiveAuction(): void {
  /*
    Qui verrà collegato il vero
    salvataggio storico quando
    costruiremo il dominio Asta.
  */

  state.auctionPhase =
    'archived'

  activePage = 'auction'

  saveAndRender()
}

function discardAuction(): void {
  /*
    Qui verranno eliminati i dati
    appartenenti esclusivamente alla
    sessione corrente quando esisterà
    il modello dati dell'asta.
  */

  state.auctionPhase =
    'discarded'

  activePage = 'auction'

  saveAndRender()
}

function newAuction(): void {
  /*
    La nuova asta riapre
    ESPLICITAMENTE la Dashboard.

    Non cambiamo manager,
    crediti o strategia:
    diventano la base modificabile
    della nuova configurazione.
  */

  state.auctionPhase = 'setup'

  activePage = 'dashboard'

  saveState(state)

  render()
}

function bindPageEvents(): void {
  if (
    activePage === 'dashboard'
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
    activePage === 'auction'
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
      },
    )
  }
}

function bindNavigation(): void {
  document
    .querySelectorAll<HTMLButtonElement>(
      '[data-page]',
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const page =
            button.dataset.page as
              | PageId
              | undefined

          if (
            !page ||
            button.disabled
          ) {
            return
          }

          activePage = page

          render()
        },
      )
    })
}

function render(): void {
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