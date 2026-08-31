// src/domain/ica.ts

export type ICaRole = 'P' | 'D' | 'C' | 'A'

/* =========================================================
   CONFIGURAZIONE
   ========================================================= */

export interface ICaWeights {
  rendimento: number
  titolarita: number
  saggi: number
  allenatore: number
}

export interface HistoricalWeights {
  fmv: number
  mv: number
}

export interface SaggiWeights {
  fascia: number
  affidabilita: number
  integrita: number
}

export interface ICaConfig {
  finalWeights: ICaWeights
  historicalWeights: HistoricalWeights
  saggiWeights: SaggiWeights
  titolaritaGamma: number
  historicalNeutralScore: number
}

export const DEFAULT_ICA_CONFIG: ICaConfig = {
  finalWeights: {
    rendimento: 0.4,
    titolarita: 0.25,
    saggi: 0.25,
    allenatore: 0.1,
  },

  historicalWeights: {
    fmv: 0.7,
    mv: 0.3,
  },

  saggiWeights: {
    fascia: 0.6,
    affidabilita: 0.2,
    integrita: 0.2,
  },

  titolaritaGamma: 0.8,
  historicalNeutralScore: 50,
}

/* =========================================================
   INPUT GIOCATORE
   ========================================================= */

export interface ICaPlayerInput {
  id?: string
  name?: string
  team?: string
  role: ICaRole

  titolarita?: number | null

  mv?: number | null
  fmv?: number | null

  presenze?: number | null
  ptTit?: number | null
  minuti?: number | null
  ptInf?: number | null

  gol?: number | null
  assist?: number | null

  ammonizioni?: number | null
  espulsioni?: number | null

  rigSegnati?: number | null
  rigSbagliati?: number | null

  golSubiti?: number | null
  rigParati?: number | null
}

/* =========================================================
   SAGGI
   ========================================================= */

export interface ICaSaggioInput {
  saggio?: string
  fasciaValore?: number | null
  affidabilita?: number | null
  integrita?: number | null
}

/* =========================================================
   ALLENATORE
   ========================================================= */

export interface ICaCoachInput {
  rawImpact?: number | null
  maxAbsImpact?: number | null
}

/* =========================================================
   BENCHMARK STORICI
   ========================================================= */

export interface ICaHistoricalBenchmarks {
  role: ICaRole
  mvValues: number[]
  fmvValues: number[]
  medianMinutes: number | null
}

export type ICaBenchmarksByRole = Partial<
  Record<ICaRole, ICaHistoricalBenchmarks>
>

/* =========================================================
   RISULTATO
   ========================================================= */

export type ICaComponentKey =
  | 'rendimento'
  | 'titolarita'
  | 'saggi'
  | 'allenatore'

export interface ICaComponentResult {
  key: ICaComponentKey
  score: number | null
  configuredWeight: number
  effectiveWeight: number
  used: boolean
}

export interface ICaHistoricalBreakdown {
  mvPercentile: number | null
  fmvPercentile: number | null
  qualityScore: number | null
  confidence: number | null
  score: number | null
}

export interface ICaSaggiBreakdown {
  fasciaScore: number | null
  affidabilitaScore: number | null
  integritaScore: number | null
  score: number | null
}

export interface ICaBreakdown {
  rendimento: ICaHistoricalBreakdown
  titolarita: number | null
  saggi: ICaSaggiBreakdown
  allenatore: number | null
}

export interface ICaResult {
  score: number | null
  components: ICaComponentResult[]
  breakdown: ICaBreakdown
  availableWeight: number
}

/* =========================================================
   FUNZIONI BASE
   ========================================================= */

function isFiniteNumber(
  value: number | null | undefined,
): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(
  value: number,
  min = 0,
  max = 100,
): number {
  return Math.min(max, Math.max(min, value))
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function median(values: number[]): number | null {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 !== 0) {
    return sorted[middle]
  }

  return (sorted[middle - 1] + sorted[middle]) / 2
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)]
}

/* =========================================================
   PERCENTILE PER RUOLO
   ========================================================= */

export function percentileRank(
  value: number,
  population: number[],
): number | null {
  const validPopulation = population
    .filter(isFiniteNumber)
    .sort((a, b) => a - b)

  if (validPopulation.length === 0) {
    return null
  }

  if (validPopulation.length === 1) {
    return 50
  }

  let below = 0
  let equal = 0

  for (const candidate of validPopulation) {
    if (candidate < value) {
      below += 1
    } else if (candidate === value) {
      equal += 1
    }
  }

  const averageRank =
    below + (equal > 0 ? (equal - 1) / 2 : 0)

  const percentile =
    (averageRank / (validPopulation.length - 1)) * 100

  return clamp(percentile)
}

/* =========================================================
   CREAZIONE BENCHMARK DAL DB GIOCATORI
   ========================================================= */

