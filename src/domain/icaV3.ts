/*
 * ==========================================================
 * iCà 3 — valore fantacalcistico atteso
 * ==========================================================
 *
 * Domanda: quanti fantapunti mi aspetto da questo giocatore nel resto
 * della stagione, rispetto agli altri del suo ruolo?
 * Il prezzo NON entra: è misurato a parte dall'indice "Affare".
 * Il calendario NON entra: l'iCà guarda alla stagione, non alle prossime 5.
 *
 * 1. FM attesa = media pesata di stagione corrente (peso 1 per presenza),
 *    stagione scorsa (peso 0,5 per presenza, max 20) e media del ruolo
 *    (peso pari a 8 partite: frena i giudizi su pochi dati).
 * 2. Correttivi in punti di FM: piazzati, indice squadra, allenatore.
 * 3. Presenze attese = titolarità Guida, ridotta dagli infortuni.
 * 4. Valore = presenze attese × (FM corretta − FM di rimpiazzo del ruolo).
 * 5. iCà 3 = valore in scala 0-100 dentro il ruolo (dal 5° percentile al migliore).
 * 6. Affare = percentile iCà 3 − percentile PMA, dentro il ruolo.
 *
 * Tutti i numeri sono parametri configurabili, non invarianti.
 */

export type ICaV3Role = 'P' | 'D' | 'C' | 'A'

export const ICA_V3_PARAMETERS = {
  priorMatches: 8,
  previousSeasonWeight: 0.5,
  previousSeasonMaxMatches: 20,
  // percentile della FM di ruolo usato come "rimpiazzo"
  replacementPercentile: 0.25,
  scaleLow: 0.05,
  scaleHigh: 1,
  setPieces: {
    penalty: { 1: 0.25, 2: 0.1 } as Record<number, number>,
    freeKick: { 1: 0.08 } as Record<number, number>,
    corner: { 1: 0.04 } as Record<number, number>,
  },
  // punti FM per ogni punto di indice squadra sopra/sotto 3 (scala 1-5)
  teamIndex: { neutral: 3, perPoint: 0.08, perPointGoalkeeper: 0.15 },
  coach: { good: 0.1, bad: -0.1 },
  injury: { maxReduction: 0.3 },
}

export interface ICaV3Input {
  id: string
  name: string
  team: string
  role: ICaV3Role
  /** stagione in corso */
  fm?: number
  appearances?: number
  /** stagione precedente (vecchio listone) */
  previousFm?: number
  previousAppearances?: number
  /** titolarità Guida 0-100 */
  titolarita?: number
  injuryGamesMissed?: number
  penaltyRank?: number
  freeKickRank?: number
  cornerRank?: number
  /** indice squadra 1-5: attacco per C/A, difesa per P/D */
  teamIndex?: number
  coachTone?: 'good' | 'bad' | 'neutral'
  /** PMA in % del budget, solo per l'indice Affare */
  pmaPercent?: number
}

export interface ICaV3Contribution {
  label: string
  /** effetto in punti di FM (correttivi) o descrizione */
  value: number
  unit: 'fm' | 'share'
}

export interface ICaV3Result {
  id: string
  score?: number
  /** percentile iCà 3 − percentile PMA (−100…+100) */
  affare?: number
  expectedFm?: number
  adjustedFm?: number
  expectedShare?: number
  value?: number
  replacementFm?: number
  contributions: ICaV3Contribution[]
  missing: string[]
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function quantile(sorted: number[], q: number): number | undefined {
  if (!sorted.length) return undefined
  const position = (sorted.length - 1) * q
  const low = Math.floor(position)
  const high = Math.ceil(position)
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low)
}

function percentileRank(sorted: number[], value: number): number {
  if (sorted.length <= 1) return 50
  const below = sorted.filter((item) => item < value).length
  const equal = sorted.filter((item) => item === value).length
  return ((below + (equal - 1) / 2) / (sorted.length - 1)) * 100
}

