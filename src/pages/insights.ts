import coachesCsv from '../../database/MisterCana_DB_Allenatori.csv?raw'

interface Coach {
  team: string
  name: string
  formation: string

  impacts: {
    goalkeeper: number
    centreBack: number
    fullBack: number
    defensiveMid: number
    wideMid: number
    centralMid: number
    attackingMid: number
    winger: number
    secondStriker: number
    striker: number
  }
}

const GOALKEEPER_ROWS = [
  {
    primary: 'Portiere A',
    pairing: 'Portiere B',
    note: 'Compatibilità da definire',
  },
  {
    primary: 'Portiere C',
    pairing: 'Portiere D',
    note: 'Compatibilità da definire',
  },
  {
    primary: 'Portiere E',
    pairing: 'Portiere F',
    note: 'Compatibilità da definire',
  },
]

const SET_PIECE_TEAMS = [
  {
    team: 'Squadra A',
    penalties: [
      '1° rigorista',
      '2° rigorista',
      '3° rigorista',
    ],
    setPieces: [
      '1° piazzati',
      '2° piazzati',
      '3° piazzati',
    ],
  },
  {
    team: 'Squadra B',
    penalties: [
      '1° rigorista',
      '2° rigorista',
      '3° rigorista',
    ],
    setPieces: [
      '1° piazzati',
      '2° piazzati',
      '3° piazzati',
    ],
  },
  {
    team: 'Squadra C',
    penalties: [
      '1° rigorista',
      '2° rigorista',
      '3° rigorista',
    ],
    setPieces: [
      '1° piazzati',
      '2° piazzati',
      '3° piazzati',
    ],
  },
]

const COACH_MACRO_ROLES = [
  {
    key: 'goalkeeper',
    label: 'Portieri',
    mantra: 'Por',
  },
  {
    key: 'centreBack',
    label: 'Difensori centrali',
    mantra: 'Dc',
  },
  {
    key: 'fullBack',
    label: 'Terzini',
    mantra: 'Ds · B · Dd',
  },
  {
    key: 'defensiveMid',
    label: 'Centrocampisti difensivi',
    mantra: 'M',
  },
  {
    key: 'wideMid',
    label: 'Esterni di centrocampo',
    mantra: 'E',
  },
  {
    key: 'centralMid',
    label: 'Centrocampisti centrali',
    mantra: 'C',
  },
  {
    key: 'attackingMid',
    label: 'Trequartisti',
    mantra: 'T',
  },
  {
    key: 'winger',
    label: 'Ali d’attacco',
    mantra: 'W',
  },
  {
    key: 'secondStriker',
    label: 'Seconde punte',
    mantra: 'A',
  },
  {
    key: 'striker',
    label: 'Punte centrali',
    mantra: 'Pc',
  },
] as const

type CoachRoleKey =
  typeof COACH_MACRO_ROLES[number]['key']

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function parseNumber(
  value: string | undefined,
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

  return Number.isFinite(parsed)
    ? parsed
    : 0
}

