import type {
  Player,
} from '../domain/player'

import {
  getPlayerRawStats,
  getPlayerSagePrices,
  getPlayerSetPieceBadges,
} from '../data/playerDetail'

import '../styles/playerDetail.css'

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

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    Math.max(
      value,
      min,
    ),
    max,
  )
}

function formatNumber(
  value:
    | number
    | undefined,
  digits = 0,
): string {
  if (
    value === undefined ||
    !Number.isFinite(
      value,
    )
  ) {
    return '—'
  }

  return value
    .toFixed(
      digits,
    )
    .replace(
      '.',
      ',',
    )
}

function formatInteger(
  value:
    | number
    | undefined,
): string {
  if (
    value === undefined ||
    !Number.isFinite(
      value,
    )
  ) {
    return '—'
  }

  return Math.round(
    value,
  ).toLocaleString(
    'it-IT',
  )
}

function formatPercent(
  value:
    | number
    | undefined,
): string {
  if (
    value === undefined ||
    !Number.isFinite(
      value,
    )
  ) {
    return '—'
  }

  return `${Math.round(
    value,
  )}%`
}

/* =========================
   SAGGI CHART
========================= */

function renderSageChart(
  playerId: string,
): string {
  const sages =
    getPlayerSagePrices(
      playerId,
    )

  if (
    sages.length === 0
  ) {
    return `
      <div
        class="player-detail-chart-empty"
      >
        Nessuna valutazione prezzo
        disponibile dai Saggi.
      </div>
    `
  }

  const values =
    sages.map(
      (sage) =>
        sage.price,
    )

  const average =
    values.reduce(
      (
        total,
        value,
      ) =>
        total + value,
      0,
    ) /
    values.length

  const maximumValue =
    Math.max(
      ...values,
      average,
      1,
    )

  const chartMax =
    Math.max(
      10,
      Math.ceil(
        maximumValue *
        1.18,
      ),
    )

  const width =
    760

  const height =
    300

  const left =
    52

  const right =
    18

  const top =
    22

  const bottom =
    58

  const innerWidth =
    width -
    left -
    right

  const innerHeight =
    height -
    top -
    bottom

  const step =
    innerWidth /
    sages.length

  const barWidth =
    Math.min(
      72,
      step * 0.56,
    )

  const yForValue =
    (
      value: number,
    ): number =>
      top +
      innerHeight -
      (
        value /
        chartMax
      ) *
      innerHeight

  const gridSteps =
    4

  const grid =
    Array.from({
      length:
        gridSteps + 1,
    })
      .map(
        (
          _,
          index,
        ) => {
          const ratio =
            index /
            gridSteps

          const value =
            chartMax *
            (
              1 -
              ratio
            )

          const y =
            top +
            innerHeight *
            ratio

          return `
            <line
              x1="${left}"
              x2="${width - right}"
              y1="${y}"
              y2="${y}"
              class="player-detail-chart-grid"
            />

            <text
              x="${left - 10}"
              y="${y + 4}"
              text-anchor="end"
              class="player-detail-chart-axis-label"
            >
              ${Math.round(
                value,
              )}
            </text>
          `
        },
      )
      .join('')

  const bars =
    sages
      .map(
        (
          sage,
          index,
        ) => {
          const centerX =
            left +
            step *
            (
              index +
              0.5
            )

          const barX =
            centerX -
            barWidth /
            2

          const barY =
            yForValue(
              sage.price,
            )

          const barHeight =
            top +
            innerHeight -
            barY

          const label =
            sage.source
              .length > 14
              ? `${sage.source.slice(
                  0,
                  12,
                )}…`
              : sage.source

          return `
            <rect
              x="${barX}"
              y="${barY}"
              width="${barWidth}"
              height="${barHeight}"
              rx="8"
              class="player-detail-sage-bar"
            />

            <text
              x="${centerX}"
              y="${Math.max(
                top + 14,
                barY - 8,
              )}"
              text-anchor="middle"
              class="player-detail-chart-value"
            >
              ${formatNumber(
                sage.price,
                0,
              )}
            </text>

            <text
              x="${centerX}"
              y="${height - 25}"
              text-anchor="middle"
              class="player-detail-chart-source"
            >
              ${escapeHtml(
                label,
              )}
            </text>
          `
        },
      )
      .join('')

  const averageY =
    yForValue(
      average,
    )

  return `
    <div
      class="player-detail-chart-shell"
    >
      <svg
        class="player-detail-chart"
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="Prezzi dei Saggi e loro media"
      >
        ${grid}

        <line
          x1="${left}"
          x2="${width - right}"
          y1="${averageY}"
          y2="${averageY}"
          class="player-detail-average-line"
        />

        <text
          x="${width - right - 2}"
          y="${averageY - 8}"
          text-anchor="end"
          class="player-detail-average-label"
        >
          MEDIA
          ${formatNumber(
            average,
            1,
          )}
        </text>

        ${bars}
      </svg>
    </div>
  `
}

