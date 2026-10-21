// Selettore tema: scuro (predefinito) o chiaro "bianco caldo".
// La scelta resta salvata nel browser e si applica su <html data-theme>.
export type Theme = 'dark' | 'light'

const THEME_KEY = 'mistercana_theme_v1'

function savedTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try { window.localStorage.setItem(THEME_KEY, theme) } catch { /* solo comodità */ }
}

export function initTheme(): void {
  applyTheme(savedTheme())
  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement | null)?.closest('[data-theme-toggle]')
    if (!button) return
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light')
  })
}
