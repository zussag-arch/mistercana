import type {
  AuctionPhase,
} from '../app/state'

export type PageId =
  | 'dashboard'
  | 'auction'
  | 'players'
  | 'playerDetail'
  | 'objectives'
  | 'insights'
  | 'importExport'

export function renderNavigation(
  activePage: PageId,
  auctionPhase: AuctionPhase,
) {
  const dashboardDot =
    auctionPhase === 'setup'
      ? 'dot green'
      : 'dot red'

  const auctionDot =
    auctionPhase === 'live'
      ? 'dot green'
      : 'dot red'

  const auctionDisabled =
    auctionPhase === 'setup'

  const auctionLive =
    auctionPhase === 'live'

  const items: Array<{
    id: PageId
    label: string
    dot?: string
    disabled?: boolean
  }> = [
    {
      id: 'dashboard',
      label: 'DASHBOARD',
      dot: dashboardDot,
    },
    {
      id: 'auction',
      label: 'ASTA',
      dot: auctionDot,
      disabled: auctionDisabled,
    },
    {
      id: 'players',
      label: 'GIOCATORI',
    },
    {
      id: 'objectives',
      label: 'OBIETTIVI',
    },
    {
      id: 'insights',
      label: 'INSIGHTS',
    },
    {
      id: 'importExport',
      label: 'IMPORT/EXPORT',
    },
  ]

  return `
    <header class="topbar">
      <div class="topbar-brand-stack">
        <div class="brand">
          MisterCanà
        </div>

        ${
          auctionLive
            ? `
              <span
                class="topbar-live-status"
                aria-label="Asta live"
              >
                <span
                  class="topbar-live-dot"
                ></span>

                LIVE
              </span>
            `
            : ''
        }
      </div>

      <nav
        class="main-nav"
        aria-label="Navigazione principale"
      >
        ${items
          .map(
            (item) => `
              <button
                class="
                  nav-item
                  ${
                    item.id ===
                    activePage
                      ? 'active'
                      : ''
                  }
                  ${
                    item.disabled
                      ? 'disabled'
                      : ''
                  }
                "
                data-page="${item.id}"
                type="button"
                ${
                  item.disabled
                    ? 'disabled'
                    : ''
                }
              >
                ${item.label}

                ${
                  item.dot
                    ? `
                      <span
                        class="${item.dot}"
                      ></span>
                    `
                    : ''
                }
              </button>
            `,
          )
          .join('')}
      </nav>

      <div
        id="topbarPageActions"
        class="topbar-page-actions"
        aria-label="Azioni pagina"
      ></div>
    </header>
  `
}
