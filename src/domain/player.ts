export type PlayerRole = 'P' | 'D' | 'C' | 'A'

export type PlayerStatus =
  | 'free'
  | 'assigned'

export interface Player {
  id: string

  name: string
  team: string
  role: PlayerRole

  /*
    Dati informativi.

    Nessuno di questi campi implica
    automaticamente una formula
    dell'algoritmo MisterCanà.
  */

  iCa?: number
  pma?: number

  /*
    Consenso esperti:
    scala prevista 0-100.
  */
  consensus?: number

  /*
    Percentuale di titolarità
    proveniente dalla futura
    fonte dedicata.
  */
  startingProbability?: number

  xMv?: number
  xFmv?: number

  /*
    Per ora semplice informazione
    utilizzata dal filtro Rigoristi.
  */
  penaltyTaker: boolean

  status: PlayerStatus
}