export function buildHistoricalBenchmarks(
  players: ICaPlayerInput[],
): ICaBenchmarksByRole {
  const roles: ICaRole[] = ['P', 'D', 'C', 'A']
  const result: ICaBenchmarksByRole = {}

  for (const role of roles) {
    const rolePlayers = players.filter(
      (player) => player.role === role,
    )

    const mvValues = rolePlayers
      .map((player) => player.mv)
      .filter(isFiniteNumber)

    const fmvValues = rolePlayers
      .map((player) => player.fmv)
      .filter(isFiniteNumber)

    const minutesValues = rolePlayers
      .map((player) => player.minuti)
      .filter(
        (value): value is number =>
          isFiniteNumber(value) && value >= 0,
      )

    result[role] = {
      role,
      mvValues,
      fmvValues,
      medianMinutes: median(minutesValues),
    }
  }

  return result
}

/* =========================================================
   1. RENDIMENTO STORICO
   ========================================================= */

export function calculateHistoricalScore(
  player: ICaPlayerInput,
  benchmarks: ICaHistoricalBenchmarks | undefined,
  config: ICaConfig = DEFAULT_ICA_CONFIG,
): ICaHistoricalBreakdown {
  if (!benchmarks) {
    return {
      mvPercentile: null,
      fmvPercentile: null,
      qualityScore: null,
      confidence: null,
      score: null,
    }
  }

  const mvPercentile = isFiniteNumber(player.mv)
    ? percentileRank(player.mv, benchmarks.mvValues)
    : null

  const fmvPercentile = isFiniteNumber(player.fmv)
    ? percentileRank(player.fmv, benchmarks.fmvValues)
    : null

  const qualityParts: Array<{
    score: number
    weight: number
  }> = []

  if (fmvPercentile != null) {
    qualityParts.push({
      score: fmvPercentile,
      weight: config.historicalWeights.fmv,
    })
  }

  if (mvPercentile != null) {
    qualityParts.push({
      score: mvPercentile,
      weight: config.historicalWeights.mv,
    })
  }

  const availableQualityWeight = qualityParts.reduce(
    (sum, part) => sum + part.weight,
    0,
  )

  let qualityScore: number | null = null

  if (availableQualityWeight > 0) {
    qualityScore =
      qualityParts.reduce(
        (sum, part) =>
          sum + part.score * part.weight,
        0,
      ) / availableQualityWeight
  }

  const medianMinutes = benchmarks.medianMinutes

  let confidence: number | null = null

  if (
    isFiniteNumber(player.minuti) &&
    player.minuti >= 0 &&
    isFiniteNumber(medianMinutes) &&
    medianMinutes > 0
  ) {
    confidence = clamp(
      player.minuti / medianMinutes,
      0,
      1,
    )
  }

  if (
    qualityScore == null ||
    confidence == null
  ) {
    return {
      mvPercentile,
      fmvPercentile,
      qualityScore,
      confidence,
      score: null,
    }
  }

  const score =
    confidence * qualityScore +
    (1 - confidence) *
      config.historicalNeutralScore

  return {
    mvPercentile:
      mvPercentile == null
        ? null
        : round2(mvPercentile),

    fmvPercentile:
      fmvPercentile == null
        ? null
        : round2(fmvPercentile),

    qualityScore: round2(qualityScore),
    confidence: round2(confidence),
    score: round2(clamp(score)),
  }
}

/* =========================================================
   2. TITOLARITÀ
   ========================================================= */

export function calculateTitolaritaScore(
  titolarita: number | null | undefined,
  config: ICaConfig = DEFAULT_ICA_CONFIG,
): number | null {
  if (!isFiniteNumber(titolarita)) {
    return null
  }

  const probability =
    clamp(titolarita, 0, 100) / 100

  const score =
    100 *
    Math.pow(
      probability,
      config.titolaritaGamma,
    )

  return round2(clamp(score))
}

/* =========================================================
   3. SAGGI
   ========================================================= */

export function normalizeFasciaValore(
  value: number | null | undefined,
): number | null {
  if (!isFiniteNumber(value)) {
    return null
  }

  if (value < 1 || value > 5) {
    return null
  }

  return (value - 1) * 25
}

export function normalizeFivePointScale(
  value: number | null | undefined,
): number | null {
  if (!isFiniteNumber(value)) {
    return null
  }

  if (value < 0 || value > 5) {
    return null
  }

  return value * 20
}

