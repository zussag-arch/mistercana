import type {
  AppState,
} from '../app/state'

import {
  calculatePriceAdvice,
  DEFAULT_PRICE_ADVICE_PARAMETERS,
  getReferenceCredits,
  ROSTER_SLOT_LIMITS,
} from './priceAdvice'

import {
  median,
} from './auctionContext'

import type {
  Player,
  PlayerRole,
} from './player'

type CompetitorRisk =
  | 'high'
  | 'medium'
  | 'low'

type CompetitorEstimateSource =
  | 'manager-role'
  | 'manager-overall'
  | 'market-role'
  | 'market-overall'
  | 'baseline'

interface CompetitorAnalysis {
  managerId: string
  managerName: string
  teamName: string

  role: PlayerRole

  roleFilled: number
  roleLimit: number

  remainingCredits: number
  financialCapacity: number

  estimatedBid: number
  estimateFactor: number

  estimateSource:
    CompetitorEstimateSource

  /** urgenza nel ruolo: >1 se è indietro col reparto rispetto al resto della rosa */
  urgencyFactor: number

  risk:
    CompetitorRisk
}

const TOTAL_ROSTER_SLOTS =
  Object.values(
    ROSTER_SLOT_LIMITS,
  ).reduce(
    (
      total,
      value,
    ) =>
      total + value,
    0,
  )

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
      '&#39;',
    )
}

function getManagerDisplayName(
  manager:
    AppState['managers'][number],
): string {
  const firstName =
    manager.firstName.trim()

  const lastName =
    manager.lastName.trim()

  const alias =
    manager.alias.trim()

  if (alias) {
    return [
      firstName,
      `"${alias}"`,
      lastName,
    ]
      .filter(Boolean)
      .join(' ')
  }

  return [
    firstName,
    lastName,
  ]
    .filter(Boolean)
    .join(' ')
}

function getPlayerMap(
  allPlayers: Player[],
): Map<string, Player> {
  return new Map(
    allPlayers.map(
      (player) => [
        player.id,
        player,
      ],
    ),
  )
}

/* =========================
   MARKET RATIOS
========================= */

function getAssignmentRatio(
  state: AppState,
  assignment:
    AppState['auctionAssignments'][number],
  playerMap:
    Map<string, Player>,
  allPlayers: Player[],
): {
  ratio: number
  role: PlayerRole
  managerId: string
} | undefined {
  const assignedPlayer =
    playerMap.get(
      assignment.playerId ?? '',
    )

  if (!assignedPlayer) {
    return undefined
  }

  // stesso valore di riferimento del Tetto (PMA, Saggi, iCà)
  const pmaCredits =
    getReferenceCredits(
      state,
      assignedPlayer,
      allPlayers,
    )

  if (
    pmaCredits === undefined ||
    pmaCredits <= 0 ||
    assignment.price <= 0
  ) {
    return undefined
  }

  const ratio =
    assignment.price /
    pmaCredits

  if (
    !Number.isFinite(
      ratio,
    ) ||
    ratio <= 0
  ) {
    return undefined
  }

  return {
    ratio,
    role:
      assignedPlayer.role,

    managerId:
      assignment.managerId,
  }
}

