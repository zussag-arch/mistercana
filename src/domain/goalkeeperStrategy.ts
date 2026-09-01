import type {
  AppState,
} from '../app/state'

import {
  calculateGoalkeeperCoverage,
} from '../data/goalkeeperCalendar'

import type {
  GoalkeeperCoverage,
} from '../data/goalkeeperCalendar'

import {
  getGoalkeeperHierarchy,
} from '../data/goalkeeperHierarchy'

import type {
  GoalkeeperHierarchy,
} from '../data/goalkeeperHierarchy'

import {
  getSaggiForPlayer,
} from '../data/saggi'

import {
  getOwnerManagerId,
  getOwnerRolePlayers,
  isPlayerAssigned,
} from './auctionContext'

import {
  calculatePriceAdvice,
} from './priceAdvice'

import type {
  PriceAdvice,
} from './priceAdvice'

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

/* =========================
   TYPES
========================= */

export type GoalkeeperTier =
  | 'top'
  | 'semitop'
  | 'second'
  | 'other'
  | 'unknown'

export type GoalkeeperStrategyType =
  | 'monoclub'
  | 'top-pair'
  | 'rotation'

export interface GoalkeeperStrategyParameters {
  /*
    PARAMETRI CORRENTI,
    NON DEFINITIVI.

    Fascia_Valore dei Saggi:
    5 = livello massimo,
    1 = livello minimo.

    Le soglie potranno essere
    cambiate dopo i test beta.
  */
  topMinFascia: number
  semitopMinFascia: number
  secondTierMinFascia: number
}

export const DEFAULT_GOALKEEPER_STRATEGY_PARAMETERS:
  GoalkeeperStrategyParameters = {
    topMinFascia:
      5,

    semitopMinFascia:
      4,

    secondTierMinFascia:
      3,
  }

export interface GoalkeeperSaggiProfile {
  medianFascia?: number
  tier: GoalkeeperTier
  samples: number
}

export interface GoalkeeperStrategyPlan {
  strategy:
    GoalkeeperStrategyType

  players:
    Player[]

  teams:
    string[]

  coverage:
    GoalkeeperCoverage | null

  projectedCost?: number

