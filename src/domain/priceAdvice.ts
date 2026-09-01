import type {
  AppState,
} from '../app/state'

import type {
  Player,
  PlayerRole,
} from './player'

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

  /*
    Scarsità.

    Pressione =
    domanda / supply

    Fattore =
    1 + k * max(0, pressione - 1)

    con cap massimo.
  */
  scarcityK: number
  scarcityFactorCap: number

  /*
    Peso del Limite reparto
    nel tetto operativo morbido.

    0   -> segue soltanto Valore asta
    0.5 -> media fra Valore asta
           e Limite reparto
    1   -> segue Limite reparto

    Parametro V1 configurabile.
  */
  roleBlendWeight: number
}

export const DEFAULT_PRICE_ADVICE_PARAMETERS:
  PriceAdviceParameters = {
    reserveFactor: 0.9,

    baseRoleElasticity: 1.08,

    topSlotElasticity: 1.22,

    sameRoleMinSample: 3,

    minimumFutureSlotCost: 1,

    scarcityK: 0.10,

    scarcityFactorCap: 1.25,

    roleBlendWeight: 0.50,
  }

export const ROSTER_SLOT_LIMITS:
  Record<
    PlayerRole,
    number
  > = {
    P: 3,
    D: 8,
    C: 8,
    A: 6,
  }

const ROLE_ORDER:
  PlayerRole[] = [
    'P',
    'D',
    'C',
    'A',
  ]

export interface PriceAdvice {
  pmaCredits?: number

  auctionMarketFactor: number

  auctionMarketSource:
    AuctionMarketSource

  auctionMarketSampleSize: number

  roleMarketSampleSize: number

  overallMarketSampleSize: number

  baseAuctionValue?: number

  supply?: number
  demand?: number
  pressure?: number

  scarcityFactor: number

  expectedAuctionValue?: number

  financialLimit?: number

  roleLimit?: number

  valueLimit?: number

  /*
    Tetto morbido ottenuto
    combinando Valore asta
    e Limite reparto.
  */
  softRecommendedCeiling?: number

  /*
    Tetto operativo finale.

    Può essere abbassato dal
    Limite finanziario, che resta
    il vero hard cap.
  */
  recommendedCeiling?: number

  bindingConstraints:
    PriceConstraint[]

  playerSlot?: number

  ownerRemainingCredits?: number

  dynamicRoleTarget?: number

  roleReserve?: number

  globalReserve?: number
}

/* =========================
   BASIC HELPERS
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
):
  number | undefined {
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
          first - second,
      )

  if (!valid.length) {
    return undefined
  }

  const middle =
    Math.floor(
      valid.length / 2,
    )

  if (
    valid.length % 2 ===
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

function getPmaCredits(
  player: Player,
  initialCredits: number,
):
  number | undefined {
  if (
    player.pmaPercent ===
      undefined ||
    !Number.isFinite(
      player.pmaPercent,
    ) ||
    player.pmaPercent <= 0 ||
    !Number.isFinite(
      initialCredits,
    ) ||
    initialCredits <= 0
  ) {
    return undefined
  }

  return (
    initialCredits *
    player.pmaPercent /
    100
  )
}

function getPlayerById(
  allPlayers: Player[],
  playerId: string,
):
  Player | undefined {
  return allPlayers.find(
    (player) =>
      player.id ===
      playerId,
  )
}

function getActiveManagers(
  state: AppState,
) {
  return state.managers.filter(
    (manager) =>
      manager.active &&
      !manager.archived,
  )
}

function getOwnerManagerId(
  state: AppState,
):
  string | undefined {
  const managers =
    getActiveManagers(
      state,
    )

  return (
    managers.find(
      (manager) =>
        manager.isOwner,
    ) ??
    managers[0]
  )?.id
}

function getManagerAssignments(
  state: AppState,
  managerId: string,
) {
  return state
    .auctionAssignments
    .filter(
      (assignment) =>
        assignment.managerId ===
        managerId,
    )
}

function getOwnerAssignments(
  state: AppState,
) {
  const ownerId =
    getOwnerManagerId(
      state,
    )

  if (!ownerId) {
    return []
  }

  return getManagerAssignments(
    state,
    ownerId,
  )
}

function isPlayerAssigned(
  state: AppState,
  playerId: string,
): boolean {
  return state
    .auctionAssignments
    .some(
      (assignment) =>
        assignment.playerId ===
        playerId,
    )
}

function getSpentByRole(
  state: AppState,
  allPlayers: Player[],
):
  Record<
    PlayerRole,
    number
  > {
  const spent:
    Record<
      PlayerRole,
      number
    > = {
      P: 0,
      D: 0,
      C: 0,
      A: 0,
    }

  getOwnerAssignments(
    state,
  ).forEach(
    (assignment) => {
      const player =
        getPlayerById(
          allPlayers,
          assignment.playerId,
        )

      if (!player) {
        return
      }

      spent[
        player.role
      ] +=
        assignment.price
    },
  )

  return spent
}

function getOwnerRemainingCredits(
  state: AppState,
):
  number | undefined {
  const ownerId =
    getOwnerManagerId(
      state,
    )

  if (!ownerId) {
    return undefined
  }

  const spent =
    getManagerAssignments(
      state,
      ownerId,
    ).reduce(
      (
        total,
        assignment,
      ) =>
        total +
        assignment.price,
      0,
    )

  return Math.max(
    0,
    state.initialCredits -
      spent,
  )
}

/* =========================
   PLAYER MARKET SLOT
========================= */

