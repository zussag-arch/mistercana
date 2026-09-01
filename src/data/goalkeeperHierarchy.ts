import goalkeeperHierarchyCsv
  from '../../database/MisterCana_DB_Portieri_Gerarchie.csv?raw'

export type GoalkeeperHierarchy =
  | 1
  | 2
  | 3

export interface GoalkeeperHierarchyRecord {
  playerId: string
  team: string
  hierarchy: GoalkeeperHierarchy
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
   PARSER
========================= */

function parseHierarchy(
  value: string,
):
  | GoalkeeperHierarchy
  | undefined {
  const parsed =
    Number(
      value.trim(),
    )

  if (
    parsed === 1 ||
    parsed === 2 ||
    parsed === 3
  ) {
    return parsed
  }

  return undefined
}

function parseGoalkeeperHierarchyCsv(
  csv: string,
): GoalkeeperHierarchyRecord[] {
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
      ):
        | GoalkeeperHierarchyRecord
        | null => {
        const playerId =
          getValue(
            row,
            'id_giocatore',
          )

        const team =
          getValue(
            row,
            'Squadra',
          )

        const hierarchy =
          parseHierarchy(
            getValue(
              row,
              'Gerarchia',
            ),
          )

        if (
          !playerId ||
          !team ||
          hierarchy === undefined
        ) {
          return null
        }

        return {
          playerId,
          team,
          hierarchy,
        }
      },
    )
    .filter(
      (
        record,
      ): record is
        GoalkeeperHierarchyRecord =>
        record !== null,
    )
}

/* =========================
   DATABASE
========================= */

export const goalkeeperHierarchies:
  GoalkeeperHierarchyRecord[] =
  parseGoalkeeperHierarchyCsv(
    goalkeeperHierarchyCsv,
  )

const hierarchyByPlayer =
  new Map<
    string,
    GoalkeeperHierarchyRecord
  >()

for (
  const record
  of goalkeeperHierarchies
) {
  hierarchyByPlayer.set(
    record.playerId,
    record,
  )
}

/* =========================
   LOOKUP
========================= */

export function getGoalkeeperHierarchy(
  playerId: string,
):
  | GoalkeeperHierarchyRecord
  | undefined {
  return hierarchyByPlayer.get(
    playerId,
  )
}

export function getGoalkeeperHierarchyValue(
  playerId: string,
):
  | GoalkeeperHierarchy
  | undefined {
  return getGoalkeeperHierarchy(
    playerId,
  )?.hierarchy
}