export function calculateSaggiScore(
  saggi: ICaSaggioInput[],
  config: ICaConfig = DEFAULT_ICA_CONFIG,
): ICaSaggiBreakdown {
  const fasciaValues = saggi
    .map((saggio) =>
      normalizeFasciaValore(
        saggio.fasciaValore,
      ),
    )
    .filter(isFiniteNumber)

  const fasciaScore = median(fasciaValues)

  const affidabilitaValues = uniqueNumbers(
    saggi
      .map((saggio) => saggio.affidabilita)
      .filter(isFiniteNumber),
  )

  const integritaValues = uniqueNumbers(
    saggi
      .map((saggio) => saggio.integrita)
      .filter(isFiniteNumber),
  )

  const affidabilitaRaw =
    median(affidabilitaValues)

  const integritaRaw =
    median(integritaValues)

  const affidabilitaScore =
    affidabilitaRaw == null
      ? null
      : normalizeFivePointScale(
          affidabilitaRaw,
        )

  const integritaScore =
    integritaRaw == null
      ? null
      : normalizeFivePointScale(
          integritaRaw,
        )

  const parts: Array<{
    score: number
    weight: number
  }> = []

  if (fasciaScore != null) {
    parts.push({
      score: fasciaScore,
      weight: config.saggiWeights.fascia,
    })
  }

  if (affidabilitaScore != null) {
    parts.push({
      score: affidabilitaScore,
      weight:
        config.saggiWeights.affidabilita,
    })
  }

  if (integritaScore != null) {
    parts.push({
      score: integritaScore,
      weight: config.saggiWeights.integrita,
    })
  }

  const availableWeight = parts.reduce(
    (sum, part) => sum + part.weight,
    0,
  )

  const score =
    availableWeight > 0
      ? parts.reduce(
          (sum, part) =>
            sum + part.score * part.weight,
          0,
        ) / availableWeight
      : null

  return {
    fasciaScore:
      fasciaScore == null
        ? null
        : round2(fasciaScore),

    affidabilitaScore:
      affidabilitaScore == null
        ? null
        : round2(affidabilitaScore),

    integritaScore:
      integritaScore == null
        ? null
        : round2(integritaScore),

    score:
      score == null
        ? null
        : round2(clamp(score)),
  }
}

/* =========================================================
   4. ALLENATORE
   ========================================================= */

export function calculateCoachScore(
  coach: ICaCoachInput | null | undefined,
): number | null {
  if (!coach) {
    return null
  }

  if (
    !isFiniteNumber(coach.rawImpact) ||
    !isFiniteNumber(coach.maxAbsImpact) ||
    coach.maxAbsImpact <= 0
  ) {
    return null
  }

  const normalizedImpact = clamp(
    coach.rawImpact /
      coach.maxAbsImpact,
    -1,
    1,
  )

  const score =
    50 + 50 * normalizedImpact

  return round2(clamp(score))
}

/* =========================================================
   iCà FINALE
   ========================================================= */

export function calculateICa(
  player: ICaPlayerInput,
  options: {
    benchmarks?: ICaBenchmarksByRole
    saggi?: ICaSaggioInput[]
    coach?: ICaCoachInput | null
    config?: ICaConfig
  } = {},
): ICaResult {
  const config =
    options.config ?? DEFAULT_ICA_CONFIG

  const historical =
    calculateHistoricalScore(
      player,
      options.benchmarks?.[player.role],
      config,
    )

  const titolarita =
    calculateTitolaritaScore(
      player.titolarita,
      config,
    )

  const saggi =
    calculateSaggiScore(
      options.saggi ?? [],
      config,
    )

  const allenatore =
    calculateCoachScore(options.coach)

  const rawComponents = [
    {
      key: 'rendimento' as const,
      score: historical.score,
      weight:
        config.finalWeights.rendimento,
    },
    {
      key: 'titolarita' as const,
      score: titolarita,
      weight:
        config.finalWeights.titolarita,
    },
    {
      key: 'saggi' as const,
      score: saggi.score,
      weight:
        config.finalWeights.saggi,
    },
    {
      key: 'allenatore' as const,
      score: allenatore,
      weight:
        config.finalWeights.allenatore,
    },
  ]

  const availableWeight =
    rawComponents.reduce(
      (sum, component) => {
        if (
          component.score == null ||
          component.weight <= 0
        ) {
          return sum
        }

        return sum + component.weight
      },
      0,
    )

  const components: ICaComponentResult[] =
    rawComponents.map((component) => {
      const used =
        component.score != null &&
        component.weight > 0 &&
        availableWeight > 0

      return {
        key: component.key,
        score: component.score,
        configuredWeight:
          component.weight,

        effectiveWeight: used
          ? component.weight /
            availableWeight
          : 0,

        used,
      }
    })

  if (availableWeight <= 0) {
    return {
      score: null,
      components,
      availableWeight: 0,

      breakdown: {
        rendimento: historical,
        titolarita,
        saggi,
        allenatore,
      },
    }
  }

  const weightedSum =
    rawComponents.reduce(
      (sum, component) => {
        if (
          component.score == null ||
          component.weight <= 0
        ) {
          return sum
        }

        return (
          sum +
          component.score *
            component.weight
        )
      },
      0,
    )

  const finalScore =
    weightedSum / availableWeight

  return {
    score: round2(clamp(finalScore)),
    components,
    availableWeight:
      round2(availableWeight),

    breakdown: {
      rendimento: historical,
      titolarita,
      saggi,
      allenatore,
    },
  }
}