import coachesCsv
  from '../../database/MisterCana_DB_Allenatori.csv?raw'

import goalkeepersCsv
  from '../../database/MisterCana_DB_Portieri.csv?raw'

import fantalabCoachesCsv
  from '../../database/fantalab_allenatori.csv?raw'

import { getCachedPlayersDataset } from '../services/playerRepository'
import { getICaV3Results } from '../data/icaV3Data'
import { localPlayers } from '../services/fantalabLocal'

import {
  runOverlayExit,
} from '../app/motion'

import {
  calculateGoalkeeperPairCoverage,
  goalkeeperCalendarTeams,
} from '../data/goalkeeperCalendar'

import type {
  GoalkeeperCoverage,
} from '../data/goalkeeperCalendar'

/* =========================
   TYPES
========================= */

type CoachRoleKey =
  | 'goalkeeper'
  | 'centreBack'
  | 'fullBack'
  | 'defensiveMid'
  | 'wideMid'
  | 'centralMid'
  | 'attackingMid'
  | 'winger'
  | 'secondStriker'
  | 'striker'

type MacroRoleGroup =
  | 'P'
  | 'D'
  | 'C'
  | 'A'

interface Coach {
  team: string
  name: string
  formation: string

  impacts: Record<
    CoachRoleKey,
    number
  >

  // false se l'allenatore attuale (FantaLab) non è quello del CSV con gli impatti
  impactsAvailable: boolean
  keyRoles: Array<{ label: string; tone: 'good' | 'bad' | 'neutral' }>
}

interface CoachMacroRole {
  key: CoachRoleKey
  label: string
  mantra: string
  group: MacroRoleGroup
}

interface FormationMarker {
  role: CoachRoleKey
  label: string
  x: number
  y: number
}

interface GoalkeeperMatrix {
  teams: string[]

  scores: Record<
    string,
    Record<
      string,
      number | null
    >
  >
}

interface GoalkeeperPairResult {
  team: string
  coverage: GoalkeeperCoverage
}

interface SetPieceTeam {
  team: string
  short: string
  penalties: string[]
  freeKicks: string[]
  corners: string[]
}

/* =========================
   MACRO ROLES
========================= */

const COACH_MACRO_ROLES:
  CoachMacroRole[] = [
    {
      key: 'goalkeeper',
      label: 'Portieri',
      mantra: 'Por',
      group: 'P',
    },
    {
      key: 'centreBack',
      label: 'Difensori centrali',
      mantra: 'Dc',
      group: 'D',
    },
    {
      key: 'fullBack',
      label: 'Terzini',
      mantra: 'B',
      group: 'D',
    },
    {
      key: 'defensiveMid',
      label:
        'Centrocampisti difensivi',
      mantra: 'M',
      group: 'C',
    },
    {
      key: 'wideMid',
      label:
        'Esterni di centrocampo',
      mantra: 'E',
      group: 'C',
    },
    {
      key: 'centralMid',
      label:
        'Centrocampisti centrali',
      mantra: 'C',
      group: 'C',
    },
    {
      key: 'attackingMid',
      label: 'Trequartisti',
      mantra: 'T',
      group: 'A',
    },
    {
      key: 'winger',
      label: 'Ali d’attacco',
      mantra: 'W',
      group: 'A',
    },
    {
      key: 'secondStriker',
      label: 'Seconde punte',
      mantra: 'A',
      group: 'A',
    },
    {
      key: 'striker',
      label: 'Punte centrali',
      mantra: 'Pc',
      group: 'A',
    },
  ]

/* =========================
   LOCAL VIEW STATE
========================= */

let selectedGoalkeeperTeam = ''

let goalkeeperSearchValue = ''

let insightsEventsBound = false

/* =========================
   HTML
========================= */

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll(
      '&',
      '&amp;',
    )
    .replaceAll(
      '<',
      '&lt;',
    )
    .replaceAll(
      '>',
      '&gt;',
    )
    .replaceAll(
      '"',
      '&quot;',
    )
    .replaceAll(
      "'",
      '&#039;',
    )
}

/* =========================
   FORMATTERS
========================= */

function formatPercent(
  value: number,
): string {
  return `${value
    .toFixed(0)
    .replace('.', ',')}%`
}

/* =========================
   CSV
========================= */

function parseCsvRow(
  line: string,
): string[] {
  const values: string[] = []

  let value = ''
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
        value += '"'
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
        value.trim(),
      )

      value = ''

      continue
    }

    value += character
  }

  values.push(
    value.trim(),
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
): number {
  if (!value) {
    return 0
  }

  const normalized =
    value
      .trim()
      .replace(',', '.')

  const parsed =
    Number(normalized)

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0
}

/* =========================
   COACH DATABASE
========================= */

function parseCoachesCsv(
  csv: string,
): Coach[] {
  const rows =
    parseCsv(csv)

  if (
    rows.length < 2
  ) {
    return []
  }

  return rows
    .slice(1)
    .map(
      (columns) => {
        const [
          team,
          name,
          formation,
          goalkeeper,
          centreBack,
          fullBack,
          defensiveMid,
          wideMid,
          centralMid,
          attackingMid,
          winger,
          secondStriker,
          striker,
        ] = columns

        if (
          !team ||
          !name
        ) {
          return null
        }

        return {
          team,
          name,

          formation:
            formation ||
            '—',

          impacts: {
            goalkeeper:
              parseNumber(
                goalkeeper,
              ),

            centreBack:
              parseNumber(
                centreBack,
              ),

            fullBack:
              parseNumber(
                fullBack,
              ),

            defensiveMid:
              parseNumber(
                defensiveMid,
              ),

            wideMid:
              parseNumber(
                wideMid,
              ),

            centralMid:
              parseNumber(
                centralMid,
              ),

            attackingMid:
              parseNumber(
                attackingMid,
              ),

            winger:
              parseNumber(
                winger,
              ),

            secondStriker:
              parseNumber(
                secondStriker,
              ),

            striker:
              parseNumber(
                striker,
              ),
          },
        }
      },
    )
    .filter(
      (
        coach,
      ): coach is Coach =>
        coach !== null,
    )
}

