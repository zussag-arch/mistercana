import type { FldaPlayer, FldaPlayerDetail, FldaRecord } from '../services/flda'

export type ICaRole = 'P' | 'D' | 'C' | 'A'
export type ICaEvent = 'goal' | 'assist' | 'cleanSheet' | 'yellow' | 'red' | 'missedPenalty' | 'goalsConceded' | 'penaltiesSaved'

export interface ICaV2Input {
  player: FldaPlayer
  history?: FldaRecord[]
  valorizzato?: boolean
  penalizzato?: boolean
  ruoloChiave?: boolean
  ballottaggio?: boolean
}

export interface ICaReferences {
  positive: Partial<Record<ICaRole, Partial<Record<ICaEvent, number>>>>
  negative: Partial<Record<ICaRole, Partial<Record<ICaEvent, number>>>>
}

export interface ICaV2Result {
  score?: number
  prospettiva?: number
  storico?: number
}

export const ICA_V2_PARAMETERS = {
  baseWeights: { prospettiva: 0.55, storico: 0.45 },
  prospettivaWeights: { xfm: 0.40, utilizzo: 0.30, integrita: 0.20, gerarchie: 0.10 },
  utilizzoWeights: { titolarita: 0.80, xi: 0.20 },
  hierarchyWeights: { penalty: 0.50, freeKick: 0.30, corner: 0.20 },
  hierarchyRankScores: { 1: 55, 2: 30, 3: 15 } as Record<number, number>,
  goalkeeperRankScores: { 1: 100, 2: 30, 3: 10 } as Record<number, number>,
  historyWeights: [0.50, 0.333333, 0.166667],
  seasonWeights: { bonus: 0.35, malus: 0.20, mv: 0.15, disponibilita: 0.20, assenze: 0.10 },
  eventWeights: {
    P: { cleanSheet: 0.75, penaltiesSaved: 0.25 },
    D: { goal: 1, assist: 1, cleanSheet: 0.90 },
    C: { goal: 0.85, assist: 0.85 },
    A: { goal: 0.70, assist: 0.70 },
  } as Record<ICaRole, Partial<Record<ICaEvent, number>>>,
  malusWeights: { yellow: 1, red: 2, missedPenalty: 3 },
  referencePercentile: 0.95,
  reliabilityPoints: [[0, 0], [10, 0.40], [20, 0.70], [30, 0.90], [35, 1]] as const,
  mvScales: {
    P: { min: 5.50, max: 6.50 },
    D: { min: 5.50, max: 6.50 },
    C: { min: 5.50, max: 6.50 },
    A: { min: 5.50, max: 6.50 },
  },
  availability: { nearFullMinutes: 72.5, fullMinutes: 87.5, exponent: 0.75 },
  absence: { softGames: 3, fullPenaltyGames: 20, exponent: 1.65 },
  expectedCorrection: { maximumPoints: 10, scale: 0.35 },
  editorial: { valorizzato: 1.06, penalizzato: 0.94, ruoloChiave: 1.05, ballottaggio: 0.95 },
} as const

const fantasyKeys = {
  appearances: ['presenze'], minutes: ['min_playing_time'], mv: ['mv'],
  goals: ['gol_fatti'], assists: ['assist'], cleanSheets: ['clean_sheet'],
  yellow: ['amm'], red: ['esp'], missedPenalty: ['rigori_sbagliati'],
  penaltiesSaved: ['rigori_parati'], goalsConceded: ['gol_subiti'],
  injuryGamesMissed: ['injury_games_missed'], xg: ['xg'], xa: ['xa'],
} as const

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
export function clamp(value: number, min = 0, max = 100): number { return Math.min(max, Math.max(min, value)) }
function field(row: FldaRecord, keys: readonly string[]): number | undefined {
  for (const key of keys) if (finite(row[key])) return row[key]
  return undefined
}
function roleOf(player: FldaPlayer): ICaRole | undefined {
  const role = player.role.toUpperCase()
  return role === 'P' || role === 'D' || role === 'C' || role === 'A' ? role : undefined
}
function weighted(values: Array<{ value?: number; weight: number }>): number | undefined {
  const valid = values.filter((item): item is { value: number; weight: number } => finite(item.value) && item.weight > 0)
  const denominator = valid.reduce((sum, item) => sum + item.weight, 0)
  return denominator ? valid.reduce((sum, item) => sum + item.value * item.weight, 0) / denominator : undefined
}

