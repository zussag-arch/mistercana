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
        <div class="brand"><span class="brand-mister">Mister</span><span class="brand-cana">Canà</span></div>

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
        role="toolbar"
        aria-label="Azioni pagina"
      ></div>

      <button
        class="theme-toggle"
        data-theme-toggle
        type="button"
        title="Cambia tema (chiaro / scuro)"
        aria-label="Cambia tema"
      ><span class="theme-toggle-icon" aria-hidden="true"></span></button>
    </header>

    ${renderMobileTabbar(activePage, auctionDisabled, auctionLive)}
  `
}

/* =========================
   BARRA IN BASSO (telefono)
   Icone SVG a tratto unico (stile Lucide), 6 voci.
========================= */

const TAB_ICONS: Record<string, string> = {
  dashboard: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  auction: '<path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/>',
  players: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  objectives: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  insights: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  importExport: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
}

function renderMobileTabbar(
  activePage: PageId,
  auctionDisabled: boolean,
  auctionLive: boolean,
): string {
  const tabs: Array<[PageId, string]> = [
    ['dashboard', 'Home'],
    ['auction', 'Asta'],
    ['players', 'Giocatori'],
    ['objectives', 'Obiettivi'],
    ['insights', 'Insights'],
    ['importExport', 'Dati'],
  ]
  return `
    <nav class="mobile-tabbar" aria-label="Navigazione">
      ${tabs.map(([id, label]) => `
        <button
          type="button"
          class="mobile-tab${id === activePage ? ' active' : ''}${id === 'auction' && auctionLive ? ' live' : ''}"
          data-page="${id}"
          ${id === 'auction' && auctionDisabled ? 'disabled' : ''}
          aria-current="${id === activePage ? 'page' : 'false'}"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICONS[id]}</svg>
          <span>${label}</span>
        </button>`).join('')}
    </nav>
  `
}
