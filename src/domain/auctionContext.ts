import type {
  AppState,
} from '../app/state'

import type {
  Player,
  PlayerRole,
} from './player'

export const ROSTER_SLOT_LIMITS:
  Record<PlayerRole, number> = {
    P: 3,
    D: 8,
    C: 8,
    A: 6,
  }

export const ROLE_ORDER:
  PlayerRole[] = [
    'P',
    'D',
    'C',
    'A',
  ]

export function median(
  values: number[],
): number | undefined {
  const valid =
    values
      .filter(
        (value) =>
          Number.isFinite(value),
      )
      .sort(
        (first, second) =>
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
    valid.length % 2 === 1
  ) {
    return valid[middle]
  }

  return (
    valid[middle - 1] +
    valid[middle]
  ) / 2
}

export function getPmaCredits(
  player: Player,
  initialCredits: number,
): number | undefined {
  if (
    player.pmaPercent === undefined ||
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

export function getPlayerById(
  allPlayers: Player[],
  playerId: string,
): Player | undefined {
  return allPlayers.find(
    (player) =>
      player.id === playerId,
  )
}

export function getActiveManagers(
  state: AppState,
) {
  return state.managers.filter(
    (manager) =>
      manager.active &&
      !manager.archived,
  )
}

export function getOwnerManagerId(
  state: AppState,
): string | undefined {
  const managers =
    getActiveManagers(state)

  return (
    managers.find(
      (manager) =>
        manager.isOwner,
    ) ??
    managers[0]
  )?.id
}

export function getManagerAssignments(
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

export function getOwnerAssignments(
  state: AppState,
) {
  const ownerId =
    getOwnerManagerId(state)

  if (!ownerId) {
    return []
  }

  return getManagerAssignments(
    state,
    ownerId,
  )
}

export function isPlayerAssigned(
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

export function getSpentByRole(
  state: AppState,
  allPlayers: Player[],
): Record<PlayerRole, number> {
  const spent:
    Record<PlayerRole, number> = {
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

      spent[player.role] +=
        assignment.price
    },
  )

  return spent
}

export function getOwnerRemainingCredits(
  state: AppState,
): number | undefined {
  const ownerId =
    getOwnerManagerId(state)

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

export function getLeagueSize(
  state: AppState,
): number {
  return Math.max(
    1,
    getActiveManagers(state)
      .length,
  )
}

export function getSortedRolePlayers(
  role: PlayerRole,
  allPlayers: Player[],
  initialCredits: number,
): Player[] {
  return allPlayers
    .filter(
      (player) =>
        player.role === role &&
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

export function getPlayerSlot(
  state: AppState,
  player: Player,
  allPlayers: Player[],
): number | undefined {
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
    getLeagueSize(state)

  return (
    Math.floor(
      index /
      leagueSize,
    ) + 1
  )
}

export function getSlotBenchmark(
  state: AppState,
  role: PlayerRole,
  slot: number,
  allPlayers: Player[],
): number | undefined {
  if (slot <= 0) {
    return undefined
  }

  const leagueSize =
    getLeagueSize(state)

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
          value !== undefined,
      )

  return median(values)
}

export function getManagerRolePlayers(
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
          player.role === role,
        ),
    )
}

export function getOwnerRolePlayers(
  state: AppState,
  allPlayers: Player[],
  role: PlayerRole,
): Player[] {
  const ownerId =
    getOwnerManagerId(state)

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

export function getFilledRosterCount(
  state: AppState,
  allPlayers: Player[],
  role: PlayerRole,
): number {
  return Math.min(
    ROSTER_SLOT_LIMITS[role],
    getOwnerRolePlayers(
      state,
      allPlayers,
      role,
    ).length,
  )
}

function coverRemainingSlots(
  state: AppState,
  role: PlayerRole,
  allPlayers: Player[],
  rolePlayers: Player[],
): number[] {
  const limit =
    ROSTER_SLOT_LIMITS[role]

  const remaining =
    Array.from(
      {
        length: limit,
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
      marketSlot === undefined
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

export function getRemainingStrategicSlotsForManager(
  state: AppState,
  role: PlayerRole,
  allPlayers: Player[],
  managerId: string,
  simulatedPlayer?: Player,
): number[] {
  const owned =
    getManagerRolePlayers(
      state,
      allPlayers,
      managerId,
      role,
    )

  const coveringPlayers = [
    ...owned,
  ]

  if (
    simulatedPlayer &&
    simulatedPlayer.role === role &&
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

export function getOwnerRemainingStrategicSlots(
  state: AppState,
  role: PlayerRole,
  allPlayers: Player[],
  simulatedPlayer?: Player,
): number[] {
  const ownerId =
    getOwnerManagerId(state)

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

export function calculateSupply(
  state: AppState,
  player: Player,
  allPlayers: Player[],
  playerSlot:
    number | undefined,
): number | undefined {
  if (
    playerSlot === undefined
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

      return (
        candidateSlot <=
        playerSlot
      )
    },
  ).length
}

export function calculateDemand(
  state: AppState,
  player: Player,
  allPlayers: Player[],
  playerSlot:
    number | undefined,
): number | undefined {
  if (
    playerSlot === undefined
  ) {
    return undefined
  }

  const managers =
    getActiveManagers(state)

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

      return remaining.some(
        (requiredSlot) =>
          requiredSlot <=
          playerSlot,
      )
    },
  ).length
}