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

/** CSV da usare: quello caricato dall'utente se presente, altrimenti quello del progetto. */
export function getCsv(key: CsvKey, bundled: string): string {
  if (typeof window === 'undefined') return bundled
  return readAll()[key]?.content ?? bundled
}

export function getCsvOverrides(): Partial<Record<CsvKey, CsvOverride>> {
  return typeof window === 'undefined' ? {} : readAll()
}

/** Salva i CSV caricati; false se la memoria del dispositivo è piena o bloccata. */
export function saveCsvOverrides(files: Partial<Record<CsvKey, CsvOverride>>): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), ...files }))
    return true
  } catch {
    return false
  }
}

export function clearCsvOverrides(): void {
  window.localStorage.removeItem(STORAGE_KEY)
}
