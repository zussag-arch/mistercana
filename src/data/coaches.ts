import coachesCsv from '../../database/MisterCana_DB_Allenatori.csv?raw'

import type {
  ICaCoachInput,
} from '../domain/ica'

import type {
  PlayerRole,
} from '../domain/player'

interface CoachRecord {
  team: string
  coach: string
  formation: string

  goalkeeper?: number

  centralDefenders?: number
  fullbacks?: number

  defensiveMidfielder?: number
  wideMidfielders?: number
  centralMidfielder?: number
  attackingMidfielder?: number

  wingers?: number
  secondStriker?: number
  centralStriker?: number
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

function normalizeText(
  value: string,
): string {
  return value
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .trim()
    .toLowerCase()
}

/* =========================
   DATABASE
========================= */

function parseCoachesCsv(
  csv: string,
): CoachRecord[] {
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
      ): CoachRecord | null => {
        const team =
          getValue(
            row,
            'Squadra',
          )

        if (!team) {
          return null
        }

        return {
          team,

          coach:
            getValue(
              row,
              'Allenatore',
            ),

          formation:
            getValue(
              row,
              'Modulo',
            ),

          goalkeeper:
            parseNumber(
              getValue(
                row,
                'Portiere',
              ),
            ),

          centralDefenders:
            parseNumber(
              getValue(
                row,
                'Difensori centrali',
              ),
            ),

          fullbacks:
            parseNumber(
              getValue(
                row,
                'Terzini',
              ),
            ),

          defensiveMidfielder:
            parseNumber(
              getValue(
                row,
                'Centrocampista difensivo',
              ),
            ),

          wideMidfielders:
            parseNumber(
              getValue(
                row,
                'Esterni di centrocampo',
              ),
            ),

          centralMidfielder:
            parseNumber(
              getValue(
                row,
                'Centrocampista centrale',
              ),
            ),

          attackingMidfielder:
            parseNumber(
              getValue(
                row,
                'Trequartista',
              ),
            ),

          wingers:
            parseNumber(
              getValue(
                row,
                "Ali d'attacco",
              ),
            ),

          secondStriker:
            parseNumber(
              getValue(
                row,
                'Seconda punta',
              ),
            ),

          centralStriker:
            parseNumber(
              getValue(
                row,
                'Punta centrale',
              ),
            ),
        }
      },
    )
    .filter(
      (
        record,
      ): record is CoachRecord =>
        record !== null,
    )
}

const coaches =
  parseCoachesCsv(
    coachesCsv,
  )

/* =========================
   MAX ABS IMPACT
========================= */

function getAllImpacts(
  coach: CoachRecord,
): number[] {
  return [
    coach.goalkeeper,
    coach.centralDefenders,
    coach.fullbacks,
    coach.defensiveMidfielder,
    coach.wideMidfielders,
    coach.centralMidfielder,
    coach.attackingMidfielder,
    coach.wingers,
    coach.secondStriker,
    coach.centralStriker,
  ].filter(
    (
      value,
    ): value is number =>
      typeof value ===
        'number' &&
      Number.isFinite(value),
  )
}

const allImpacts =
  coaches.flatMap(
    getAllImpacts,
  )

const MAX_ABS_IMPACT =
  allImpacts.length > 0
    ? Math.max(
        ...allImpacts.map(
          (value) =>
            Math.abs(value),
        ),
      )
    : 0

/* =========================
   MACRO ROLE
========================= */

function averageAvailable(
  values:
    Array<
      number | undefined
    >,
): number | undefined {
  const valid =
    values.filter(
      (
        value,
      ): value is number =>
        typeof value ===
          'number' &&
        Number.isFinite(value),
    )

  if (
    valid.length === 0
  ) {
    return undefined
  }

  return (
    valid.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / valid.length
  )
}

function getRoleImpact(
  coach: CoachRecord,
  role: PlayerRole,
): number | undefined {
  switch (role) {
    case 'P':
      return coach.goalkeeper

    case 'D':
      return averageAvailable([
        coach.centralDefenders,
        coach.fullbacks,
      ])

    case 'C':
      return averageAvailable([
        coach.defensiveMidfielder,
        coach.wideMidfielders,
        coach.centralMidfielder,
        coach.attackingMidfielder,
      ])

    case 'A':
      return averageAvailable([
        coach.wingers,
        coach.secondStriker,
        coach.centralStriker,
      ])
  }
}

/* =========================
   PUBLIC API
========================= */

export function getCoachInput(
  team: string,
  role: PlayerRole,
): ICaCoachInput | null {
  const normalizedTeam =
    normalizeText(team)

  const coach =
    coaches.find(
      (record) =>
        normalizeText(
          record.team,
        ) === normalizedTeam,
    )

  if (!coach) {
    return null
  }

  const rawImpact =
    getRoleImpact(
      coach,
      role,
    )

  if (
    rawImpact === undefined ||
    MAX_ABS_IMPACT <= 0
  ) {
    return null
  }

  return {
    rawImpact,
    maxAbsImpact:
      MAX_ABS_IMPACT,
  }
}