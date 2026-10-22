// Comportamento da app su telefono:
// - schede della pagina Asta (Chiamata / Consigli / Mercato), ricordate tra un ridisegno e l'altro
// - dopo una chiamata si torna sempre alla scheda Chiamata
const TAB_KEY = 'mistercana_auction_tab_v1'
type AuctionTab = 'call' | 'advice' | 'market'

function currentTab(): AuctionTab {
  try {
    const saved = window.sessionStorage.getItem(TAB_KEY)
    if (saved === 'advice' || saved === 'market') return saved
  } catch { /* solo comodità */ }
  return 'call'
}

export function setAuctionTab(tab: AuctionTab): void {
  document.documentElement.dataset.auctionTab = tab
  try { window.sessionStorage.setItem(TAB_KEY, tab) } catch { /* solo comodità */ }
  document.querySelectorAll<HTMLElement>('button[data-auction-tab]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.auctionTab === tab))
  })
  window.scrollTo({ top: 0 })
}

// Schede della Dashboard su telefono (Riepilogo / Budget / Allenatori)
const DASH_KEY = 'mistercana_dashboard_tab_v1'
type DashTab = 'summary' | 'budget' | 'managers'

function currentDashTab(): DashTab {
  try {
    const saved = window.sessionStorage.getItem(DASH_KEY)
    if (saved === 'budget' || saved === 'managers') return saved
  } catch { /* solo comodità */ }
  return 'summary'
}

function setDashTab(tab: DashTab): void {
  document.documentElement.dataset.dashTab = tab
  try { window.sessionStorage.setItem(DASH_KEY, tab) } catch { /* solo comodità */ }
  syncTabButtons()
  window.scrollTo({ top: 0 })
}

function syncTabButtons(): void {
  // il pulsante Indietro della scheda completa sparisce quando si esce dalla scheda
  if (!document.querySelector('.player-full-page-v3')) {
    document.querySelectorAll('.sheet-back-portal').forEach((item) => item.remove())
  }
  const root = document.documentElement.dataset
  document.querySelectorAll<HTMLElement>('button[data-auction-tab]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.auctionTab === (root.auctionTab ?? 'call')))
  })
  document.querySelectorAll<HTMLElement>('button[data-dash-tab]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.dashTab === (root.dashTab ?? 'summary')))
  })
}

export function initMobileApp(): void {
  document.documentElement.dataset.auctionTab = currentTab()
  document.documentElement.dataset.dashTab = currentDashTab()

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    const dash = target?.closest<HTMLElement>('button[data-dash-tab]')
    if (dash?.dataset.dashTab) {
      setDashTab(dash.dataset.dashTab as DashTab)
      return
    }
    const tab = target?.closest<HTMLElement>('button[data-auction-tab]')
    if (tab?.dataset.auctionTab) {
      setAuctionTab(tab.dataset.auctionTab as AuctionTab)
      return
    }
    // chiamare un giocatore (consigliato, Top iCà, alternative) riporta alla Chiamata
    if (target?.closest('[data-call-top-ica], .auction-call-primary-button, .auction-call-alternative button, [data-call-player]')) {
      window.setTimeout(() => setAuctionTab('call'), 0)
    }
  })

  // le etichette delle schede vengono ridisegnate con la pagina: riallinea lo stato
  // allinea le schede dopo ogni ridisegno, al massimo una volta per fotogramma
  let pending = false
  new MutationObserver(() => {
    if (pending) return
    pending = true
    window.requestAnimationFrame(() => {
      pending = false
      syncTabButtons()
    })
  }).observe(document.getElementById('app') ?? document.body, { childList: true, subtree: true })
}