/* =========================
   LEGACY GOALKEEPER MATRIX

   IMPORTANTE:
   questo database continua
   ad alimentare SOLO la griglia
   nell'overlay.

   Insight usa invece il nuovo
   calendario 0/1/2.
========================= */

function parseGoalkeeperCsv(
  csv: string,
): GoalkeeperMatrix {
  const rows =
    parseCsv(csv)

  if (
    rows.length < 2
  ) {
    return {
      teams: [],
      scores: {},
    }
  }

  const teams =
    rows[0]
      .slice(1)
      .filter(Boolean)

  const scores:
    GoalkeeperMatrix['scores'] =
    {}

  rows
    .slice(1)
    .forEach(
      (columns) => {
        const rowTeam =
          columns[0]

        if (!rowTeam) {
          return
        }

        scores[rowTeam] = {}

        teams.forEach(
          (
            columnTeam,
            index,
          ) => {
            const raw =
              columns[
                index + 1
              ]

            if (
              !raw ||
              rowTeam ===
                columnTeam
            ) {
              scores[rowTeam][
                columnTeam
              ] = null

              return
            }

            const parsed =
              Number(
                raw.replace(
                  ',',
                  '.',
                ),
              )

            scores[rowTeam][
              columnTeam
            ] =
              Number.isFinite(
                parsed,
              )
                ? parsed
                : null
          },
        )
      },
    )

  return {
    teams,
    scores,
  }
}

/* =========================
   SET PIECES DATABASE
========================= */

/* =========================
   DATABASES
========================= */

/* Tabella FantaLab di oggi: allenatore, modulo, ruoli chiave e battitori. */
const FANTALAB_TEAMS = (() => {
  const lines = fantalabCoachesCsv.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim())
  const header = lines[0].split(';')
  return lines.slice(1).map((line) => {
    const cells = line.split(';')
    return Object.fromEntries(header.map((name, index) => [name.trim(), (cells[index] ?? '').trim()]))
  })
})()

const splitNames = (value: string | undefined): string[] =>
  (value ?? '').split(',').map((name) => name.trim()).filter(Boolean)

function surname(value: string): string {
  return value.trim().split(/\s+/).pop()?.toLocaleLowerCase('it') ?? ''
}

function mergeCoaches(legacy: Coach[]): Coach[] {
  if (!FANTALAB_TEAMS.length) return legacy
  return FANTALAB_TEAMS.map((row) => {
    const old = legacy.find((coach) => coach.team === row['Squadra'])
    const sameCoach = Boolean(old && surname(row['Allenatore']) === surname(old.name))
    const hasValues = Boolean(old && Object.values(old.impacts).some((value) => value !== 0))
    const keyRoles = (row['Ruoli chiave'] ?? '').split('|').flatMap((item) => {
      const match = item.trim().match(/^(.+?)\s*\((positivo|negativo|neutro)\)$/i)
      if (!match) return []
      const tone = match[2].toLowerCase() === 'positivo' ? 'good' as const
        : match[2].toLowerCase() === 'negativo' ? 'bad' as const : 'neutral' as const
      return [{ label: match[1], tone }]
    })
    return {
      team: row['Squadra'],
      name: row['Allenatore'] || old?.name || '—',
      formation: row['Modulo'] || old?.formation || '',
      impacts: old?.impacts ?? Object.fromEntries(COACH_MACRO_ROLES.map((role) => [role.key, 0])) as Coach['impacts'],
      impactsAvailable: sameCoach && hasValues,
      keyRoles,
    }
  })
}

const COACHES =
  mergeCoaches(
    parseCoachesCsv(
      coachesCsv,
    ),
  )

const GOALKEEPER_MATRIX =
  parseGoalkeeperCsv(
    goalkeepersCsv,
  )

// Gerarchie dei battitori dalla tabella FantaLab, nell'ordine della fonte.
const SET_PIECE_TEAMS: SetPieceTeam[] =
  FANTALAB_TEAMS.map((row) => ({
    team: row['Squadra'],
    short: row['Sigla'] ?? '',
    penalties: splitNames(row['Rigoristi']).slice(0, 3),
    freeKicks: splitNames(row['Punizioni']).slice(0, 3),
    corners: splitNames(row["Calci d'angolo"]).slice(0, 3),
  }))

/* =========================
   GOALKEEPER CALENDAR
========================= */

function compareGoalkeeperPairResults(
  first: GoalkeeperPairResult,
  second: GoalkeeperPairResult,
): number {
  /*
    Nessun peso arbitrario.

    Ordine:
    1. più giornate favorevoli
    2. meno buchi
    3. media matchup più alta
    4. nome squadra
  */

  const favorableDifference =
    second
      .coverage
      .favorableDays -
    first
      .coverage
      .favorableDays

  if (
    favorableDifference !== 0
  ) {
    return favorableDifference
  }

  const holesDifference =
    first
      .coverage
      .holes -
    second
      .coverage
      .holes

  if (
    holesDifference !== 0
  ) {
    return holesDifference
  }

  const averageDifference =
    second
      .coverage
      .averageMatchup -
    first
      .coverage
      .averageMatchup

  if (
    averageDifference !== 0
  ) {
    return averageDifference
  }

  return first.team.localeCompare(
    second.team,
    'it',
  )
}