  saggiStrength?: number
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
   GENERIC HELPERS
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

function median(
  values: number[],
): number | undefined {
  const valid =
    values
      .filter(
        (value) =>
          Number.isFinite(
            value,
          ),
      )
      .sort(
        (
          first,
          second,
        ) =>
          first -
          second,
      )

  if (!valid.length) {
    return undefined
  }

  const middle =
    Math.floor(
      valid.length /
      2,
    )

  if (
    valid.length %
      2 ===
    1
  ) {
    return valid[
      middle
    ]
  }

  return (
    valid[
      middle - 1
    ] +
    valid[
      middle
    ]
  ) / 2
}

function getUniqueTeams(
  players: Player[],
): string[] {
  return Array.from(
    new Set(
      players.map(
        (player) =>
          player.team,
      ),
    ),
  )
}

function hasPlayer(
  players: Player[],
  playerId: string,
): boolean {
  return players.some(
    (player) =>
      player.id ===
      playerId,
  )
}

/* =========================
   SAGGI
========================= */

export function getGoalkeeperSaggiProfile(
  playerId: string,
  parameters:
    GoalkeeperStrategyParameters =
      DEFAULT_GOALKEEPER_STRATEGY_PARAMETERS,
): GoalkeeperSaggiProfile {
  const values =
    getSaggiForPlayer(
      playerId,
    )
      .map(
        (record) =>
          record.fasciaValore,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== undefined &&
          Number.isFinite(
            value,
          ) &&
          value >= 1 &&
          value <= 5,
      )

  const medianFascia =
    median(
      values,
    )

  if (
    medianFascia === undefined
  ) {
    return {
      tier:
        'unknown',

      samples:
        values.length,
    }
  }

  if (
    medianFascia >=
    parameters.topMinFascia
  ) {
    return {
      medianFascia,
      tier:
        'top',
      samples:
        values.length,
    }
  }

  if (
    medianFascia >=
    parameters
      .semitopMinFascia
  ) {
    return {
      medianFascia,
      tier:
        'semitop',
      samples:
        values.length,
    }
  }

  if (
    medianFascia >=
    parameters
      .secondTierMinFascia
  ) {
    return {
      medianFascia,
      tier:
        'second',
      samples:
        values.length,
    }
  }

  return {
    medianFascia,
    tier:
      'other',
    samples:
      values.length,
  }
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

  return (
    cost <=
    financialLimit
  )
}

/* =========================
   HIERARCHY HELPERS
========================= */

function getHierarchy(
  player: Player,
):
  | GoalkeeperHierarchy
  | undefined {
  const record =
    getGoalkeeperHierarchy(
      player.id,
    )

  if (
    !record ||
    record.team !==
      player.team
  ) {
    return undefined
  }

  return record.hierarchy
}

function findTeamGoalkeeper(
  players: Player[],
  team: string,
  hierarchy:
    GoalkeeperHierarchy,
): Player | undefined {
  return players.find(
    (player) =>
      player.team ===
        team &&
      getHierarchy(
        player,
      ) ===
        hierarchy,
  )
}

/* =========================
   COST
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

  return calculatePriceAdvice(
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
  ).reduce<number>(
    (
      total,
      value,
    ) =>
      total +
      value,
    0,
  )
}

/* =========================
   PLAN QUALITY
========================= */

function calculatePlanSaggiStrength(
  players: Player[],
  parameters:
    GoalkeeperStrategyParameters,
): number | undefined {
  const p1Profiles =
    players
      .filter(
        (player) =>
          getHierarchy(
            player,
          ) === 1,
      )
      .map(
        (player) =>
          getGoalkeeperSaggiProfile(
            player.id,
            parameters,
          )
            .medianFascia,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== undefined,
      )

  return median(
    p1Profiles,
  )
}

/* =========================
   STRATEGY 1
   MONOCLUB
========================= */

function buildMonoclubPlan(
  state: AppState,
  trio: Player[],
  allPlayers: Player[],
  parameters:
    GoalkeeperStrategyParameters,
):
  | GoalkeeperStrategyPlan
  | null {
  const teams =
    getUniqueTeams(
      trio,
    )

  if (
    teams.length !== 1
  ) {
    return null
  }

  const team =
    teams[0]

  const p1 =
    findTeamGoalkeeper(
      trio,
      team,
      1,
    )

  const p2 =
    findTeamGoalkeeper(
      trio,
      team,
      2,
    )

  const p3 =
    findTeamGoalkeeper(
      trio,
      team,
      3,
    )

  if (
    !p1 ||
    !p2 ||
    !p3
  ) {
    return null
  }

  const profile =
    getGoalkeeperSaggiProfile(
      p1.id,
      parameters,
    )

  /*
    Strategia 1:
    il P1 deve essere Top.

    P2 e P3 non ricevono
    penalità qualitative.
  */
  if (
    profile.tier !==
      'top'
  ) {
    return null
  }

  return {
    strategy:
      'monoclub',

    players:
      trio,

    teams,

    coverage:
      calculateGoalkeeperCoverage(
        [
          team,
        ],
      ),

    projectedCost:
      calculateProjectedTrioCost(
        state,
        trio,
        allPlayers,
      ),

    saggiStrength:
      profile.medianFascia,
  }
}

/* =========================
   STRATEGY 2
   TOP / SEMITOP + P2
   + P1 ABBINATO
========================= */

function buildTopPairPlan(
  state: AppState,
  trio: Player[],
  allPlayers: Player[],
  parameters:
    GoalkeeperStrategyParameters,
):
  | GoalkeeperStrategyPlan
  | null {
  const teams =
    getUniqueTeams(
      trio,
    )

  if (
    teams.length !== 2
  ) {
    return null
  }

  const counts =
    new Map<
      string,
      number
    >()

  trio.forEach(
    (player) => {
      counts.set(
        player.team,
        (
          counts.get(
            player.team,
          ) ??
          0
        ) + 1,
      )
    },
  )

  const anchorTeam =
    Array.from(
      counts.entries(),
    )
      .find(
        (
          entry,
        ) =>
          entry[1] === 2,
      )
      ?.[0]

  const pairedTeam =
    Array.from(
      counts.entries(),
    )
      .find(
        (
          entry,
        ) =>
          entry[1] === 1,
      )
      ?.[0]

  if (
    !anchorTeam ||
    !pairedTeam
  ) {
    return null
  }

  const anchorP1 =
    findTeamGoalkeeper(
      trio,
      anchorTeam,
      1,
    )

  const anchorP2 =
    findTeamGoalkeeper(
      trio,
      anchorTeam,
      2,
    )

  const pairedP1 =
    findTeamGoalkeeper(
      trio,
      pairedTeam,
      1,
    )

  if (
    !anchorP1 ||
    !anchorP2 ||
    !pairedP1
  ) {
    return null
  }

  const anchorProfile =
    getGoalkeeperSaggiProfile(
      anchorP1.id,
      parameters,
    )

  if (
    anchorProfile.tier !==
      'top' &&
    anchorProfile.tier !==
      'semitop'
  ) {
    return null
  }

  return {
    strategy:
      'top-pair',

    players:
      trio,

    teams:
      [
        anchorTeam,
        pairedTeam,
      ],

    coverage:
      calculateGoalkeeperCoverage(
        [
          anchorTeam,
          pairedTeam,
        ],
      ),

    projectedCost:
      calculateProjectedTrioCost(
        state,
        trio,
        allPlayers,
      ),

    saggiStrength:
      calculatePlanSaggiStrength(
        trio,
        parameters,
      ),
  }
}

/* =========================
   STRATEGY 3
   TRE P1 SECONDA FASCIA
========================= */

function buildRotationPlan(
  state: AppState,
  trio: Player[],
  allPlayers: Player[],
  parameters:
    GoalkeeperStrategyParameters,
):
  | GoalkeeperStrategyPlan
  | null {
  const teams =
    getUniqueTeams(
      trio,
    )

  if (
    teams.length !== 3
  ) {
    return null
  }

  const allP1 =
    trio.every(
      (player) =>
        getHierarchy(
          player,
        ) === 1,
    )

  if (!allP1) {
    return null
  }

  const allSecondTier =
    trio.every(
      (player) =>
        getGoalkeeperSaggiProfile(
          player.id,
          parameters,
        ).tier ===
          'second',
    )

  if (
    !allSecondTier
  ) {
    return null
  }

  return {
    strategy:
      'rotation',

    players:
      trio,

    teams,

    coverage:
      calculateGoalkeeperCoverage(
        teams,
      ),

    projectedCost:
      calculateProjectedTrioCost(
        state,
        trio,
        allPlayers,
      ),

    saggiStrength:
      calculatePlanSaggiStrength(
        trio,
        parameters,
      ),
  }
}

/* =========================
   TRIO EVALUATION
========================= */

function evaluateTrio(
  state: AppState,
  trio: Player[],
  allPlayers: Player[],
  parameters:
    GoalkeeperStrategyParameters,
): GoalkeeperStrategyPlan[] {
  if (
    trio.length !== 3
  ) {
    return []
  }

  const plans:
    GoalkeeperStrategyPlan[] =
    []

  const monoclub =
    buildMonoclubPlan(
      state,
      trio,
      allPlayers,
      parameters,
    )

  if (monoclub) {
    plans.push(
      monoclub,
    )
  }

  const topPair =
    buildTopPairPlan(
      state,
      trio,
      allPlayers,
      parameters,
    )

  if (topPair) {
    plans.push(
      topPair,
    )
  }

  const rotation =
    buildRotationPlan(
      state,
      trio,
      allPlayers,
      parameters,
    )

  if (rotation) {
    plans.push(
      rotation,
    )
  }

  return plans
}

/* =========================
   COMBINATIONS
========================= */

function buildTrios(
  players: Player[],
): Player[][] {
  const result:
    Player[][] = []

  for (
    let first = 0;
    first <
      players.length - 2;
    first += 1
  ) {
    for (
      let second =
        first + 1;
      second <
        players.length - 1;
      second += 1
    ) {
      for (
        let third =
          second + 1;
        third <
          players.length;
        third += 1
      ) {
        result.push(
          [
            players[first],
            players[second],
            players[third],
          ],
        )
      }
    }
  }

  return result
}

/* =========================
   PLAN COMPARATOR
========================= */

function comparePlans(
  first:
    GoalkeeperStrategyPlan,
  second:
    GoalkeeperStrategyPlan,
): number {
  /*
    Nessun punteggio pesato.

    Ordine corrente:
    1. qualità Saggi dei P1
    2. meno buchi calendario
    3. più giornate favorevoli
    4. minor costo stimato

    È una scelta ALPHA e resta
    configurabile/rivedibile.
  */

  const saggiDifference =
    (
      second.saggiStrength ??
      -Infinity
    ) -
    (
      first.saggiStrength ??
      -Infinity
    )

  if (
    Math.abs(
      saggiDifference,
    ) >
    0.000001
  ) {
    return saggiDifference
  }

  const firstHoles =
    first.coverage
      ?.holes ??
    Infinity

  const secondHoles =
    second.coverage
      ?.holes ??
    Infinity

  if (
    firstHoles !==
    secondHoles
  ) {
    return (
      firstHoles -
      secondHoles
    )
  }

  const firstFavorable =
    first.coverage
      ?.favorableDays ??
    -Infinity

  const secondFavorable =
    second.coverage
      ?.favorableDays ??
    -Infinity

  if (
    firstFavorable !==
    secondFavorable
  ) {
    return (
      secondFavorable -
      firstFavorable
    )
  }

  const firstCost =
    first.projectedCost ??
    Infinity

  const secondCost =
    second.projectedCost ??
    Infinity

  return (
    firstCost -
    secondCost
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
   GENERIC CANDIDATE
========================= */

function buildRecommendationCandidate(
  state: AppState,
  player: Player,
  allPlayers: Player[],
  recommendationParameters:
    RecommendationParameters,
  strategyParameters:
    GoalkeeperStrategyParameters,
  plans:
    GoalkeeperStrategyPlan[],
): GoalkeeperCandidateData {
  const sortedPlans =
    [
      ...plans,
    ].sort(
      comparePlans,
    )

  const bestPlan =
    sortedPlans[0]

  const strategies =
    new Set(
      plans.map(
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

  const advice =
    calculatePriceAdvice(
      state,
      player,
      allPlayers,
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
    getHierarchy(
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
    la penalità di concentrazione
    della rosa.

    Le strategie 1 e 2 richiedono
    esplicitamente portieri della
    stessa squadra reale.
  */
  const candidate:
    RecommendationCandidate = {
    player,

    /*
      Per P lo score esprime soltanto
      il valore di opzione strategica:
      1 strategia = 0.33
      2 strategie = 0.67
      3 strategie = 1.00

      L'ordinamento finale utilizza
      anche obiettivi e qualità del
      miglior piano.
    */
    score:
      openStrategies /
      3,

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
      openStrategies /
      3,

    sustainability:
      calculateSustainability(
        advice,
        recommendationParameters,
      ),

    opportunity:
      undefined,

    objectiveFit,

    objectivePriority,

    teamFactor:
      1,

    targetSlot:
      undefined,

    playerSlot:
      hierarchy,

    sameTeamCount,

    sameTeamRoleCount:
      sameTeamCount,

    priceAdvice:
      advice,

    reasons:
      [],
  }

  const data:
    GoalkeeperCandidateData = {
    candidate,
    plans:
      sortedPlans,
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
    Ordine AUTO corrente:

    1. mantiene aperte più strategie
    2. priorità Obiettivi
    3. qualità del miglior piano
    4. qualità Saggi del candidato
    5. iCà come ultimo tie-break

    Non usiamo una somma di pesi
    arbitrari.
  */

  if (
    first.openStrategies !==
    second.openStrategies
  ) {
    return (
      second.openStrategies -
      first.openStrategies
    )
  }

  if (
    first.candidate
      .objectiveFit !==
    second.candidate
      .objectiveFit
  ) {
    return (
      second.candidate
        .objectiveFit -
      first.candidate
        .objectiveFit
    )
  }

  if (
    first.bestPlan &&
    second.bestPlan
  ) {
    const planDifference =
      comparePlans(
        first.bestPlan,
        second.bestPlan,
      )

    if (
      planDifference !== 0
    ) {
      return planDifference
    }
  } else if (
    first.bestPlan
  ) {
    return -1
  } else if (
    second.bestPlan
  ) {
    return 1
  }

  const saggiDifference =
    (
      second.saggiProfile
        .medianFascia ??
      -Infinity
    ) -
    (
      first.saggiProfile
        .medianFascia ??
      -Infinity
    )

  if (
    Math.abs(
      saggiDifference,
    ) >
    0.000001
  ) {
    return saggiDifference
  }

  return (
    (
      second.candidate
        .player.iCa ??
      -Infinity
    ) -
    (
      first.candidate
        .player.iCa ??
      -Infinity
    )
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
      role:
        'P',

      alternatives:
        [],

      ranked:
        [],
    }
  }

  const ownerGoalkeepers =
    getOwnerRolePlayers(
      state,
      allPlayers,
      'P',
    )

  /*
    Rosa P completa.
  */
  if (
    ownerGoalkeepers.length >=
    3
  ) {
    return {
      role:
        'P',

      alternatives:
        [],

      ranked:
        [],
    }
  }

  const ownerIds =
    new Set(
      ownerGoalkeepers.map(
        (player) =>
          player.id,
      ),
    )

  /*
    Pool utilizzabile:
    - portieri già nostri
    - portieri ancora liberi

    Escludiamo chi è stato
    acquistato dagli avversari.
  */
  const availableGoalkeepers =
    allPlayers.filter(
      (player) => {
        if (
          player.role !==
          'P'
        ) {
          return false
        }

        if (
          ownerIds.has(
            player.id,
          )
        ) {
          return true
        }

        return !isPlayerAssigned(
          state,
          player.id,
        )
      },
    )

  if (
    availableGoalkeepers.length <
    3
  ) {
    return {
      role:
        'P',

      alternatives:
        [],

      ranked:
        [],
    }
  }

  /*
    Una terna futura è accettabile
    solo se contiene TUTTI i
    portieri già acquistati.
  */
  const validTrios =
    buildTrios(
      availableGoalkeepers,
    )
      .filter(
        (trio) =>
          ownerGoalkeepers.every(
            (owned) =>
              hasPlayer(
                trio,
                owned.id,
              ),
          ),
      )

  const plans:
    GoalkeeperStrategyPlan[] =
    validTrios.flatMap(
      (trio) =>
        evaluateTrio(
          state,
          trio,
          allPlayers,
          strategyParameters,
        ),
    )

  const discardedIds =
    new Set(
      state.recommendedDiscards,
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
            plans.filter(
              (plan) =>
                hasPlayer(
                  plan.players,
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
        Se un portiere non conduce
        ad alcuna terna valida,
        non entra nel ranking AUTO.

        Resta comunque libero e
        selezionabile manualmente.
      */
      .filter(
        (data) =>
          data.openStrategies >
          0,
      )
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
    role:
      'P',

    recommended,

    alternatives,

    ranked,
  }
}