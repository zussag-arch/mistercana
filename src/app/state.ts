import type {
  PlayerObjective,
} from '../domain/objective'

export type AuctionPhase =
  | 'setup'
  | 'live'
  | 'finalizing'
  | 'archived'
  | 'discarded'

export type BudgetRole =
  | 'P'
  | 'D'
  | 'C'
  | 'A'

export type BudgetProfile =
  | 'prudente'
  | 'equilibrata'
  | 'aggressiva'
  | 'personalizzata'

export interface BudgetDistribution {
  P: number
  D: number
  C: number
  A: number
}

export interface Manager {
  id: string
  firstName: string
  lastName: string
  alias: string
  teamName: string
  isOwner: boolean
  active: boolean
  archived: boolean
}

export interface AuctionAssignment {
  id: string
  playerId: string
  managerId: string
  price: number

  /*
    Informazioni opzionali sull'ultimo
    concorrente reale per il giocatore.

    Per ora vengono soltanto registrate:
    non entrano automaticamente negli
    algoritmi di prezzo o raccomandazione.
  */
  secondBidderManagerId?: string
  secondBidPrice?: number
}

export interface ArchivedAuction {
  id: string
  archivedAt: string
  assignments:
    AuctionAssignment[]
}

export interface AppState {
  auctionPhase: AuctionPhase

  currentAuctionPlayerId:
    | string
    | null

  auctionAssignments:
    AuctionAssignment[]

  archivedAuctions:
    ArchivedAuction[]

  /*
    Esclusioni valide esclusivamente
    per la Chiamata consigliata
    dell'asta corrente.
  */
  recommendedDiscards:
    string[]

  initialCredits: number

  defenseModifierEnabled:
    boolean

  budgetProfile:
    BudgetProfile

  budgetDistribution:
    BudgetDistribution

  managers: Manager[]

  objectives:
    PlayerObjective[]
}

export const defaultState:
  AppState = {
    auctionPhase:
      'setup',

    currentAuctionPlayerId:
      null,

    auctionAssignments:
      [],

    archivedAuctions:
      [],

    recommendedDiscards:
      [],

    initialCredits:
      500,

    defenseModifierEnabled:
      false,

    budgetProfile:
      'equilibrata',

    budgetDistribution: {
      P: 11,
      D: 21,
      C: 23,
      A: 45,
    },

    managers: [
      {
        id:
          'owner',

        firstName:
          'Gabriele',

        lastName:
          '',

        alias:
          '',

        teamName:
          '',

        isOwner:
          true,

        active:
          true,

        archived:
          false,
      },
    ],

    objectives:
      [],
  }