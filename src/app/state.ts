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

/*
  Assegnazione reale della sessione
  d'asta corrente.

  Giocatore e manager vengono
  identificati tramite i rispettivi
  ID permanenti.

  Nome, squadra, ruolo e nome del
  manager NON vengono duplicati qui.
*/
export interface AuctionAssignment {
  id: string

  playerId: string
  managerId: string

  price: number
}

/*
  Snapshot minimo di un'asta
  registrata.

  Per ora conserviamo le
  assegnazioni reali della sessione.

  La struttura può essere estesa
  in futuro con divisione,
  strategie, scarti e altri dati
  senza modificare l'identità delle
  assegnazioni già archiviate.
*/
export interface ArchivedAuction {
  id: string

  archivedAt: string

  assignments:
    AuctionAssignment[]
}

export interface AppState {
  auctionPhase: AuctionPhase

  /*
  ID permanente del giocatore
  attualmente chiamato.

  Nome, squadra e ruolo NON vengono
  duplicati nello stato:
  derivano sempre dal database
  centrale dei giocatori.
  */
  currentAuctionPlayerId:
    | string
    | null

  /*
  Fonte unica di verità per lo stato
  Libero / Assegnato della sessione
  corrente.

  Tutte le pagine operative devono
  leggere questa struttura e non
  Player.status.
  */
  auctionAssignments:
    AuctionAssignment[]

  /*
  Aste registrate.

  Una sessione scartata non viene
  aggiunta a questo archivio.
  */
  archivedAuctions:
    ArchivedAuction[]

  initialCredits: number

  defenseModifierEnabled: boolean

  budgetProfile: BudgetProfile

  budgetDistribution:
    BudgetDistribution

  managers: Manager[]

  /*
  Shortlist strategica personale.

  Il ruolo non viene salvato qui:
  deriva dal database giocatori.

  Questo evita duplicazioni e
  incoerenze tra obiettivi e database.
  */
  objectives:
    PlayerObjective[]
}

export const defaultState: AppState = {
  auctionPhase: 'setup',

  currentAuctionPlayerId: null,

  auctionAssignments: [],

  archivedAuctions: [],

  initialCredits: 500,

  defenseModifierEnabled: false,

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