function parseCoachesCsv(
  csv: string,
): Coach[] {
  const lines =
    csv
      .replace(/\r/g, '')
      .split('\n')
      .map(
        (line) =>
          line.trim(),
      )
      .filter(Boolean)

  if (lines.length < 2) {
    return []
  }

  const rows =
    lines.slice(1)

  return rows
    .map(
      (line) => {
        const columns =
          line
            .split(';')
            .map(
              (value) =>
                value.trim(),
            )

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
            formation || '—',

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

const COACHES =
  parseCoachesCsv(
    coachesCsv,
  )

function formatImpact(
  value: number,
): string {
  if (value > 0) {
    return `+${value.toFixed(2)}`
  }

  if (value < 0) {
    return value.toFixed(2)
  }

  return '0.00'
}

function getImpactClass(
  value: number,
): string {
  if (value > 0) {
    return 'positive'
  }

  if (value < 0) {
    return 'negative'
  }

  return 'neutral'
}

function renderGoalkeeperSection():
  string {
  return `
    <section
      class="insight-section"
    >
      <div
        class="insight-section-header"
      >
        <div>
          <span
            class="insight-eyebrow"
          >
            PORTIERI
          </span>

          <h2>
            Abbinamenti portieri
          </h2>

          <p>
            Struttura predisposta per la
            futura tabella degli
            abbinamenti.
          </p>
        </div>

        <span
          class="
            insight-placeholder-badge
          "
        >
          Dati da collegare
        </span>
      </div>

      <div
        class="goalkeeper-table"
      >
        <div
          class="
            goalkeeper-table-header
          "
        >
          <span>
            Portiere
          </span>

          <span>
            Abbinamento
          </span>

          <span>
            Indicazione
          </span>
        </div>

        ${GOALKEEPER_ROWS
          .map(
            (row) => `
              <div
                class="
                  goalkeeper-table-row
                "
              >
                <strong>
                  ${escapeHtml(
                    row.primary,
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    row.pairing,
                  )}
                </span>

                <small>
                  ${escapeHtml(
                    row.note,
                  )}
                </small>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderSetPiecesSection():
  string {
  return `
    <section
      class="insight-section"
    >
      <div
        class="insight-section-header"
      >
        <div>
          <span
            class="insight-eyebrow"
          >
            SPECIALISTI
          </span>

          <h2>
            Rigori / Piazzati
          </h2>

          <p>
            Ordine gerarchico per squadra.
            I dati reali verranno collegati
            nella fase database.
          </p>
        </div>

        <span
          class="
            insight-placeholder-badge
          "
        >
          Ordine da fonte esterna
        </span>
      </div>

      <div
        class="set-pieces-grid"
      >
        ${SET_PIECE_TEAMS
          .map(
            (item) => `
              <article
                class="set-piece-card"
              >
                <div
                  class="set-piece-team"
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
                      ${item.penalties
                        .map(
                          (player) => `
                            <li>
                              ${escapeHtml(
                                player,
                              )}
                            </li>
                          `,
                        )
                        .join('')}
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
                      ${item.setPieces
                        .map(
                          (player) => `
                            <li>
                              ${escapeHtml(
                                player,
                              )}
                            </li>
                          `,
                        )
                        .join('')}
                    </ol>
                  </div>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderCoachPitch():
  string {
  return `
    <div
      class="coach-pitch"
    >
      <div
        class="
          pitch-line
          pitch-half
        "
      ></div>

      <div
        class="pitch-circle"
      ></div>

      <div
        class="
          coach-zone
          zone-goalkeeper
        "
      >
        Por
      </div>

      <div
        class="
          coach-zone
          zone-centre-back
        "
      >
        Dc
      </div>

      <div
        class="
          coach-zone
          zone-full-back
        "
      >
        Ds/B/Dd
      </div>

      <div
        class="
          coach-zone
          zone-defensive-mid
        "
      >
        M
      </div>

      <div
        class="
          coach-zone
          zone-wide-mid
        "
      >
        E
      </div>

      <div
        class="
          coach-zone
          zone-central-mid
        "
      >
        C
      </div>

      <div
        class="
          coach-zone
          zone-attacking-mid
        "
      >
        T
      </div>

      <div
        class="
          coach-zone
          zone-winger
        "
      >
        W
      </div>

      <div
        class="
          coach-zone
          zone-second-striker
        "
      >
        A
      </div>

      <div
        class="
          coach-zone
          zone-striker
        "
      >
        Pc
      </div>
    </div>
  `
}

function renderCoachSection():
  string {
  return `
    <section
      class="insight-section"
    >
      <div
        class="insight-section-header"
      >
        <div>
          <span
            class="insight-eyebrow"
          >
            ALLENATORI SERIE A
          </span>

          <h2>
            Impatto allenatori
          </h2>

          <p>
            Impatto del sistema di gioco
            sui macro-ruoli Mantra.
          </p>
        </div>

        <span
          class="
            insight-placeholder-badge
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
              class="coach-grid"
            >
              ${COACHES
                .map(
                  (coach) => `
                    <article
                      class="coach-card"
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
                        ${renderCoachPitch()}

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
                                      role.key as
                                        CoachRoleKey
                                    ]

                                return `
                                  <div
                                    class="
                                      coach-macro-role-row
                                    "
                                  >
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

                                    <span
                                      class="
                                        coach-impact-placeholder
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
                coach-database-empty
              "
            >
              Nessun allenatore trovato
              nel database.
            </div>
          `
      }
    </section>
  `
}

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