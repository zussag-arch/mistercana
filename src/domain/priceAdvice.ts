import type {
  AppState,
} from '../app/state'

import {
  calculateDemand,
  calculateSupply,
  getFilledRosterCount,
  getOwnerRemainingCredits,
  getOwnerRemainingStrategicSlots,
  getPlayerById,
  getPlayerSlot,
  getPmaCredits,
  getSlotBenchmark,
  getSpentByRole,
  median,
  ROLE_ORDER,
  ROSTER_SLOT_LIMITS,
} from './auctionContext'

import type {
  Player,
  PlayerRole,
} from './player'

export {
  ROSTER_SLOT_LIMITS,
} from './auctionContext'

export type PriceConstraint =
  | 'financial'
  | 'role'
  | 'value'

export type AuctionMarketSource =
  | 'role'
  | 'overall'
  | 'baseline'

export interface PriceAdviceParameters {
  reserveFactor: number

  baseRoleElasticity: number
  topSlotElasticity: number

  sameRoleMinSample: number

  minimumFutureSlotCost: number

  scarcityK: number
  scarcityFactorCap: number

  roleBlendWeight: number
}

export const DEFAULT_PRICE_ADVICE_PARAMETERS:
  PriceAdviceParameters = {
    reserveFactor: 0.9,

    baseRoleElasticity:
      1.08,

    topSlotElasticity:
      1.22,

    sameRoleMinSample:
      3,

    minimumFutureSlotCost:
      1,

    scarcityK:
      0.10,

    scarcityFactorCap:
      1.25,

    roleBlendWeight:
      0.50,
  }

export interface PriceAdvice {
  pmaCredits?: number

  auctionMarketFactor:
    number

  auctionMarketSource:
    AuctionMarketSource

  auctionMarketSampleSize:
    number

  roleMarketSampleSize:
    number

  overallMarketSampleSize:
    number

  baseAuctionValue?: number

  supply?: number
  demand?: number
  pressure?: number

  scarcityFactor: number

  expectedAuctionValue?:
    number

  financialLimit?: number
  roleLimit?: number
  valueLimit?: number

  softRecommendedCeiling?:
    number

  recommendedCeiling?:
    number

  bindingConstraints:
    PriceConstraint[]

  playerSlot?: number

  ownerRemainingCredits?:
    number

  dynamicRoleTarget?:
    number

  roleReserve?: number