function getGoalkeeperTopThree(
  team: string,
):
  GoalkeeperPairResult[] {
  if (!team) {
    return []
  }

  return goalkeeperCalendarTeams
    .filter(
      (pairedTeam) =>
        pairedTeam !== team,
    )
    .map(
      (pairedTeam) => {
        const coverage =
          calculateGoalkeeperPairCoverage(
            team,
            pairedTeam,
          )

        if (!coverage) {
          return null
        }

        return {
          team:
            pairedTeam,

          coverage,
        }
      },
    )
    .filter(
      (
        result,
      ): result is GoalkeeperPairResult =>
        result !== null,
    )
    .sort(
      compareGoalkeeperPairResults,
    )
    .slice(
      0,
      3,
    )
}

function renderGoalkeeperTopThree(
  team: string,
): string {
  if (!team) {
    return `
      <div
        class="
          goalkeeper-recommendations-empty
        "
      >
        <span>
          Cerca una squadra
        </span>

        <small>
          I tre migliori abbinamenti
          calendario compariranno qui.
        </small>
      </div>
    `
  }

  const results =
    getGoalkeeperTopThree(
      team,
    )

  if (
    results.length === 0
  ) {
    return `
      <div
        class="
          goalkeeper-recommendations-empty
        "
      >
        Nessun abbinamento calendario
        disponibile.
      </div>
    `
  }

  return `
    <div
      class="
        goalkeeper-selection-heading
      "
    >
      <span>Migliori abbinamenti calendario</span>
        <strong>${escapeHtml(team)}${starterKeeper(team) ? ` <small>· 🧤 ${escapeHtml(starterKeeper(team) ?? "")}</small>` : ''}</strong>
    </div>

    <div
      class="
        goalkeeper-recommendations-list
      "
    >
      ${results
        .map(
          (
            result,
            index,
          ) => `
            <div
              class="
                goalkeeper-recommendation
              "
            >
              <span
                class="
                  goalkeeper-rank
                "
              >
                ${index + 1}
              </span>

              <div
                class="
                  goalkeeper-recommendation-team
                "
              >
                <strong>
                  ${escapeHtml(
                    result.team,
                  )}
                </strong>${starterKeeper(result.team) ? `<span class="goalkeeper-keeper">🧤 ${escapeHtml(starterKeeper(result.team) ?? "")}</span>` : ''}

                <small>
                  Favorevoli
                  ${result.coverage.favorableDays}/${result.coverage.days}
                  ·
                  Copertura
                  ${formatPercent(
                    result.coverage.coveredPercent,
                  )}
                  ·
                  Buchi
                  ${result.coverage.holes}
                </small>
              </div>

              <span
                class="
                  goalkeeper-score
                "
                title="Giornate con almeno un matchup favorevole"
              >
                ${formatPercent(
                  result
                    .coverage
                    .favorablePercent,
                )}
              </span>
            </div>
          `,
        )
        .join('')}
    </div>

    <div
      class="
        goalkeeper-recommendations-empty
      "
      style="
        margin-top: 8px;
        min-height: 0;
        padding: 8px 10px;
      "
    >
      <small>
        Classifica:
        più giornate favorevoli,
        poi meno buchi,
        poi miglior media matchup.
      </small>
    </div>
  `
}

// Portiere titolare della squadra secondo i dati correnti (Guida FantaLab o FLDA).
function starterKeeper(team: string): string | undefined {
  const keepers = getCachedPlayersDataset()?.players
    .filter((player) => player.team === team && player.role === 'P') ?? []
  const starter = keepers.find((player) => player.goalkeeper_rank === 1)
    ?? keepers.find((player) => player.is_starting_xi)
  return starter?.name
}

function renderGoalkeeperTeamChips(): string {
  return goalkeeperCalendarTeams.map((team) => `<button type="button" class="goalkeeper-team-chip${team === selectedGoalkeeperTeam ? ' selected' : ''}" data-goalkeeper-team="${escapeHtml(team)}" aria-pressed="${team === selectedGoalkeeperTeam}">${escapeHtml(team)}</button>`).join('')
}

function getGoalkeeperMatches(
  query: string,
): string[] {
  const normalized =
    query
      .trim()
      .toLowerCase()

  if (!normalized) {
    return []
  }

  return goalkeeperCalendarTeams
    .filter(
      (team) =>
        team
          .toLowerCase()
          .includes(
            normalized,
          ),
    )
    .slice(
      0,
      8,
    )
}

function renderGoalkeeperSuggestions(
  query: string,
): string {
  const matches =
    getGoalkeeperMatches(
      query,
    )

  if (
    !query.trim()
  ) {
    return ''
  }

  if (
    matches.length === 0
  ) {
    return `
      <div
        class="
          goalkeeper-search-no-result
        "
      >
        Nessuna squadra trovata
      </div>
    `
  }

  return matches
    .map(
      (team) => `
        <button
          type="button"
          class="
            goalkeeper-search-suggestion
          "
          data-goalkeeper-team="${escapeHtml(
            team,
          )}"
        >
          ${escapeHtml(
            team,
          )}
        </button>
      `,
    )
    .join('')
}

/* =========================
   LEGACY MATRIX HELPERS
========================= */

function getMatrixScoreClass(
  score: number | null,
): string {
  if (
    score === null
  ) {
    return 'matrix-empty'
  }

  if (
    score >= 90
  ) {
    return 'matrix-excellent'
  }

  if (
    score >= 86
  ) {
    return 'matrix-good'
  }

  if (
    score >= 82
  ) {
    return 'matrix-medium'
  }

  return 'matrix-low'
}

