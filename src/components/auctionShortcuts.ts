// Scorciatoie da tastiera nella pagina Asta:
//   Spazio = +1 · Maiusc+Spazio = +10 · Invio = Aggiudicato
// Non scattano mentre si scrive in un campo (tranne Invio nel prezzo)
// né quando è aperta una finestra.
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function overlayOpen(): boolean {
  return Boolean(document.querySelector(
    '.auction-award-overlay:not(.hidden):not([hidden]), .goalkeeper-matrix-overlay:not([hidden]), .round-select-menu, [aria-modal="true"]:not([hidden])',
  ))
}

function press(selector: string): boolean {
  const button = document.querySelector<HTMLButtonElement>(selector)
  if (!button || button.disabled) return false
  button.click()
  return true
}

export function initAuctionShortcuts(): void {
  document.addEventListener('keydown', (event) => {
    if (!document.querySelector('#auctionOpenAwardButton')) return
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
    if (overlayOpen()) return

    const inPrice = event.target instanceof HTMLInputElement && event.target.id === 'auctionPriceInput'

    if (event.key === 'Enter' && (inPrice || !isTyping(event.target))) {
      if (press('#auctionOpenAwardButton')) event.preventDefault()
      return
    }

    if (isTyping(event.target)) return

    if (event.key === ' ' || event.code === 'Space') {
      const done = event.shiftKey
        ? press('#auctionPricePlusTenButton')
        : press('#auctionPricePlusOneButton')
      if (done) event.preventDefault()
    }
  })
}
