let blinkTimer:
  number | null = null

let isLive = false

/*
  Pulsazione morbida come il pallino LIVE della dashboard:
  un ciclo di 1,4 s in cui il verde va da pieno a 30% e torna.
  I browser non animano la favicon, quindi si cambiano
  fotogrammi già pronti.
*/
const PULSE_PERIOD_MS =
  3000

// aggiornamento ogni 4 ms (il minimo dei browser): l'opacità si calcola
// dal tempo trascorso, quindi il ritmo resta costante anche se un passo salta
const PULSE_STEP_MS =
  4

// quota del ciclo in cui il pallino resta acceso al 100%
const PULSE_HOLD =
  0.15

const DOT_RED_ON =
  '#F04F4F'

const DOT_GREEN_ON =
  '#46E6A1'

function getFaviconLink():
  HTMLLinkElement {
  const existing =
    document.querySelector<HTMLLinkElement>(
      'link[rel~="icon"]',
    )

  if (existing) {
    return existing
  }

  const link =
    document.createElement(
      'link',
    )

  link.rel = 'icon'
  link.type = 'image/svg+xml'

  document.head.appendChild(
    link,
  )

  return link
}

function createFaviconSvg(
  dotColor: string,
  opacity = 1,
): string {
  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
    >
      <circle
        cx="32"
        cy="32"
        r="27"
        fill="${dotColor}"
        fill-opacity="${opacity.toFixed(2)}"
      />

      <circle
        cx="32"
        cy="32"
        r="27"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        stroke-width="2"
      />
    </svg>
  `
}

function faviconHref(
  dotColor: string,
  opacity = 1,
): string {
  return `data:image/svg+xml,${encodeURIComponent(
    createFaviconSvg(
      dotColor,
      opacity,
    ),
  )}`
}

function applyFavicon(
  dotColor: string,
): void {
  getFaviconLink().href =
    faviconHref(dotColor)
}

// acceso pieno per PULSE_HOLD del ciclo, poi discesa e risalita
// morbide su curva coseno (1 → 0,3 → 1)
function pulseOpacity(
  phase: number,
): number {
  if (phase < PULSE_HOLD) {
    return 1
  }

  const fade =
    (phase - PULSE_HOLD) / (1 - PULSE_HOLD)

  return 0.65 + 0.35 * Math.cos(fade * Math.PI * 2)
}

// un'icona per ogni livello di opacità (passo 0,01), creata una volta sola
const liveFrameCache =
  new Map<number, string>()

let liveStartedAt = 0
let lastLiveLevel = -1

function liveFrameHref(
  level: number,
): string {
  let href = liveFrameCache.get(level)
  if (!href) {
    href = faviconHref(DOT_GREEN_ON, level / 100)
    liveFrameCache.set(level, href)
  }
  return href
}

function stopBlinking():
  void {
  if (
    blinkTimer !== null
  ) {
    window.clearInterval(
      blinkTimer,
    )

    blinkTimer = null
  }

  lastLiveLevel = -1
}

function showInactive():
  void {
  stopBlinking()

  applyFavicon(
    DOT_RED_ON,
  )
}

function showLiveFrame():
  void {
  const phase =
    ((performance.now() - liveStartedAt) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS

  const level =
    Math.round(pulseOpacity(phase) * 100)

  // si cambia l'icona solo quando l'opacità cambia davvero
  if (level === lastLiveLevel) {
    return
  }

  lastLiveLevel = level
  getFaviconLink().href =
    liveFrameHref(level)
}

function startBlinking():
  void {
  stopBlinking()

  liveStartedAt = performance.now()

  showLiveFrame()

  blinkTimer =
    window.setInterval(
      showLiveFrame,
      PULSE_STEP_MS,
    )
}

export function syncFavicon(
  auctionIsLive: boolean,
): void {
  if (
    auctionIsLive ===
    isLive
  ) {
    return
  }

  isLive =
    auctionIsLive

  if (isLive) {
    startBlinking()
    return
  }

  showInactive()
}

export function initializeFavicon(
  auctionIsLive: boolean,
): void {
  isLive =
    auctionIsLive

  if (isLive) {
    startBlinking()
    return
  }

  showInactive()
}