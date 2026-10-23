import type {
  AppState,
} from '../app/state'

import {
  getOwnerManagerId,
  getOwnerRolePlayers,
} from './auctionContext'

import {
  calculateBaseAuctionValue,
  calculateGoalkeeperPriceAdviceFromPlans,
} from './priceAdvice'

import type {
  PriceAdvice,
} from './priceAdvice'

import {
  DEFAULT_GOALKEEPER_STRATEGY_PARAMETERS,
  getAvailableGoalkeepers,
  getGoalkeeperPlayerHierarchy,
  getGoalkeeperSaggiProfile,
  getValidGoalkeeperPlans,
} from './goalkeeperPlanning'

import type {
  GoalkeeperPlanningPlan,
  GoalkeeperSaggiProfile,
  GoalkeeperStrategyParameters,
  GoalkeeperStrategyType,
} from './goalkeeperPlanning'

import type {
  ObjectivePriority,
} from './objective'

import type {
  Player,
} from './player'

import type {
  RecommendationCandidate,
  RecommendationParameters,
  RecommendationResult,
} from './recommendation'



export type {
  
  GoalkeeperStrategyParameters,
  
  
} from './goalkeeperPlanning'

/* =========================
   TYPES
========================= */

interface GoalkeeperStrategyPlan
  extends GoalkeeperPlanningPlan {
  projectedCost?: number
}

interface GoalkeeperCandidateData {
  candidate:
    RecommendationCandidate

  plans:
    GoalkeeperStrategyPlan[]

  bestPlan?:
    GoalkeeperStrategyPlan

  openStrategies:
    number

  saggiProfile:
    GoalkeeperSaggiProfile
}

/* =========================
   HELPERS
========================= */

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