function getLeagueSize(
  state: AppState,
): number {
  return Math.max(
    1,
    getActiveManagers(
      state,
    ).length,
  )
}

function getSortedRolePlayers(
  role: PlayerRole,
  allPlayers: Player[],
  initialCredits: number,
): Player[] {
  return allPlayers
    .filter(
      (player) =>
        player.role ===
        role &&
        getPmaCredits(
          player,
          initialCredits,
        ) !== undefined,
    )
    .sort(
      (
        first,
        second,
      ) =>
        (
          getPmaCredits(
            second,
            initialCredits,
          ) ??
          -Infinity
        ) -
        (
          getPmaCredits(
            first,
            initialCredits,
          ) ??
          -Infinity
        ),
    )
}

function getPlayerSlot(
  state: AppState,
  player: Player,
  allPlayers: Player[],
):
  number | undefined {
  const pma =
    getPmaCredits(
      player,
      state.initialCredits,
    )

  if (pma === undefined) {
    return undefined
  }

  const sorted =
    getSortedRolePlayers(
      player.role,
      allPlayers,
      state.initialCredits,
    )

  const index =
    sorted.findIndex(
      (candidate) =>
        candidate.id ===
        player.id,
    )

  if (index < 0) {
    return undefined
  }

  const leagueSize =
    getLeagueSize(
      state,
    )

  return (
    Math.floor(
      index /
      leagueSize,
    ) + 1
  )
}

function getSlotBenchmark(
  state: AppState,
  role: PlayerRole,
  slot: number,
  allPlayers: Player[],
):
  number | undefined {
  if (slot <= 0) {
    return undefined
  }

  const leagueSize =
    getLeagueSize(
      state,
    )

  const sorted =
    getSortedRolePlayers(
      role,
      allPlayers,
      state.initialCredits,
    )

  const start =
    (
      slot - 1
    ) *
    leagueSize

  const end =
    start +
    leagueSize

  const values =
    sorted
      .slice(
        start,
        end,
      )
      .map(
        (player) =>
          getPmaCredits(
            player,
            state.initialCredits,
          ),
      )
      .filter(
        (
          value,
        ): value is number =>
          value !==
          undefined,
      )

  return median(
    values,
  )
}

/* =========================
   MARKET OBSERVATION
========================= */

