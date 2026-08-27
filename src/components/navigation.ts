export type PageId =
  | 'dashboard'
  | 'auction'
  | 'players'
  | 'objectives'
  | 'insights'
  | 'importExport'

export function renderNavigation(activePage: PageId, auctionLive: boolean) {
  const dashboardDot = auctionLive ? 'dot red' : 'dot green'
  const auctionDot = auctionLive ? 'dot green' : 'dot red'

  const items: Array<{ id: PageId; label: string; dot?: string }> = [
    { id: 'dashboard', label: 'DASHBOARD', dot: dashboardDot },
    { id: 'auction', label: 'ASTA', dot: auctionDot },
    { id: 'players', label: 'GIOCATORI' },
    { id: 'objectives', label: 'OBIETTIVI' },
    { id: 'insights', label: 'INSIGHTS' },
    { id: 'importExport', label: 'IMPORT/EXPORT' },
  ]

  return `
    <header class="topbar">
      <div class="brand">MisterCanà</div>

      <nav class="main-nav" aria-label="Navigazione principale">
        ${items
          .map(
            (item) => `
              <button
                class="nav-item ${item.id === activePage ? 'active' : ''}"
                data-page="${item.id}"
                type="button"
              >
                ${item.label}
                ${item.dot ? `<span class="${item.dot}"></span>` : ''}
              </button>
            `,
          )
          .join('')}
      </nav>
    </header>
  `
}
