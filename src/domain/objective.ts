export type ObjectivePriority =
  | 'primary'
  | 'secondary'
  | 'third'
  | 'fourth'
  | 'bet'

export interface PlayerObjective {
  playerId: string

  priority: ObjectivePriority

  /*
    Placeholder neutro.

    Per ora è sempre 1 e NON viene
    utilizzato da nessun algoritmo.

    Verrà rivalutato quando costruiremo
    la logica della chiamata consigliata.
  */
  weight: number
}