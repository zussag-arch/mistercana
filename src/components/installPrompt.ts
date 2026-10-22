// Installazione su Android (Chrome, Edge, Samsung Internet).
// Il link https://zussag-arch.github.io/mistercana/?installa apre l'app con la
// finestra "Installa MisterCanà": un tocco e parte l'installazione di Chrome.
// Se il browser non lo permette, la finestra spiega come farlo dal menu.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function wantsInstall(): boolean {
  return /[?&]installa\b/.test(window.location.search) || window.location.hash === '#installa'
}

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent)
}

function closeSheet(): void {
  document.querySelector('.install-sheet')?.remove()
  // toglie "?installa" dall'indirizzo, così ricaricando non ricompare
  if (wantsInstall()) {
    window.history.replaceState(null, '', window.location.pathname)
  }
}

function renderSheet(): void {
  document.querySelector('.install-sheet')?.remove()
  const installed = isInstalled()
  const ready = Boolean(deferred)
  const sheet = document.createElement('div')
  sheet.className = 'install-sheet'
  sheet.innerHTML = `
    <div class="install-card" role="dialog" aria-modal="true" aria-labelledby="installTitle">
      <img src="${import.meta.env.BASE_URL}icons/mistercana-192.png" alt="" width="72" height="72">
      <h2 id="installTitle">${installed ? 'MisterCanà è già installata' : 'Installa MisterCanà'}</h2>
      ${installed
        ? '<p>Stai già usando l\'app installata.</p>'
        : ready
          ? '<p>Si aggiunge alla schermata Home e si apre a schermo intero, come un\'app.</p>'
          : isAndroid()
            ? '<p>Apri il menu di Chrome <b>⋮</b> in alto a destra e scegli <b>Installa app</b> (oppure <b>Aggiungi a schermata Home</b>).</p>'
            : '<p>Su iPhone: apri questa pagina in <b>Safari</b>, premi <b>Condividi</b> e scegli <b>Aggiungi alla schermata Home</b>.</p>'}
      <div class="install-actions">
        ${!installed && ready ? '<button type="button" class="install-go" data-install-go>Installa</button>' : ''}
        <button type="button" class="install-later" data-install-close>${installed || !ready ? 'Ok' : 'Non ora'}</button>
      </div>
    </div>`
  document.body.append(sheet)
}

export function initInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as InstallPromptEvent
    // se la finestra è già aperta, ora può mostrare il pulsante Installa
    if (document.querySelector('.install-sheet')) renderSheet()
  })

  window.addEventListener('appinstalled', () => {
    deferred = null
    closeSheet()
  })

  document.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-install-close]') || target?.classList.contains('install-sheet')) {
      closeSheet()
      return
    }
    if (target?.closest('[data-install-go]') && deferred) {
      const prompt = deferred
      deferred = null
      await prompt.prompt()
      await prompt.userChoice
      closeSheet()
      return
    }
    if (target?.closest('[data-install-open]')) {
      renderSheet()
    }
  })

  if (wantsInstall()) {
    // Chrome segnala che l'app è installabile poco dopo il caricamento
    window.setTimeout(renderSheet, 600)
  }
}
