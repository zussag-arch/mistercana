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
  getOwnerRolePlayers,
  isPlayerAssigned,
} from './auctionContext'

import type {
  Player,
} from './player'

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

    Fascia_Valore Saggi:
    5 = livello massimo
    1 = livello minimo.

    La classificazione potrà
    essere modificata dopo
    i test beta.
  */
  topMinFascia: number

  semitopMinFascia: number

  secondTierMinFascia: number
}

export const DEFAULT_GOALKEEPER_STRATEGY_PARAMETERS:
  GoalkeeperStrategyParameters = {
    topMinFascia: 5,

    semitopMinFascia: 4,

    secondTierMinFascia: 3,
  }

export interface GoalkeeperSaggiProfile {
  medianFascia?: number

  tier: GoalkeeperTier

  samples: number
}

export interface GoalkeeperPlanningPlan {
  strategy:
    GoalkeeperStrategyType

  players:
    Player[]

  teams:
    string[]

  coverage:
    GoalkeeperCoverage | null

  saggiStrength?: number
}

/* =========================
   GENERIC HELPERS
========================= */

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
      player.id === playerId,
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
    median(values)

  if (
    medianFascia === undefined
  ) {
    return {
      tier: 'unknown',

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

      tier: 'top',

      samples:
        values.length,
    }
  }

  if (
    medianFascia >=
    parameters.semitopMinFascia
  ) {
    return {
      medianFascia,

      tier: 'semitop',

      samples:
        values.length,
    }
  }

  if (
    medianFascia >=
    parameters.secondTierMinFascia
  ) {
    return {
      medianFascia,

      tier: 'second',

      samples:
        values.length,
    }
  }

  return {
    medianFascia,

    tier: 'other',

    samples:
      values.length,
  }
}

/* =========================
   HIERARCHY
========================= */

export function getGoalkeeperPlayerHierarchy(
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
    record.team !== player.team
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
      player.team === team &&
      getGoalkeeperPlayerHierarchy(
        player,
      ) === hierarchy,
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
  const values =
    players
      .filter(
        (player) =>
          getGoalkeeperPlayerHierarchy(
            player,
          ) === 1,
      )
      .map(
        (player) =>
          getGoalkeeperSaggiProfile(
            player.id,
            parameters,
          ).medianFascia,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== undefined,
      )

  return median(values)
}

/* =========================
   STRATEGY 1
   MONOCLUB
========================= */

function buildMonoclubPlan(
  trio: Player[],
  parameters:
    GoalkeeperStrategyParameters,
):
  | GoalkeeperPlanningPlan
  | null {
  const teams =
    getUniqueTeams(trio)

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
    REGOLA ALPHA CORRENTE.

    Non è un invariante definitivo:
    al momento il Monoclub viene
    considerato valido soltanto con
    un P1 classificato Top dai Saggi.

    La manteniamo invariata in questo
    refactor economico.
  */
  if (
    profile.tier !== 'top'
  ) {
    return null
  }

  return {
    strategy: 'monoclub',

    players: trio,

    teams,

    coverage:
      calculateGoalkeeperCoverage(
        [team],
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
  trio: Player[],
  parameters:
    GoalkeeperStrategyParameters,
):
  | GoalkeeperPlanningPlan
  | null {
  const teams =
    getUniqueTeams(trio)

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
    ).find(
      (entry) =>
        entry[1] === 2,
    )?.[0]

  const pairedTeam =
    Array.from(
      counts.entries(),
    ).find(
      (entry) =>
        entry[1] === 1,
    )?.[0]

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

  const profile =
    getGoalkeeperSaggiProfile(
      anchorP1.id,
      parameters,
    )

  if (
    profile.tier !== 'top' &&
    profile.tier !== 'semitop'
  ) {
    return null
  }

  return {
    strategy: 'top-pair',

    players: trio,

    teams: [
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
  trio: Player[],
  parameters:
    GoalkeeperStrategyParameters,
):
  | GoalkeeperPlanningPlan
  | null {
  const teams =
    getUniqueTeams(trio)

  if (
    teams.length !== 3
  ) {
    return null
  }

  const allP1 =
    trio.every(
      (player) =>
        getGoalkeeperPlayerHierarchy(
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
        ).tier === 'second',
    )

  if (!allSecondTier) {
    return null
  }

  return {
    strategy: 'rotation',

    players: trio,

    teams,

    coverage:
      calculateGoalkeeperCoverage(
        teams,
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

export function evaluateGoalkeeperTrio(
  trio: Player[],
  parameters:
    GoalkeeperStrategyParameters =
      DEFAULT_GOALKEEPER_STRATEGY_PARAMETERS,
): GoalkeeperPlanningPlan[] {
  if (
    trio.length !== 3
  ) {
    return []
  }

  const plans:
    GoalkeeperPlanningPlan[] = []

  const monoclub =
    buildMonoclubPlan(
      trio,
      parameters,
    )

  if (monoclub) {
    plans.push(
      monoclub,
    )
  }

  const topPair =
    buildTopPairPlan(
      trio,
      parameters,
    )

  if (topPair) {
    plans.push(
      topPair,
    )
  }

  const rotation =
    buildRotationPlan(
      trio,
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
   AVAILABLE POOL
========================= */

export function getAvailableGoalkeepers(
  state: AppState,
  allPlayers: Player[],
): Player[] {
  const owned =
    getOwnerRolePlayers(
      state,
      allPlayers,
      'P',
    )

  const ownedIds =
    new Set(
      owned.map(
        (player) =>
          player.id,
      ),
    )

  return allPlayers.filter(
    (player) => {
      if (
        player.role !== 'P'
      ) {
        return false
      }

      if (
        ownedIds.has(
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
}

/* =========================
   VALID PLANS
========================= */

export function getValidGoalkeeperPlans(
  state: AppState,
  allPlayers: Player[],
  requiredPlayer?:
    Player,
  parameters:
    GoalkeeperStrategyParameters =
      DEFAULT_GOALKEEPER_STRATEGY_PARAMETERS,
): GoalkeeperPlanningPlan[] {
  const ownerGoalkeepers =
    getOwnerRolePlayers(
      state,
      allPlayers,
      'P',
    )

  if (
    ownerGoalkeepers.length >= 3
  ) {
    return []
  }

  if (
    requiredPlayer &&
    requiredPlayer.role !== 'P'
  ) {
    return []
  }

  const ownerIds =
    new Set(
      ownerGoalkeepers.map(
        (player) =>
          player.id,
      ),
    )

  if (
    requiredPlayer &&
    !ownerIds.has(
      requiredPlayer.id,
    ) &&
    isPlayerAssigned(
      state,
      requiredPlayer.id,
    )
  ) {
    return []
  }

  const available =
    getAvailableGoalkeepers(
      state,
      allPlayers,
    )

  if (
    available.length < 3
  ) {
    return []
  }

  const validTrios =
    buildTrios(
      available,
    ).filter(
      (trio) => {
        const containsOwned =
          ownerGoalkeepers.every(
            (owned) =>
              hasPlayer(
                trio,
                owned.id,
              ),
          )

        if (!containsOwned) {
          return false
        }

        if (
          requiredPlayer &&
          !hasPlayer(
            trio,
            requiredPlayer.id,
          )
        ) {
          return false
        }

        return true
      },
    )

  return validTrios.flatMap(
    (trio) =>
      evaluateGoalkeeperTrio(
        trio,
        parameters,
      ),
  )
}