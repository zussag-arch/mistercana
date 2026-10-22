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
  // colore della barra del browser / di stato (Android, Safari) in tinta col tema
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f6f1e8' : '#121517')
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