export function sampleReliability(appearances: number | undefined): number {
  if (!finite(appearances) || appearances <= 0) return 0
  const points = ICA_V2_PARAMETERS.reliabilityPoints
  for (let index = 1; index < points.length; index += 1) {
    const [rightX, rightY] = points[index]!
    const [leftX, leftY] = points[index - 1]!
    if (appearances <= rightX) return leftY + ((appearances - leftX) / (rightX - leftX)) * (rightY - leftY)
  }
  return 1
}

export function percentile95(values: number[]): number | undefined {
  const sorted = values.filter(finite).sort((a, b) => a - b)
  if (!sorted.length) return undefined
  const position = (sorted.length - 1) * ICA_V2_PARAMETERS.referencePercentile
  const lower = Math.floor(position); const upper = Math.ceil(position)
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower)
}

export function xfmScore(value: unknown): number | undefined { return finite(value) ? clamp(value * 10) : undefined }

export function utilizationScore(player: FldaPlayer): number | undefined {
  const titolarita = finite(player.titolarita_display) ? clamp(player.titolarita_display) : undefined
  const xi = typeof player.is_starting_xi === 'boolean' ? (player.is_starting_xi ? 100 : 0) : undefined
  return weighted([
    { value: titolarita, weight: ICA_V2_PARAMETERS.utilizzoWeights.titolarita },
    { value: xi, weight: ICA_V2_PARAMETERS.utilizzoWeights.xi },
  ])
}

export function integrityScore(value: unknown): number | undefined {
  return finite(value) && value >= 1 && value <= 5 ? value * 20 : undefined
}

function rankScore(value: unknown): number | undefined {
  return finite(value) ? ICA_V2_PARAMETERS.hierarchyRankScores[Math.round(value)] : undefined
}

export function hierarchyScore(player: FldaPlayer, utilization = utilizationScore(player)): number | undefined {
  const role = roleOf(player)
  if (role === 'P') return finite(player.goalkeeper_rank)
    ? ICA_V2_PARAMETERS.goalkeeperRankScores[Math.round(player.goalkeeper_rank)]
    : undefined
  const raw = weighted([
    { value: rankScore(player.penalty_rank), weight: ICA_V2_PARAMETERS.hierarchyWeights.penalty },
    { value: rankScore(player.free_kick_rank), weight: ICA_V2_PARAMETERS.hierarchyWeights.freeKick },
    { value: rankScore(player.corner_rank), weight: ICA_V2_PARAMETERS.hierarchyWeights.corner },
  ])
  return finite(raw) && finite(utilization) ? raw * utilization / 100 : undefined
}

export function perspectiveScore(player: FldaPlayer): number | undefined {
  const utilization = utilizationScore(player)
  return weighted([
    { value: xfmScore(player.fm_exp), weight: ICA_V2_PARAMETERS.prospettivaWeights.xfm },
    { value: utilization, weight: ICA_V2_PARAMETERS.prospettivaWeights.utilizzo },
    { value: integrityScore(player.integrita), weight: ICA_V2_PARAMETERS.prospettivaWeights.integrita },
    { value: hierarchyScore(player, utilization), weight: ICA_V2_PARAMETERS.prospettivaWeights.gerarchie },
  ])
}

function correctedRate(row: FldaRecord, key: keyof typeof fantasyKeys, denominator: 'minutes' | 'appearances'): number | undefined {
  const value = field(row, fantasyKeys[key]); const divisor = field(row, fantasyKeys[denominator])
  const appearances = field(row, fantasyKeys.appearances)
  if (!finite(value) || !finite(divisor) || divisor <= 0) return undefined
  return (value / divisor) * (denominator === 'minutes' ? 90 : 1) * sampleReliability(appearances)
}

