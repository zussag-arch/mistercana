/*
 * ==========================================================
 * iCà 3 — valore fantacalcistico atteso
 * ==========================================================
 *
 * Domanda: quanti fantapunti mi aspetto da questo giocatore nel resto
 * della stagione, rispetto agli altri del suo ruolo?
 * Il prezzo NON entra: è misurato a parte dall'indice "Affare".
 * La facilità delle partite entra dalle griglie abbinamenti (portieri per P/D,
 * attaccanti per C/A): media della riga della squadra, scalata fra −1 e +1.
 *
 * 1. FM attesa = media pesata di stagione corrente (peso 1 per presenza),
 *    stagione scorsa (peso 0,5 per presenza, max 20) e media del ruolo
 *    (peso pari a 8 partite: frena i giudizi su pochi dati).
 * 2. Correttivi in punti di FM: piazzati, indice squadra, allenatore,
 *    facilità partite dalle griglie abbinamenti.
 * 3. Presenze attese = titolarità Guida, ridotta dagli infortuni.
 * 4. iCà = fantapunti attesi a partita × 100 = FM corretta × presenze attese × 100.
 *    È un valore assoluto: il migliore non vale 100, vale quello che rende.
 * 5. Posizione nel ruolo (0-100) = percentile dell'iCà fra i pari ruolo:
 *    serve agli algoritmi (qualità 0-1) e all'indice Affare.
 * 6. Affare = posizione nel ruolo per iCà − posizione nel ruolo per PMA.
 *
 * Tutti i numeri sono parametri configurabili, non invarianti.
 */

export type ICaV3Role = 'P' | 'D' | 'C' | 'A'

export const ICA_V3_PARAMETERS = {
  // l'iCà è espresso in centesimi di fantapunto a partita
  displayScale: 100,
  priorMatches: 8,
  previousSeasonWeight: 0.5,
  previousSeasonMaxMatches: 20,
  setPieces: {
    penalty: { 1: 0.25, 2: 0.1 } as Record<number, number>,
    freeKick: { 1: 0.08 } as Record<number, number>,
    corner: { 1: 0.04 } as Record<number, number>,
  },
  // punti FM per ogni punto di indice squadra sopra/sotto 3 (scala 1-5)
  teamIndex: { neutral: 3, perPoint: 0.08, perPointGoalkeeper: 0.15 },
  // giudizio dell'allenatore sul ruolo del giocatore (ruoli chiave)
  coach: { good: 0.1, bad: -0.1 },
  // giocatore citato per nome dalla Guida tra valorizzati / penalizzati
  coachPlayer: { good: 0.15, bad: -0.15 },
  injury: { maxReduction: 0.3 },
  // facilità partite: punti FM per la squadra più favorita (+1) o più
  // sfavorita (−1) nella griglia del ruolo, rispetto alla media (0).
  calendar: { P: 0.6, D: 0.4, C: 0.25, A: 0.3 } as Record<ICaV3Role, number>,
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
  /** valorizzato / penalizzato per nome dall'allenatore */
  coachPlayerTone?: 'good' | 'bad'
  /** facilità partite da griglia abbinamenti, −1 … +1 (0 = media) */
  easeIndex?: number
  /** valore medio della squadra nella griglia, per la spiegazione */
  easeGridValue?: number
  easeGridName?: string
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
  /** fantapunti attesi a partita */
  score?: number
  /** percentile dell'iCà nel ruolo, 0-100 */
  rolePercentile?: number
  /** percentile iCà 3 − percentile PMA (−100…+100) */
  affare?: number
  expectedFm?: number
  adjustedFm?: number
  expectedShare?: number
  contributions: ICaV3Contribution[]
  missing: string[]
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
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
  if (input.coachPlayerTone === 'good') items.push({ label: 'Valorizzato dall\'allenatore', value: p.coachPlayer.good, unit: 'fm' })
  if (input.coachPlayerTone === 'bad') items.push({ label: 'Penalizzato dall\'allenatore', value: p.coachPlayer.bad, unit: 'fm' })
  if (finite(input.easeIndex)) {
    const delta = Math.max(-1, Math.min(1, input.easeIndex)) * p.calendar[input.role]
    if (Math.abs(delta) >= 0.005) {
      const grid = input.easeGridName ? `griglia ${input.easeGridName}` : 'griglia'
      const mean = finite(input.easeGridValue) ? ` (media ${input.easeGridValue.toFixed(1).replace('.', ',')})` : ''
      items.push({ label: `Partite ${delta > 0 ? 'favorevoli' : 'sfavorevoli'}: ${grid}${mean}`, value: delta, unit: 'fm' })
    }
  }
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
  const results = new Map<string, ICaV3Result>()
  const roles: ICaV3Role[] = ['P', 'D', 'C', 'A']

  for (const role of roles) {
    const group = inputs.filter((input) => input.role === role)
    const prior = roleMeanFm(group)
    const partial = group.map((input) => {
      const missing: string[] = []
      const fm = expectedFm(input, prior)
      if (!finite(fm)) missing.push('fantamedia')
      const adjustments = fmAdjustments(input)
      const adjustedFm = finite(fm) ? fm + adjustments.reduce((sum, item) => sum + item.value, 0) : undefined
      const share = expectedShare(input)
      if (!finite(share)) missing.push('titolarità')
      // ×100 per leggerlo come numero intero (7,39 fantapunti → 739)
      const score = finite(adjustedFm) && finite(share) ? adjustedFm * share * ICA_V3_PARAMETERS.displayScale : undefined
      return { input, fm, adjustedFm, share, score, adjustments, missing }
    })

    const scores = partial.flatMap((item) => finite(item.score) ? [item.score] : []).sort((a, b) => a - b)
    const pmas = partial.flatMap((item) => finite(item.input.pmaPercent) ? [item.input.pmaPercent] : []).sort((a, b) => a - b)

    for (const item of partial) {
      const rolePercentile = finite(item.score) && scores.length > 1 ? percentileRank(scores, item.score) : undefined
      const affare = finite(rolePercentile) && finite(item.input.pmaPercent) && pmas.length > 1
        ? rolePercentile - percentileRank(pmas, item.input.pmaPercent)
        : undefined
      results.set(item.input.id, {
        id: item.input.id,
        score: item.score,
        rolePercentile,
        affare,
        expectedFm: item.fm,
        adjustedFm: item.adjustedFm,
        expectedShare: item.share,
        contributions: item.adjustments,
        missing: item.missing,
      })
    }
  }
  return results
}
