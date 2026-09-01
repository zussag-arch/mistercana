import saggiRaw
  from '../../database/MisterCana_DB_Saggi.csv?raw'

import playersRaw
  from '../../database/MisterCana_DB_Giocatori_2026_27.csv?raw'

import battitoriRaw
  from '../../database/MisterCana_DB_Battitori.csv?raw'

export interface PlayerSagePrice {
  source: string
  price: number

  originalBand?: string
  valueBand?: string
  reliability?: string
  integrity?: string
}

export interface PlayerRawStats {
  appearances?: number
  minutes?: number

  goals?: number
  assists?: number

  yellowCards?: number
  redCards?: number

  penaltiesScored?: number
  penaltiesMissed?: number

  goalsConceded?: number
  penaltiesSaved?: number

  enhanced?: string
  penalized?: string
}

export interface PlayerSetPieceBadge {
  label: string
  rank: number
}

interface CsvRow {
  [key: string]: string
}

/* =========================
   CSV
========================= */

function parseCsvLine(
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
      const next =
        line[
          index + 1
        ]

      if (
        quoted &&
        next === '"'
      ) {
        current += '"'
        index += 1

        continue
      }

      quoted =
        !quoted

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

    current +=
      character
  }

  values.push(
    current.trim(),
  )

  return values
}

function parseCsv(
  raw: string,
): CsvRow[] {
  const normalized =
    raw
      .replace(
        /^\uFEFF/,
        '',
      )
      .replace(
        /\r\n/g,
        '\n',
      )
      .replace(
        /\r/g,
        '\n',
      )

  const lines =
    normalized
      .split('\n')
      .filter(
        (line) =>
          line.trim()
            .length > 0,
      )

  if (
    lines.length === 0
  ) {
    return []
  }

  const headers =
    parseCsvLine(
      lines[0],
    )

  return lines
    .slice(1)
    .map(
      (line) => {
        const values =
          parseCsvLine(
            line,
          )

        const row:
          CsvRow = {}

        headers.forEach(
          (
            header,
            index,
          ) => {
            row[
              header
            ] =
              values[
                index
              ] ??
              ''
          },
        )

        return row
      },
    )
}

/* =========================
   NORMALIZATION
========================= */

function normalizeText(
  value: string,
): string {
  return value
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .trim()
}

function parseNumber(
  value:
    string | undefined,
):
  | number
  | undefined {
  if (!value) {
    return undefined
  }

  const clean =
    value
      .trim()
      .replace('%', '')
      .replace(',', '.')

  if (!clean) {
    return undefined
  }

  const result =
    Number(clean)

  if (
    !Number.isFinite(
      result,
    )
  ) {
    return undefined
  }

  return result
}

function cleanOptionalText(
  value:
    string | undefined,
):
  | string
  | undefined {
  const clean =
    value?.trim() ?? ''

  if (
    !clean ||
    clean === '0' ||
    clean === '-'
  ) {
    return undefined
  }

  return clean
}

/* =========================
   SOURCE DATA
========================= */

const saggiRows =
  parseCsv(
    saggiRaw,
  )

const playerRows =
  parseCsv(
    playersRaw,
  )

const battitoriRows =
  parseCsv(
    battitoriRaw,
  )

/* =========================
   SAGGI
========================= */

export function getPlayerSagePrices(
  playerId: string,
): PlayerSagePrice[] {
  const result:
    PlayerSagePrice[] = []

  const seenSources =
    new Set<string>()

  saggiRows
    .filter(
      (row) =>
        row.id_giocatore
          ?.trim() ===
        playerId,
    )
    .forEach(
      (row) => {
        const source =
          row.Saggio
            ?.trim()

        const price =
          parseNumber(
            row.Prezzo,
          )

        if (
          !source ||
          price ===
            undefined ||
          price < 0
        ) {
          return
        }

        const sourceKey =
          normalizeText(
            source,
          )

        if (
          seenSources.has(
            sourceKey,
          )
        ) {
          return
        }

        seenSources.add(
          sourceKey,
        )

        result.push({
          source,

          price,

          originalBand:
            cleanOptionalText(
              row
                .Fascia_Originale,
            ),

          valueBand:
            cleanOptionalText(
              row
                .Fascia_Valore,
            ),

          reliability:
            cleanOptionalText(
              row
                .Affidabilita,
            ),

          integrity:
            cleanOptionalText(
              row
                .Integrita,
            ),
        })
      },
    )

  return result
}

/* =========================
   RAW PLAYER STATS
========================= */

export function getPlayerRawStats(
  playerId: string,
): PlayerRawStats {
  const row =
    playerRows.find(
      (candidate) =>
        candidate
          .id_giocatore
          ?.trim() ===
        playerId,
    )

  if (!row) {
    return {}
  }

  return {
    appearances:
      parseNumber(
        row.Presenze,
      ),

    minutes:
      parseNumber(
        row.Minuti,
      ),

    goals:
      parseNumber(
        row.Gol,
      ),

    assists:
      parseNumber(
        row.Assist,
      ),

    yellowCards:
      parseNumber(
        row.Ammonizioni,
      ),

    redCards:
      parseNumber(
        row.Espulsioni,
      ),

    penaltiesScored:
      parseNumber(
        row.Rig_Segnati,
      ),

    penaltiesMissed:
      parseNumber(
        row.Rig_Sbagliati,
      ),

    goalsConceded:
      parseNumber(
        row.Gol_Subiti,
      ),

    penaltiesSaved:
      parseNumber(
        row.Rig_Parati,
      ),

    enhanced:
      cleanOptionalText(
        row.Valorizzato,
      ),

    penalized:
      cleanOptionalText(
        row.Penalizzato,
      ),
  }
}

/* =========================
   BATTITORI
========================= */

function cellContainsPlayer(
  cell: string,
  playerName: string,
): boolean {
  const target =
    normalizeText(
      playerName,
    )

  if (!target) {
    return false
  }

  const cleanCell =
    normalizeText(
      cell,
    )

  if (
    cleanCell === target
  ) {
    return true
  }

  /*
    Alcuni database possono
    contenere più nomi nella
    stessa cella separati da
    virgole, slash o "+".
  */
  return cell
    .split(
      /[,/+]/,
    )
    .some(
      (candidate) =>
        normalizeText(
          candidate,
        ) === target,
    )
}

export function getPlayerSetPieceBadges(
  playerName: string,
  team: string,
): PlayerSetPieceBadge[] {
  const teamRow =
    battitoriRows.find(
      (row) =>
        normalizeText(
          row.Squadra ?? '',
        ) ===
        normalizeText(
          team,
        ),
    )

  if (!teamRow) {
    return []
  }

  const badges:
    PlayerSetPieceBadge[] =
    []

  const penaltyColumns =
    [
      'Rigorista 1',
      'Rigorista 2',
      'Rigorista 3',
      'Rigorista 4',
    ]

  const freeKickColumns =
    [
      'Piazzati 1',
      'Piazzati 2',
      'Piazzati 3',
    ]

  penaltyColumns.forEach(
    (
      column,
      index,
    ) => {
      if (
        cellContainsPlayer(
          teamRow[
            column
          ] ?? '',
          playerName,
        )
      ) {
        badges.push({
          label:
            'RIGORI',

          rank:
            index + 1,
        })
      }
    },
  )

  freeKickColumns.forEach(
    (
      column,
      index,
    ) => {
      if (
        cellContainsPlayer(
          teamRow[
            column
          ] ?? '',
          playerName,
        )
      ) {
        badges.push({
          label:
            'PIAZZATI',

          rank:
            index + 1,
        })
      }
    },
  )

  return badges
}