function roleMeanFm(inputs: ICaV3Input[]): number | undefined {
  const values = inputs.filter((input) => finite(input.fm) && (input.appearances ?? 0) >= 3).map((input) => input.fm as number)
  if (!values.length) return undefined
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function expectedFm(input: ICaV3Input, prior: number | undefined): number | undefined {
  const p = ICA_V3_PARAMETERS
  let weight = 0
  let total = 0
  if (finite(input.fm) && finite(input.appearances) && input.appearances > 0) {
    weight += input.appearances
    total += input.fm * input.appearances
  }
  if (finite(input.previousFm) && finite(input.previousAppearances) && input.previousAppearances > 0) {
    const w = Math.min(input.previousAppearances, p.previousSeasonMaxMatches) * p.previousSeasonWeight
    weight += w
    total += input.previousFm * w
  }
  if (weight === 0) return undefined
  if (finite(prior)) {
    weight += p.priorMatches
    total += prior * p.priorMatches
  }
  return total / weight
}

export function fmAdjustments(input: ICaV3Input): ICaV3Contribution[] {
  const p = ICA_V3_PARAMETERS
  const items: ICaV3Contribution[] = []
  const rank = (label: string, table: Record<number, number>, value?: number) => {
    if (finite(value) && table[value]) items.push({ label: `${label} n.${value}`, value: table[value], unit: 'fm' })
  }
  rank('Rigorista', p.setPieces.penalty, input.penaltyRank)
  rank('Punizioni', p.setPieces.freeKick, input.freeKickRank)
  rank('Angoli', p.setPieces.corner, input.cornerRank)
  if (finite(input.teamIndex)) {
    const perPoint = input.role === 'P' ? p.teamIndex.perPointGoalkeeper : p.teamIndex.perPoint
    const delta = (input.teamIndex - p.teamIndex.neutral) * perPoint
    if (delta !== 0) {
      const kind = input.role === 'P' || input.role === 'D' ? 'difesa' : 'attacco'
      items.push({ label: `Squadra in ${kind} ${input.teamIndex}/5`, value: delta, unit: 'fm' })
    }
  }
  if (input.coachTone === 'good') items.push({ label: 'Ruolo valorizzato dall\'allenatore', value: p.coach.good, unit: 'fm' })
  if (input.coachTone === 'bad') items.push({ label: 'Ruolo penalizzato dall\'allenatore', value: p.coach.bad, unit: 'fm' })
  return items
}

export function expectedShare(input: ICaV3Input): number | undefined {
  if (!finite(input.titolarita)) return undefined
  const base = Math.max(0, Math.min(100, input.titolarita)) / 100
  const played = Math.max(input.appearances ?? 0, 1)
  const missed = input.injuryGamesMissed ?? 0
  const reduction = missed > 0
    ? Math.min(ICA_V3_PARAMETERS.injury.maxReduction, missed / (played + missed))
    : 0
  return base * (1 - reduction)
}

/** Calcola iCà 3 e Affare per un insieme di giocatori (confronti dentro il ruolo). */
export function calculateICaV3(inputs: ICaV3Input[]): Map<string, ICaV3Result> {
  const p = ICA_V3_PARAMETERS
  const results = new Map<string, ICaV3Result>()
  const roles: ICaV3Role[] = ['P', 'D', 'C', 'A']

  for (const role of roles) {
    const group = inputs.filter((input) => input.role === role)
    const prior = roleMeanFm(group)
    const fmValues = group.filter((input) => finite(input.fm) && (input.appearances ?? 0) >= 3)
      .map((input) => input.fm as number).sort((a, b) => a - b)
    const replacement = quantile(fmValues, p.replacementPercentile)

    const partial = group.map((input) => {
      const missing: string[] = []
      const fm = expectedFm(input, prior)
      if (!finite(fm)) missing.push('fantamedia')
      const adjustments = fmAdjustments(input)
      const adjustedFm = finite(fm) ? fm + adjustments.reduce((sum, item) => sum + item.value, 0) : undefined
      const share = expectedShare(input)
      if (!finite(share)) missing.push('titolarità')
      const value = finite(adjustedFm) && finite(share) && finite(replacement)
        ? share * (adjustedFm - replacement)
        : undefined
      return { input, fm, adjustedFm, share, value, adjustments, missing }
    })

    const values = partial.flatMap((item) => finite(item.value) ? [item.value] : []).sort((a, b) => a - b)
    const low = quantile(values, p.scaleLow)
    const high = quantile(values, p.scaleHigh)
    const scored = partial.map((item) => {
      const score = finite(item.value) && finite(low) && finite(high) && high > low
        ? Math.max(0, Math.min(100, ((item.value - low) / (high - low)) * 100))
        : undefined
      return { ...item, score }
    })

    const scores = scored.flatMap((item) => finite(item.score) ? [item.score] : []).sort((a, b) => a - b)
    const pmas = scored.flatMap((item) => finite(item.input.pmaPercent) ? [item.input.pmaPercent] : []).sort((a, b) => a - b)

    for (const item of scored) {
      const affare = finite(item.score) && finite(item.input.pmaPercent) && scores.length > 1 && pmas.length > 1
        ? percentileRank(scores, item.score) - percentileRank(pmas, item.input.pmaPercent)
        : undefined
      results.set(item.input.id, {
        id: item.input.id,
        score: item.score,
        affare,
        expectedFm: item.fm,
        adjustedFm: item.adjustedFm,
        expectedShare: item.share,
        value: item.value,
        replacementFm: replacement,
        contributions: item.adjustments,
        missing: item.missing,
      })
    }
  }
  return results
}
