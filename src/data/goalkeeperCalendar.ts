import goalkeeperCalendarCsv
  from '../../database/MisterCana_DB_Portieri_Calendario.csv?raw'

export type GoalkeeperMatchupValue =
  | 0
  | 1
  | 2

export interface GoalkeeperCalendarTeam {
  team: string

  matchups:
    GoalkeeperMatchupValue[]
}

export interface GoalkeeperCoverage {
  teams: string[]

  days: number

  favorableDays: number
  mediumDays: number
  holes: number

  coveredDays: number

  favorablePercent: number
  coveredPercent: number
  holesPercent: number

  averageMatchup: number
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

function parseMatchupValue(
  raw: string,
):
  | GoalkeeperMatchupValue
  | null {
  const value =
    Number(
      raw.trim(),
    )

  if (
    value === 0 ||
    value === 1 ||
    value === 2
  ) {
    return value
  }

  return null
}

function parseGoalkeeperCalendar(
  csv: string,
):
  GoalkeeperCalendarTeam[] {
  const rows =
    parseCsv(csv)

  if (
    rows.length < 2
  ) {
    return []
  }

  const header =
    rows[0]

  const expectedDays =
    header.length - 1

  return rows
    .slice(1)
    .map(
      (columns) => {
        const team =
          columns[0]?.trim()

        if (!team) {
          return null
        }

        const matchups =
          columns
            .slice(
              1,
              expectedDays + 1,
            )
            .map(
              parseMatchupValue,
            )

        if (
          matchups.length !==
          expectedDays
        ) {
          return null
        }

        if (
          matchups.some(
            (value) =>
              value === null,
          )
        ) {
          return null
        }

        return {
          team,

          matchups:
            matchups as
              GoalkeeperMatchupValue[],
        }
      },
    )
    .filter(
      (
        item,
      ): item is GoalkeeperCalendarTeam =>
        item !== null,
    )
}

/* =========================
   DATABASE
========================= */

export const goalkeeperCalendar =
  parseGoalkeeperCalendar(
    goalkeeperCalendarCsv,
  )

export const goalkeeperCalendarTeams =
  goalkeeperCalendar
    .map(
      (item) =>
        item.team,
    )

/* =========================
   LOOKUP
========================= */

export function getGoalkeeperTeamCalendar(
  team: string,
):
  | GoalkeeperCalendarTeam
  | undefined {
  return goalkeeperCalendar.find(
    (item) =>
      item.team === team,
  )
}

/* =========================
   COVERAGE
========================= */

export function calculateGoalkeeperCoverage(
  teams: string[],
):
  GoalkeeperCoverage | null {
  const uniqueTeams =
    Array.from(
      new Set(
        teams.filter(Boolean),
      ),
    )

  if (
    uniqueTeams.length === 0
  ) {
    return null
  }

  const calendars =
    uniqueTeams
      .map(
        getGoalkeeperTeamCalendar,
      )
      .filter(
        (
          item,
        ): item is GoalkeeperCalendarTeam =>
          item !== undefined,
      )

  if (
    calendars.length !==
    uniqueTeams.length
  ) {
    return null
  }

  const days =
    Math.min(
      ...calendars.map(
        (item) =>
          item.matchups.length,
      ),
    )

  if (
    days <= 0
  ) {
    return null
  }

  const dailyBest:
    GoalkeeperMatchupValue[] =
    []

  for (
    let day = 0;
    day < days;
    day += 1
  ) {
    const values =
      calendars.map(
        (calendar) =>
          calendar.matchups[
            day
          ],
      )

    const best =
      Math.max(
        ...values,
      ) as
        GoalkeeperMatchupValue

    dailyBest.push(
      best,
    )
  }

  const favorableDays =
    dailyBest.filter(
      (value) =>
        value === 2,
    ).length

  const mediumDays =
    dailyBest.filter(
      (value) =>
        value === 1,
    ).length

  const holes =
    dailyBest.filter(
      (value) =>
        value === 0,
    ).length

  const coveredDays =
    favorableDays +
    mediumDays

  const totalValue =
  dailyBest.reduce<number>(
    (
      total,
      value,
    ) =>
      total + value,
    0,
  )

  return {
    teams:
      uniqueTeams,

    days,

    favorableDays,
    mediumDays,
    holes,

    coveredDays,

    favorablePercent:
      (
        favorableDays /
        days
      ) *
      100,

    coveredPercent:
      (
        coveredDays /
        days
      ) *
      100,

    holesPercent:
      (
        holes /
        days
      ) *
      100,

    averageMatchup:
      totalValue /
      days,
  }
}

/* =========================
   PAIRS
========================= */

export function calculateGoalkeeperPairCoverage(
  firstTeam: string,
  secondTeam: string,
):
  GoalkeeperCoverage | null {
  if (
    !firstTeam ||
    !secondTeam ||
    firstTeam ===
      secondTeam
  ) {
    return null
  }

  return calculateGoalkeeperCoverage(
    [
      firstTeam,
      secondTeam,
    ],
  )
}

/* =========================
   TRIPLES
========================= */

export function calculateGoalkeeperTripleCoverage(
  firstTeam: string,
  secondTeam: string,
  thirdTeam: string,
):
  GoalkeeperCoverage | null {
  const teams =
    [
      firstTeam,
      secondTeam,
      thirdTeam,
    ]

  if (
    new Set(
      teams,
    ).size !== 3
  ) {
    return null
  }

  return calculateGoalkeeperCoverage(
    teams,
  )
}