function renderGoalkeeperMatrix(
  selectedTeam = '',
): string {
  if (
    GOALKEEPER_MATRIX
      .teams.length === 0
  ) {
    return `
      <div
        class="
          goalkeeper-matrix-empty
        "
      >
        Database portieri vuoto.
      </div>
    `
  }

  return `
    <div
      class="
        goalkeeper-matrix-scroll
      "
    >
      <table
        class="
          goalkeeper-matrix-table
        "
      >
        <thead>
          <tr>
            <th
              class="
                goalkeeper-matrix-corner
              "
            >
              Squadra
            </th>

            ${GOALKEEPER_MATRIX
              .teams
              .map(
                (team) => `
                  <th
                    class="${
                      team ===
                      selectedTeam
                        ? 'is-selected'
                        : ''
                    }"
                    title="${escapeHtml(
                      team,
                    )}"
                  >
                    ${escapeHtml(
                      team.slice(
                        0,
                        3,
                      ).toUpperCase(),
                    )}
                  </th>
                `,
              )
              .join('')}
          </tr>
        </thead>

        <tbody>
          ${GOALKEEPER_MATRIX
            .teams
            .map(
              (rowTeam) => `
                <tr
                  class="${
                    rowTeam ===
                    selectedTeam
                      ? 'is-selected'
                      : ''
                  }"
                >
                  <th>
                    ${escapeHtml(
                      rowTeam,
                    )}
                  </th>

                  ${GOALKEEPER_MATRIX
                    .teams
                    .map(
                      (
                        columnTeam,
                      ) => {
                        const score =
                          GOALKEEPER_MATRIX
                            .scores[
                              rowTeam
                            ]?.[
                              columnTeam
                            ] ??
                          null

                        const selected =
                          rowTeam ===
                            selectedTeam ||
                          columnTeam ===
                            selectedTeam

                        return `
                          <td
                            class="
                              ${getMatrixScoreClass(
                                score,
                              )}
                              ${
                                selected
                                  ? 'is-selected'
                                  : ''
                              }
                            "
                            title="${escapeHtml(
                              rowTeam,
                            )} / ${escapeHtml(
                              columnTeam,
                            )}"
                          >
                            ${
                              score ===
                              null
                                ? '—'
                                : score
                            }
                          </td>
                        `
                      },
                    )
                    .join('')}
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

/* =========================
   GOALKEEPER SECTION
========================= */

function renderGoalkeeperSection():
  string {
  return `
    <section
      class="
        insight-section
        goalkeeper-insight-section
      "
    >
      <div
        class="
          insight-section-header
        "
      >
        <div>
          <span
            class="
              insight-eyebrow
            "
          >
            PORTIERI
          </span>

          <h2>
            Abbinamenti portieri
          </h2>

          <p>
            Cerca una squadra.
            I suggerimenti vengono
            calcolati giornata per
            giornata dal calendario
            matchup 0 / 1 / 2.
          </p>
        </div>

        <button
          type="button"
          class="
            insight-database-button
          "
          data-open-goalkeeper-matrix
        >
          Vedi griglia
        </button>
      </div>

      <div
        class="
          goalkeeper-tool
        "
      >
        <div
          class="
            goalkeeper-search-area
          "
        >
          <label
            class="
              goalkeeper-search-box
            "
          >
            <span
              class="
                goalkeeper-search-icon
              "
            >
              ⌕
            </span>

            <input
              id="goalkeeperSearch"
              type="search"
              autocomplete="off"
              placeholder="Cerca squadra..."
              value="${escapeHtml(
                goalkeeperSearchValue,
              )}"
            >
          </label>

          <div
            id="goalkeeperSuggestions"
            class="
              goalkeeper-search-suggestions
            "
          >
            ${renderGoalkeeperSuggestions(
              goalkeeperSearchValue,
            )}
          </div>
          <div id="goalkeeperTeamChips" class="goalkeeper-team-chips">${renderGoalkeeperTeamChips()}</div>
        </div>

        <div
          id="goalkeeperRecommendations"
          class="
            goalkeeper-recommendations
          "
        >
          ${renderGoalkeeperTopThree(
            selectedGoalkeeperTeam,
          )}
        </div>
      </div>
    </section>

    <div
      id="goalkeeperMatrixOverlay"
      class="
        goalkeeper-matrix-overlay
      "
      hidden
      aria-hidden="true"
      data-goalkeeper-overlay
    >
      <div
        class="
          goalkeeper-matrix-dialog
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="goalkeeperMatrixTitle"
      >
        <div
          class="
            goalkeeper-matrix-header
          "
        >
          <div>
            <span
              class="
                insight-eyebrow
              "
            >
              PORTIERI
            </span>

            <h2
              id="goalkeeperMatrixTitle"
            >
              Griglia abbinamenti
            </h2>

            <p>
              Compatibilità tra le squadre: più alto il valore, più le due squadre si alternano bene in calendario. Scegli una squadra per evidenziarne riga e colonna.
            </p>
          </div>

          <button
            type="button"
            class="
              goalkeeper-matrix-close
            "
            data-close-goalkeeper-matrix
            aria-label="Chiudi griglia portieri"
          >
            ×
          </button>
        </div>

        <div
          id="goalkeeperMatrixContent"
          class="
            goalkeeper-matrix-content
          "
        >
          ${renderGoalkeeperMatrix(
            selectedGoalkeeperTeam,
          )}
        </div>

        <div
          class="
            goalkeeper-matrix-legend
          "
        >
          <span>
            <i
              class="
                legend-low
              "
            ></i>
            Basso
          </span>

          <span>
            <i
              class="
                legend-medium
              "
            ></i>
            Medio
          </span>

          <span>
            <i
              class="
                legend-good
              "
            ></i>
            Buono
          </span>

          <span>
            <i
              class="
                legend-excellent
              "
            ></i>
            Ottimo
          </span>
        </div>
      </div>
    </div>
  `
}

/* =========================
   SET PIECES
========================= */

