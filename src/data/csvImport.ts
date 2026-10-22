// Controllo dei CSV caricati da Import/Export: riconosce il tipo di file,
// verifica le colonne indispensabili e confronta con i dati in uso.
import type { CsvKey } from './csvOverrides'

export interface CsvAnalysis {
  fileName: string
  key?: CsvKey
  content: string
  ok: boolean
  errors: string[]
  summary: string[]
}

type Row = Record<string, string>

function splitLines(text: string): string[] {
  return text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim())
}

function delimiterOf(header: string): string {
  return (header.match(/;/g) ?? []).length >= (header.match(/,/g) ?? []).length ? ';' : ','
}

function parseRows(text: string): { header: string[]; rows: Row[] } {
  const lines = splitLines(text)
  if (!lines.length) return { header: [], rows: [] }
  const delimiter = delimiterOf(lines[0])
  const header = lines[0].split(delimiter).map((cell) => cell.trim())
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(delimiter)
    const row: Row = {}
    header.forEach((name, index) => { if (!(name in row)) row[name] = (cells[index] ?? '').trim() })
    return row
  })
  return { header, rows }
}

const PLAYER_COLUMNS = ['ID FantaLab', 'Nome', 'Squadra', 'Ruolo', 'Titolarità % (Guida)', 'PMA % budget (Guida)', 'Fantamedia', 'Presenze']
const COACH_COLUMNS = ['Squadra', 'Allenatore', 'Modulo', 'Ruoli chiave', 'Rigoristi', 'Punizioni', "Calci d'angolo", 'Formazione tipo']

function detectKey(fileName: string, header: string[]): CsvKey | undefined {
  const name = fileName.toLowerCase()
  if (header.includes('Fascia') && header.includes('Fonte')) return 'sos_consigli'
  if (header.includes('Ballottaggio') && header.includes('Probabilità')) return 'sos_probabili'
  if (header.includes('Probabilità') && header.includes('Avversario')) return 'probabili'
  if (header.includes('Lega') && header.includes('Prezzo') && header.includes('ID Fantacalcio')) return 'aste'
  if (header.includes('Giornata') && header.includes('Fantavoto')) return 'voti_giornate'
  if (header.includes('Stagione') && header.includes('FMV') && header.includes('ID Fantacalcio')) return 'storico_stagioni'
  if (header.includes('ID FantaLab') && !header.includes('PMA % budget (Guida)') && header.includes('Fantamedia')) return 'stagione_precedente'
  if (header.includes('ID FantaLab')) return 'fantalab_giocatori'
  if (header.includes('Allenatore') && header.includes('Ruoli chiave')) return 'fantalab_allenatori'
  if (header.includes('Saggio') && header.includes('Prezzo')) return 'saggi'
  if (header.includes('Gerarchia') && header.includes('Giocatore')) return 'portieri_gerarchie'
  if (header[0] === 'Squadra' && header.includes('G1') && header.includes('G38')) return 'portieri_calendario'
  if (header[0] === 'Squadra' && header.length > 10) {
    if (name.includes('portier')) return 'griglia_portieri'
    if (name.includes('attacc')) return 'griglia_attaccanti'
  }
  return undefined
}

function missingColumns(header: string[], required: string[]): string[] {
  return required.filter((column) => !header.includes(column))
}

function analyzePlayers(rows: Row[], current: Row[]): { errors: string[]; summary: string[] } {
  const errors: string[] = []
  const listed = rows.filter((row) => row['Nel listone'] !== 'No')
  const ids = new Set<string>()
  let duplicates = 0
  for (const row of listed) {
    if (!row['ID FantaLab']) { errors.push('Ci sono righe senza ID FantaLab.'); break }
    if (ids.has(row['ID FantaLab'])) duplicates += 1
    ids.add(row['ID FantaLab'])
  }
  if (duplicates) errors.push(`${duplicates} ID FantaLab duplicati.`)
  const badRoles = listed.filter((row) => !['P', 'D', 'C', 'A'].includes(row['Ruolo'])).length
  if (badRoles) errors.push(`${badRoles} giocatori con ruolo non valido.`)
  if (listed.length < 300) errors.push(`Solo ${listed.length} giocatori: il listone sembra incompleto.`)

  const before = new Map(current.filter((row) => row['Nel listone'] !== 'No').map((row) => [row['ID FantaLab'], row]))
  const after = new Map(listed.map((row) => [row['ID FantaLab'], row]))
  const added = [...after.keys()].filter((id) => !before.has(id)).map((id) => after.get(id)!)
  const removed = [...before.keys()].filter((id) => !after.has(id)).map((id) => before.get(id)!)
  const moved = [...after.values()].filter((row) => before.has(row['ID FantaLab']) && before.get(row['ID FantaLab'])!['Squadra'] !== row['Squadra'])
  const names = (list: Row[]) => list.slice(0, 6).map((row) => `${row['Nome']} (${row['Squadra']})`).join(', ') + (list.length > 6 ? ` e altri ${list.length - 6}` : '')
  const summary = [`${before.size} → ${after.size} giocatori`]
  summary.push(added.length ? `${added.length} nuovi: ${names(added)}` : 'nessun giocatore nuovo')
  if (removed.length) summary.push(`${removed.length} usciti: ${names(removed)}`)
  if (moved.length) summary.push(`${moved.length} cambi di squadra: ${moved.slice(0, 6).map((row) => `${row['Nome']} → ${row['Squadra']}`).join(', ')}${moved.length > 6 ? ` e altri ${moved.length - 6}` : ''}`)
  return { errors, summary }
}