/* =========================
   MV / FMV CHART
========================= */

function renderPerformanceChart(
  player: Player,
): string {
  const width =
    760

  const height =
    300

  const left =
    52

  const right =
    28

  const top =
    28

  const bottom =
    58

  const innerHeight =
    height -
    top -
    bottom

  const mv =
    player.mv

  const fmv =
    player.fmv

  const available =
    [
      mv,
      fmv,
    ].filter(
      (
        value,
      ): value is number =>
        value !== undefined &&
        Number.isFinite(
          value,
        ),
    )

  if (
    available.length === 0
  ) {
    return `
      <div
        class="player-detail-chart-empty"
      >
        Dati MV/FMV non disponibili.
      </div>
    `
  }

  const minimumData =
    Math.min(
      ...available,
    )

  const maximumData =
    Math.max(
      ...available,
    )

  const minimum =
    Math.floor(
      (
        minimumData -
        0.8
      ) *
      2,
    ) /
    2

  const maximum =
    Math.ceil(
      (
        maximumData +
        0.8
      ) *
      2,
    ) /
    2

  const safeRange =
    Math.max(
      1,
      maximum -
      minimum,
    )

  const yForValue =
    (
      value: number,
    ): number =>
      top +
      innerHeight -
      (
        (
          value -
          minimum
        ) /
        safeRange
      ) *
      innerHeight

  const pointX =
    left +
    (
      width -
      left -
      right
    ) /
    2

  const gridSteps =
    4

  const grid =
    Array.from({
      length:
        gridSteps + 1,
    })
      .map(
        (
          _,
          index,
        ) => {
          const ratio =
            index /
            gridSteps

          const value =
            maximum -
            safeRange *
            ratio

          const y =
            top +
            innerHeight *
            ratio

          return `
            <line
              x1="${left}"
              x2="${width - right}"
              y1="${y}"
              y2="${y}"
              class="player-detail-chart-grid"
            />

            <text
              x="${left - 10}"
              y="${y + 4}"
              text-anchor="end"
              class="player-detail-chart-axis-label"
            >
              ${formatNumber(
                value,
                1,
              )}
            </text>
          `
        },
      )
      .join('')

  const mvMarkup =
    mv !== undefined &&
    Number.isFinite(
      mv,
    )
      ? `
        <line
          x1="${pointX - 120}"
          x2="${pointX}"
          y1="${yForValue(
            mv,
          )}"
          y2="${yForValue(
            mv,
          )}"
          class="
            player-detail-current-guide
            player-detail-current-guide-mv
          "
        />

        <circle
          cx="${pointX}"
          cy="${yForValue(
            mv,
          )}"
          r="8"
          class="player-detail-mv-point"
        />

        <text
          x="${pointX - 14}"
          y="${yForValue(
            mv,
          ) - 13}"
          text-anchor="end"
          class="player-detail-mv-label"
        >
          MV
          ${formatNumber(
            mv,
            2,
          )}
        </text>
      `
      : ''

  const fmvMarkup =
    fmv !== undefined &&
    Number.isFinite(
      fmv,
    )
      ? `
        <line
          x1="${pointX}"
          x2="${pointX + 120}"
          y1="${yForValue(
            fmv,
          )}"
          y2="${yForValue(
            fmv,
          )}"
          class="
            player-detail-current-guide
            player-detail-current-guide-fmv
          "
        />

        <circle
          cx="${pointX}"
          cy="${yForValue(
            fmv,
          )}"
          r="8"
          class="player-detail-fmv-point"
        />

        <text
          x="${pointX + 14}"
          y="${yForValue(
            fmv,
          ) - 13}"
          text-anchor="start"
          class="player-detail-fmv-label"
        >
          FMV
          ${formatNumber(
            fmv,
            2,
          )}
        </text>
      `
      : ''

  return `
    <div
      class="player-detail-chart-shell"
    >
      <svg
        class="player-detail-chart"
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="MV e FMV della stagione corrente"
      >
        ${grid}

        ${mvMarkup}

        ${fmvMarkup}

        <text
          x="${pointX}"
          y="${height - 24}"
          text-anchor="middle"
          class="player-detail-chart-season"
        >
          2026/27
        </text>
      </svg>

      <div
        class="player-detail-history-pending"
      >
        Storico multi-stagione non
        ancora disponibile
      </div>
    </div>
  `
}