function eventRate(row: FldaRecord, event: ICaEvent): number | undefined {
  if (event === 'goal') return correctedRate(row, 'goals', 'minutes')
  if (event === 'assist') return correctedRate(row, 'assists', 'minutes')
  if (event === 'cleanSheet') return correctedRate(row, 'cleanSheets', 'appearances')
  if (event === 'yellow') return correctedRate(row, 'yellow', 'appearances')
  if (event === 'red') return correctedRate(row, 'red', 'appearances')
  if (event === 'missedPenalty') return correctedRate(row, 'missedPenalty', 'appearances')
  if (event === 'goalsConceded') return correctedRate(row, 'goalsConceded', 'appearances')
  return correctedRate(row, 'penaltiesSaved', 'appearances')
}

export function buildICaReferences(inputs: ICaV2Input[]): ICaReferences {
  const positive: ICaReferences['positive'] = {}; const negative: ICaReferences['negative'] = {}
  for (const role of ['P', 'D', 'C', 'A'] as ICaRole[]) {
    positive[role] = {}; negative[role] = {}
    for (const event of ['goal', 'assist', 'cleanSheet', 'penaltiesSaved'] as ICaEvent[]) {
      positive[role]![event] = percentile95(inputs.filter((item) => roleOf(item.player) === role)
        .flatMap((item) => (item.history ?? []).slice(0, 3).map((row) => eventRate(row, event)).filter(finite)))
    }
    for (const event of ['yellow', 'red', 'missedPenalty', 'goalsConceded'] as ICaEvent[]) {
      negative[role]![event] = percentile95(inputs.filter((item) => roleOf(item.player) === role)
        .flatMap((item) => (item.history ?? []).slice(0, 3).map((row) => eventRate(row, event)).filter(finite)))
    }
  }
  return { positive, negative }
}

function eventScore(rate: number | undefined, reference: number | undefined): number | undefined {
  if (!finite(rate) || !finite(reference)) return undefined
  if (reference <= 0) return rate === 0 ? 0 : undefined
  return clamp(100 * rate / reference)
}

function expectedCorrection(row: FldaRecord, actualKey: 'goals' | 'assists', expectedKey: 'xg' | 'xa'): number {
  const actual = field(row, fantasyKeys[actualKey]); const expected = field(row, fantasyKeys[expectedKey])
  const appearances = field(row, fantasyKeys.appearances)
  if (!finite(actual) || !finite(expected)) return 0
  const scale = Math.max(1, actual, expected)
  return clamp((actual - expected) / scale / ICA_V2_PARAMETERS.expectedCorrection.scale, -1, 1)
    * ICA_V2_PARAMETERS.expectedCorrection.maximumPoints * sampleReliability(appearances)
}

function bonusScore(role: ICaRole, row: FldaRecord, references: ICaReferences): number | undefined {
  const weights = ICA_V2_PARAMETERS.eventWeights[role]
  return weighted(Object.entries(weights).map(([event, weight]) => {
    let score = eventScore(eventRate(row, event as ICaEvent), references.positive[role]?.[event as ICaEvent])
    if (finite(score) && event === 'goal') score = clamp(score + expectedCorrection(row, 'goals', 'xg'))
    if (finite(score) && event === 'assist') score = clamp(score + expectedCorrection(row, 'assists', 'xa'))
    if (role === 'P' && event === 'penaltiesSaved' && eventRate(row, 'penaltiesSaved') === 0) score = 50
    return { value: score, weight }
  }))
}

function malusScore(role: ICaRole, row: FldaRecord, references: ICaReferences): number | undefined {
  if (role === 'P') {
    const penalty = eventScore(eventRate(row, 'goalsConceded'), references.negative.P?.goalsConceded)
    return finite(penalty) ? 100 - penalty : undefined
  }
  const penalty = weighted((['yellow', 'red', 'missedPenalty'] as ICaEvent[]).map((event) => ({
    value: eventScore(eventRate(row, event), references.negative[role]?.[event]),
    weight: ICA_V2_PARAMETERS.malusWeights[event as keyof typeof ICA_V2_PARAMETERS.malusWeights],
  })))
  return finite(penalty) ? clamp(100 - penalty) : undefined
}

