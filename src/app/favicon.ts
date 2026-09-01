let blinkTimer:
  number | null = null

let isLive = false
let brightPhase = false

const BLINK_INTERVAL_MS =
  800

const DOT_RED_ON =
  '#F04F4F'

const DOT_GREEN_OFF =
  '#2F6F50'

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

function applyFavicon(
  dotColor: string,
): void {
  const link =
    getFaviconLink()

  const svg =
    createFaviconSvg(
      dotColor,
    )

  link.href =
    `data:image/svg+xml,${encodeURIComponent(
      svg,
    )}`
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

  brightPhase = false
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
  applyFavicon(
    brightPhase
      ? DOT_GREEN_ON
      : DOT_GREEN_OFF,
  )
}

function startBlinking():
  void {
  stopBlinking()

  brightPhase = false

  showLiveFrame()

  blinkTimer =
    window.setInterval(
      () => {
        brightPhase =
          !brightPhase

        showLiveFrame()
      },
      BLINK_INTERVAL_MS,
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