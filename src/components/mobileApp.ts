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
  document.querySelectorAll<HTMLElement>('[data-auction-tab]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.auctionTab === tab))
  })
  window.scrollTo({ top: 0 })
}

export function initMobileApp(): void {
  document.documentElement.dataset.auctionTab = currentTab()

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    const tab = target?.closest<HTMLElement>('[data-auction-tab]')
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
  new MutationObserver(() => {
    const tab = document.documentElement.dataset.auctionTab ?? 'call'
    document.querySelectorAll<HTMLElement>('[data-auction-tab]').forEach((button) => {
      button.setAttribute('aria-selected', String(button.dataset.auctionTab === tab))
    })
  }).observe(document.body, { childList: true, subtree: true })
}
