import './style.css'

import { renderNavigation, type PageId } from './components/navigation'

import { renderDashboardPage } from './pages/dashboard'
import { renderAuctionPage } from './pages/auction'
import { renderPlayersPage } from './pages/players'
import { renderObjectivesPage } from './pages/objectives'
import { renderInsightsPage } from './pages/insights'
import { renderImportExportPage } from './pages/importExport'

let activePage: PageId = 'dashboard'
let auctionLive = false

const appElement = document.querySelector<HTMLDivElement>('#app')

if (!appElement) {
  throw new Error('Elemento #app non trovato')
}

const app = appElement

function getPageContent(page: PageId): string {
  switch (page) {
    case 'dashboard':
      return renderDashboardPage()

    case 'auction':
      return renderAuctionPage(auctionLive)

    case 'players':
      return renderPlayersPage()

    case 'objectives':
      return renderObjectivesPage()

    case 'insights':
      return renderInsightsPage()

    case 'importExport':
      return renderImportExportPage()

    default:
      return renderDashboardPage()
  }
}

function render(): void {
  app.innerHTML = `
    ${renderNavigation(activePage, auctionLive)}

    <main class="app-content">
      ${getPageContent(activePage)}
    </main>
  `

  document
    .querySelectorAll<HTMLButtonElement>('[data-page]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const page = button.dataset.page as PageId | undefined

        if (!page) {
          return
        }

        activePage = page
        render()
      })
    })
}

render()