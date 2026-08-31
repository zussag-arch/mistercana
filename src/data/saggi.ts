import saggiCsv from '../../database/MisterCana_DB_Saggi.csv?raw'

import type {
  ICaSaggioInput,
} from '../domain/ica'

export interface SaggioRecord {
  playerId: string
  saggio: string
  fasciaOriginale: string
  fasciaValore?: number
  affidabilita?: number
  integrita?: number
  prezzo?: number
}

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
   NUMBERS
========================= */

function parseNumber(
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

  const parsed =
    Number(
      value
        .trim()
        .replace(',', '.'),
    )

  return Number.isFinite(parsed)
    ? parsed
    : undefined
}

/* =========================
   DATABASE
========================= */

function parseSaggiCsv(
  csv: string,
): SaggioRecord[] {
  const rows =
    parseCsv(csv)

  if (rows.length < 2) {
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
        columnIndex.get(column)

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
      ): SaggioRecord | null => {
        const playerId =
          getValue(
            row,
            'id_giocatore',
          )

        const saggio =
          getValue(
            row,
            'Saggio',
          )

        if (
          !playerId ||
          !saggio
        ) {
          return null
        }

        return {
          playerId,

          saggio,

          fasciaOriginale:
            getValue(
              row,
              'Fascia_Originale',
            ),

          fasciaValore:
            parseNumber(
              getValue(
                row,
                'Fascia_Valore',
              ),
            ),

          affidabilita:
            parseNumber(
              getValue(
                row,
                'Affidabilita',
              ),
            ),

          integrita:
            parseNumber(
              getValue(
                row,
                'Integrita',
              ),
            ),

          /*
            Conservato per trasparenza
            ma NON utilizzato né
            nell'iCà né nel Consenso.
          */
          prezzo:
            parseNumber(
              getValue(
                row,
                'Prezzo',
              ),
            ),
        }
      },
    )
    .filter(
      (
        record,
      ): record is SaggioRecord =>
        record !== null,
    )
}

export const saggi:
  SaggioRecord[] =
  parseSaggiCsv(
    saggiCsv,
  )

/* =========================
   INDEX BY PLAYER
========================= */

const saggiByPlayer =
  new Map<
    string,
    SaggioRecord[]
  >()

for (const record of saggi) {
  const current =
    saggiByPlayer.get(
      record.playerId,
    ) ?? []

  current.push(record)

  saggiByPlayer.set(
    record.playerId,
    current,
  )
}

export function getSaggiForPlayer(
  playerId: string,
): SaggioRecord[] {
  return (
    saggiByPlayer.get(
      playerId,
    ) ?? []
  )
}

/* =========================
   iCà INPUT
========================= */

export function getICaSaggiForPlayer(
  playerId: string,
): ICaSaggioInput[] {
  return getSaggiForPlayer(
    playerId,
  ).map(
    (record) => ({
      saggio:
        record.saggio,

      fasciaValore:
        record.fasciaValore,

      affidabilita:
        record.affidabilita,

      integrita:
        record.integrita,
    }),
  )
}

/* =========================
   CONSENSO 0-10
========================= */

function round2(
  value: number,
): number {
  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) * 100,
    ) / 100
  )
}

export function calculateConsensus(
  playerId: string,
): number | undefined {
  const fasciaValues =
    getSaggiForPlayer(
      playerId,
    )
      .map(
        (record) =>
          record.fasciaValore,
      )
      .filter(
        (
          value,
        ): value is number =>
          typeof value ===
            'number' &&
          Number.isFinite(value) &&
          value >= 1 &&
          value <= 5,
      )

  if (
    fasciaValues.length === 0
  ) {
    return undefined
  }

  const normalized =
    fasciaValues.map(
      (fascia) =>
        (fascia - 1) * 2.5,
    )

  const average =
    normalized.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / normalized.length

  return round2(average)
}