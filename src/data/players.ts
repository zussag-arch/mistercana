import playersCsv from '../../database/MisterCana_DB_Giocatori_2026_27.csv?raw'
import fantalabPlayersCsvBundled from '../../database/fantalab_giocatori.csv?raw'

import {
  calculateConsensus,
} from './saggi'

import type {
  Player,
  PlayerRole,
} from '../domain/player'
import { getCsv } from './csvOverrides'

// CSV caricati dalla pagina Import/Export, altrimenti quelli del progetto
const fantalabPlayersCsv = getCsv('fantalab_giocatori', fantalabPlayersCsvBundled)

/* =========================
   CSV
========================= */

function parseCsvRow(
  line: string,
): string[] {
  const values: string[] = []

  let current = ''
  let quoted = false

  for (
    let index = 0;
    index < line.length;
    index += 1
  ) {
    const character =
      line[index]

    if (character === '"') {
      if (
        quoted &&
        line[index + 1] === '"'
      ) {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }

      continue
    }

    if (
      character === ';' &&
      !quoted
    ) {
      values.push(
        current.trim(),
      )

      current = ''

      continue
    }

    current += character
  }

  values.push(
    current.trim(),
  )

  return values
}

function parseCsv(
  csv: string,
): string[][] {
  return csv
    .replace(/\r/g, '')
    .split('\n')
    .map(
      (line) =>
        line.trim(),
    )
    .filter(Boolean)
    .map(parseCsvRow)
}

/* =========================
   PARSERS
========================= */

function parseItalianNumber(
  value:
    | string
    | undefined,
): number | undefined {
  if (
    value === undefined ||
    value.trim() === ''
  ) {
    return undefined
  }

  const normalized =
    value
      .trim()
      .replace(/\./g, '')
      .replace(',', '.')

  const parsed =
    Number(normalized)

  return Number.isFinite(parsed)
    ? parsed
    : undefined
}

function parsePercentage(
  value:
    | string
    | undefined,
): number | undefined {
  if (
    value === undefined ||
    value.trim() === ''
  ) {
    return undefined
  }

  const normalized =
    value
      .trim()
      .replace('%', '')
      .replace(/\./g, '')
      .replace(',', '.')

  const parsed =
    Number(normalized)

  return Number.isFinite(parsed)
    ? parsed
    : undefined
}

function parseBooleanFlag(
  value:
    | string
    | undefined,
): boolean {
  if (!value) {
    return false
  }

  const normalized =
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )

  return (
    normalized === 'si' ||
    normalized === 'yes' ||
    normalized === 'true' ||
    normalized === '1'
  )
}

function parseRole(
  value:
    | string
    | undefined,
): PlayerRole | null {
  switch (
    value?.trim().toUpperCase()
  ) {
    case 'P':
      return 'P'

    case 'D':
      return 'D'

    case 'C':
      return 'C'

    case 'A':
      return 'A'

    default:
      return null
  }
}

/* =========================
   DATABASE
========================= */

function parsePlayersCsv(
  csv: string,
): Player[] {
  const rows =
    parseCsv(csv)

  if (
    rows.length < 2
  ) {
    return []
  }

  const header =
    rows[0]

  const columnIndex =
    new Map<string, number>()

  header.forEach(
    (
      column,
      index,
    ) => {
      columnIndex.set(
        column.trim(),
        index,
      )
    },
  )

  const getValue =
    (
      row: string[],
      column: string,
    ): string => {
      const index =
        columnIndex.get(
          column,
        )

      if (
        index === undefined
      ) {
        return ''
      }

      return (
        row[index] ?? ''
      ).trim()
    }

  return rows
    .slice(1)
    .map(
      (
        row,
      ): Player | null => {
        const id =
          getValue(
            row,
            'id_giocatore',
          )

        const team =
          getValue(
            row,
            'Squadra',
          )

        const name =
          getValue(
            row,
            'Giocatore',
          )

        const role =
          parseRole(
            getValue(
              row,
              'Ruolo',
            ),
          )

        if (
          !id ||
          !team ||
          !name ||
          !role
        ) {
          return null
        }

        return {
          id,
          name,
          team,
          role,

          startingProbability:
            parsePercentage(
              getValue(
                row,
                'Titolarita',
              ),
            ),

          mv:
            parseItalianNumber(
              getValue(
                row,
                'MV',
              ),
            ),

          fmv:
            parseItalianNumber(
              getValue(
                row,
                'FMV',
              ),
            ),

          pmaPercent:
            parsePercentage(
              getValue(
                row,
                'PMA',
              ),
            ),

          appearances:
            parseItalianNumber(
              getValue(
                row,
                'Presenze',
              ),
            ),

          startingPoints:
            parseItalianNumber(
              getValue(
                row,
                'Pt_Tit',
              ),
            ),

          minutes:
            parseItalianNumber(
              getValue(
                row,
                'Minuti',
              ),
            ),

          injuryPoints:
            parseItalianNumber(
              getValue(
                row,
                'Pt_Inf',
              ),
            ),

          goals:
            parseItalianNumber(
              getValue(
                row,
                'Gol',
              ),
            ),

          assists:
            parseItalianNumber(
              getValue(
                row,
                'Assist',
              ),
            ),

          yellowCards:
            parseItalianNumber(
              getValue(
                row,
                'Ammonizioni',
              ),
            ),

          redCards:
            parseItalianNumber(
              getValue(
                row,
                'Espulsioni',
              ),
            ),

          penaltiesScored:
            parseItalianNumber(
              getValue(
                row,
                'Rig_Segnati',
              ),
            ),

          penaltiesMissed:
            parseItalianNumber(
              getValue(
                row,
                'Rig_Sbagliati',
              ),
            ),

          goalsConceded:
            parseItalianNumber(
              getValue(
                row,
                'Gol_Subiti',
              ),
            ),

          penaltiesSaved:
            parseItalianNumber(
              getValue(
                row,
                'Rig_Parati',
              ),
            ),

          valorizzato:
            parseBooleanFlag(
              getValue(
                row,
                'Valorizzato',
              ),
            ),

          penalizzato:
            parseBooleanFlag(
              getValue(
                row,
                'Penalizzato',
              ),
            ),

          nomeNascosto:
            parseBooleanFlag(
              getValue(
                row,
                'Nome_Nascosto',
              ),
            ),

          iCa: undefined,

          pma: undefined,

          consensus:
            undefined,

          xMv: undefined,

          xFmv: undefined,

          penaltyTaker: false,

          status: 'free',
        }
      },
    )
    .filter(
      (
        player,
      ): player is Player =>
        player !== null,
    )
}