function setPieceRole(team: string, name: string): string | undefined {
  const wanted = name.trim().toLocaleLowerCase('it')
  return getCachedPlayersDataset()?.players.find((player) =>
    player.team === team && player.name.trim().toLocaleLowerCase('it') === wanted)?.role
}

function renderSetPieceList(team: string, label: string, players: string[]): string {
  return `
    <div class="set-piece-column">
      <span class="set-piece-label">${label}</span>
      ${players.length
        ? `<ol>${players.map((player, index) => {
            const role = setPieceRole(team, player)
            return `<li class="${index === 0 ? 'is-first' : ''}">
              <span class="set-piece-rank">${index + 1}</span>
              ${role ? `<span class="role-badge role-${role.toLowerCase()} set-piece-role">${escapeHtml(role)}</span>` : ''}
              <span class="set-piece-name">${escapeHtml(player)}</span>
            </li>`
          }).join('')}</ol>`
        : '<p class="set-piece-empty">—</p>'}
    </div>
  `
}

// iCà 3 per ruolo: i migliori per valore atteso (con la V2 accanto per
// confronto) e i migliori affari (valore alto rispetto al prezzo).
function renderICaV3Section(): string {
  const results = getICaV3Results()
  const roles: Array<['P' | 'D' | 'C' | 'A', string]> = [['P', 'Portieri'], ['D', 'Difensori'], ['C', 'Centrocampisti'], ['A', 'Attaccanti']]
  const fmt = (value: number | undefined) => typeof value === 'number' ? String(Math.round(value)) : '—'
  const signed = (value: number | undefined) => typeof value === 'number' ? `${value > 0 ? '+' : ''}${Math.round(value)}` : '—'
  const players = localPlayers().players
  const column = (role: 'P' | 'D' | 'C' | 'A', label: string) => {
    const rows = players.filter((player) => player.role === role && player.player_id)
      .map((player) => ({ player, v3: results.get(player.player_id as string) }))
      .filter((row) => typeof row.v3?.score === 'number')
    const top = [...rows].sort((a, b) => (b.v3!.score! - a.v3!.score!)).slice(0, 6)
    const deals = rows.filter((row) => row.v3!.score! >= 40 && typeof row.v3!.affare === 'number')
      .sort((a, b) => b.v3!.affare! - a.v3!.affare!).slice(0, 4)
    const line = (row: typeof rows[number], deal: boolean) => `<li data-player-ref="${escapeHtml(row.player.player_id ?? '')}">
      <span class="ica3-name">${escapeHtml(row.player.name)}<small>${escapeHtml(row.player.team)}</small></span>
      <span class="ica3-score">${fmt(row.v3!.score)}</span>
      ${deal || (row.v3!.affare ?? 0) >= 15 ? `<span class="ica3-affare">${signed(row.v3!.affare)}</span>` : `<span class="ica3-v2">affare ${signed(row.v3!.affare)}</span>`}
    </li>`
    return `<article class="ica3-role role-tone-${role.toLowerCase()}">
      <header><span class="role-badge role-${role.toLowerCase()}">${role}</span><strong>${label}</strong></header>
      <span class="ica3-label">Migliori per valore atteso</span>
      <ol>${top.map((row) => line(row, false)).join('') || '<li class="ica3-empty">—</li>'}</ol>
      <span class="ica3-label">Migliori affari</span>
      <ol>${deals.map((row) => line(row, true)).join('') || '<li class="ica3-empty">—</li>'}</ol>
    </article>`
  }
  return `
    <section class="insight-section ica3-section">
      <div class="insight-section-header">
        <div>
          <span class="insight-eyebrow">Valutazione</span>
          <h2>iCà e affari</h2>
          <p>iCà = fantapunti attesi rispetto al ruolo (0-100). Affare = posizione per iCà meno posizione per prezzo: positivo se rende più di quanto costa.</p>
        </div>
        <span class="insight-database-status">FantaLab · ${results.size} giocatori</span>
      </div>
      <div class="ica3-grid">${roles.map(([role, label]) => column(role, label)).join('')}</div>
    </section>`
}

function renderSetPiecesSection():
  string {
  return `
    <section class="insight-section set-pieces-section">
      <div class="insight-section-header">
        <div>
          <span class="insight-eyebrow">Specialisti</span>
          <h2>Rigori e piazzati</h2>
          <p>Gerarchie dei battitori per squadra: il primo è il titolare del compito.</p>
        </div>
        <span class="insight-database-status">${SET_PIECE_TEAMS.length} squadre · FantaLab</span>
      </div>
      ${SET_PIECE_TEAMS.length
        ? `<div class="set-pieces-grid">${SET_PIECE_TEAMS.map((item) => `
            <article class="set-piece-card">
              <header class="set-piece-team"><strong>${escapeHtml(item.team)}</strong>${item.short ? `<small>${escapeHtml(item.short)}</small>` : ''}</header>
              <div class="set-piece-columns">
                ${renderSetPieceList(item.team, 'Rigori', item.penalties)}
                ${renderSetPieceList(item.team, 'Punizioni', item.freeKicks)}
                ${renderSetPieceList(item.team, 'Angoli', item.corners)}
              </div>
            </article>`).join('')}</div>`
        : '<p class="set-piece-empty">Tabella battitori non disponibile.</p>'}
    </section>
  `
}

function marker(
  role: CoachRoleKey,
  label: string,
  x: number,
  y: number,
): FormationMarker {
  return {
    role,
    label,
    x,
    y,
  }
}

