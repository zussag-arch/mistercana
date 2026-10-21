let blinkTimer:
  number | null = null

let isLive = false
let frameIndex = 0

/*
  Pulsazione morbida come il pallino LIVE della dashboard:
  un ciclo di 1,4 s in cui il verde va da pieno a 30% e torna.
  I browser non animano la favicon, quindi si cambiano
  fotogrammi già pronti.
*/
const PULSE_PERIOD_MS =
  1400

const PULSE_FRAMES =
  16

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

// opacità su curva coseno: 1 → 0,3 → 1, senza scatti
const LIVE_FRAMES: string[] =
  Array.from(
    { length: PULSE_FRAMES },
    (_, index) =>
      faviconHref(
        DOT_GREEN_ON,
        0.65 + 0.35 * Math.cos(
          (index / PULSE_FRAMES) * Math.PI * 2,
        ),
      ),
  )

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

  frameIndex = 0
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
  getFaviconLink().href =
    LIVE_FRAMES[frameIndex]
}

function startBlinking():
  void {
  stopBlinking()

  showLiveFrame()

  blinkTimer =
    window.setInterval(
      () => {
        frameIndex =
          (frameIndex + 1) % PULSE_FRAMES

        showLiveFrame()
      },
      PULSE_PERIOD_MS / PULSE_FRAMES,
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