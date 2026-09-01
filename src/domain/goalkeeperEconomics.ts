import type {
  AppState,
} from '../app/state'

import {
  getOwnerRemainingCredits,
  getOwnerRolePlayers,
  getSpentByRole,
  ROSTER_SLOT_LIMITS,
} from './auctionContext'

import type {
  GoalkeeperPlanningPlan,
} from './goalkeeperPlanning'

import type {
  Player,
} from './player'

export interface GoalkeeperEconomics {
  /*
    Costo dei portieri che devono
    ancora essere acquistati DOPO
    il candidato per completare
    la strategia scelta.
  */
  strategicReserve?: number

  /*
    Riserva P usata dal limite
    finanziario globale.

    Se non esiste una strategia
    valida, usa soltanto il minimo
    necessario a riempire gli slot.
  */
  financialGoalkeeperReserve:
    number

  roleLimit?: number

  financialLimit?: number

  globalReserve?: number

  dynamicRoleTarget: number

  ownerRemainingCredits?:
    number
}

interface GoalkeeperEconomicsInput {
  state: AppState

  player: Player

  allPlayers: Player[]

  plans:
    GoalkeeperPlanningPlan[]

  dynamicRoleTarget: number

  nonGoalkeeperGlobalReserve:
    number

  minimumFutureSlotCost:
    number

  estimatePlayerCost:
    (
      player: Player,
    ) =>
      | number
      | undefined
}

/* =========================
   HELPERS
========================= */

function getSafeFutureCost(
  player: Player,
  minimumFutureSlotCost:
    number,
  estimatePlayerCost:
    (
      player: Player,
    ) =>
      | number
      | undefined,
): number {
  const estimated =
    estimatePlayerCost(
      player,
    )

  if (
    estimated === undefined ||
    !Number.isFinite(
      estimated,
    )
  ) {
    return minimumFutureSlotCost
  }

  return Math.max(
    minimumFutureSlotCost,
    estimated,
  )
}

function getPlanFutureReserve(
  plan: GoalkeeperPlanningPlan,
  ownerIds: Set<string>,
  candidateId:
    string | undefined,
  minimumFutureSlotCost:
    number,
  estimatePlayerCost:
    (
      player: Player,
    ) =>
      | number
      | undefined,
): number {
  return plan.players.reduce(
    (
      total,
      player,
    ) => {
      /*
        Già acquistato da noi:
        costo già sostenuto.
      */
      if (
        ownerIds.has(
          player.id,
        )
      ) {
        return total
      }

      /*
        Il candidato è proprio
        il giocatore di cui stiamo
        calcolando il tetto.

        Il suo costo non deve entrare
        nella riserva futura.
      */
      if (
        candidateId &&
        player.id ===
          candidateId
      ) {
        return total
      }

      return (
        total +
        getSafeFutureCost(
          player,
          minimumFutureSlotCost,
          estimatePlayerCost,
        )
      )
    },
    0,
  )
}

/* =========================
   COMPLETION RESERVE
========================= */

export function calculateGoalkeeperCompletionReserve(
  state: AppState,
  allPlayers: Player[],
  plans:
    GoalkeeperPlanningPlan[],
  minimumFutureSlotCost:
    number,
  estimatePlayerCost:
    (
      player: Player,
    ) =>
      | number
      | undefined,
): number {
  const ownerGoalkeepers =
    getOwnerRolePlayers(
      state,
      allPlayers,
      'P',
    )

  const ownerIds =
    new Set(
      ownerGoalkeepers.map(
        (player) =>
          player.id,
      ),
    )

  if (
    ownerGoalkeepers.length >=
    ROSTER_SLOT_LIMITS.P
  ) {
    return 0
  }

  const reserves =
    plans.map(
      (plan) =>
        getPlanFutureReserve(
          plan,
          ownerIds,
          undefined,
          minimumFutureSlotCost,
          estimatePlayerCost,
        ),
    )

  if (reserves.length) {
    /*
      Per il vincolo finanziario
      globale ci interessa sapere
      qual è almeno una strada
      concreta e ancora realizzabile
      per completare P.

      Usiamo quindi la strategia valida
      con minor costo futuro.
    */
    return Math.min(
      ...reserves,
    )
  }

  /*
    FALLBACK FINANZIARIO.

    Nessuna strategia riconosciuta è
    più disponibile.

    Non inventiamo una ripartizione
    del budget P: riserviamo soltanto
    il costo minimo necessario a
    riempire gli slot mancanti.
  */
  const remainingSlots =
    Math.max(
      0,
      ROSTER_SLOT_LIMITS.P -
        ownerGoalkeepers.length,
    )

  return (
    remainingSlots *
    minimumFutureSlotCost
  )
}

