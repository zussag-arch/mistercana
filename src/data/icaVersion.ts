// Indice di valutazione usato in tutta l'app: iCà 3 (attuale) o iCà 4 (in prova).
// La scelta resta salvata nel browser; si cambia dalla pagina Dati.
export type ICaVersion = 'v3' | 'v4'
const KEY = 'mistercana_ica_version_v1'

export function icaVersion(): ICaVersion {
  try { return window.localStorage.getItem(KEY) === 'v4' ? 'v4' : 'v3' } catch { return 'v3' }
}

export function setIcaVersion(version: ICaVersion): void {
  try { window.localStorage.setItem(KEY, version) } catch { /* solo comodità */ }
}