function getFormationMarkers(
  formation: string,
): FormationMarker[] {
  switch (
    formation.trim()
  ) {
    case '4-3-3':
      return [
        marker(
          'goalkeeper',
          'Por',
          50,
          91,
        ),

        marker(
          'fullBack',
          'B',
          18,
          73,
        ),

        marker(
          'centreBack',
          'Dc',
          39,
          78,
        ),

        marker(
          'centreBack',
          'Dc',
          61,
          78,
        ),

        marker(
          'fullBack',
          'B',
          82,
          73,
        ),

        marker(
          'centralMid',
          'C',
          28,
          51,
        ),

        marker(
          'defensiveMid',
          'M',
          50,
          57,
        ),

        marker(
          'centralMid',
          'C',
          72,
          51,
        ),

        marker(
          'winger',
          'W',
          24,
          24,
        ),

        marker(
          'striker',
          'Pc',
          50,
          15,
        ),

        marker(
          'winger',
          'W',
          76,
          24,
        ),
      ]

    case '4-2-3-1':
      return [
        marker(
          'goalkeeper',
          'Por',
          50,
          91,
        ),

        marker(
          'fullBack',
          'B',
          18,
          73,
        ),

        marker(
          'centreBack',
          'Dc',
          39,
          78,
        ),

        marker(
          'centreBack',
          'Dc',
          61,
          78,
        ),

        marker(
          'fullBack',
          'B',
          82,
          73,
        ),

        marker(
          'defensiveMid',
          'M',
          39,
          56,
        ),

        marker(
          'centralMid',
          'C',
          61,
          56,
        ),

        marker(
          'winger',
          'W',
          24,
          34,
        ),

        marker(
          'attackingMid',
          'T',
          50,
          30,
        ),

        marker(
          'winger',
          'W',
          76,
          34,
        ),

        marker(
          'striker',
          'Pc',
          50,
          13,
        ),
      ]

    case '3-4-2-1':
      return [
        marker(
          'goalkeeper',
          'Por',
          50,
          91,
        ),

        marker(
          'centreBack',
          'Dc',
          27,
          75,
        ),

        marker(
          'centreBack',
          'Dc',
          50,
          79,
        ),

        marker(
          'centreBack',
          'Dc',
          73,
          75,
        ),

        marker(
          'wideMid',
          'E',
          16,
          52,
        ),

        marker(
          'centralMid',
          'C',
          40,
          56,
        ),

        marker(
          'centralMid',
          'C',
          60,
          56,
        ),

        marker(
          'wideMid',
          'E',
          84,
          52,
        ),

        marker(
          'attackingMid',
          'T',
          38,
          31,
        ),

        marker(
          'attackingMid',
          'T',
          62,
          31,
        ),

        marker(
          'striker',
          'Pc',
          50,
          12,
        ),
      ]

    // 3-4-3: tre centrali, quattro di centrocampo, due ali e una punta
    case '3-4-3':
      return [
        marker('goalkeeper', 'Por', 50, 91),
        marker('centreBack', 'Dc', 27, 75),
        marker('centreBack', 'Dc', 50, 79),
        marker('centreBack', 'Dc', 73, 75),
        marker('wideMid', 'E', 14, 52),
        marker('centralMid', 'C', 38, 56),
        marker('centralMid', 'C', 62, 56),
        marker('wideMid', 'E', 86, 52),
        marker('winger', 'W', 24, 26),
        marker('striker', 'Pc', 50, 16),
        marker('winger', 'W', 76, 26),
      ]
    // 3-5-1-1: come il 3-5-2 con un trequartista dietro la punta
    case '3-5-1-1':
      return [
        marker('goalkeeper', 'Por', 50, 91),
        marker('centreBack', 'Dc', 27, 75),
        marker('centreBack', 'Dc', 50, 79),
        marker('centreBack', 'Dc', 73, 75),
        marker('wideMid', 'E', 14, 50),
        marker('centralMid', 'C', 34, 54),
        marker('defensiveMid', 'M', 50, 58),
        marker('centralMid', 'C', 66, 54),
        marker('wideMid', 'E', 86, 50),
        marker('attackingMid', 'T', 50, 33),
        marker('striker', 'Pc', 50, 15),
      ]
    case '3-5-2':
      return [
        marker(
          'goalkeeper',
          'Por',
          50,
          91,
        ),

        marker(
          'centreBack',
          'Dc',
          27,
          75,
        ),

        marker(
          'centreBack',
          'Dc',
          50,
          79,
        ),

        marker(
          'centreBack',
          'Dc',
          73,
          75,
        ),

        marker(
          'wideMid',
          'E',
          14,
          50,
        ),

        marker(
          'centralMid',
          'C',
          34,
          54,
        ),

        marker(
          'defensiveMid',
          'M',
          50,
          58,
        ),

        marker(
          'centralMid',
          'C',
          66,
          54,
        ),

        marker(
          'wideMid',
          'E',
          86,
          50,
        ),

        marker(
          'secondStriker',
          'A',
          39,
          19,
        ),

        marker(
          'striker',
          'Pc',
          61,
          19,
        ),
      ]

    case '4-3-2-1':
      return [
        marker(
          'goalkeeper',
          'Por',
          50,
          91,
        ),

        marker(
          'fullBack',
          'B',
          18,
          73,
        ),

        marker(
          'centreBack',
          'Dc',
          39,
          78,
        ),

        marker(
          'centreBack',
          'Dc',
          61,
          78,
        ),

        marker(
          'fullBack',
          'B',
          82,
          73,
        ),

        marker(
          'centralMid',
          'C',
          30,
          53,
        ),

        marker(
          'defensiveMid',
          'M',
          50,
          58,
        ),

        marker(
          'centralMid',
          'C',
          70,
          53,
        ),

        marker(
          'attackingMid',
          'T',
          39,
          31,
        ),

        marker(
          'attackingMid',
          'T',
          61,
          31,
        ),

        marker(
          'striker',
          'Pc',
          50,
          12,
        ),
      ]

    default:
      return [
        marker(
          'goalkeeper',
          'Por',
          50,
          91,
        ),

        marker(
          'centreBack',
          'Dc',
          35,
          73,
        ),

        marker(
          'centreBack',
          'Dc',
          65,
          73,
        ),

        marker(
          'centralMid',
          'C',
          35,
          50,
        ),

        marker(
          'centralMid',
          'C',
          65,
          50,
        ),

        marker(
          'striker',
          'Pc',
          50,
          18,
        ),
      ]
  }
}