  globalReserve?: number
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
   MARKET OBSERVATION
========================= */

function getMarketRatios(
  state: AppState,
  allPlayers: Player[],
  role?: PlayerRole,
): number[] {
  return state
    .auctionAssignments
    .map(
      (assignment) => {
        const player =
          getPlayerById(
            allPlayers,
            assignment.playerId,
          )

        if (!player) {
          return undefined
        }

        if (
          role &&
          player.role !== role
        ) {
          return undefined
        }

        const pma =
          getPmaCredits(
            player,
            state.initialCredits,
          )

        if (
          pma === undefined ||
          pma <= 0 ||
          assignment.price <= 0
        ) {
          return undefined
        }

        return (
          assignment.price /
          pma
        )
      },
    )
    .filter(
      (
        value,
      ): value is number =>
        value !== undefined &&
        Number.isFinite(value) &&
        value > 0,
    )
}

function calculateAuctionMarket(
  state: AppState,
  player: Player,
  allPlayers: Player[],
  parameters:
    PriceAdviceParameters,
): {
  factor: number
  source: AuctionMarketSource
  sampleSize: number
  roleSampleSize: number
  overallSampleSize: number
} {
  const roleRatios =
    getMarketRatios(
      state,
      allPlayers,
      player.role,
    )

  const overallRatios =
    getMarketRatios(
      state,
      allPlayers,
    )

  const roleMedian =
    median(roleRatios)

  const overallMedian =
    median(overallRatios)

  if (
    roleRatios.length >=
      parameters
        .sameRoleMinSample &&
    roleMedian !== undefined
  ) {
    return {
      factor:
        roleMedian,

      source:
        'role',

      sampleSize:
        roleRatios.length,

      roleSampleSize:
        roleRatios.length,

      overallSampleSize:
        overallRatios.length,
    }
  }

  if (
    overallRatios.length >=
      parameters
        .sameRoleMinSample &&
    overallMedian !==
      undefined
  ) {
    return {
      factor:
        overallMedian,

      source:
        'overall',

      sampleSize:
        overallRatios.length,

      roleSampleSize:
        roleRatios.length,

      overallSampleSize:
        overallRatios.length,
    }
  }

  if (
    roleMedian !== undefined
  ) {
    return {
      factor:
        roleMedian,

      source:
        'role',

      sampleSize:
        roleRatios.length,

      roleSampleSize:
        roleRatios.length,

      overallSampleSize:
        overallRatios.length,
    }
  }

  if (
    overallMedian !==
    undefined
  ) {
    return {
      factor:
        overallMedian,

      source:
        'overall',

      sampleSize:
        overallRatios.length,

      roleSampleSize:
        roleRatios.length,

      overallSampleSize:
        overallRatios.length,
    }
  }

  return {
    factor: 1,

    source:
      'baseline',

    sampleSize: 0,

    roleSampleSize: 0,

    overallSampleSize: 0,
  }
}

/* =========================
   DYNAMIC ROLE TARGETS
========================= */

function getBaseRoleTargets(
  state: AppState,
): Record<
  PlayerRole,
  number
> {
  return {
    P:
      state.initialCredits *
      state
        .budgetDistribution
        .P /
      100,

    D:
      state.initialCredits *
      state
        .budgetDistribution
        .D /
      100,

    C:
      state.initialCredits *
      state
        .budgetDistribution
        .C /
      100,

    A:
      state.initialCredits *
      state
        .budgetDistribution
        .A /
      100,
  }
}

function getAdjustedRoleTargets(
  state: AppState,
  allPlayers: Player[],
  parameters:
    PriceAdviceParameters,
): Record<
  PlayerRole,
  number
> {
  const targets =
    getBaseRoleTargets(state)

  const spent =
    getSpentByRole(
      state,
      allPlayers,
    )

  ROLE_ORDER.forEach(
    (
      role,
      roleIndex,
    ) => {
      const filled =
        getFilledRosterCount(
          state,
          allPlayers,
          role,
        )

      const isCompleted =
        filled >=
        ROSTER_SLOT_LIMITS[
          role
        ]

      if (
        !isCompleted ||
        roleIndex >=
          ROLE_ORDER.length - 1
      ) {
        return
      }

      const delta =
        targets[role] -
        spent[role]

      if (
        Math.abs(delta) <
        0.0001
      ) {
        return
      }

      const futureRoles =
        ROLE_ORDER.slice(
          roleIndex + 1,
        )

      if (delta > 0) {
        const totalWeight =
          futureRoles.reduce(
            (
              total,
              futureRole,
            ) =>
              total +
              state
                .budgetDistribution[
                futureRole
              ],
            0,
          )

        if (
          totalWeight <= 0
        ) {
          return
        }

        futureRoles.forEach(
          (futureRole) => {
            const weight =
              state
                .budgetDistribution[
                futureRole
              ] /
              totalWeight

            targets[
              futureRole
            ] +=
              delta *
              weight
          },
        )

        return
      }

      let deficit =
        Math.abs(delta)

      for (
        const futureRole
        of futureRoles
      ) {
        if (
          deficit <= 0
        ) {
          break
        }

        const futureFilled =
          getFilledRosterCount(
            state,
            allPlayers,
            futureRole,
          )

        const remainingSlots =
          Math.max(
            0,
            ROSTER_SLOT_LIMITS[
              futureRole
            ] -
              futureFilled,
          )

        const minimumTarget =
          spent[
            futureRole
          ] +
          (
            remainingSlots *
            parameters
              .minimumFutureSlotCost
          )

        const absorbable =
          Math.max(
            0,
            targets[
              futureRole
            ] -
              minimumTarget,
          )

        const absorbed =
          Math.min(
            deficit,
            absorbable,
          )

        targets[
          futureRole
        ] -=
          absorbed

        deficit -=
          absorbed
      }
    },
  )

  return targets
}

/* =========================
   STRATEGIC SLOT QUOTAS
========================= */

function getRoleStrategicQuotas(
  state: AppState,
  role: PlayerRole,
  allPlayers: Player[],
  dynamicRoleTarget: number,
  parameters:
    PriceAdviceParameters,
): number[] {
  const slotCount =
    ROSTER_SLOT_LIMITS[
      role
    ]

  const minimum =
    parameters
      .minimumFutureSlotCost

  const benchmarks =
    Array.from(
      {
        length:
          slotCount,
      },
      (
        _,
        index,
      ) =>
        Math.max(
          minimum,
          getSlotBenchmark(
            state,
            role,
            index + 1,
            allPlayers,
          ) ??
            minimum,
        ),
    )

  const minimumTotal =
    slotCount *
    minimum

  const distributable =
    Math.max(
      0,
      dynamicRoleTarget -
        minimumTotal,
    )

  const benchmarkTotal =
    benchmarks.reduce(
      (
        total,
        benchmark,
      ) =>
        total +
        benchmark,
      0,
    )

  if (
    benchmarkTotal <= 0
  ) {
    return Array.from(
      {
        length:
          slotCount,
      },
      () =>
        minimum,
    )
  }

  return benchmarks.map(
    (benchmark) =>
      minimum +
      (
        distributable *
        (
          benchmark /
          benchmarkTotal
        )
      ),
  )
}

/* =========================
   ROLE RESERVE
========================= */

function getRoleReserve(
  state: AppState,
  role: PlayerRole,
  allPlayers: Player[],
  dynamicRoleTarget: number,
  parameters:
    PriceAdviceParameters,
  simulatedPlayer?:
    Player,
): {
  reserve: number
  remainingSlots: number[]
} {
  const quotas =
    getRoleStrategicQuotas(
      state,
      role,
      allPlayers,
      dynamicRoleTarget,
      parameters,
    )

  const remainingSlots =
    getOwnerRemainingStrategicSlots(
      state,
      role,
      allPlayers,
      simulatedPlayer,
    )

  const reserve =
    remainingSlots.reduce(
      (
        total,
        slot,
      ) =>
        total +
        (
          quotas[
            slot - 1
          ] ??
          parameters
            .minimumFutureSlotCost
        ),
      0,
    )

  return {
    reserve,
    remainingSlots,
  }
}

/* =========================
   GLOBAL RESERVE
========================= */

function calculateGlobalReserve(
  state: AppState,
  player: Player,
  allPlayers: Player[],
  adjustedTargets:
    Record<
      PlayerRole,
      number
    >,
  parameters:
    PriceAdviceParameters,
): number {
  let rawReserve = 0

  let remainingSlotCount = 0

  ROLE_ORDER.forEach(
    (role) => {
      const roleReserve =
        getRoleReserve(
          state,
          role,
          allPlayers,
          adjustedTargets[
            role
          ],
          parameters,
          player.role === role
            ? player
            : undefined,
        )

      rawReserve +=
        roleReserve.reserve

      remainingSlotCount +=
        roleReserve
          .remainingSlots
          .length
    },
  )

  const minimumReserve =
    remainingSlotCount *
    parameters
      .minimumFutureSlotCost

  return Math.max(
    minimumReserve,
    rawReserve *
      parameters
        .reserveFactor,
  )
}

/* =========================
   SCARCITY
========================= */

function calculateScarcity(
  supply:
    number | undefined,
  demand:
    number | undefined,
  parameters:
    PriceAdviceParameters,
): {
  pressure?: number
  factor: number
} {
  if (
    supply === undefined ||
    demand === undefined ||
    supply <= 0
  ) {
    return {
      factor: 1,
    }
  }

  const pressure =
    demand /
    supply

  const rawFactor =
    1 +
    (
      parameters
        .scarcityK *
      Math.max(
        0,
        pressure - 1,
      )
    )

  return {
    pressure,

    factor:
      Math.min(
        parameters
          .scarcityFactorCap,
        rawFactor,
      ),
  }
}

/* =========================
   DYNAMIC CEILING
========================= */

function calculateSoftCeiling(
  valueLimit:
    number | undefined,
  roleLimit:
    number | undefined,
  parameters:
    PriceAdviceParameters,
): number | undefined {
  if (
    valueLimit === undefined &&
    roleLimit === undefined
  ) {
    return undefined
  }

  if (
    valueLimit === undefined
  ) {
    return roleLimit
  }

  if (
    roleLimit === undefined
  ) {
    return valueLimit
  }

  const roleWeight =
    clamp(
      parameters
        .roleBlendWeight,
      0,
      1,
    )

  const valueWeight =
    1 -
    roleWeight

  return Math.round(
    (
      valueLimit *
      valueWeight
    ) +
    (
      roleLimit *
      roleWeight
    ),
  )
}

/* =========================
   MAIN
========================= */

export function calculatePriceAdvice(
  state: AppState,
  player: Player,
  allPlayers: Player[],
  parameters:
    PriceAdviceParameters =
      DEFAULT_PRICE_ADVICE_PARAMETERS,
): PriceAdvice {
  const pmaCredits =
    getPmaCredits(
      player,
      state.initialCredits,
    )

  const market =
    calculateAuctionMarket(
      state,
      player,
      allPlayers,
      parameters,
    )

  const baseAuctionValue =
    pmaCredits === undefined
      ? undefined
      : (
          pmaCredits *
          market.factor
        )

  const playerSlot =
    getPlayerSlot(
      state,
      player,
      allPlayers,
    )

  const supply =
    calculateSupply(
      state,
      player,
      allPlayers,
      playerSlot,
    )

  const demand =
    calculateDemand(
      state,
      player,
      allPlayers,
      playerSlot,
    )

  const scarcity =
    calculateScarcity(
      supply,
      demand,
      parameters,
    )

  const expectedAuctionValue =
    baseAuctionValue === undefined
      ? undefined
      : (
          baseAuctionValue *
          scarcity.factor
        )

  const valueLimit =
    expectedAuctionValue === undefined
      ? undefined
      : Math.max(
          1,
          Math.round(
            expectedAuctionValue,
          ),
        )

  const ownerRemainingCredits =
    getOwnerRemainingCredits(
      state,
    )

  const spent =
    getSpentByRole(
      state,
      allPlayers,
    )

  const adjustedTargets =
    getAdjustedRoleTargets(
      state,
      allPlayers,
      parameters,
    )

  const dynamicRoleTarget =
    adjustedTargets[
      player.role
    ]

  const globalReserve =
    ownerRemainingCredits ===
      undefined
      ? undefined
      : calculateGlobalReserve(
          state,
          player,
          allPlayers,
          adjustedTargets,
          parameters,
        )

  const financialLimit =
    ownerRemainingCredits ===
      undefined ||
    globalReserve ===
      undefined
      ? undefined
      : Math.max(
          0,
          Math.floor(
            ownerRemainingCredits -
              globalReserve,
          ),
        )

  const roleReserveData =
    getRoleReserve(
      state,
      player.role,
      allPlayers,
      dynamicRoleTarget,
      parameters,
      player,
    )

  const roleReserve =
    roleReserveData.reserve

  const roleElasticity =
    player.role === 'P'
      ? 1
      : playerSlot === 1
        ? parameters
            .topSlotElasticity
        : parameters
            .baseRoleElasticity

  const roleLimit =
    Math.max(
      0,
      Math.floor(
        (
          dynamicRoleTarget *
          roleElasticity
        ) -
          spent[
            player.role
          ] -
          roleReserve,
      ),
    )

  const softRecommendedCeiling =
    calculateSoftCeiling(
      valueLimit,
      roleLimit,
      parameters,
    )

  const recommendedCeiling =
    softRecommendedCeiling ===
      undefined
      ? financialLimit
      : financialLimit ===
          undefined
        ? softRecommendedCeiling
        : Math.min(
            softRecommendedCeiling,
            financialLimit,
          )

  const bindingConstraints:
    PriceConstraint[] = []

  if (
    recommendedCeiling !==
      undefined
  ) {
    if (
      financialLimit !==
        undefined &&
      recommendedCeiling ===
        financialLimit &&
      (
        softRecommendedCeiling ===
          undefined ||
        financialLimit <=
          softRecommendedCeiling
      )
    ) {
      bindingConstraints.push(
        'financial',
      )
    } else if (
      valueLimit !==
        undefined &&
      roleLimit !==
        undefined
    ) {
      bindingConstraints.push(
        valueLimit <= roleLimit
          ? 'value'
          : 'role',
      )
    } else if (
      valueLimit !== undefined
    ) {
      bindingConstraints.push(
        'value',
      )
    } else if (
      roleLimit !== undefined
    ) {
      bindingConstraints.push(
        'role',
      )
    }
  }

  return {
    pmaCredits,

    auctionMarketFactor:
      market.factor,

    auctionMarketSource:
      market.source,

    auctionMarketSampleSize:
      market.sampleSize,

    roleMarketSampleSize:
      market.roleSampleSize,

    overallMarketSampleSize:
      market.overallSampleSize,

    baseAuctionValue,

    supply,

    demand,

    pressure:
      scarcity.pressure,

    scarcityFactor:
      scarcity.factor,

    expectedAuctionValue,

    financialLimit,

    roleLimit,

    valueLimit,

    softRecommendedCeiling,

    recommendedCeiling,

    bindingConstraints,

    playerSlot,

    ownerRemainingCredits,

    dynamicRoleTarget,

    roleReserve,

    globalReserve,
  }
}