/* =========================
   RAW STATS
========================= */

function renderStat(
  label: string,
  value: string,
): string {
  return `
    <div
      class="player-detail-stat"
    >
      <span>
        ${escapeHtml(
          label,
        )}
      </span>

      <strong>
        ${escapeHtml(
          value,
        )}
      </strong>
    </div>
  `
}

/* =========================
   OVERLAY
========================= */

export function renderPlayerDetailOverlay(
  player: Player,
  assigned: boolean,
  callEnabled = true,
): string {
  const rawStats =
    getPlayerRawStats(
      player.id,
    )

  const setPieces =
    getPlayerSetPieceBadges(
      player.name,
      player.team,
    )

  const starting =
    clamp(
      player
        .startingProbability ??
        0,
      0,
      100,
    )

  const stats:
    string[] = []

  stats.push(
    renderStat(
      'Presenze',
      formatInteger(
        rawStats
          .appearances,
      ),
    ),
  )

  stats.push(
    renderStat(
      'Minuti',
      formatInteger(
        rawStats.minutes,
      ),
    ),
  )

  if (
    player.role === 'P'
  ) {
    stats.push(
      renderStat(
        'Gol subiti',
        formatInteger(
          rawStats
            .goalsConceded,
        ),
      ),
    )

    stats.push(
      renderStat(
        'Rigori parati',
        formatInteger(
          rawStats
            .penaltiesSaved,
        ),
      ),
    )
  } else {
    stats.push(
      renderStat(
        'Gol',
        formatInteger(
          rawStats.goals,
        ),
      ),
    )

    stats.push(
      renderStat(
        'Assist',
        formatInteger(
          rawStats.assists,
        ),
      ),
    )

    stats.push(
      renderStat(
        'Rigori segnati',
        formatInteger(
          rawStats
            .penaltiesScored,
        ),
      ),
    )

    stats.push(
      renderStat(
        'Rigori sbagliati',
        formatInteger(
          rawStats
            .penaltiesMissed,
        ),
      ),
    )
  }

  stats.push(
    renderStat(
      'Ammonizioni',
      formatInteger(
        rawStats
          .yellowCards,
      ),
    ),
  )

  stats.push(
    renderStat(
      'Espulsioni',
      formatInteger(
        rawStats
          .redCards,
      ),
    ),
  )

  const callButtonDisabled =
    assigned ||
    !callEnabled

  const callButtonLabel =
    assigned
      ? 'ASSEGNATO'
      : callEnabled
        ? 'CHIAMA'
        : 'ASTA NON ATTIVA'

  return `
    <div
      id="playerDetailOverlay"
      class="player-detail-overlay"
      aria-hidden="false"
    >
      <button
        type="button"
        class="player-detail-backdrop"
        data-close-player-detail
        aria-label="Chiudi scheda giocatore"
      ></button>

      <section
        class="player-detail-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playerDetailTitle"
      >
        <header
          class="player-detail-header"
        >
          <div
            class="player-detail-identity"
          >
            <span
              class="
                player-detail-role
                player-detail-role-${player.role.toLowerCase()}
              "
            >
              ${player.role}
            </span>

            <div>
              <span
                class="player-detail-eyebrow"
              >
                SCHEDA GIOCATORE
              </span>

              <h2
                id="playerDetailTitle"
              >
                ${escapeHtml(
                  player.name,
                )}
              </h2>

              <p>
                ${escapeHtml(
                  player.team,
                )}
                · ${player.role}
              </p>
            </div>
          </div>

          <div
            class="player-detail-header-actions"
          >
            <button
              type="button"
              class="player-detail-call-button"
              data-player-detail-call="${escapeHtml(
                player.id,
              )}"
              ${
                callButtonDisabled
                  ? 'disabled'
                  : ''
              }
            >
              ${callButtonLabel}
            </button>

            <button
              type="button"
              class="player-detail-close-button"
              data-close-player-detail
              aria-label="Chiudi"
            >
              ×
            </button>
          </div>
        </header>

        <div
          class="player-detail-kpis"
        >
          <div
            class="
              player-detail-kpi
              player-detail-kpi-primary
            "
          >
            <span>iCà</span>

            <strong>
              ${formatNumber(
                player.iCa,
                2,
              )}
            </strong>
          </div>

          <div
            class="player-detail-kpi"
          >
            <span>PMA</span>

            <strong>
              ${
                player
                  .pmaPercent ===
                undefined
                  ? '—'
                  : `${formatNumber(
                      player
                        .pmaPercent,
                      1,
                    )}%`
              }
            </strong>
          </div>

          <div
            class="player-detail-kpi"
          >
            <span>Consenso</span>

            <strong>
              ${formatNumber(
                player.consensus,
                2,
              )}
            </strong>
          </div>

          <div
            class="
              player-detail-kpi
              player-detail-kpi-history
            "
          >
            <span>
              Prezzo passata stagione
            </span>

            <strong>
              —
            </strong>

            <small>
              storico non disponibile
            </small>
          </div>
        </div>

        <div
          class="player-detail-performance-strip"
        >
          <div
            class="player-detail-small-metric"
          >
            <span>MV</span>

            <strong>
              ${formatNumber(
                player.mv,
                2,
              )}
            </strong>
          </div>

          <div
            class="player-detail-small-metric"
          >
            <span>FMV</span>

            <strong>
              ${formatNumber(
                player.fmv,
                2,
              )}
            </strong>
          </div>

          <div
            class="player-detail-starting"
          >
            <span>
              Titolarità
            </span>

            <div
              class="player-detail-starting-track"
            >
              <span
                style="
                  width:
                  ${starting}%;
                "
              ></span>
            </div>

            <strong>
              ${formatPercent(
                player
                  .startingProbability,
              )}
            </strong>
          </div>
        </div>

        ${
          setPieces.length
            ? `
              <div
                class="player-detail-set-pieces"
              >
                ${setPieces
                  .map(
                    (badge) => `
                      <span>
                        ${escapeHtml(
                          badge.label,
                        )}
                        · ${badge.rank}°
                      </span>
                    `,
                  )
                  .join('')}
              </div>
            `
            : ''
        }

        <div
          class="player-detail-chart-grid"
        >
          <article
            class="player-detail-panel"
          >
            <div
              class="player-detail-panel-heading"
            >
              <div>
                <span>
                  VALUTAZIONI
                </span>

                <h3>
                  Prezzi dei Saggi
                </h3>
              </div>

              <small>
                barra = fonte
                · linea = media
              </small>
            </div>

            ${renderSageChart(
              player.id,
            )}
          </article>

          <article
            class="player-detail-panel"
          >
            <div
              class="player-detail-panel-heading"
            >
              <div>
                <span>
                  ANDAMENTO
                </span>

                <h3>
                  MV / FMV
                </h3>
              </div>

              <div
                class="player-detail-chart-legend"
              >
                <span
                  class="mv"
                >
                  MV
                </span>

                <span
                  class="fmv"
                >
                  FMV
                </span>
              </div>
            </div>

            ${renderPerformanceChart(
              player,
            )}
          </article>
        </div>

        <article
          class="
            player-detail-panel
            player-detail-insights-panel
          "
        >
          <div
            class="player-detail-panel-heading"
          >
            <div>
              <span>
                STAGIONE CORRENTE
              </span>

              <h3>
                Dati utili
              </h3>
            </div>
          </div>

          <div
            class="player-detail-stats-grid"
          >
            ${stats.join('')}
          </div>

          ${
            rawStats.enhanced ||
            rawStats.penalized
              ? `
                <div
                  class="player-detail-notes"
                >
                  ${
                    rawStats.enhanced
                      ? `
                        <div
                          class="
                            player-detail-note
                            positive
                          "
                        >
                          <span>
                            Valorizzato
                          </span>

                          <p>
                            ${escapeHtml(
                              rawStats
                                .enhanced,
                            )}
                          </p>
                        </div>
                      `
                      : ''
                  }

                  ${
                    rawStats.penalized
                      ? `
                        <div
                          class="
                            player-detail-note
                            negative
                          "
                        >
                          <span>
                            Penalizzato
                          </span>

                          <p>
                            ${escapeHtml(
                              rawStats
                                .penalized,
                            )}
                          </p>
                        </div>
                      `
                      : ''
                  }
                </div>
              `
              : ''
          }
        </article>
      </section>
    </div>
  `
}