function getMacroRoleGroup(
  role: CoachRoleKey,
): MacroRoleGroup {
  return (
    COACH_MACRO_ROLES.find(
      (item) =>
        item.key === role,
    )?.group ??
    'C'
  )
}

/* =========================
   COACH PITCH
========================= */

function renderCoachPitch(
  formation: string,
): string {
  const markers =
    getFormationMarkers(
      formation,
    )

  return `
    <div
      class="
        coach-pitch
      "
    >
      <div
        class="
          pitch-line
          pitch-half
        "
      ></div>

      <div
        class="
          pitch-circle
        "
      ></div>

      <div
        class="
          pitch-box
          pitch-box-top
        "
      ></div>

      <div
        class="
          pitch-box
          pitch-box-bottom
        "
      ></div>

      ${markers
        .map(
          (item) => {
            const group =
              getMacroRoleGroup(
                item.role,
              )

            return `
              <div
                class="
                  coach-player-marker
                  coach-player-${group.toLowerCase()}
                "
                style="
                  left:${item.x}%;
                  top:${item.y}%;
                "
                title="${escapeHtml(
                  item.role,
                )}"
              >
                ${escapeHtml(
                  item.label,
                )}
              </div>
            `
          },
        )
        .join('')}
    </div>
  `
}

/* =========================
   COACH IMPACT
========================= */

function formatImpact(
  value: number,
): string {
  if (
    value > 0
  ) {
    return `+${value.toFixed(
      2,
    )}`
  }

  if (
    value < 0
  ) {
    return value.toFixed(2)
  }

  return '0.00'
}

function getImpactClass(
  value: number,
): string {
  if (
    value > 0
  ) {
    return 'positive'
  }

  if (
    value < 0
  ) {
    return 'negative'
  }

  return 'neutral'
}

/* =========================
   COACH SECTION
========================= */

function renderCoachSection():
  string {
  return `
    <section
      class="
        insight-section
      "
    >
      <div
        class="
          insight-section-header
        "
      >
        <div>
          <span
            class="
              insight-eyebrow
            "
          >
            ALLENATORI SERIE A
          </span>

          <h2>
            Impatto allenatori
          </h2>

          <p>
            Modulo preferito e impatto
            sui macro-ruoli Mantra.
          </p>
        </div>

        <span
          class="
            insight-database-status
          "
        >
          ${COACHES.length}
          allenatori dal database
        </span>
      </div>

      ${
        COACHES.length
          ? `
            <div
              class="
                coach-grid
              "
            >
              ${COACHES
                .map(
                  (coach) => `
                    <article
                      class="
                        coach-card
                      "
                    >
                      <div
                        class="
                          coach-card-header
                        "
                      >
                        <div>
                          <div
                            class="
                              coach-title-row
                            "
                          >
                            <strong>
                              ${escapeHtml(
                                coach.name,
                              )}
                            </strong>
                          </div>

                          <small>
                            ${escapeHtml(
                              coach.team,
                            )}
                          </small>
                        </div>

                        <span
                          class="
                            coach-formation
                          "
                        >
                          ${escapeHtml(
                            coach.formation,
                          )}
                        </span>
                      </div>
                      ${coach.keyRoles.length ? `<div class="coach-key-roles">${coach.keyRoles.map((item) => `<span class="coach-key-role coach-key-${item.tone}">${escapeHtml(item.label)}${item.tone === 'good' ? ' +' : item.tone === 'bad' ? ' −' : ''}</span>`).join('')}</div>` : ''}

                      <div
                        class="
                          coach-card-body
                        "
                      >
                        ${renderCoachPitch(
                          coach.formation,
                        )}

                        <div
                          class="
                            coach-macro-role-list
                          "
                        >
                          ${COACH_MACRO_ROLES
                            .map(
                              (role) => {
                                const value =
                                  coach
                                    .impacts[
                                      role.key
                                    ]

                                return `
                                  <div
                                    class="
                                      coach-macro-role-row
                                    "
                                  >
                                    <div
                                      class="
                                        coach-macro-role-name
                                      "
                                    >
                                      <span
                                        class="
                                          coach-role-dot
                                          coach-role-${role.group.toLowerCase()}
                                        "
                                      >
                                        ${escapeHtml(
                                          role.mantra,
                                        )}
                                      </span>

                                      <div>
                                        <strong>
                                          ${escapeHtml(
                                            role.label,
                                          )}
                                        </strong>

                                        <small>
                                          ${escapeHtml(
                                            role.mantra,
                                          )}
                                        </small>
                                      </div>
                                    </div>

                                    <span
                                      class="
                                        coach-impact-value
                                        coach-impact-${coach.impactsAvailable ? getImpactClass(
                                          value,
                                        ) : 'neutral'}
                                      "
                                    >
                                      ${coach.impactsAvailable ? formatImpact(
                                        value,
                                      ) : 'n.d.'}
                                    </span>
                                  </div>
                                `
                              },
                            )
                            .join('')}
                        </div>
                      </div>
                    </article>
                  `,
                )
                .join('')}
            </div>
          `
          : `
            <div
              class="
                insight-database-empty
              "
            >
              Database allenatori vuoto.
            </div>
          `
      }
    </section>
  `
}

/* =========================
   PAGE
========================= */

