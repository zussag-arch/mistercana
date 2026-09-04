import type {
  AppState,
} from '../app/state'

import {
  getOwnerAssignments,
  getOwnerManagerId,
  getOwnerRemainingStrategicSlots,
  getPlayerById,
  getPlayerSlot,
  isPlayerAssigned,
} from './auctionContext'

import {
  calculatePriceAdvice,
} from './priceAdvice'

import {
  calculateGoalkeeperRecommendation,
} from './goalkeeperStrategy'

import type {
  PriceAdvice,
} from './priceAdvice'

import type {
  ObjectivePriority,
} from './objective'

import type {
  Player,
  PlayerRole,
} from './player'

export interface RecommendationParameters {
  qualityWeight: number

  needFitWeight: number

  sustainabilityWeight:
    number

  opportunityWeight:
    number

  objectiveWeight:
    number

  betterSlotDecay:
    number

  worseSlotDecay:
    number

  sustainabilityIntercept:
    number

  sustainabilitySlope:
    number

  teamTotalQuadratic:
    number

  teamRoleQuadratic:
    number

  teamPenaltyCap:
    number

  alternativesCount:
    number

  objectivePrimary:
    number

  objectiveSecondary:
    number

  objectiveThird:
    number

  objectiveFourth:
    number

  objectiveBet:
    number
}

export const DEFAULT_RECOMMENDATION_PARAMETERS:
  RecommendationParameters = {
    /*
      Parametri ALPHA.

      La somma dei pesi è 1:

      Qualità         15%
      Bisogno         30%
      Sostenibilità   12%
      Mercato          8%
      Obiettivo       35%

      Verranno rivalutati durante
      la fase beta sulla base delle
      osservazioni reali d'asta.
    */

    qualityWeight:
      0.15,

    needFitWeight:
      0.30,

    sustainabilityWeight:
      0.12,

    opportunityWeight:
      0.08,

    objectiveWeight:
      0.35,

    betterSlotDecay:
      0.45,

    worseSlotDecay:
      0.65,

    sustainabilityIntercept:
      1.25,

    sustainabilitySlope:
      0.50,

    teamTotalQuadratic:
      0.015,

    teamRoleQuadratic:
      0.020,

    teamPenaltyCap:
      0.50,

    alternativesCount:
      2,

    /*
      Valore normalizzato della
      priorità impostata negli
      Obiettivi.

      "bet" non è trattato come
      semplice quinta scelta:
      rappresenta una categoria
      strategica distinta.
    */

    objectivePrimary:
      1.00,

    objectiveSecondary:
      0.82,

    objectiveThird:
      0.68,

    objectiveFourth:
      0.55,

    objectiveBet:
      0.60,
  }

export interface RecommendationCandidate {
  player: Player

  score: number

  quality?: number

  needFit?: number

  sustainability?: number

  opportunity?: number

  objectiveFit: number

  objectivePriority?:
    ObjectivePriority

  teamFactor: number

  targetSlot?: number

  playerSlot?: number

  sameTeamCount: number

  sameTeamRoleCount: number

  priceAdvice:
    PriceAdvice

  reasons: string[]
}

export interface RecommendationResult {
  role: PlayerRole

  targetSlot?: number

  recommended?:
    RecommendationCandidate

  alternatives:
    RecommendationCandidate[]

