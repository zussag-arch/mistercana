const DEFAULT_EXIT_MOTION_MS =
  140

function parseDuration(
  value: string,
): number {
  const trimmed =
    value.trim()

  if (
    trimmed.endsWith(
      'ms',
    )
  ) {
    const parsed =
      Number.parseFloat(
        trimmed,
      )

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : DEFAULT_EXIT_MOTION_MS
  }

  if (
    trimmed.endsWith(
      's',
    )
  ) {
    const parsed =
      Number.parseFloat(
        trimmed,
      )

    return Number.isFinite(
      parsed,
    )
      ? parsed * 1000
      : DEFAULT_EXIT_MOTION_MS
  }

  return DEFAULT_EXIT_MOTION_MS
}

export function prefersReducedMotion():
  boolean {
  return (
    typeof window !==
      'undefined' &&
    window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
  )
}

export function getExitMotionDuration():
  number {
  if (
    typeof window ===
      'undefined' ||
    typeof document ===
      'undefined' ||
    prefersReducedMotion()
  ) {
    return 0
  }

  const value =
    window
      .getComputedStyle(
        document.documentElement,
      )
      .getPropertyValue(
        '--motion-exit',
      )

  return parseDuration(
    value,
  )
}

export function runOverlayExit(
  selector: string,
  onComplete: () => void,
): void {
  const element =
    document.querySelector<HTMLElement>(
      selector,
    )

  const duration =
    getExitMotionDuration()

  if (
    !element ||
    duration <= 0
  ) {
    onComplete()

    return
  }

  element.classList.add(
    'is-closing',
  )

  element.setAttribute(
    'aria-hidden',
    'true',
  )

  window.setTimeout(
    onComplete,
    duration,
  )
}