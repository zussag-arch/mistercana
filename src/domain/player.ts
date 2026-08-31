export type PlayerRole =
  | 'P'
  | 'D'
  | 'C'
  | 'A'

export type PlayerStatus =
  | 'free'
  | 'assigned'

export interface Player {
  /*
    Identità permanente del giocatore.

    Nel database 2026/27 è il valore
    id_giocatore, ad esempio:
    0001
    0002
    0003
  */
  id: string

  name: string
  team: string
  role: PlayerRole

  /*
    =========================
    DATI LISTONE 2026/27
    =========================
  */

  /*
    Percentuale di titolarità.

    Esempio:
    95,0% nel CSV
    diventa 95 nel modello.
  */
  startingProbability?: number

  /*
    Media voto e fantamedia
    presenti nel database sorgente.
  */
  mv?: number
  fmv?: number

  /*
    PMA espresso come percentuale
    del budget iniziale.

    Esempio:
    6,6% nel CSV
    diventa 6.6.

    Non coincide automaticamente
    con un PMA espresso in crediti.
  */
  pmaPercent?: number

  /*
    =========================
    DATI STORICI
    =========================

    I valori mancanti restano
    undefined e non diventano zero.
  */

  appearances?: number
  startingPoints?: number
  minutes?: number
  injuryPoints?: number

  goals?: number
  assists?: number

  yellowCards?: number
  redCards?: number

  penaltiesScored?: number
  penaltiesMissed?: number

  goalsConceded?: number
  penaltiesSaved?: number

  /*
    Segnali strategici provenienti
    dalla fonte del listone.

    Per ora vengono conservati come
    informazione e non entrano
    automaticamente nell'iCà.
  */
  valorizzato?: boolean
  penalizzato?: boolean
  nomeNascosto?: boolean

  /*
    =========================
    METRICHE MISTERCANÀ
    =========================
  */

  /*
    Indice prospettico MisterCanà
    su scala 0-100.

    Il valore viene calcolato
    dinamicamente dai dati disponibili.
  */
  iCa?: number

  /*
    Campo legacy del prototipo.

    Non viene popolato automaticamente
    con pmaPercent.
  */
  pma?: number

  /*
    Consenso tra i Saggi.

    Scala 0-10.

    È la media delle sole
    Fascia_Valore disponibili,
    normalizzate:

    1 -> 0
    2 -> 2.5
    3 -> 5
    4 -> 7.5
    5 -> 10
  */
  consensus?: number

  /*
    Metriche previsionali future.

    Non coincidono automaticamente
    con MV e FMV storiche.
  */
  xMv?: number
  xFmv?: number

  /*
    Campo legacy.

    La gerarchia dei rigoristi viene
    ora ricavata dal DB Battitori.
  */
  penaltyTaker: boolean

  /*
    Temporaneamente tutti i giocatori
    importati dal listone partono
    come liberi.

    In futuro questo valore dovrà
    derivare dallo stato reale
    dell'asta/divisione corrente.
  */
  status: PlayerStatus
}