import playersCsv from '../../database/MisterCana_DB_Giocatori_2026_27.csv?raw'

import type {
  Player,
  PlayerRole,
} from '../domain/player'

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

    if (
      character === '"'
    ) {
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

  return Number.isFinite(
    parsed,
  )
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

  return Number.isFinite(
    parsed,
  )
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
    normalized === 'sì' ||
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
        row[index] ??
        ''
      ).trim()
    }

  return rows
    .slice(1)
    .map(
      (row): Player | null => {
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

          /*
            Metriche MisterCanà non
            presenti nel listone.

            Non vengono inventate.
          */
          iCa: undefined,
          pma: undefined,
          consensus: undefined,
          xMv: undefined,
          xFmv: undefined,

          /*
            Legacy.

            La pagina Giocatori usa
            il database Battitori
            per identificare i
            rigoristi reali.
          */
          penaltyTaker: false,

          /*
            Stato temporaneo.

            Verrà sostituito dallo
            stato condiviso dell'asta.
          */
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

export const players:
  Player[] =
  parsePlayersCsv(
    playersCsv,
  )