export function mvScore(role: ICaRole, value: unknown): number | undefined {
  if (!finite(value)) return undefined
  const scale = ICA_V2_PARAMETERS.mvScales[role]
  return clamp(100 * (value - scale.min) / (scale.max - scale.min))
}

export function availabilityScore(row: FldaRecord): number | undefined {
  const minutes = field(row, fantasyKeys.minutes); const appearances = field(row, fantasyKeys.appearances)
  if (!finite(minutes) || !finite(appearances) || appearances <= 0) return undefined
  const perAppearance = minutes / appearances
  const { nearFullMinutes, fullMinutes, exponent } = ICA_V2_PARAMETERS.availability
  if (perAppearance >= fullMinutes) return 100
  return clamp(90 * Math.pow(perAppearance / nearFullMinutes, exponent))
}

export function absenceScore(row: FldaRecord): number | undefined {
  const missed = field(row, fantasyKeys.injuryGamesMissed)
  if (!finite(missed)) return undefined
  const { softGames, fullPenaltyGames, exponent } = ICA_V2_PARAMETERS.absence
  const normalized = clamp((missed - softGames) / (fullPenaltyGames - softGames), 0, 1)
  return clamp(100 - 100 * Math.pow(normalized, exponent))
}

function seasonScore(role: ICaRole, row: FldaRecord, references: ICaReferences): number | undefined {
  const weights = ICA_V2_PARAMETERS.seasonWeights
  return weighted([
    { value: bonusScore(role, row, references), weight: weights.bonus },
    { value: malusScore(role, row, references), weight: weights.malus },
    { value: mvScore(role, field(row, fantasyKeys.mv)), weight: weights.mv },
    { value: availabilityScore(row), weight: weights.disponibilita },
    { value: absenceScore(row), weight: weights.assenze },
  ])
}

export function historyScore(input: ICaV2Input, references: ICaReferences): number | undefined {
  const role = roleOf(input.player)
  if (!role) return undefined
  return weighted((input.history ?? []).slice(0, 3).map((row, index) => ({
    value: seasonScore(role, row, references), weight: ICA_V2_PARAMETERS.historyWeights[index]!,
  })))
}

export function calculateICaV2(input: ICaV2Input, references?: ICaReferences): ICaV2Result {
  // Senza un campione di ruolo non fabbrichiamo una reference dal singolo
  // giocatore: le componenti percentile restano escluse e vengono rinormalizzate.
  const effectiveReferences = references ?? { positive: {}, negative: {} }
  const prospettiva = perspectiveScore(input.player)
  const storico = historyScore(input, effectiveReferences)
  const base = weighted([
    { value: prospettiva, weight: ICA_V2_PARAMETERS.baseWeights.prospettiva },
    { value: storico, weight: ICA_V2_PARAMETERS.baseWeights.storico },
  ])
  if (!finite(base)) return { prospettiva, storico }
  let multiplier = 1
  if (input.valorizzato) multiplier *= ICA_V2_PARAMETERS.editorial.valorizzato
  if (input.penalizzato) multiplier *= ICA_V2_PARAMETERS.editorial.penalizzato
  if (input.ruoloChiave) multiplier *= ICA_V2_PARAMETERS.editorial.ruoloChiave
  if (input.ballottaggio) multiplier *= ICA_V2_PARAMETERS.editorial.ballottaggio
  return { score: Math.round(clamp(base * multiplier) * 100) / 100, prospettiva, storico }
}

function trueFlag(record: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => record[key] === true || record[key] === 1)
}

export function calculateFldaICaV2(player: FldaPlayer, detail?: FldaPlayerDetail): ICaV2Result {
  return calculateICaV2(buildFldaICaV2Input(player, detail?.history))
}

export function buildFldaICaV2Input(
  player: FldaPlayer,
  history?: FldaRecord[],
): ICaV2Input {
  return {
    player,
    history,
    valorizzato: trueFlag(player, ['valorizzato']),
    penalizzato: trueFlag(player, ['penalizzato', 'sfavorito']),
    ruoloChiave: trueFlag(player, ['ruolo_chiave']),
    ballottaggio: trueFlag(player, ['ballottaggio']),
  }
}
