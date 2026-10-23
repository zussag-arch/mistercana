// CSV caricati dall'utente dalla pagina Import/Export: sostituiscono quelli del
// progetto (database/) senza commit. Restano nel browser finché non si torna ai
// dati originali. Le pagine leggono sempre tramite getCsv().

export type CsvKey =
  | 'fantalab_giocatori'
  | 'fantalab_allenatori'
  | 'griglia_portieri'
  | 'griglia_attaccanti'
  | 'portieri_calendario'
  | 'portieri_gerarchie'
  | 'saggi'
  | 'stagione_precedente'
  | 'voti_giornate'
  | 'storico_stagioni'
  | 'aste'
  | 'probabili'
  | 'sos_probabili'
  | 'sos_consigli'
  | 'avversari'
  | 'carriera'
  | 'heatmap'

export const CSV_LABELS: Record<CsvKey, string> = {
  fantalab_giocatori: 'Listone giocatori',
  fantalab_allenatori: 'Allenatori e Guida',
  griglia_portieri: 'Griglia portieri',
  griglia_attaccanti: 'Griglia attaccanti',
  portieri_calendario: 'Calendario portieri',
  portieri_gerarchie: 'Gerarchie portieri',
  saggi: 'Saggi',
  stagione_precedente: 'Stagione precedente',
  voti_giornate: 'Voti per giornata',
  storico_stagioni: 'Storico MV/FMV',
  aste: 'Aste di lega',
  probabili: 'Formazioni probabili',
  sos_probabili: 'Probabili SOS Fanta',
  sos_consigli: 'Consigli SOS Fanta',
  avversari: 'Anagrafica avversari',
  carriera: 'Carriera (FotMob)',
  heatmap: 'Heatmap (FotMob)',
}

export interface CsvOverride {
  fileName: string
  content: string
  loadedAt: string
}

const STORAGE_KEY = 'mistercana_csv_overrides_v1'

function readAll(): Partial<Record<CsvKey, CsvOverride>> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Partial<Record<CsvKey, CsvOverride>> : {}
  } catch {
    return {}
  }
}

/**
 * Dati della TUA lega: storico aste e anagrafica avversari. Non sono dati del progetto ma dell'utente:
 * vivono solo qui (e online con il login), un'app appena installata parte senza.
 */
export const PRIVATE_KEYS: CsvKey[] = ['aste', 'avversari']

/** Passaggio una tantum: chi usava già l'app (ha allenatori, aste archiviate o un'anagrafica
 *  caricata) riceve come dati propri lo storico che prima era incluso nel progetto. */
function shouldAdoptBundled(): boolean {
  try {
    if (readAll().avversari) return true
    const state = JSON.parse(window.localStorage.getItem('mistercana_app_state_v1') ?? 'null')
    return Boolean(state?.managers?.length || state?.archivedAuctions?.length)
  } catch {
    return false
  }
}

/** CSV da usare: quello caricato dall'utente se presente, altrimenti quello del progetto. */
export function getCsv(key: CsvKey, bundled: string): string {
  if (typeof window === 'undefined') return bundled
  const own = readAll()[key]?.content
  if (own !== undefined) return own
  if (!PRIVATE_KEYS.includes(key)) return bundled
  if (!bundled || !shouldAdoptBundled()) return ''
  saveCsvOverrides({ [key]: { fileName: `${key}.csv`, content: bundled, loadedAt: new Date().toISOString() } })
  // il salvataggio online parte prima di questo punto: si segna la modifica a mano
  try { window.localStorage.setItem('mistercana_cloud_modified_at', new Date().toISOString()) } catch { /* niente */ }
  return bundled
}

/** tabelle del progetto sostituite da file caricati (storico aste e anagrafica esclusi: sono dati tuoi) */
export function getCsvOverrides(): Partial<Record<CsvKey, CsvOverride>> {
  if (typeof window === 'undefined') return {}
  return Object.fromEntries(Object.entries(readAll()).filter(([key]) => !PRIVATE_KEYS.includes(key as CsvKey)))
}

/** Salva i CSV caricati; false se la memoria del dispositivo è piena o bloccata. */
export function saveCsvOverrides(files: Partial<Record<CsvKey, CsvOverride>>): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), ...files }))
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('mistercana:saved'))
    return true
  } catch {
    return false
  }
}

/** torna ai dati del progetto; storico aste e anagrafica sono dati tuoi e restano */
export function clearCsvOverrides(): void {
  const keep = Object.fromEntries(Object.entries(readAll()).filter(([key]) => PRIVATE_KEYS.includes(key as CsvKey)))
  if (Object.keys(keep).length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keep))
  else window.localStorage.removeItem(STORAGE_KEY)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('mistercana:saved'))
}