function getEstimateFactor(
  state: AppState,
  managerId: string,
  role: PlayerRole,
  allPlayers: Player[],
): {
  factor: number
  source:
    CompetitorEstimateSource
} {
  const playerMap =
    getPlayerMap(
      allPlayers,
    )

  const ratios =
    state.auctionAssignments
      .map(
        (assignment) =>
          getAssignmentRatio(
            state,
            assignment,
            playerMap,
            allPlayers,
          ),
      )
      .filter(
        (
          item,
        ): item is {
          ratio: number
          role: PlayerRole
          managerId: string
        } =>
          item !== undefined,
      )

  /*
    PRIORITÀ 1
    Acquisti dello stesso manager
    nello stesso ruolo.
  */

  const managerRoleRatios =
    ratios
      .filter(
        (item) =>
          item.managerId ===
            managerId &&
          item.role === role,
      )
      .map(
        (item) =>
          item.ratio,
      )

  const managerRoleMedian =
    median(
      managerRoleRatios,
    )

  if (
    managerRoleMedian !==
    undefined
  ) {
    return {
      factor:
        managerRoleMedian,

      source:
        'manager-role',
    }
  }

  /*
    PRIORITÀ 2
    Comportamento generale
    dello stesso manager.
  */

  const managerRatios =
    ratios
      .filter(
        (item) =>
          item.managerId ===
          managerId,
      )
      .map(
        (item) =>
          item.ratio,
      )

  const managerMedian =
    median(
      managerRatios,
    )

  if (
    managerMedian !==
    undefined
  ) {
    return {
      factor:
        managerMedian,

      source:
        'manager-overall',
    }
  }

  /*
    PRIORITÀ 3A
    Mercato dell'asta corrente
    nello stesso ruolo.
  */

  const marketRoleRatios =
    ratios
      .filter(
        (item) =>
          item.role === role,
      )
      .map(
        (item) =>
          item.ratio,
      )

  const marketRoleMedian =
    median(
      marketRoleRatios,
    )

  if (
    marketRoleMedian !==
    undefined
  ) {
    return {
      factor:
        marketRoleMedian,

      source:
        'market-role',
    }
  }

  /*
    PRIORITÀ 3B
    Mercato complessivo
    dell'asta corrente.
  */

  const marketRatios =
    ratios.map(
      (item) =>
        item.ratio,
    )

  const marketMedian =
    median(
      marketRatios,
    )

  if (
    marketMedian !==
    undefined
  ) {
    return {
      factor:
        marketMedian,

      source:
        'market-overall',
    }
  }

  /*
    PRIORITÀ 4
    Nessun dato osservato:
    PMA = riferimento iniziale.
  */

  return {
    factor: 1,
    source: 'baseline',
  }
}

/* =========================
   RISK
========================= */

function calculateRisk(
  estimatedBid: number,
  financialCapacity: number,
  referenceCeiling: number,
): CompetitorRisk {
  /*
    ALTO:
    la puntata normalmente stimata
    raggiunge o supera il nostro
    tetto corrente.
  */

  if (
    estimatedBid >=
    referenceCeiling
  ) {
    return 'high'
  }

  /*
    MEDIO:
    normalmente dovrebbe stare
    sotto il nostro tetto,
    ma finanziariamente potrebbe
    comunque raggiungerlo.
  */

  if (
    financialCapacity >=
    referenceCeiling
  ) {
    return 'medium'
  }

  /*
    BASSO:
    non ha sufficiente capacità
    finanziaria per raggiungere
    il nostro tetto.
  */

  return 'low'
}

function getRiskLabel(
  risk: CompetitorRisk,
): string {
  switch (risk) {
    case 'high':
      return 'ALTO'

    case 'medium':
      return 'MEDIO'

    case 'low':
      return 'BASSO'
  }
}

function getEstimateSourceLabel(
  source:
    CompetitorEstimateSource,
): string {
  switch (source) {
    case 'manager-role':
      return 'storico manager · ruolo'

    case 'manager-overall':
      return 'storico manager'

    case 'market-role':
      return 'mercato · ruolo'

    case 'market-overall':
      return 'mercato asta'

    case 'baseline':
      return 'baseline PMA'
  }
}

/* =========================
   MAIN ANALYSIS
========================= */

