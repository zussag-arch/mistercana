import type {
  FldaPlayer,
  FldaPlayerDetail,
  FldaRecord,
} from '../services/flda'

export type ICaRole = 'P' | 'D' | 'C' | 'A'

export type ICaCoachTone =
  | 'good'
  | 'bad'

export type ICaDifficulty =
  | 'easy'
  | 'medium'
  | 'difficult'

export interface ICaCoachRole {
  role: string
  tone: ICaCoachTone
}

export interface ICaFixture {
  day?: number
  difficulty_category?: ICaDifficulty
}

export interface ICaV2Input {
  player: FldaPlayer

  /*
   * Listone completo.
   * Serve come fallback per il percentile xFM.
   */
  rolePlayers?: FldaPlayer[]

  /*
   * guide.key_roles della squadra.
   */
  coachRoles?: ICaCoachRole[]

  /*
   * Fixture già richieste nel contesto corretto:
   *
   * P       -> goalkeeper
   * D/C/A   -> attacker
   */
  fixtures?: ICaFixture[]

  /*
   * Attualmente sono state giocate
   * le prime 4 giornate.
   */
  currentMatchday?: number

  /*
   * Legacy.
   * Lo manteniamo per compatibilità,
   * ma non entra più nell'ICA.
   */
  history?: FldaRecord[]

  valorizzato?: boolean
  penalizzato?: boolean
  ruoloChiave?: boolean
  ballottaggio?: boolean
}

/*
 * I riferimenti ICA ora servono
 * esclusivamente per la distribuzione xFM
 * dei quattro ruoli Classic.
 */
export interface ICaReferences {
  xfmByRole: Partial<
    Record<ICaRole, number[]>
  >
}

export interface ICaV2Result {
  score?: number

  /*
   * ICA prima del bonus piazzati.
   */
  baseScore?: number

  /*
   * Componenti 0-100.
   */
  xfm?: number
  titolarita?: number
  coach?: number
  calendario?: number

  /*
   * Bonus assoluto ICA.
   */
  piazzati?: number

  /*
   * Compatibilità temporanea
   * con UI legacy.
   */
  prospettiva?: number
  storico?: number
}

export const ICA_V2_PARAMETERS = {
  weights: {
    xfm: 50,
    titolarita: 30,
    coach: 20,
    calendario: 10,
  },

  calendar: {
    matches: 5,

    difficultyScores: {
      easy: 100,
      medium: 50,
      difficult: 0,
    } as Record<ICaDifficulty, number>,
  },

  coach: {
    good: 100,
    neutral: 50,
    bad: 0,
    mixed: 50,
  },

  setPieces: {
    penalty: {
      1: 6,
      2: 3,
    },

    freeKick: {
      1: 3,
      2: 2,
    },

    corner: {
      1: 2,
      2: 1,
    },

    maximum: 8,
  },
} as const

/*
 * Conversione ruolo Mantra
 * -> ruolo tattico Coach_KeyRoles FLDA.
 */
const MANTRA_TO_COACH_ROLES:
Record<string, readonly string[]> = {
  Por: ['gk'],

  Dc: ['def-center'],

  Dd: ['def-fullbacks'],
  Ds: ['def-fullbacks'],

  E: [
    'def-halfbacks',
    'mid-wide',
  ],

  M: ['mid-holding'],

  C: ['mid-center'],

  T: ['treq-center'],

  W: [
    'treq-wings',
    'att-wings',
  ],

  A: ['att-wings'],

  Pc: ['att-center'],
}

function finite(
  value: unknown,
): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
  )
}

export function clamp(
  value: number,
  min = 0,
  max = 100,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  )
}

function round2(
  value: number,
): number {
  return (
    Math.round(value * 100)
    / 100
  )
}

function roleOf(
  player: FldaPlayer,
): ICaRole | undefined {
  const role =
    player.role
      ?.trim()
      .toUpperCase()

  if (
    role === 'P'
    || role === 'D'
    || role === 'C'
    || role === 'A'
  ) {
    return role
  }

  return undefined
}

