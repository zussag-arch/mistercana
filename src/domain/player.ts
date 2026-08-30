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

    Sono dati informativi provenienti
    dal database sorgente.

    La loro presenza non implica
    automaticamente il loro utilizzo
    nelle formule MisterCanà.
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
    Segnali strategici provenienti
    dalla fonte del listone.

    Per ora vengono soltanto
    conservati come informazione.
  */
  valorizzato?: boolean
  penalizzato?: boolean
  nomeNascosto?: boolean

  /*
    =========================
    METRICHE MISTERCANÀ
    =========================

    Questi campi restano disponibili
    per compatibilità con il progetto
    e per le future formule.

    Non vengono inventati se il
    database corrente non li contiene.
  */

  iCa?: number

  /*
    Campo legacy del prototipo.

    Non viene popolato automaticamente
    con pmaPercent.
  */
  pma?: number

  /*
    Consenso esperti:
    scala prevista 0-100.
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