import type { AppState } from '../app/state'

interface AuctionActions {
  onEndAuction: () => void
  onArchiveAuction: () => void
  onDiscardAuction: () => void
  onNewAuction: () => void
}

export function renderAuctionPage(
  state: AppState,
): string {
  if (state.auctionPhase === 'live') {
    return `
      <section class="page">

        <div class="page-heading">

          <div>
            <h1>Asta</h1>
            <p>Sessione live.</p>
          </div>

          <span class="live-badge">
            LIVE
          </span>

        </div>

        <section class="panel">

          <h2>Tool Asta</h2>

          <p class="muted-text">
            Questo spazio verrà progettato
            nella fase successiva.
          </p>

        </section>

        <div class="auction-actions">

          <button
            id="endAuctionButton"
            type="button"
            class="danger-button"
          >
            Termina asta
          </button>

        </div>

      </section>
    `
  }

  if (
    state.auctionPhase ===
    'finalizing'
  ) {
    return `
      <section class="page">

        <div class="page-heading">

          <div>
            <h1>Asta</h1>

            <p>
              Sessione terminata.
            </p>
          </div>

          <span class="finalizing-badge">
            DA FINALIZZARE
          </span>

        </div>

        <section
          class="panel finalization-panel"
        >

          <div class="finalization-icon">
            !
          </div>

          <div class="finalization-copy">

            <h2>
              Asta terminata
            </h2>

            <p>
              La sessione non è ancora
              stata registrata.
            </p>

            <p>
              Prima di iniziare una nuova
              asta devi scegliere se
              salvare definitivamente i
              dati nello storico oppure
              scartare questa sessione.
            </p>

          </div>

        </section>

        <div class="auction-actions">

          <button
            id="discardAuctionButton"
            type="button"
            class="danger-button"
          >
            Scarta asta
          </button>

          <button
            id="archiveAuctionButton"
            type="button"
            class="primary-button"
          >
            Registra asta
          </button>

        </div>

        <div
          id="discardAuctionOverlay"
          class="overlay hidden"
          aria-hidden="true"
        >

          <div
            class="overlay-backdrop"
          ></div>

          <div
            class="
              overlay-card
              small-overlay-card
            "
          >

            <div class="overlay-header">

              <div>
                <span class="eyebrow">
                  SCARTA ASTA
                </span>

                <h2>
                  Conferma eliminazione
                </h2>
              </div>

              <button
                id="closeDiscardAuctionButton"
                type="button"
                class="icon-button"
                aria-label="Chiudi"
              >
                ×
              </button>

            </div>

            <div class="danger-panel">

              <p>
                Questa sessione non verrà
                aggiunta allo storico.
              </p>

              <p>
                <strong>
                  I dati appartenenti
                  esclusivamente a questa
                  asta verranno scartati.
                </strong>
              </p>

            </div>

            <div class="overlay-actions">

              <button
                id="cancelDiscardAuctionButton"
                type="button"
                class="secondary-button"
              >
                Annulla
              </button>

              <button
                id="confirmDiscardAuctionButton"
                type="button"
                class="danger-button"
              >
                Scarta asta
              </button>

            </div>

          </div>
        </div>

      </section>
    `
  }

  if (
    state.auctionPhase === 'archived'
  ) {
    return `
      <section class="page">

        <div class="page-heading">

          <div>
            <h1>Asta</h1>

            <p>
              Sessione registrata.
            </p>
          </div>

          <span class="archived-badge">
            REGISTRATA
          </span>

        </div>

        <section class="panel">

          <h2>
            Asta registrata
          </h2>

          <p class="muted-text">
            La sessione è stata chiusa
            correttamente ed è pronta per
            essere conservata nello
            storico.
          </p>

        </section>

        <div class="auction-actions">

          <button
            id="newAuctionButton"
            type="button"
            class="primary-button"
          >
            Nuova asta
          </button>

        </div>

      </section>
    `
  }

  if (
    state.auctionPhase ===
    'discarded'
  ) {
    return `
      <section class="page">

        <div class="page-heading">

          <div>
            <h1>Asta</h1>

            <p>
              Sessione scartata.
            </p>
          </div>

          <span class="discarded-badge">
            SCARTATA
          </span>

        </div>

        <section class="panel">

          <h2>
            Asta scartata
          </h2>

          <p class="muted-text">
            La sessione non verrà aggiunta
            allo storico.
          </p>

        </section>

        <div class="auction-actions">

          <button
            id="newAuctionButton"
            type="button"
            class="primary-button"
          >
            Nuova asta
          </button>

        </div>

      </section>
    `
  }

  return `
    <section class="page">

      <h1>Asta</h1>

      <p>
        Asta non ancora avviata.
      </p>

    </section>
  `
}

export function bindAuctionEvents(
  state: AppState,
  actions: AuctionActions,
): void {
  if (state.auctionPhase === 'live') {
    document
      .querySelector(
        '#endAuctionButton',
      )
      ?.addEventListener(
        'click',
        actions.onEndAuction,
      )
  }

  if (
    state.auctionPhase ===
    'finalizing'
  ) {
    document
      .querySelector(
        '#archiveAuctionButton',
      )
      ?.addEventListener(
        'click',
        actions.onArchiveAuction,
      )

    const overlay =
      document.querySelector<HTMLElement>(
        '#discardAuctionOverlay',
      )

    const openOverlay = () => {
      overlay?.classList.remove(
        'hidden',
      )

      overlay?.setAttribute(
        'aria-hidden',
        'false',
      )
    }

    const closeOverlay = () => {
      overlay?.classList.add(
        'hidden',
      )

      overlay?.setAttribute(
        'aria-hidden',
        'true',
      )
    }

    document
      .querySelector(
        '#discardAuctionButton',
      )
      ?.addEventListener(
        'click',
        openOverlay,
      )

    document
      .querySelector(
        '#closeDiscardAuctionButton',
      )
      ?.addEventListener(
        'click',
        closeOverlay,
      )

    document
      .querySelector(
        '#cancelDiscardAuctionButton',
      )
      ?.addEventListener(
        'click',
        closeOverlay,
      )

    document
      .querySelector(
        '#confirmDiscardAuctionButton',
      )
      ?.addEventListener(
        'click',
        actions.onDiscardAuction,
      )
  }

  if (
    state.auctionPhase ===
      'archived' ||
    state.auctionPhase ===
      'discarded'
  ) {
    document
      .querySelector(
        '#newAuctionButton',
      )
      ?.addEventListener(
        'click',
        actions.onNewAuction,
      )
  }
}