/*
 * ==========================================================
 * xFM
 * ==========================================================
 *
 * Non usiamo più p10/p90.
 *
 * Usiamo il percentile rank del giocatore
 * all'interno del proprio ruolo Classic.
 *
 * Peggiore del ruolo = 0
 * Migliore del ruolo = 100
 *
 * I pari merito ricevono lo stesso
 * percentile medio.
 */
export function xfmScore(
  value: unknown,
  peers: readonly number[] = [],
): number | undefined {
  if (!finite(value)) {
    return undefined
  }

  const values =
    peers
      .filter(finite)
      .sort((a, b) => a - b)

  if (!values.length) {
    return undefined
  }

  if (values.length === 1) {
    return 50
  }

  const lowerCount =
    values.filter(
      (candidate) =>
        candidate < value,
    ).length

  const equalCount =
    values.filter(
      (candidate) =>
        candidate === value,
    ).length

  /*
   * Rank medio in caso di pari merito.
   */
  const averageZeroBasedRank =
    lowerCount
    + Math.max(
      0,
      equalCount - 1,
    ) / 2

  return clamp(
    (
      averageZeroBasedRank
      / (values.length - 1)
    ) * 100,
  )
}

export function buildICaReferences(
  inputs: ICaV2Input[],
): ICaReferences {
  const xfmByRole:
    ICaReferences['xfmByRole'] = {}

  for (
    const role of
    ['P', 'D', 'C', 'A'] as ICaRole[]
  ) {
    const values =
      inputs
        .filter(
          (input) =>
            roleOf(input.player)
            === role,
        )
        .map(
          (input) =>
            input.player.fm_exp,
        )
        .filter(finite)

    xfmByRole[role] = values
  }

  return {
    xfmByRole,
  }
}

/*
 * Vecchia utility mantenuta
 * perché può essere richiamata da test
 * o codice legacy.
 */
export function percentile95(
  values: number[],
): number | undefined {
  const sorted =
    values
      .filter(finite)
      .sort((a, b) => a - b)

  if (!sorted.length) {
    return undefined
  }

  const position =
    (sorted.length - 1) * 0.95

  const lower =
    Math.floor(position)

  const upper =
    Math.ceil(position)

  const left =
    sorted[lower]!

  const right =
    sorted[upper]!

  return (
    left
    + (
      right - left
    ) * (
      position - lower
    )
  )
}

/*
 * ==========================================================
 * TITOLARITÀ
 * ==========================================================
 *
 * FLDA fornisce già:
 *
 * 1
 * 25
 * 50
 * 75
 * 95
 *
 * Nessun'altra trasformazione.
 */
export function utilizationScore(
  player: FldaPlayer,
): number | undefined {
  if (
    !finite(
      player.titolarita_display,
    )
  ) {
    return undefined
  }

  return clamp(
    player.titolarita_display,
  )
}

/*
 * ==========================================================
 * COACH
 * ==========================================================
 *
 * solo good  -> 100
 * solo bad   -> 0
 * good + bad -> 50
 * nessun match -> 50
 */
export function coachScore(
  player: FldaPlayer,
  coachRoles:
    readonly ICaCoachRole[] = [],
): number {
  const mantraRoles =
    Array.isArray(
      player.mantra_roles,
    )
      ? player.mantra_roles
      : []

  const relevantCoachRoles =
    new Set<string>()

  for (
    const mantraRole of
    mantraRoles
  ) {
    const mappings =
      MANTRA_TO_COACH_ROLES[
        mantraRole
      ] ?? []

    for (
      const mapping of mappings
    ) {
      relevantCoachRoles.add(
        mapping,
      )
    }
  }

  let good = false
  let bad = false

  for (
    const keyRole of coachRoles
  ) {
    if (
      !relevantCoachRoles.has(
        keyRole.role,
      )
    ) {
      continue
    }

    if (
      keyRole.tone === 'good'
    ) {
      good = true
    }

    if (
      keyRole.tone === 'bad'
    ) {
      bad = true
    }
  }

  if (good && bad) {
    return (
      ICA_V2_PARAMETERS
        .coach.mixed
    )
  }

  if (good) {
    return (
      ICA_V2_PARAMETERS
        .coach.good
    )
  }

  if (bad) {
    return (
      ICA_V2_PARAMETERS
        .coach.bad
    )
  }

  return (
    ICA_V2_PARAMETERS
      .coach.neutral
  )
}

