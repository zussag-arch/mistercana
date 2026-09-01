import coachesCsv
  from '../../database/MisterCana_DB_Allenatori.csv?raw'

import goalkeepersCsv
  from '../../database/MisterCana_DB_Portieri.csv?raw'

import setPiecesCsv
  from '../../database/MisterCana_DB_Battitori.csv?raw'

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
  penalties: string[]
  setPieces: string[]
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

function parseSetPiecesCsv(
  csv: string,
): SetPieceTeam[] {
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
          penalty1,
          penalty2,
          penalty3,
          penalty4,
          setPiece1,
          setPiece2,
          setPiece3,
        ] = columns

        if (!team) {
          return null
        }

        return {
          team,

          penalties: [
            penalty1,
            penalty2,
            penalty3,
            penalty4,
          ].filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          ),

          setPieces: [
            setPiece1,
            setPiece2,
            setPiece3,
          ].filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          ),
        }
      },
    )
    .filter(
      (
        item,
      ): item is SetPieceTeam =>
        item !== null,
    )
}

/* =========================
   DATABASES
========================= */

const COACHES =
  parseCoachesCsv(
    coachesCsv,
  )

const GOALKEEPER_MATRIX =
  parseGoalkeeperCsv(
    goalkeepersCsv,
  )

const SET_PIECE_TEAMS =
  parseSetPiecesCsv(
    setPiecesCsv,
  )

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
      <span>
        Migliori abbinamenti calendario
      </span>

      <strong>
        ${escapeHtml(
          team,
        )}
      </strong>
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
                </strong>

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
        aria-labelledby="
          goalkeeperMatrixTitle
        "
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
              id="
                goalkeeperMatrixTitle
              "
            >
              Griglia abbinamenti
            </h2>

            <p>
              Matrice legacy di
              compatibilità tra le
              squadre.
            </p>
          </div>

          <button
            type="button"
            class="
              goalkeeper-matrix-close
            "
            data-close-goalkeeper-matrix
            aria-label="
              Chiudi griglia portieri
            "
          >
            ×
          </button>
        </div>

        <div
          id="
            goalkeeperMatrixContent
          "
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

function renderSetPiecesSection():
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
            SPECIALISTI
          </span>

          <h2>
            Rigori / Piazzati
          </h2>

          <p>
            Gerarchie dei battitori
            suddivise per squadra.
          </p>
        </div>

        <span
          class="
            insight-database-status
          "
        >
          ${SET_PIECE_TEAMS.length}
          squadre dal database
        </span>
      </div>

      ${
        SET_PIECE_TEAMS.length
          ? `
            <div
              class="
                set-pieces-grid
              "
            >
              ${SET_PIECE_TEAMS
                .map(
                  (item) => `
                    <article
                      class="
                        set-piece-card
                      "
                    >
                      <div
                        class="
                          set-piece-team
                        "
                      >
                        ${escapeHtml(
                          item.team,
                        )}
                      </div>

                      <div
                        class="
                          set-piece-columns
                        "
                      >
                        <div>
                          <span
                            class="
                              set-piece-label
                            "
                          >
                            Rigori
                          </span>

                          <ol>
                            ${
                              item
                                .penalties
                                .length
                                ? item
                                    .penalties
                                    .map(
                                      (
                                        player,
                                      ) => `
                                        <li>
                                          ${escapeHtml(
                                            player,
                                          )}
                                        </li>
                                      `,
                                    )
                                    .join(
                                      '',
                                    )
                                : `
                                  <li
                                    class="
                                      set-piece-empty
                                    "
                                  >
                                    —
                                  </li>
                                `
                            }
                          </ol>
                        </div>

                        <div>
                          <span
                            class="
                              set-piece-label
                            "
                          >
                            Piazzati
                          </span>

                          <ol>
                            ${
                              item
                                .setPieces
                                .length
                                ? item
                                    .setPieces
                                    .map(
                                      (
                                        player,
                                      ) => `
                                        <li>
                                          ${escapeHtml(
                                            player,
                                          )}
                                        </li>
                                      `,
                                    )
                                    .join(
                                      '',
                                    )
                                : `
                                  <li
                                    class="
                                      set-piece-empty
                                    "
                                  >
                                    —
                                  </li>
                                `
                            }
                          </ol>
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
              Database battitori vuoto.
            </div>
          `
      }
    </section>
  `
}

/* =========================
   FORMATIONS
========================= */

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
                                        coach-impact-${getImpactClass(
                                          value,
                                        )}
                                      "
                                    >
                                      ${formatImpact(
                                        value,
                                      )}
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