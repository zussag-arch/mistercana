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

export interface AppState {
  auctionPhase: AuctionPhase

  initialCredits: number

  budgetProfile: BudgetProfile

  budgetDistribution: BudgetDistribution

  managers: Manager[]

  /*
    Shortlist strategica personale.

    Il ruolo non viene salvato qui:
    deriva dal database giocatori.

    Questo evita duplicazioni e
    incoerenze tra obiettivi e database.
  */
  objectives: PlayerObjective[]
}

export const defaultState: AppState = {
  auctionPhase: 'setup',

  initialCredits: 500,

  budgetProfile: 'equilibrata',

  budgetDistribution: {
    P: 11,
    D: 21,
    C: 23,
    A: 45,
  },

  managers: [
    {
      id: 'owner',

      firstName: 'Gabriele',
      lastName: '',
      alias: '',

      teamName: '',

      isOwner: true,
      active: true,
      archived: false,
    },
  ],

  objectives: [],
}