/*
 * ==========================================================
 * CALENDARIO
 * ==========================================================
 *
 * Prendiamo SOLO le prossime 5 giornate.
 *
 * easy      = 100
 * medium    = 50
 * difficult = 0
 */
export function calendarScore(
  fixtures:
    readonly ICaFixture[] = [],
  currentMatchday = 4,
): number | undefined {
  const nextFive =
    fixtures
      .filter(
        (fixture) =>
          finite(fixture.day)
          && fixture.day
            > currentMatchday,
      )
      .sort(
        (a, b) =>
          (a.day ?? 0)
          - (b.day ?? 0),
      )
      .slice(
        0,
        ICA_V2_PARAMETERS
          .calendar.matches,
      )

  if (!nextFive.length) {
    return undefined
  }

  const scores: number[] = []

  for (
    const fixture of nextFive
  ) {
    const category =
      fixture
        .difficulty_category

    if (!category) {
      continue
    }

    scores.push(
      ICA_V2_PARAMETERS
        .calendar
        .difficultyScores[
          category
        ],
    )
  }

  if (!scores.length) {
    return undefined
  }

  return (
    scores.reduce(
      (sum, score) =>
        sum + score,
      0,
    )
    / scores.length
  )
}

/*
 * ==========================================================
 * PIAZZATI
 * ==========================================================
 *
 * 1° rigori      +6
 * 2° rigori      +3
 *
 * 1° punizioni   +3
 * 2° punizioni   +2
 *
 * 1° corner      +2
 * 2° corner      +1
 *
 * massimo +8
 */
function rankBonus(
  value: unknown,
  first: number,
  second: number,
): number {
  if (!finite(value)) {
    return 0
  }

  const rank =
    Math.round(value)

  if (rank === 1) {
    return first
  }

  if (rank === 2) {
    return second
  }

  return 0
}

export function setPieceBonus(
  player: FldaPlayer,
): number {
  const penalty =
    rankBonus(
      player.penalty_rank,
      ICA_V2_PARAMETERS
        .setPieces.penalty[1],
      ICA_V2_PARAMETERS
        .setPieces.penalty[2],
    )

  const freeKick =
    rankBonus(
      player.free_kick_rank,
      ICA_V2_PARAMETERS
        .setPieces.freeKick[1],
      ICA_V2_PARAMETERS
        .setPieces.freeKick[2],
    )

  const corner =
    rankBonus(
      player.corner_rank,
      ICA_V2_PARAMETERS
        .setPieces.corner[1],
      ICA_V2_PARAMETERS
        .setPieces.corner[2],
    )

  return Math.min(
    penalty
      + freeKick
      + corner,
    ICA_V2_PARAMETERS
      .setPieces.maximum,
  )
}

/*
 * ==========================================================
 * ICA
 * ==========================================================
 */