export function renderInsightsPage():
  string {
  return `
    <section
      class="
        page
        insights-page
      "
    >
      <div
        class="
          insights-page-header
        "
      >
        <div>
          <h1>
            Insights
          </h1>

          <p>
            Informazioni di supporto
            strategico.
          </p>
        </div>
      </div>

      ${renderICaV3Section()}
      ${renderGoalkeeperSection()}

      ${renderSetPiecesSection()}

      ${renderCoachSection()}
    </section>
  `
}

/* =========================
   GOALKEEPER UI UPDATE
========================= */

function updateGoalkeeperUi():
  void {
  const chips = document.querySelector<HTMLElement>('#goalkeeperTeamChips')
  if (chips) chips.innerHTML = renderGoalkeeperTeamChips()

  const recommendations =
    document.querySelector<HTMLElement>(
      '#goalkeeperRecommendations',
    )

  if (recommendations) {
    recommendations.innerHTML =
      renderGoalkeeperTopThree(
        selectedGoalkeeperTeam,
      )
  }

  /*
    La griglia continua a essere
    generata dal DB legacy.
    Qui aggiorniamo soltanto
    l'evidenziazione della squadra.
  */
  const matrix =
    document.querySelector<HTMLElement>(
      '#goalkeeperMatrixContent',
    )

  if (matrix) {
    matrix.innerHTML =
      renderGoalkeeperMatrix(
        selectedGoalkeeperTeam,
      )
  }

  const input =
    document.querySelector<HTMLInputElement>(
      '#goalkeeperSearch',
    )

  if (
    input &&
    selectedGoalkeeperTeam
  ) {
    input.value =
      selectedGoalkeeperTeam
  }
}

function updateGoalkeeperSuggestions():
  void {
  const suggestions =
    document.querySelector<HTMLElement>(
      '#goalkeeperSuggestions',
    )

  if (!suggestions) {
    return
  }

  suggestions.innerHTML =
    renderGoalkeeperSuggestions(
      goalkeeperSearchValue,
    )
}

function openGoalkeeperMatrix():
  void {
  const overlay =
    document.querySelector<HTMLElement>(
      '#goalkeeperMatrixOverlay',
    )

  if (!overlay) {
    return
  }

  overlay.classList.remove(
    'is-closing',
  )

  overlay.hidden = false

  overlay.setAttribute(
    'aria-hidden',
    'false',
  )

  document.body.classList.add(
    'insights-overlay-open',
  )
}

function closeGoalkeeperMatrix():
  void {
  const overlay =
    document.querySelector<HTMLElement>(
      '#goalkeeperMatrixOverlay',
    )

  if (
    !overlay ||
    overlay.hidden
  ) {
    return
  }

  runOverlayExit(
    '#goalkeeperMatrixOverlay',
    () => {
      overlay.hidden = true

      overlay.classList.remove(
        'is-closing',
      )

      overlay.setAttribute(
        'aria-hidden',
        'true',
      )

      document.body.classList.remove(
        'insights-overlay-open',
      )
    },
  )
}

/* =========================
   EVENTS
========================= */

export function bindInsightsEvents():
  void {
  if (
    insightsEventsBound
  ) {
    return
  }

  insightsEventsBound = true

  document.addEventListener(
    'input',
    (event) => {
      const target =
        event.target

      if (
        !(
          target instanceof
          HTMLInputElement
        )
      ) {
        return
      }

      if (
        target.id !==
        'goalkeeperSearch'
      ) {
        return
      }

      goalkeeperSearchValue =
        target.value

      updateGoalkeeperSuggestions()
    },
  )

  document.addEventListener(
    'keydown',
    (event) => {
      const target =
        event.target

      if (
        target instanceof
          HTMLInputElement &&
        target.id ===
          'goalkeeperSearch' &&
        event.key ===
          'Enter'
      ) {
        const first =
          getGoalkeeperMatches(
            target.value,
          )[0]

        if (first) {
          selectedGoalkeeperTeam =
            first

          goalkeeperSearchValue =
            first

          updateGoalkeeperUi()

          const suggestions =
            document
              .querySelector<
                HTMLElement
              >(
                '#goalkeeperSuggestions',
              )

          if (suggestions) {
            suggestions.innerHTML =
              ''
          }
        }
      }

      if (
        event.key ===
        'Escape'
      ) {
        closeGoalkeeperMatrix()
      }
    },
  )

  document.addEventListener(
    'click',
    (event) => {
      const target =
        event.target

      if (
        !(
          target instanceof
          Element
        )
      ) {
        return
      }

      const teamButton =
        target.closest<
          HTMLButtonElement
        >(
          '[data-goalkeeper-team]',
        )

      if (teamButton) {
        const team =
          teamButton.dataset
            .goalkeeperTeam

        if (team) {
          selectedGoalkeeperTeam =
            team

          goalkeeperSearchValue =
            team

          updateGoalkeeperUi()

          const suggestions =
            document
              .querySelector<
                HTMLElement
              >(
                '#goalkeeperSuggestions',
              )

          if (suggestions) {
            suggestions.innerHTML =
              ''
          }
        }

        return
      }

      if (
        target.closest(
          '[data-open-goalkeeper-matrix]',
        )
      ) {
        openGoalkeeperMatrix()

        return
      }

      if (
        target.closest(
          '[data-close-goalkeeper-matrix]',
        )
      ) {
        closeGoalkeeperMatrix()

        return
      }

      const overlay =
        target.closest<HTMLElement>(
          '[data-goalkeeper-overlay]',
        )

      if (
        overlay &&
        target === overlay
      ) {
        closeGoalkeeperMatrix()
      }
    },
  )
}

/*
  La pagina Insights non aveva in origine
  un binder dedicato.

  Usiamo event delegation e attiviamo
  il binder una sola volta quando il
  modulo viene caricato.

  Se in futuro main.ts chiamerà
  bindInsightsEvents(), il guard
  impedirà listener duplicati.
*/
bindInsightsEvents()