export function calculateCompetitors(
  state: AppState,
  player: Player,
  allPlayers: Player[],
): CompetitorAnalysis[] {
  const playerMap =
    getPlayerMap(
      allPlayers,
    )

  const minimumFutureSlotCost =
    DEFAULT_PRICE_ADVICE_PARAMETERS
      .minimumFutureSlotCost

  const roleLimit =
    ROSTER_SLOT_LIMITS[
      player.role
    ]

  const priceAdvice =
    calculatePriceAdvice(
      state,
      player,
      allPlayers,
    )

  const playerPmaCredits =
    getReferenceCredits(
      state,
      player,
      allPlayers,
    )

  /*
    Per il rischio utilizziamo
    prioritariamente il nostro
    Tetto consigliato.

    I fallback servono solo nei
    casi in cui quel valore non
    sia calcolabile.
  */

  const referenceCeiling =
    priceAdvice
      .recommendedCeiling ??
    priceAdvice
      .valueLimit ??
    (
      playerPmaCredits ===
      undefined
        ? 1
        : Math.max(
            1,
            Math.round(
              playerPmaCredits,
            ),
          )
    )

  return state.managers
    .filter(
      (manager) =>
        manager.active &&
        !manager.archived &&
        !manager.isOwner,
    )
    .map(
      (
        manager,
      ):
        CompetitorAnalysis |
        null => {
        const assignments =
          state.auctionAssignments
            .filter(
              (assignment) =>
                assignment
                  .managerId ===
                manager.id,
            )

        const spent =
          assignments.reduce(
            (
              total,
              assignment,
            ) =>
              total +
              assignment.price,
            0,
          )

        const remainingCredits =
          Math.max(
            0,
            state.initialCredits -
              spent,
          )

        const filledRosterSlots =
          assignments.length

        const remainingRosterSlots =
          Math.max(
            0,
            TOTAL_ROSTER_SLOTS -
              filledRosterSlots,
          )

        if (
          remainingRosterSlots <=
          0
        ) {
          return null
        }

        const roleFilled =
          assignments.reduce(
            (
              total,
              assignment,
            ) => {
              const assignedPlayer =
                playerMap.get(
                  assignment
                    .playerId ?? '',
                )

              if (
                assignedPlayer
                  ?.role ===
                player.role
              ) {
                return total + 1
              }

              return total
            },
            0,
          )

        if (
          roleFilled >=
          roleLimit
        ) {
          return null
        }

        /*
          Se compra questo giocatore,
          questo slot viene occupato.

          Restano quindi:
          slot attualmente liberi - 1.
        */

        const futureSlotsAfterPurchase =
          Math.max(
            0,
            remainingRosterSlots -
              1,
          )

        const futureMinimumReserve =
          futureSlotsAfterPurchase *
          minimumFutureSlotCost

        const financialCapacity =
          Math.max(
            0,
            Math.floor(
              remainingCredits -
                futureMinimumReserve,
            ),
          )

        if (
          financialCapacity <=
          0
        ) {
          return null
        }

        const estimate =
          getEstimateFactor(
            state,
            manager.id,
            player.role,
            allPlayers,
          )

        /*
          Puntata stimata grezza:

          PMA giocatore ×
          comportamento osservato
          del manager / mercato.
        */

        /*
          Urgenza: chi è indietro in questo reparto rispetto
          a quanto ha già riempito della rosa rilancia di più.
          Esempio: 12/25 in rosa ma 0/3 portieri → +17% circa.
          Chi è avanti nel reparto rilancia un po' meno.
        */
        const rosterProgress =
          filledRosterSlots / TOTAL_ROSTER_SLOTS
        const roleProgress =
          roleFilled / roleLimit
        const urgencyFactor =
          Math.min(
            1.3,
            Math.max(
              0.85,
              1 + 0.35 * (rosterProgress - roleProgress),
            ),
          )

        const rawEstimatedBid =
          playerPmaCredits ===
          undefined
            ? 1
            : (
                playerPmaCredits *
                estimate.factor *
                urgencyFactor
              )

        /*
          Non possiamo stimare una
          puntata superiore a ciò
          che il manager può
          finanziariamente pagare.
        */

        const estimatedBid =
          Math.max(
            1,
            Math.min(
              financialCapacity,
              Math.round(
                rawEstimatedBid,
              ),
            ),
          )

        const risk =
          calculateRisk(
            estimatedBid,
            financialCapacity,
            referenceCeiling,
          )

        return {
          managerId:
            manager.id,

          managerName:
            getManagerDisplayName(
              manager,
            ),

          teamName:
            manager.teamName.trim(),

          role:
            player.role,

          roleFilled,

          roleLimit,

          remainingCredits,

          financialCapacity,

          estimatedBid,

          estimateFactor:
            estimate.factor,

          estimateSource:
            estimate.source,
          urgencyFactor,
          risk,
        }
      },
    )
    .filter(
      (
        competitor,
      ): competitor is
        CompetitorAnalysis =>
        competitor !== null,
    )
    .sort(
      (
        first,
        second,
      ) => {
        const riskRank:
          Record<
            CompetitorRisk,
            number
          > = {
            high: 3,
            medium: 2,
            low: 1,
          }

        const riskDifference =
          riskRank[
            second.risk
          ] -
          riskRank[
            first.risk
          ]

        if (
          riskDifference !== 0
        ) {
          return riskDifference
        }

        if (
          first.estimatedBid !==
          second.estimatedBid
        ) {
          return (
            second.estimatedBid -
            first.estimatedBid
          )
        }

        if (
          first.financialCapacity !==
          second.financialCapacity
        ) {
          return (
            second
              .financialCapacity -
            first
              .financialCapacity
          )
        }

        return first
          .managerName
          .localeCompare(
            second.managerName,
            'it',
          )
      },
    )
}