function getObjectiveFit(
  priority:
    | ObjectivePriority
    | undefined,
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

/* =========================
   SUSTAINABILITY
========================= */

function calculateSustainability(
  advice: PriceAdvice,
  parameters:
    RecommendationParameters,
): number | undefined {
  const cost =
    advice.baseAuctionValue

  const limits =
    [
      advice.roleLimit,
      advice.financialLimit,
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
    cost === undefined ||
    !limits.length
  ) {
    return undefined
  }

  const capacity =
    Math.min(
      ...limits,
    )

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

function isFinanciallyEligible(
  advice: PriceAdvice,
): boolean {
  const cost =
    advice.baseAuctionValue

  const financialLimit =
    advice.financialLimit

  if (
    cost === undefined ||
    financialLimit ===
      undefined ||
    !Number.isFinite(
      cost,
    ) ||
    !Number.isFinite(
      financialLimit,
    )
  ) {
    return true
  }

  /*
    Anche per P l'unica
    esclusione economica hard
    è il limite finanziario
    globale.

    Il limite strategico P
    rimane soft.
  */
  return (
    cost <=
    financialLimit
  )
}

/* =========================
   PROJECTED PLAN COST
========================= */

function getProjectedPlayerCost(
  state: AppState,
  player: Player,
  allPlayers: Player[],
): number | undefined {
  const ownerId =
    getOwnerManagerId(
      state,
    )

  if (ownerId) {
    const assignment =
      state
        .auctionAssignments
        .find(
          (item) =>
            item.playerId ===
              player.id &&
            item.managerId ===
              ownerId,
        )

    if (assignment) {
      return assignment.price
    }
  }

  /*
    Usiamo soltanto il valore-base
    di mercato.

    NON richiamiamo calculatePriceAdvice()
    qui, evitando ricorsioni e la
    ricostruzione ripetuta dei piani P.
  */
  return calculateBaseAuctionValue(
    state,
    player,
    allPlayers,
  ).baseAuctionValue
}

function calculateProjectedTrioCost(
  state: AppState,
  players: Player[],
  allPlayers: Player[],
): number | undefined {
  const values =
    players.map(
      (player) =>
        getProjectedPlayerCost(
          state,
          player,
          allPlayers,
        ),
    )

  if (
    values.some(
      (value) =>
        value === undefined ||
        !Number.isFinite(
          value,
        ),
    )
  ) {
    return undefined
  }

  return (
    values as number[]
  ).reduce(
    (
      total,
      value,
    ) =>
      total + value,
    0,
  )
}

function enrichPlan(
  state: AppState,
  plan: GoalkeeperPlanningPlan,
  allPlayers: Player[],
): GoalkeeperStrategyPlan {
  return {
    ...plan,

    projectedCost:
      calculateProjectedTrioCost(
        state,
        plan.players,
        allPlayers,
      ),
  }
}

/* =========================
   PLAN COMPARATOR
========================= */

/*
  Punteggio di un piano portieri (0-100 circa):
  60% qualità (iCà medio dei portieri del piano, posizione nel ruolo)
  40% calendario (giornate favorevoli su 38), meno 3 punti per buco.
  I Saggi restano solo come spareggio, poi il costo.
*/
const PLAN_QUALITY_WEIGHT = 0.6
const PLAN_CALENDAR_WEIGHT = 0.4
const PLAN_HOLE_PENALTY = 3

function goalkeeperPlanScore(
  plan: GoalkeeperPlanningPlan,
): number {
  const qualities = plan.players
    .map((player) => player.iCa)
    .filter((value): value is number => value !== undefined && Number.isFinite(value))
  const quality = qualities.length
    ? qualities.reduce((sum, value) => sum + value, 0) / qualities.length
    : 0
  const favorable = plan.coverage?.favorableDays ?? 0
  const holes = plan.coverage?.holes ?? 0
  return (
    PLAN_QUALITY_WEIGHT * quality +
    PLAN_CALENDAR_WEIGHT * (favorable / 38) * 100 -
    PLAN_HOLE_PENALTY * holes
  )
}

function comparePlans(
  first:
    GoalkeeperStrategyPlan,
  second:
    GoalkeeperStrategyPlan,
): number {
  const scoreDifference =
    goalkeeperPlanScore(second) -
    goalkeeperPlanScore(first)

  if (Math.abs(scoreDifference) > 0.5) {
    return scoreDifference
  }

  const saggiDifference =
    (second.saggiStrength ?? -Infinity) -
    (first.saggiStrength ?? -Infinity)

  if (Math.abs(saggiDifference) > 0.000001) {
    return saggiDifference
  }

  return (
    (first.projectedCost ?? Infinity) -
    (second.projectedCost ?? Infinity)
  )
}

/* =========================
   REASONS
========================= */

function getStrategyLabel(
  strategy:
    GoalkeeperStrategyType,
): string {
  switch (strategy) {
    case 'monoclub':
      return 'Monoclub'

    case 'top-pair':
      return 'Top/Semitop + secondo + P1 abbinato'

    case 'rotation':
      return 'Rotazione tre P1'
  }
}

function buildGoalkeeperReasons(
  data:
    GoalkeeperCandidateData,
): string[] {
  const reasons:
    string[] = []

  if (
    data.openStrategies > 1
  ) {
    reasons.push(
      `mantiene aperte ${data.openStrategies} strategie portieri`,
    )
  } else if (
    data.openStrategies === 1
  ) {
    reasons.push(
      'mantiene aperta una strategia portieri valida',
    )
  }

  if (
    data.bestPlan
  ) {
    reasons.push(
      `piano migliore: ${getStrategyLabel(
        data.bestPlan.strategy,
      )}`,
    )

    if (
      data.bestPlan.coverage
    ) {
      reasons.push(
        `${data.bestPlan.coverage.favorableDays}/${data.bestPlan.coverage.days} giornate favorevoli · ${data.bestPlan.coverage.holes} buchi`,
      )
    }
  }

  if (
    reasons.length === 0
  ) {
    reasons.push(
      'profilo compatibile con la costruzione del reparto portieri',
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

function buildRecommendationCandidate(
  state: AppState,
  player: Player,
  allPlayers: Player[],
  recommendationParameters:
    RecommendationParameters,
  strategyParameters:
    GoalkeeperStrategyParameters,
  planningPlans:
    GoalkeeperPlanningPlan[],
): GoalkeeperCandidateData {
  const enrichedPlans =
    planningPlans
      .map(
        (plan) =>
          enrichPlan(
            state,
            plan,
            allPlayers,
          ),
      )
      .sort(
        comparePlans,
      )

  const bestPlan =
    enrichedPlans[0]

  const strategies =
    new Set(
      planningPlans.map(
        (plan) =>
          plan.strategy,
      ),
    )

  const openStrategies =
    strategies.size

  const saggiProfile =
    getGoalkeeperSaggiProfile(
      player.id,
      strategyParameters,
    )

  /*
    Il prezzo P usa gli stessi
    piani che sono già stati
    calcolati dal ranking.

    Evitiamo quindi di enumerare
    di nuovo tutte le terne.
  */
  const advice =
    calculateGoalkeeperPriceAdviceFromPlans(
      state,
      player,
      allPlayers,
      planningPlans,
    )

  const objectivePriority =
    getObjectivePriority(
      state,
      player.id,
    )

  const objectiveFit =
    getObjectiveFit(
      objectivePriority,
      recommendationParameters,
    )

  const hierarchy =
    getGoalkeeperPlayerHierarchy(
      player,
    )

  const ownerPlayers =
    getOwnerRolePlayers(
      state,
      allPlayers,
      'P',
    )

  const sameTeamCount =
    ownerPlayers.filter(
      (owned) =>
        owned.team ===
        player.team,
    ).length

  /*
    Nei portieri non applichiamo
    penalità di concentrazione.

    Monoclub e Top-pair richiedono
    esplicitamente portieri della
    stessa squadra reale.
  */
  const candidate:
    RecommendationCandidate = {
      player,

      /*
        Score P = valore di opzione
        strategica.

        1 strategia = 1/3
        2 strategie = 2/3
        3 strategie = 1

        L'ordinamento AUTO non usa
        una somma pesata D/C/A.
      */
      score:
        openStrategies / 3,

      quality:
        saggiProfile
          .medianFascia ===
          undefined
          ? undefined
          : clamp(
              saggiProfile
                .medianFascia /
                5,
              0,
              1,
            ),

      needFit:
        openStrategies / 3,

      sustainability:
        calculateSustainability(
          advice,
          recommendationParameters,
        ),

      opportunity:
        undefined,

      objectiveFit,

      objectivePriority,

      teamFactor: 1,

      targetSlot:
        undefined,

      playerSlot:
        hierarchy,

      sameTeamCount,

      sameTeamRoleCount:
        sameTeamCount,

      priceAdvice:
        advice,

      reasons: [],
    }

  const data:
    GoalkeeperCandidateData = {
      candidate,

      plans:
        enrichedPlans,

      bestPlan,

      openStrategies,

      saggiProfile,
    }

  candidate.reasons =
    buildGoalkeeperReasons(
      data,
    )

  return data
}

/* =========================
   CANDIDATE COMPARATOR
========================= */

function compareCandidates(
  first:
    GoalkeeperCandidateData,
  second:
    GoalkeeperCandidateData,
): number {
  /*
    Ordine v2:
    1. priorità Obiettivi
    2. 50% iCà del candidato + 50% punteggio del suo miglior piano
    3. più strategie ancora aperte
    4. Saggi, poi iCà del candidato
  */
  if (
    first.candidate.objectiveFit !==
    second.candidate.objectiveFit
  ) {
    return (
      second.candidate.objectiveFit -
      first.candidate.objectiveFit
    )
  }

  if (first.bestPlan && second.bestPlan) {
    // metà conta il portiere che chiami, metà il piano in cui entra
    const candidateScore = (data: GoalkeeperCandidateData) =>
      0.5 * (data.candidate.player.iCa ?? 0) +
      0.5 * goalkeeperPlanScore(data.bestPlan!)
    const difference = candidateScore(second) - candidateScore(first)
    if (Math.abs(difference) > 0.5) {
      return difference
    }
    const planDifference =
      comparePlans(first.bestPlan, second.bestPlan)
    if (planDifference !== 0) {
      return planDifference
    }
  } else if (first.bestPlan) {
    return -1
  } else if (second.bestPlan) {
    return 1
  }

  if (first.openStrategies !== second.openStrategies) {
    return second.openStrategies - first.openStrategies
  }

  const saggiDifference =
    (second.saggiProfile.medianFascia ?? -Infinity) -
    (first.saggiProfile.medianFascia ?? -Infinity)

  if (Math.abs(saggiDifference) > 0.000001) {
    return saggiDifference
  }

  return (
    (second.candidate.player.iCa ?? -Infinity) -
    (first.candidate.player.iCa ?? -Infinity)
  )
}

/* =========================
   PUBLIC API
========================= */

export function calculateGoalkeeperRecommendation(
  state: AppState,
  allPlayers: Player[],
  recommendationParameters:
    RecommendationParameters,
  strategyParameters:
    GoalkeeperStrategyParameters =
      DEFAULT_GOALKEEPER_STRATEGY_PARAMETERS,
): RecommendationResult {
  const ownerId =
    getOwnerManagerId(
      state,
    )

  if (!ownerId) {
    return {
      role: 'P',

      alternatives: [],

      ranked: [],
    }
  }

  const ownerGoalkeepers =
    getOwnerRolePlayers(
      state,
      allPlayers,
      'P',
    )

  if (
    ownerGoalkeepers.length >= 3
  ) {
    return {
      role: 'P',

      alternatives: [],

      ranked: [],
    }
  }

  /*
    Una sola costruzione delle
    terne valide per tutto il
    ranking AUTO.
  */
  const allPlans =
    getValidGoalkeeperPlans(
      state,
      allPlayers,
      undefined,
      strategyParameters,
    )

  const discardedIds =
    new Set(
      state.recommendedDiscards,
    )

  const ownerIds =
    new Set(
      ownerGoalkeepers.map(
        (player) =>
          player.id,
      ),
    )

  const availableGoalkeepers =
    getAvailableGoalkeepers(
      state,
      allPlayers,
    )

  const candidateData =
    availableGoalkeepers
      .filter(
        (player) =>
          !ownerIds.has(
            player.id,
          ) &&
          !discardedIds.has(
            player.id,
          ),
      )
      .map(
        (player) => {
          const playerPlans =
            allPlans.filter(
              (plan) =>
                plan.players.some(
                  (goalkeeper) =>
                    goalkeeper.id ===
                    player.id,
                ),
            )

          return buildRecommendationCandidate(
            state,
            player,
            allPlayers,
            recommendationParameters,
            strategyParameters,
            playerPlans,
          )
        },
      )
      /*
        Nessun piano valido:
        escluso soltanto dal ranking
        automatico.

        Il giocatore resta libero e
        selezionabile manualmente.
      */
      .filter(
        (data) =>
          data.openStrategies > 0,
      )
      /*
        L'unico hard cap economico
        resta quello finanziario.
      */
      .filter(
        (data) =>
          isFinanciallyEligible(
            data.candidate
              .priceAdvice,
          ),
      )
      .sort(
        compareCandidates,
      )

  const ranked =
    candidateData.map(
      (data) =>
        data.candidate,
    )

  const recommended =
    ranked[0]

  const alternatives =
    ranked.slice(
      1,
      1 +
      recommendationParameters
        .alternativesCount,
    )

  return {
    role: 'P',

    recommended,

    alternatives,

    ranked,
  }
}