function analyzeCoaches(rows: Row[], current: Row[]): { errors: string[]; summary: string[] } {
  const errors: string[] = []
  if (rows.length < 18) errors.push(`Solo ${rows.length} squadre: la tabella sembra incompleta.`)
  const before = new Map(current.map((row) => [row['Squadra'], row]))
  const changed = rows.filter((row) => before.has(row['Squadra']) && before.get(row['Squadra'])!['Allenatore'] !== row['Allenatore'])
  const updates = rows.map((row) => row['Aggiornato']).filter(Boolean).sort()
  const summary = [`${rows.length} squadre`]
  summary.push(changed.length ? `cambi di allenatore: ${changed.map((row) => `${row['Squadra']} → ${row['Allenatore']}`).join(', ')}` : 'nessun cambio di allenatore')
  if (updates.length) summary.push(`Guida aggiornata fino al ${new Date(updates[updates.length - 1]).toLocaleDateString('it-IT')}`)
  return { errors, summary }
}

function analyzeGrid(header: string[], rows: Row[]): { errors: string[]; summary: string[] } {
  const errors: string[] = []
  const teams = header.slice(1)
  const rowTeams = rows.map((row) => row['Squadra'])
  const missing = teams.filter((team) => !rowTeams.includes(team))
  if (missing.length) errors.push(`Squadre senza riga: ${missing.join(', ')}.`)
  const values = rows.flatMap((row) => teams.map((team) => Number((row[team] ?? '').replace(',', '.'))).filter(Number.isFinite))
  if (!values.length) errors.push('Nessun valore numerico nella griglia.')
  return { errors, summary: [`${teams.length} × ${rows.length} squadre`, values.length ? `valori da ${Math.min(...values)} a ${Math.max(...values)}` : ''].filter(Boolean) }
}

function analyzeSaggi(rows: Row[], current: Row[]): { errors: string[]; summary: string[] } {
  const errors: string[] = []
  const names = (list: Row[]) => [...new Set(list.map((row) => row['Saggio']))]
  const now = names(rows)
  if (!rows.length) errors.push('Nessuna riga nei Saggi.')
  const priced = rows.filter((row) => row['Prezzo']).length
  return {
    errors,
    summary: [
      `${now.length} Saggi: ${now.join(', ')}`,
      `${rows.length} righe, ${priced} con prezzo (prima: ${names(current).join(', ') || '—'})`,
    ],
  }
}

function analyzeGoalkeepers(key: CsvKey, rows: Row[]): { errors: string[]; summary: string[] } {
  if (key === 'portieri_calendario') {
    const errors = rows.length < 18 ? [`Solo ${rows.length} squadre nel calendario.`] : []
    return { errors, summary: [`${rows.length} squadre × 38 giornate`] }
  }
  const teams = new Set(rows.map((row) => row['Squadra']))
  const errors = rows.length < 40 ? [`Solo ${rows.length} portieri: gerarchie incomplete.`] : []
  return { errors, summary: [`${rows.length} portieri di ${teams.size} squadre`] }
}

export function analyzeCsv(fileName: string, content: string, current: (key: CsvKey) => string): CsvAnalysis {
  const { header, rows } = parseRows(content)
  const key = detectKey(fileName, header)
  if (!key) {
    return {
      fileName, content, ok: false, summary: [],
      errors: ['Tipo di file non riconosciuto. Servono: listone giocatori, allenatori, Saggi, calendario o gerarchie portieri FantaLab, oppure una griglia con "portieri" o "attaccanti" nel nome del file.'],
    }
  }
  const required = key === 'fantalab_giocatori' ? PLAYER_COLUMNS
    : key === 'fantalab_allenatori' ? COACH_COLUMNS
      : key === 'saggi' ? ['id_giocatore', 'Saggio', 'Fascia_Originale', 'Prezzo']
        : key === 'portieri_gerarchie' ? ['id_giocatore', 'Giocatore', 'Squadra', 'Gerarchia']
          : ['Squadra']
  const missing = missingColumns(header, required)
  if (missing.length) {
    return { fileName, key, content, ok: false, summary: [], errors: [`Colonne mancanti: ${missing.join(', ')}.`] }
  }
  const currentRows = parseRows(current(key)).rows
  const result = key === 'fantalab_giocatori' ? analyzePlayers(rows, currentRows)
    : key === 'fantalab_allenatori' ? analyzeCoaches(rows, currentRows)
      : key === 'saggi' ? analyzeSaggi(rows, currentRows)
        : key === 'portieri_calendario' || key === 'portieri_gerarchie' ? analyzeGoalkeepers(key, rows)
          : analyzeGrid(header, rows)
  return { fileName, key, content, ok: result.errors.length === 0, ...result }
}