/* =========================
   RENDER
========================= */

export function renderCompetitorAnalysis(
  state: AppState,
  player: Player,
  allPlayers: Player[],
): string {
  const alreadyAssigned =
    state.auctionAssignments.some(
      (assignment) =>
        assignment.playerId ===
        player.id,
    )

  if (alreadyAssigned) {
    return ''
  }

  const competitors =
    calculateCompetitors(
      state,
      player,
      allPlayers,
    )

  const visibleCompetitors =
    competitors.slice(
      0,
      4,
    )

  if (
    visibleCompetitors.length ===
    0
  ) {
    return `
      <section
        class="
          auction-competitors-section
        "
      >
        <div
          class="
            auction-competitors-heading
          "
        >
          <div>
            <span
              class="auction-kicker"
            >
              CONCORRENZA
            </span>

            <h3>
              Possibili avversari
            </h3>
          </div>
        </div>

        <div
          class="
            auction-competitors-empty
          "
        >
          Nessun concorrente
          economicamente disponibile
          per questo ruolo.
        </div>
      </section>
    `
  }

  return `
    <section
      class="
        auction-competitors-section
      "
    >
      <div
        class="
          auction-competitors-heading
        "
      >
        <div>
          <span
            class="auction-kicker"
          >
            CONCORRENZA
          </span>

          <h3>
            Possibili avversari
          </h3>
        </div>

        <span
          class="
            auction-competitors-count
          "
        >
          ${escapeHtml(
            player.name,
          )}
        </span>
      </div>

      <div
        class="
          auction-competitors-grid
        "
      >
        ${visibleCompetitors
          .map(
            (
              competitor,
            ) => `
              <article
                class="
                  auction-competitor-card
                  risk-${competitor.risk}
                "
              >
                <div
                  class="
                    auction-competitor-card-top
                  "
                >
                  <div>
                    <strong>
                      ${escapeHtml(
                        competitor
                          .managerName,
                      )}
                    </strong>

                    ${
                      competitor
                        .teamName
                        ? `
                          <span>
                            ${escapeHtml(
                              competitor
                                .teamName,
                            )}
                          </span>
                        `
                        : ''
                    }
                  </div>

                  <span
                    class="
                      auction-competitor-risk
                      risk-${competitor.risk}
                    "
                  >
                    ${getRiskLabel(
                      competitor.risk,
                    )}
                  </span>
                </div>

                <div
                  class="
                    auction-competitor-main
                  "
                >
                  <span>
                    Puntata stimata
                  </span>

                  <strong>
                    ${competitor
                      .estimatedBid}
                    cr
                  </strong>

                  <small>
                    ${getEstimateSourceLabel(
                      competitor
                        .estimateSource,
                    )}${competitor.urgencyFactor >= 1.08 ? ' · urgente' : competitor.urgencyFactor <= 0.92 ? ' · reparto già avviato' : ''}
                  </small>
                </div>

                <div
                  class="
                    auction-competitor-bottom
                  "
                >
                  <div>
                    <span>
                      Slot occupati
                    </span>

                    <strong>
                      ${competitor
                        .roleFilled}
                      /
                      ${competitor
                        .roleLimit}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Capacità max
                    </span>

                    <strong>
                      ${competitor
                        .financialCapacity}
                      cr
                    </strong>
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