/* =========================
   CANDIDATE ECONOMICS
========================= */

export function calculateGoalkeeperEconomics(
  input:
    GoalkeeperEconomicsInput,
): GoalkeeperEconomics {
  const {
    state,
    player,
    allPlayers,
    plans,
    dynamicRoleTarget,
    nonGoalkeeperGlobalReserve,
    minimumFutureSlotCost,
    estimatePlayerCost,
  } = input

  const ownerGoalkeepers =
    getOwnerRolePlayers(
      state,
      allPlayers,
      'P',
    )

  const ownerIds =
    new Set(
      ownerGoalkeepers.map(
        (goalkeeper) =>
          goalkeeper.id,
      ),
    )

  const playerAlreadyOwned =
    ownerIds.has(
      player.id,
    )

  const relevantPlans =
    plans.filter(
      (plan) =>
        plan.players.some(
          (goalkeeper) =>
            goalkeeper.id ===
            player.id,
        ),
    )

  const planReserves =
    relevantPlans.map(
      (plan) =>
        getPlanFutureReserve(
          plan,
          ownerIds,
          player.id,
          minimumFutureSlotCost,
          estimatePlayerCost,
        ),
    )

  const strategicReserve =
    planReserves.length
      ? Math.min(
          ...planReserves,
        )
      : undefined

  /*
    Se non esiste alcuna strategia
    valida, il prezzo manuale deve
    continuare a funzionare.

    Per il solo hard cap finanziario
    manteniamo quindi il minimo
    necessario a completare gli slot.
  */
  const remainingAfterCandidate =
    Math.max(
      0,
      ROSTER_SLOT_LIMITS.P -
        ownerGoalkeepers.length -
        (
          playerAlreadyOwned
            ? 0
            : 1
        ),
    )

  const financialGoalkeeperReserve =
    strategicReserve ??
    (
      remainingAfterCandidate *
      minimumFutureSlotCost
    )

  const spent =
    getSpentByRole(
      state,
      allPlayers,
    )

  /*
    LIMITE STRATEGICO P

    Budget P disponibile al candidato
    dopo aver preservato il costo degli
    altri portieri necessari alla terna.

    Nessun budget P / 3.
  */
  const roleLimit =
    strategicReserve === undefined
      ? undefined
      : Math.max(
          0,
          Math.floor(
            dynamicRoleTarget -
              spent.P -
              strategicReserve,
          ),
        )

  const ownerRemainingCredits =
    getOwnerRemainingCredits(
      state,
    )

  const globalReserve =
    ownerRemainingCredits ===
      undefined
      ? undefined
      : (
          nonGoalkeeperGlobalReserve +
          financialGoalkeeperReserve
        )

  /*
    LIMITE FINANZIARIO GLOBALE

    È l'hard cap.

    Dopo il candidato devono restare
    abbastanza crediti per:
    - completare D/C/A
    - completare la strategia P
      o, in fallback, gli slot P minimi.
  */
  const financialLimit =
    ownerRemainingCredits ===
      undefined ||
    globalReserve === undefined
      ? undefined
      : Math.max(
          0,
          Math.floor(
            ownerRemainingCredits -
              globalReserve,
          ),
        )

  return {
    strategicReserve,

    financialGoalkeeperReserve,

    roleLimit,

    financialLimit,

    globalReserve,

    dynamicRoleTarget,

    ownerRemainingCredits,
  }
}