export function calculateICaV2(
  input: ICaV2Input,
  references?: ICaReferences,
): ICaV2Result {
  const role =
    roleOf(input.player)

  if (!role) {
    return {}
  }

  /*
   * Prima scelta:
   * references costruite sul listone.
   *
   * Fallback:
   * rolePlayers passati direttamente.
   */
  const peerValues =
    references
      ?.xfmByRole[role]
    ?? (
      input.rolePlayers ?? []
    )
      .filter(
        (player) =>
          roleOf(player) === role,
      )
      .map(
        (player) =>
          player.fm_exp,
      )
      .filter(finite)

  const xfm =
    xfmScore(
      input.player.fm_exp,
      peerValues,
    )

  const titolarita =
    utilizationScore(
      input.player,
    )

  const coach =
    coachScore(
      input.player,
      input.coachRoles ?? [],
    )

  const calendario =
    calendarScore(
      input.fixtures ?? [],
      input.currentMatchday ?? 4,
    )

  const piazzati =
    setPieceBonus(
      input.player,
    )

  /*
   * IMPORTANTE:
   *
   * Non rinormalizziamo più i pesi
   * se manca un componente.
   *
   * Se manca xFM, titolarità o calendario,
   * l'ICA non viene inventato.
   */
  if (
    !finite(xfm)
    || !finite(titolarita)
    || !finite(calendario)
  ) {
    return {
      xfm,
      titolarita,
      coach,
      calendario,
      piazzati,
    }
  }

  const weights =
    ICA_V2_PARAMETERS.weights

  const baseScore =
    (
      xfm
        * weights.xfm

      + titolarita
        * weights.titolarita

      + coach
        * weights.coach

      + calendario
        * weights.calendario
    )
    / (
      weights.xfm
      + weights.titolarita
      + weights.coach
      + weights.calendario
    )

  const finalScore =
    clamp(
      baseScore
      + piazzati,
    )

  const roundedBase =
    round2(baseScore)

  const roundedFinal =
    round2(finalScore)

  return {
    score: roundedFinal,

    baseScore:
      roundedBase,

    xfm:
      round2(xfm),

    titolarita:
      round2(titolarita),

    coach:
      round2(coach),

    calendario:
      round2(calendario),

    piazzati,

    /*
     * Compatibilità UI vecchia.
     */
    prospettiva:
      roundedBase,

    storico:
      undefined,
  }
}

/*
 * ==========================================================
 * COMPATIBILITÀ
 * ==========================================================
 *
 * Queste funzioni restano esportate
 * per non rompere import esistenti.
 */

export function perspectiveScore(
  player: FldaPlayer,
  rolePlayers:
    FldaPlayer[] = [],
): number | undefined {
  const role =
    roleOf(player)

  if (!role) {
    return undefined
  }

  const peers =
    rolePlayers
      .filter(
        (candidate) =>
          roleOf(candidate) === role,
      )
      .map(
        (candidate) =>
          candidate.fm_exp,
      )
      .filter(finite)

  const xfm =
    xfmScore(
      player.fm_exp,
      peers,
    )

  const titolarita =
    utilizationScore(player)

  if (
    !finite(xfm)
    || !finite(titolarita)
  ) {
    return undefined
  }

  return (
    (
      xfm
        * ICA_V2_PARAMETERS
          .weights.xfm

      + titolarita
        * ICA_V2_PARAMETERS
          .weights.titolarita
    )
    / (
      ICA_V2_PARAMETERS
        .weights.xfm

      + ICA_V2_PARAMETERS
        .weights.titolarita
    )
  )
}

export function historyScore(
  _input?: ICaV2Input,
  _references?: ICaReferences,
): number | undefined {
  return undefined
}

export function integrityScore(
  _value?: unknown,
): number | undefined {
  return undefined
}

export function hierarchyScore(
  _player?: FldaPlayer,
  _utilization?: number,
): number | undefined {
  return undefined
}

export function mvScore(
  _role?: ICaRole,
  _value?: unknown,
): number | undefined {
  return undefined
}

export function availabilityScore(
  _row?: FldaRecord,
): number | undefined {
  return undefined
}

export function absenceScore(
  _row?: FldaRecord,
): number | undefined {
  return undefined
}

export function sampleReliability(
  _appearances?: number,
): number {
  return 1
}

export function buildFldaICaV2Input(
  player: FldaPlayer,
  history?: FldaRecord[],
): ICaV2Input {
  return {
    player,
    history,
  }
}

export function calculateFldaICaV2(
  player: FldaPlayer,
  detail?: FldaPlayerDetail,
): ICaV2Result {
  return calculateICaV2(
    buildFldaICaV2Input(
      player,
      detail?.history,
    ),
  )
}