function getMarketRatios(
  state: AppState,
  allPlayers: Player[],
  role?:
    PlayerRole,
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
          player.role !==
            role
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
        value !==
          undefined &&
        Number.isFinite(
          value,
        ) &&
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
    median(
      roleRatios,
    )

  const overallMedian =
    median(
      overallRatios,
    )

  if (
    roleRatios.length >=
      parameters
        .sameRoleMinSample &&
    roleMedian !==
      undefined
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
    roleMedian !==
    undefined
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
):
  Record<
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

function getManagerRolePlayers(
  state: AppState,
  allPlayers: Player[],
  managerId: string,
  role: PlayerRole,
): Player[] {
  return getManagerAssignments(
    state,
    managerId,
  )
    .map(
      (assignment) =>
        getPlayerById(
          allPlayers,
          assignment.playerId,
        ),
    )
    .filter(
      (
        player,
      ): player is Player =>
        Boolean(
          player &&
          player.role ===
            role,
        ),
    )
}

function getOwnerRolePlayers(
  state: AppState,
  allPlayers: Player[],
  role: PlayerRole,
): Player[] {
  const ownerId =
    getOwnerManagerId(
      state,
    )

  if (!ownerId) {
    return []
  }

  return getManagerRolePlayers(
    state,
    allPlayers,
    ownerId,
    role,
  )
}

function getFilledRosterCount(
  state: AppState,
  allPlayers: Player[],
  role: PlayerRole,
): number {
  return Math.min(
    ROSTER_SLOT_LIMITS[
      role
    ],
    getOwnerRolePlayers(
      state,
      allPlayers,
      role,
    ).length,
  )
}

function getAdjustedRoleTargets(
  state: AppState,
  allPlayers: Player[],
  parameters:
    PriceAdviceParameters,
):
  Record<
    PlayerRole,
    number
  > {
  const targets =
    getBaseRoleTargets(
      state,
    )

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
        targets[
          role
        ] -
        spent[
          role
        ]

      if (
        Math.abs(
          delta,
        ) <
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
        Math.abs(
          delta,
        )

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
   STRATEGIC SLOT COVERAGE
========================= */

function coverRemainingSlots(
  state: AppState,
  role: PlayerRole,
  allPlayers: Player[],
  rolePlayers: Player[],
): number[] {
  const limit =
    ROSTER_SLOT_LIMITS[
      role
    ]

  const remaining =
    Array.from(
      {
        length:
          limit,
      },
      (
        _,
        index,
      ) =>
        index + 1,
    )

  const marketSlots =
    rolePlayers
      .map(
        (player) => ({
          slot:
            getPlayerSlot(
              state,
              player,
              allPlayers,
            ),
        }),
      )
      .sort(
        (
          first,
          second,
        ) =>
          (
            first.slot ??
            Infinity
          ) -
          (
            second.slot ??
            Infinity
          ),
      )

  for (
    const item
    of marketSlots
  ) {
    if (!remaining.length) {
      break
    }

    const marketSlot =
      item.slot

    if (
      marketSlot ===
      undefined
    ) {
      remaining.pop()

      continue
    }

    const compatibleIndex =
      remaining.findIndex(
        (requiredSlot) =>
          marketSlot <=
          requiredSlot,
      )

    if (
      compatibleIndex >= 0
    ) {
      remaining.splice(
        compatibleIndex,
        1,
      )

      continue
    }

    remaining.pop()
  }

  return remaining
}

function getRemainingStrategicSlotsForManager(
  state: AppState,
  role: PlayerRole,
  allPlayers: Player[],
  managerId: string,
  simulatedPlayer?:
    Player,
): number[] {
  const owned =
    getManagerRolePlayers(
      state,
      allPlayers,
      managerId,
      role,
    )

  const coveringPlayers =
    [
      ...owned,
    ]

  if (
    simulatedPlayer &&
    simulatedPlayer.role ===
      role &&
    !isPlayerAssigned(
      state,
      simulatedPlayer.id,
    )
  ) {
    coveringPlayers.push(
      simulatedPlayer,
    )
  }

  return coverRemainingSlots(
    state,
    role,
    allPlayers,
    coveringPlayers,
  )
}

function getOwnerRemainingStrategicSlots(
  state: AppState,
  role: PlayerRole,
  allPlayers: Player[],
  simulatedPlayer?:
    Player,
): number[] {
  const ownerId =
    getOwnerManagerId(
      state,
    )

  if (!ownerId) {
    return Array.from(
      {
        length:
          ROSTER_SLOT_LIMITS[
            role
          ],
      },
      (
        _,
        index,
      ) =>
        index + 1,
    )
  }

  return getRemainingStrategicSlotsForManager(
    state,
    role,
    allPlayers,
    ownerId,
    simulatedPlayer,
  )
}

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
   GLOBAL FINANCIAL RESERVE
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
          player.role ===
            role
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
   SUPPLY / DEMAND
========================= */

function calculateSupply(
  state: AppState,
  player: Player,
  allPlayers: Player[],
  playerSlot:
    number | undefined,
): number | undefined {
  if (
    playerSlot ===
    undefined
  ) {
    return undefined
  }

  return allPlayers.filter(
    (candidate) => {
      if (
        candidate.role !==
        player.role
      ) {
        return false
      }

      if (
        isPlayerAssigned(
          state,
          candidate.id,
        )
      ) {
        return false
      }

      const candidateSlot =
        getPlayerSlot(
          state,
          candidate,
          allPlayers,
        )

      if (
        candidateSlot ===
        undefined
      ) {
        return false
      }

      /*
        Supply dello stesso slot
        o migliore.

        Slot 1 è migliore di Slot 2.
      */
      return (
        candidateSlot <=
        playerSlot
      )
    },
  ).length
}

function calculateDemand(
  state: AppState,
  player: Player,
  allPlayers: Player[],
  playerSlot:
    number | undefined,
): number | undefined {
  if (
    playerSlot ===
    undefined
  ) {
    return undefined
  }

  const managers =
    getActiveManagers(
      state,
    )

  return managers.filter(
    (manager) => {
      const remaining =
        getRemainingStrategicSlotsForManager(
          state,
          player.role,
          allPlayers,
          manager.id,
        )

      if (!remaining.length) {
        return false
      }

      /*
        Una squadra conta come
        domanda per Slot X se deve
        ancora coprire Slot X
        oppure una fascia migliore.

        Esempio P1:
        deve ancora mancare P1.

        Esempio P2:
        deve ancora mancare
        P1 oppure P2.
      */
      return remaining.some(
        (requiredSlot) =>
          requiredSlot <=
          playerSlot,
      )
    },
  ).length
}

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
   DYNAMIC RECOMMENDED CEILING
========================= */

function calculateSoftCeiling(
  valueLimit:
    number | undefined,
  roleLimit:
    number | undefined,
  parameters:
    PriceAdviceParameters,
):
  number | undefined {
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
   MAIN CALCULATION
========================= */

export function calculatePriceAdvice(
  state: AppState,
  player: Player,
  allPlayers: Player[],
  parameters:
    PriceAdviceParameters =
      DEFAULT_PRICE_ADVICE_PARAMETERS,
): PriceAdvice {
  /* -------------------------
     PMA / MARKET
  ------------------------- */

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
    pmaCredits ===
      undefined
      ? undefined
      : (
          pmaCredits *
          market.factor
        )

  /* -------------------------
     SLOT / SCARCITY
  ------------------------- */

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
    baseAuctionValue ===
      undefined
      ? undefined
      : (
          baseAuctionValue *
          scarcity.factor
        )

  const valueLimit =
    expectedAuctionValue ===
      undefined
      ? undefined
      : Math.max(
          1,
          Math.round(
            expectedAuctionValue,
          ),
        )

  /* -------------------------
     OWNER / STRATEGY
  ------------------------- */

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

  /* -------------------------
     FINANCIAL LIMIT
  ------------------------- */

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

  /* -------------------------
     ROLE LIMIT
  ------------------------- */

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

  /* -------------------------
     DYNAMIC CEILING
  ------------------------- */

  const softRecommendedCeiling =
    calculateSoftCeiling(
      valueLimit,
      roleLimit,
      parameters,
    )

  /*
    Il finanziario è il vero
    hard cap.

    Valore e reparto sono invece
    segnali morbidi che concorrono
    al tetto dinamico.
  */
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
    } else {
      /*
        Il tetto nasce dal blend
        dei due segnali morbidi.

        Indichiamo quale dei due
        sta tirando maggiormente
        verso il basso.
      */
      if (
        valueLimit !==
          undefined &&
        roleLimit !==
          undefined
      ) {
        bindingConstraints.push(
          valueLimit <=
            roleLimit
            ? 'value'
            : 'role',
        )
      } else if (
        valueLimit !==
        undefined
      ) {
        bindingConstraints.push(
          'value',
        )
      } else if (
        roleLimit !==
        undefined
      ) {
        bindingConstraints.push(
          'role',
        )
      }
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