/* =========================
   BASE PLAYERS
========================= */

/*
  Il listone è quello FantaLab aggiornato (database/fantalab_giocatori.csv).
  Il vecchio CSV serve solo a conservare i codici storici ("0280"…): un
  giocatore già presente mantiene il suo codice, così obiettivi, assegnazioni
  e Saggi salvati restano collegati; i giocatori nuovi usano l'ID FantaLab.
  Chi non è più nel listone FantaLab viene escluso.
*/
function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('it')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function fantalabNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

function buildPlayersFromFantaLab(legacy: Player[]): Player[] {
  const rows = parseCsv(fantalabPlayersCsv.replace(/^﻿/, ''))
  if (rows.length < 2) return legacy
  const header = rows[0].map((cell) => cell.trim())
  const records = rows.slice(1).map((cells) =>
    Object.fromEntries(header.map((name, index) => [name, (cells[index] ?? '').trim()])) as Record<string, string>)
    .filter((row) => row['ID FantaLab'] && row['Nel listone'] !== 'No')

  const byFull = new Map<string, Player[]>()
  const byNameRole = new Map<string, Player[]>()
  for (const player of legacy) {
    const full = [normalizeText(player.name), normalizeText(player.team), player.role].join('|')
    const nameRole = [normalizeText(player.name), player.role].join('|')
    byFull.set(full, [...(byFull.get(full) ?? []), player])
    byNameRole.set(nameRole, [...(byNameRole.get(nameRole) ?? []), player])
  }
  const used = new Set<string>()
  const pick = (candidates: Player[] | undefined) => {
    const free = (candidates ?? []).filter((player) => !used.has(player.id))
    return free.length === 1 ? free[0] : undefined
  }

  // Prima i match pieni (nome+squadra+ruolo), poi chi ha cambiato squadra.
  const matches = new Map<string, Player>()
  for (const row of records) {
    const old = pick(byFull.get([normalizeText(row['Nome']), normalizeText(row['Squadra']), row['Ruolo']].join('|')))
    if (old) { used.add(old.id); matches.set(row['ID FantaLab'], old) }
  }
  for (const row of records) {
    if (matches.has(row['ID FantaLab'])) continue
    const old = pick(byNameRole.get([normalizeText(row['Nome']), row['Ruolo']].join('|')))
    if (old) { used.add(old.id); matches.set(row['ID FantaLab'], old) }
  }

  return records.flatMap((row): Player[] => {
    const role = parseRole(row['Ruolo'])
    if (!role) return []
    const old = matches.get(row['ID FantaLab'])
    const base: Player = old
      // statistiche storiche del vecchio listone (stagione precedente)
      ? { ...old }
      // giocatore nuovo: statistiche della stagione in corso da FantaLab
      : {
          id: row['ID FantaLab'],
          name: row['Nome'],
          team: row['Squadra'],
          role,
          mv: fantalabNumber(row['Media Voto']),
          fmv: fantalabNumber(row['Fantamedia']),
          appearances: fantalabNumber(row['Presenze']),
          minutes: fantalabNumber(row['Minuti Giocati']),
          goals: fantalabNumber(row['Gol Totali']),
          assists: fantalabNumber(row['Assist Totali']),
          yellowCards: fantalabNumber(row['Ammonizioni']),
          redCards: fantalabNumber(row['Espulsioni']),
          penaltiesScored: fantalabNumber(row['Rigori Segnati']),
          penaltiesMissed: fantalabNumber(row['Rigori Sbagliati']),
          goalsConceded: fantalabNumber(row['Gol Subiti']),
          penaltiesSaved: fantalabNumber(row['Rigori Parati']),
          iCa: undefined,
          pma: undefined,
          consensus: undefined,
          xMv: undefined,
          xFmv: undefined,
          penaltyTaker: false,
          status: 'free',
        }
    return [{
      ...base,
      // dati correnti sempre dal listone aggiornato
      name: row['Nome'],
      team: row['Squadra'],
      role,
      fantalabId: row['ID FantaLab'],
      fantacalcioId: row['ID Fantacalcio'] || undefined,
      startingProbability: fantalabNumber(row['Titolarità % (Guida)']) ?? base.startingProbability,
      pmaPercent: fantalabNumber(row['PMA % budget (Guida)']) ?? base.pmaPercent,
    }]
  })
}

const basePlayers =
  buildPlayersFromFantaLab(
    parsePlayersCsv(
      playersCsv,
    ),
  )

/* =========================
   ENRICHED PLAYERS
========================= */

export const players:
  Player[] =
  basePlayers.map(
    (player) => ({
      ...player,
      // l'iCà è calcolato da data/icaV3Data (iCà 3), non sul listone
      iCa: undefined,
      consensus:
        calculateConsensus(
          player.id,
        ),
    }),
  )