  ranked:
    RecommendationCandidate[]
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

/* =========================
   STRATEGIC NEED
========================= */

function calculateNeedFit(
  targetSlot:
    number | undefined,
  playerSlot:
    number | undefined,
  parameters:
    RecommendationParameters,
): number | undefined {
  if (
    targetSlot === undefined ||
    playerSlot === undefined
  ) {
    return undefined
  }

  if (
    playerSlot === targetSlot
  ) {
    return 1
  }

  /*
    Slot numericamente inferiore
    = profilo superiore.

    Esempio:
    serve D3, candidato D1.
  */
  if (
    playerSlot < targetSlot
  ) {
    return Math.exp(
      -parameters
        .betterSlotDecay *
      (
        targetSlot -
        playerSlot
      ),
    )
  }

  /*
    Slot numericamente superiore
    = profilo inferiore rispetto
    al bisogno corrente.

    Esempio:
    serve D3, candidato D5.
  */
  return Math.exp(
    -parameters
      .worseSlotDecay *
    (
      playerSlot -
      targetSlot
    ),
  )
}

/* =========================
   ECONOMIC SUSTAINABILITY
========================= */

function calculateCapacity(
  advice: PriceAdvice,
): number | undefined {
  const values =
    [
      advice.roleLimit,
      advice.financialLimit,
    ]
      .filter(
        (
          value,
        ): value is number =>
          value !== undefined &&
          Number.isFinite(
            value,
          ),
      )

  if (!values.length) {
    return undefined
  }

  /*
    Per la sostenibilità usiamo
    il margine più prudente tra
    reparto e capacità finanziaria.

    Questo NON trasforma il limite
    reparto in hard cap:
    serve soltanto a misurare quanto
    è economicamente comodo il profilo.
  */
  return Math.min(
    ...values,
  )
}

function calculateSustainability(
  advice: PriceAdvice,
  parameters:
    RecommendationParameters,
): number | undefined {
  /*
    Usiamo baseAuctionValue e non
    valueLimit.

    In questo modo la scarsità non
    viene conteggiata sia qui sia
    nell'opportunità di mercato.
  */
  const cost =
    advice.baseAuctionValue

  const capacity =
    calculateCapacity(
      advice,
    )

  if (
    cost === undefined ||
    capacity === undefined
  ) {
    return undefined
  }

  if (
    capacity <= 0
  ) {
    return 0
  }

  const ratio =
    cost /
    capacity

  return clamp(
    parameters
      .sustainabilityIntercept -
    (
      parameters
        .sustainabilitySlope *
      ratio
    ),
    0,
    1,
  )
}

/* =========================
   MARKET OPPORTUNITY
========================= */

function calculateOpportunity(
  advice: PriceAdvice,
): number | undefined {
  const pressure =
    advice.pressure

  if (
    pressure === undefined ||
    !Number.isFinite(
      pressure,
    ) ||
    pressure < 0
  ) {
    return undefined
  }

  /*
    Trasforma una pressione
    [0, +infinito)
    in un valore [0, 1).

    pressure = 1
    -> opportunity = 0.5

    pressure = 3
    -> opportunity = 0.75
  */
  return (
    pressure /
    (
      1 +
      pressure
    )
  )
}

/* =========================
   OBJECTIVES
========================= */

function getObjectivePriority(
  state: AppState,
  playerId: string,
):
  | ObjectivePriority
  | undefined {
  return state
    .objectives
    .find(
      (objective) =>
        objective.playerId ===
        playerId,
    )
    ?.priority
}

function calculateObjectiveFit(
  priority:
    ObjectivePriority | undefined,
  parameters:
    RecommendationParameters,
): number {
  if (!priority) {
    return 0
  }

  switch (priority) {
    case 'primary':
      return parameters
        .objectivePrimary

    case 'secondary':
      return parameters
        .objectiveSecondary

    case 'third':
      return parameters
        .objectiveThird

    case 'fourth':
      return parameters
        .objectiveFourth

    case 'bet':
      return parameters
        .objectiveBet
  }
}

function getObjectiveReason(
  priority:
    ObjectivePriority,
): string {
  switch (priority) {
    case 'primary':
      return 'obiettivo primario tra quelli selezionati'

    case 'secondary':
      return 'obiettivo secondario tra quelli selezionati'

    case 'third':
      return 'terzo obiettivo tra quelli selezionati'

    case 'fourth':
      return 'quarto obiettivo tra quelli selezionati'

    case 'bet':
      return 'scommessa inserita tra i tuoi obiettivi'
  }
}

/* =========================
   WEIGHTED SCORE
========================= */

function calculateWeightedScore(
  values: Array<{
    value:
      number | undefined
    weight: number
  }>,
): number {
  let weightedTotal = 0

  let weightTotal = 0

  values.forEach(
    (item) => {
      if (
        item.value === undefined ||
        !Number.isFinite(
          item.value,
        )
      ) {
        return
      }

      weightedTotal +=
        item.value *
        item.weight

      weightTotal +=
        item.weight
    },
  )

  /*
    Se un componente manca davvero,
    i pesi disponibili vengono
    rinormalizzati.

    ObjectiveFit invece è sempre
    definito:
    0 significa semplicemente
    "non è un obiettivo".
  */
  if (
    weightTotal <= 0
  ) {
    return 0
  }

  return (
    weightedTotal /
    weightTotal
  )
}

/* =========================
   OWNER ROSTER
========================= */

function getOwnerPlayers(
  state: AppState,
  allPlayers: Player[],
): Player[] {
  return getOwnerAssignments(
    state,
  )
    .map(
      (assignment) =>
        getPlayerById(
          allPlayers,
          assignment.playerId ?? '',
        ),
    )
    .filter(
      (
        player,
      ): player is Player =>
        Boolean(player),
    )
}

/* =========================
   TEAM DIVERSIFICATION
========================= */

function calculateTeamFactor(
  state: AppState,
  candidate: Player,
  allPlayers: Player[],
  parameters:
    RecommendationParameters,
): {
  factor: number
  sameTeamCount: number
  sameTeamRoleCount: number
} {
  const ownerPlayers =
    getOwnerPlayers(
      state,
      allPlayers,
    )

  const sameTeamCount =
    ownerPlayers.filter(
      (player) =>
        player.team ===
        candidate.team,
    ).length

  const sameTeamRoleCount =
    ownerPlayers.filter(
      (player) =>
        player.team ===
        candidate.team &&
        player.role ===
        candidate.role,
    ).length

  /*
    Penalità morbida.

    Non impedisce mai in assoluto
    di consigliare giocatori della
    stessa squadra reale.
  */
  const rawPenalty =
    (
      parameters
        .teamTotalQuadratic *
      sameTeamCount ** 2
    ) +
    (
      parameters
        .teamRoleQuadratic *
      sameTeamRoleCount ** 2
    )

  const penalty =
    Math.min(
      parameters
        .teamPenaltyCap,
      rawPenalty,
    )

  return {
    factor:
      1 -
      penalty,

    sameTeamCount,

    sameTeamRoleCount,
  }
}

/* =========================
   HARD FINANCIAL GUARD
========================= */

function isFinanciallyEligible(
  advice: PriceAdvice,
): boolean {
  const cost =
    advice.baseAuctionValue

  const financialLimit =
    advice.financialLimit

  /*
    In mancanza di uno dei dati
    non inventiamo un'esclusione.

    Il candidato resta quindi
    valutabile dagli altri fattori.
  */
  if (
    cost === undefined ||
    financialLimit === undefined ||
    !Number.isFinite(cost) ||
    !Number.isFinite(
      financialLimit,
    )
  ) {
    return true
  }

  /*
    Il limite finanziario globale
    è l'unico hard cap.

    Un giocatore può invece essere
    sopra il limite strategico del
    reparto e restare eleggibile.
  */
  return (
    cost <=
    financialLimit
  )
}

/* =========================
   EXPLANATIONS
========================= */

function buildReasons(
  candidate:
    RecommendationCandidate,
): string[] {
  const reasons:
    string[] = []

  /*
    L'Obiettivo è intenzionalmente
    mostrato per primo perché è uno
    dei fattori più importanti della
    Chiamata consigliata.
  */
  if (
    candidate.objectivePriority
  ) {
    reasons.push(
      getObjectiveReason(
        candidate
          .objectivePriority,
      ),
    )
  }

  if (
    candidate.targetSlot !==
      undefined &&
    candidate.playerSlot !==
      undefined
  ) {
    if (
      candidate.playerSlot ===
      candidate.targetSlot
    ) {
      reasons.push(
        `copre esattamente la fascia ${candidate.player.role}${candidate.targetSlot} che ti manca`,
      )
    } else if (
      candidate.playerSlot <
      candidate.targetSlot
    ) {
      reasons.push(
        `copre la fascia ${candidate.player.role}${candidate.targetSlot} con un profilo superiore`,
      )
    }
  }

  if (
    candidate.sustainability !==
      undefined &&
    candidate.sustainability >=
      0.75
  ) {
    reasons.push(
      'costo coerente con il margine disponibile',
    )
  }

  if (
    candidate.opportunity !==
      undefined &&
    candidate.opportunity >=
      0.60
  ) {
    reasons.push(
      'pressione di mercato alta sulla sua fascia',
    )
  }

  if (
    candidate.teamFactor >=
    0.95
  ) {
    reasons.push(
      'mantiene una buona diversificazione della rosa',
    )
  }

  if (
    reasons.length === 0
  ) {
    reasons.push(
      'è il miglior equilibrio disponibile tra bisogno, qualità e sostenibilità',
    )
  }

  return reasons.slice(
    0,
    3,
  )
}

/* =========================
   CANDIDATE
========================= */

function calculateCandidate(
  state: AppState,
  candidate: Player,
  allPlayers: Player[],
  targetSlot:
    number | undefined,
  parameters:
    RecommendationParameters,
): RecommendationCandidate {
  const priceAdvice =
    calculatePriceAdvice(
      state,
      candidate,
      allPlayers,
    )

  const playerSlot =
    getPlayerSlot(
      state,
      candidate,
      allPlayers,
    )

  /*
    iCà è già 0-100.
  */
  const quality =
    candidate.iCa ===
      undefined
      ? undefined
      : clamp(
          candidate.iCa /
          100,
          0,
          1,
        )

  const needFit =
    calculateNeedFit(
      targetSlot,
      playerSlot,
      parameters,
    )

  const sustainability =
    calculateSustainability(
      priceAdvice,
      parameters,
    )

  const opportunity =
    calculateOpportunity(
      priceAdvice,
    )

  const objectivePriority =
    getObjectivePriority(
      state,
      candidate.id,
    )

  const objectiveFit =
    calculateObjectiveFit(
      objectivePriority,
      parameters,
    )

  /*
    Formula ALPHA:

    Base =
      0.15 * Quality
    + 0.30 * Need
    + 0.12 * Sustainability
    + 0.08 * Opportunity
    + 0.35 * Objective
  */
  const baseScore =
    calculateWeightedScore([
      {
        value:
          quality,

        weight:
          parameters
            .qualityWeight,
      },
      {
        value:
          needFit,

        weight:
          parameters
            .needFitWeight,
      },
      {
        value:
          sustainability,

        weight:
          parameters
            .sustainabilityWeight,
      },
      {
        value:
          opportunity,

        weight:
          parameters
            .opportunityWeight,
      },
      {
        value:
          objectiveFit,

        weight:
          parameters
            .objectiveWeight,
      },
    ])

  const team =
    calculateTeamFactor(
      state,
      candidate,
      allPlayers,
      parameters,
    )

  /*
    La concentrazione sulla squadra
    reale agisce dopo il punteggio
    principale come fattore morbido.
  */
  const score =
    baseScore *
    team.factor

  const result:
    RecommendationCandidate = {
      player:
        candidate,

      score,

      quality,

      needFit,

      sustainability,

      opportunity,

      objectiveFit,

      objectivePriority,

      teamFactor:
        team.factor,

      targetSlot,

      playerSlot,

      sameTeamCount:
        team.sameTeamCount,

      sameTeamRoleCount:
        team.sameTeamRoleCount,

      priceAdvice,

      reasons:
        [],
    }

  result.reasons =
    buildReasons(
      result,
    )

  return result
}

/* =========================
   RECOMMENDATION
========================= */

export function calculateRecommendation(
  state: AppState,
  role: PlayerRole,
  allPlayers: Player[],
  parameters:
    RecommendationParameters =
      DEFAULT_RECOMMENDATION_PARAMETERS,
): RecommendationResult {
  const ownerId =
    getOwnerManagerId(
      state,
    )

  if (!ownerId) {
    return {
      role,
      alternatives: [],
      ranked: [],
    }
  }

  /*
    PORTIERI

    P non usa gli slot strategici
    generici derivati dal PMA.

    La raccomandazione viene delegata
    al motore dedicato che valuta
    le terne e le strategie P.
  */
  if (
    role === 'P'
  ) {
    return calculateGoalkeeperRecommendation(
      state,
      allPlayers,
      parameters,
    )
  }

  /*
    D / C / A

    La Chiamata consigliata considera
    sempre e soltanto il ruolo attivo.
  */
  const remaining =
    getOwnerRemainingStrategicSlots(
      state,
      role,
      allPlayers,
    )

  const targetSlot =
    remaining[0]

  if (
    targetSlot === undefined
  ) {
    return {
      role,
      alternatives: [],
      ranked: [],
    }
  }

  /*
    Gli scarti escludono esclusivamente
    il ranking automatico.

    Non modificano l'assegnazione del
    giocatore e non lo rendono venduto.
  */
  const discardedIds =
    new Set(
      state.recommendedDiscards,
    )

  const candidates =
    allPlayers
      .filter(
        (player) =>
          player.role === role &&
          !isPlayerAssigned(
            state,
            player.id,
          ) &&
          !discardedIds.has(
            player.id,
          ),
      )
      .map(
        (player) =>
          calculateCandidate(
            state,
            player,
            allPlayers,
            targetSlot,
            parameters,
          ),
      )
      /*
        L'unica esclusione economica
        automatica è il superamento
        del limite finanziario globale
        già da parte del costo-base.

        Il limite reparto resta soft.
      */
      .filter(
        (candidate) =>
          isFinanciallyEligible(
            candidate.priceAdvice,
          ),
      )
      .sort(
        (
          first,
          second,
        ) => {
          /*
            Primo criterio:
            RecommendationScore.
          */
          const scoreDifference =
            second.score -
            first.score

          if (
            Math.abs(
              scoreDifference,
            ) >
            0.000001
          ) {
            return scoreDifference
          }

          /*
            Pareggio:
            preferiamo l'iCà maggiore.

            È soltanto un tie-break,
            quindi non duplica il peso
            della qualità nel punteggio.
          */
          return (
            (
              second.player.iCa ??
              -Infinity
            ) -
            (
              first.player.iCa ??
              -Infinity
            )
          )
        },
      )

  const recommended =
    candidates[0]

  const alternatives =
    candidates.slice(
      1,
      1 +
      parameters
        .alternativesCount,
    )

  return {
    role,

    targetSlot,

    recommended,

    alternatives,

    ranked:
      candidates,
  }
}
