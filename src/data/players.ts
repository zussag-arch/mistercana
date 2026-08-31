import playersCsv from '../../database/MisterCana_DB_Giocatori_2026_27.csv?raw'

import {
  buildHistoricalBenchmarks,
  calculateICa,
} from '../domain/ica'

import {
  calculateConsensus,
  getICaSaggiForPlayer,
} from './saggi'

import {
  getCoachInput,
} from './coaches'

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

const basePlayers =
  parsePlayersCsv(
    playersCsv,
  )

/* =========================
   HISTORICAL BENCHMARKS
========================= */

const historicalBenchmarks =
  buildHistoricalBenchmarks(
    basePlayers.map(
      (player) => ({
        id: player.id,
        name: player.name,
        team: player.team,
        role: player.role,

        titolarita:
          player.startingProbability,

        mv: player.mv,
        fmv: player.fmv,

        presenze:
          player.appearances,

        ptTit:
          player.startingPoints,

        minuti:
          player.minutes,

        ptInf:
          player.injuryPoints,

        gol:
          player.goals,

        assist:
          player.assists,

        ammonizioni:
          player.yellowCards,

        espulsioni:
          player.redCards,

        rigSegnati:
          player.penaltiesScored,

        rigSbagliati:
          player.penaltiesMissed,

        golSubiti:
          player.goalsConceded,

        rigParati:
          player.penaltiesSaved,
      }),
    ),
  )

/* =========================
   ENRICHED PLAYERS
========================= */

export const players:
  Player[] =
  basePlayers.map(
    (player) => {
      const saggi =
        getICaSaggiForPlayer(
          player.id,
        )

      const coach =
        getCoachInput(
          player.team,
          player.role,
        )

      const iCaResult =
        calculateICa(
          {
            id: player.id,
            name: player.name,
            team: player.team,
            role: player.role,

            titolarita:
              player.startingProbability,

            mv: player.mv,
            fmv: player.fmv,

            presenze:
              player.appearances,

            ptTit:
              player.startingPoints,

            minuti:
              player.minutes,

            ptInf:
              player.injuryPoints,

            gol:
              player.goals,

            assist:
              player.assists,

            ammonizioni:
              player.yellowCards,

            espulsioni:
              player.redCards,

            rigSegnati:
              player.penaltiesScored,

            rigSbagliati:
              player.penaltiesMissed,

            golSubiti:
              player.goalsConceded,

            rigParati:
              player.penaltiesSaved,
          },
          {
            benchmarks:
              historicalBenchmarks,

            saggi,

            coach,
          },
        )

      return {
        ...player,

        iCa:
          iCaResult.score ??
          undefined,

        consensus:
          calculateConsensus(
            player.id,
          ),
      }
    },
  )