export function renderAuctionPage(auctionLive: boolean) {
  return `
    <section class="page">
      <h1>Asta</h1>
      <p>${auctionLive ? 'Asta in corso.' : 'Asta non ancora avviata.'}</p>
    </section>
  `
}