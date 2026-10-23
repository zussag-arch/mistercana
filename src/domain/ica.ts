/*
 * ==========================================================
 * iCà — valore fantacalcistico atteso
 * ==========================================================
 *
 * Come è costruito, e perché (prove sui dati: stagioni passate e confronto con Algo):
 *
 * 1. Fantamedia attesa su più stagioni (in corso 1 per presenza, scorsa 0,75, due anni fa 0,5),
 *    frenata dalla media del ruolo con peso pari a 24 partite: da un anno all'altro la fantamedia
 *    cambia molto, e la frenata forte è quella che sbaglia meno.
 * 2. Correttivi tarati su quanto valgono davvero (es. rigorista n.1 ≈ +0,35 di FM, non +1,25)
 *    e con un tetto complessivo (prima pesavano il doppio della fantamedia stessa).
 * 3. Presenze attese continue, non a gradini: titolarità Guida + presenze e minuti della stagione
 *    + presenze della stagione scorsa, poi gli infortuni con il rientro previsto. Un dato da solo
 *    (es. titolarità 1% vecchia) non azzera più un giocatore.
 * 4. Due numeri: qualità (fantapunti a partita giocata ×10) e rendimento (qualità × presenze
 *    attese): l'iCà mostrato è la qualità, il rendimento ordina il ruolo.
 *
 * Tutti i numeri sono parametri, verificabili con la prova a posteriori.
 */
export type ICaRole = 'P' | 'D' | 'C' | 'A'

/*
 * Giudizio dell'allenatore sul ruolo del giocatore: i ruoli Mantra del
 * giocatore vengono tradotti nei ruoli tattici dei "ruoli chiave" della Guida.
 * Valorizzato e penalizzato insieme = neutro.
 */
export interface ICaCoachRole {
  role: string
  tone: 'good' | 'bad' | string
}

const MANTRA_TO_COACH_ROLES: Record<string, readonly string[]> = {
  Por: ['gk'],
  Dc: ['def-center'],
  Dd: ['def-fullbacks'],
  Ds: ['def-fullbacks'],
  E: ['def-halfbacks', 'mid-wide'],
  M: ['mid-holding'],
  C: ['mid-center'],
  T: ['treq-center'],
  W: ['treq-wings', 'att-wings'],
  A: ['att-wings'],
  Pc: ['att-center'],
}

export function coachRoleTone(
  mantraRoles: readonly string[] | null | undefined,
  coachRoles: readonly ICaCoachRole[] = [],
): 'good' | 'bad' | 'neutral' {
  const relevant = new Set((mantraRoles ?? []).flatMap((role) => MANTRA_TO_COACH_ROLES[role] ?? []))
  const tones = coachRoles.filter((item) => relevant.has(item.role)).map((item) => item.tone)
  const good = tones.includes('good')
  const bad = tones.includes('bad')
  return good && !bad ? 'good' : bad && !good ? 'bad' : 'neutral'
}


export interface ICaBaseInput {
  id: string
  name: string
  team: string
  role: ICaRole
  /** stagione in corso */
  fm?: number
  appearances?: number
  /** stagione precedente (vecchio listone) */
  previousFm?: number
  previousAppearances?: number
  /** fantamedia attesa di FantaLab: usata solo se mancano entrambe le stagioni */
  fantalabXfm?: number
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


export const ICA_PARAMETERS = {
  displayScale: 10,
  fm: {
    currentWeight: 1,
    seasonDecay: [0.75, 0.5],
    maxMatchesPerSeason: 38,
    priorMatches: 24,
  },
  adjustments: {
    penalty: { 1: 0.35, 2: 0.1 } as Record<number, number>,
    freeKick: { 1: 0.05 } as Record<number, number>,
    corner: { 1: 0.03 } as Record<number, number>,
    teamIndexPerPoint: 0.08,
    teamIndexPerPointGoalkeeper: 0.12,
    coachRole: 0.05,
    coachPlayer: 0.08,
    calendar: { P: 0.25, D: 0.15, C: 0.1, A: 0.12 } as Record<ICaRole, number>,
    /** somma massima dei correttivi, in punti di FM */
    cap: 0.6,
  },
  share: {
    /** peso della titolarità Guida, espresso in partite */
    guideMatches: 10,
    /** peso della stagione scorsa, in partite */
    previousMatches: 6,
    /** senza alcun dato */
    fallback: 0.3,
    floor: 0.02,
  },
  seasonMatches: 38,
  /** stagione fuori dalla Serie A (solo per chi non ne ha in A): tarata su 59 arrivi del 2025/26 */
  foreign: {
    /** punti di FM per ogni punto di bonus a partita (3 × gol + assist) sopra 0,15 */
    bonusWeight: 0.4,
    bonusNeutral: 0.15,
    /** seconde leghe e campionati medi (Serie B, Championship, Eredivisie…) rendono meno in A */
    tierPenalty: [0, 0.3, 0.3] as number[],
    /** la stagione estera conta la metà di una stagione di Serie A */
    weight: 0.5,
  },
}

export interface ICaSeason {
  season: string
  fm?: number
  appearances?: number
}

export interface ICaForeignSeason {
  season: string
  league: string
  appearances: number
  /** (3 × gol + assist) a partita */
  bonusPerMatch: number
  /** 0 = top 5 europei, 1 = seconde leghe / campionati medi, 2 = minori */
  tier: number
}

export interface ICaInput extends ICaBaseInput {
  /** ultima stagione fuori dalla Serie A, usata solo se manca ogni stagione di Serie A */
  foreignSeason?: ICaForeignSeason
  /** stagioni precedenti, dalla più recente */
  pastSeasons: ICaSeason[]
  /** stagione in corso */
  minutes?: number
  starts?: number
  /** giornate già giocate dalla squadra */
  teamMatches?: number
  /** giornata attuale e giornata di rientro, se infortunato o indisponibile */
  currentMatchday?: number
  returnMatchday?: number
  out?: boolean
}

export interface ICaStep { label: string; value: number }

export interface ICaRawResult {
  id: string
  /** rendimento: fantapunti attesi a partita della squadra ×10 */
  score?: number
  /** qualità: fantapunti attesi quando gioca ×10 */
  quality?: number
  rolePercentile?: number
  affare?: number
  expectedFm?: number
  adjustedFm?: number
  expectedShare?: number
  contributions: ICaStep[]
  shareParts: ICaStep[]
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const validFm = (value: unknown): value is number => finite(value) && value > 0
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function percentileRank(sorted: number[], value: number): number {
  if (sorted.length <= 1) return 50
  const below = sorted.filter((item) => item < value).length
  const equal = sorted.filter((item) => item === value).length
  return ((below + (equal - 1) / 2) / (sorted.length - 1)) * 100
}

export function expectedFm(input: ICaInput, prior: number | undefined): number | undefined {
  const p = ICA_PARAMETERS.fm
  let weight = 0
  let total = 0
  if (validFm(input.fm) && finite(input.appearances) && input.appearances > 0) {
    weight += input.appearances * p.currentWeight
    total += input.fm * input.appearances * p.currentWeight
  }
  input.pastSeasons.slice(0, p.seasonDecay.length).forEach((season, index) => {
    if (!validFm(season.fm) || !finite(season.appearances) || season.appearances <= 0) return
    const w = Math.min(season.appearances, p.maxMatchesPerSeason) * p.seasonDecay[index]
    weight += w
    total += season.fm * w
  })
  // nessuna stagione di Serie A ma una stagione piena altrove: fantamedia equivalente stimata
  const hasSerieAHistory = input.pastSeasons.some((season) => validFm(season.fm) && (season.appearances ?? 0) > 0)
  if (!hasSerieAHistory && input.foreignSeason && finite(prior)) {
    const f = ICA_PARAMETERS.foreign
    const season = input.foreignSeason
    const estimate = prior + f.bonusWeight * (season.bonusPerMatch - f.bonusNeutral) - (f.tierPenalty[season.tier] ?? 0)
    const w = Math.min(season.appearances, p.maxMatchesPerSeason) * f.weight
    weight += w
    total += estimate * w
  }
  if (weight === 0) {
    if (validFm(input.fantalabXfm) && finite(prior)) return (input.fantalabXfm * 4 + prior * p.priorMatches) / (4 + p.priorMatches)
    if (validFm(input.fantalabXfm)) return input.fantalabXfm
    return finite(prior) ? prior * 0.97 : undefined
  }
  if (finite(prior)) {
    weight += p.priorMatches
    total += prior * p.priorMatches
  }
  return total / weight
}

export function adjustments(input: ICaInput): ICaStep[] {
  const a = ICA_PARAMETERS.adjustments
  const items: ICaStep[] = []
  const rank = (label: string, table: Record<number, number>, value?: number) => {
    if (finite(value) && table[value]) items.push({ label: `${label} n.${value}`, value: table[value] })
  }
  rank('Rigorista', a.penalty, input.penaltyRank)
  rank('Punizioni', a.freeKick, input.freeKickRank)
  rank('Angoli', a.corner, input.cornerRank)
  if (finite(input.teamIndex)) {
    const perPoint = input.role === 'P' ? a.teamIndexPerPointGoalkeeper : a.teamIndexPerPoint
    const delta = (input.teamIndex - 3) * perPoint
    if (delta) items.push({ label: `Squadra in ${input.role === 'P' || input.role === 'D' ? 'difesa' : 'attacco'} ${input.teamIndex}/5`, value: delta })
  }
  if (input.coachTone === 'good') items.push({ label: 'Ruolo valorizzato dall\'allenatore', value: a.coachRole })
  if (input.coachTone === 'bad') items.push({ label: 'Ruolo penalizzato dall\'allenatore', value: -a.coachRole })
  if (input.coachPlayerTone === 'good') items.push({ label: 'Valorizzato dall\'allenatore', value: a.coachPlayer })
  if (input.coachPlayerTone === 'bad') items.push({ label: 'Penalizzato dall\'allenatore', value: -a.coachPlayer })
  if (finite(input.easeIndex)) {
    const delta = clamp(input.easeIndex, -1, 1) * a.calendar[input.role]
    if (Math.abs(delta) >= 0.005) items.push({ label: `Partite ${delta > 0 ? 'favorevoli' : 'sfavorevoli'}`, value: delta })
  }
  // tetto complessivo: i correttivi non possono valere più di ±cap punti di FM
  const sum = items.reduce((total, item) => total + item.value, 0)
  if (Math.abs(sum) > a.cap) {
    const factor = a.cap / Math.abs(sum)
    return [...items.map((item) => ({ ...item, value: item.value * factor })), { label: `Correttivi limitati a ±${a.cap.toFixed(1).replace('.', ',')}`, value: 0 }]
  }
  return items
}

/** presenze attese 0-1 sul resto della stagione, con le parti che le compongono */
export function expectedShare(input: ICaInput): { share: number; parts: ICaStep[] } {
  const s = ICA_PARAMETERS.share
  const parts: ICaStep[] = []
  let weight = 0
  let total = 0
  if (finite(input.titolarita)) {
    const value = clamp(input.titolarita / 100, 0, 1)
    weight += s.guideMatches; total += value * s.guideMatches
    parts.push({ label: 'Titolarità Guida', value })
  }
  const matches = input.teamMatches ?? 0
  if (matches > 0 && finite(input.appearances)) {
    const played = clamp(input.appearances / matches, 0, 1)
    const minutes = finite(input.minutes) ? clamp(input.minutes / (85 * matches), 0, 1) : played
    const value = (played + minutes) / 2
    weight += matches; total += value * matches
    parts.push({ label: `Stagione in corso (${input.appearances}/${matches} partite)`, value })
  }
  const last = input.pastSeasons[0]
  if (last && finite(last.appearances)) {
    const value = clamp(last.appearances / ICA_PARAMETERS.seasonMatches, 0, 1)
    weight += s.previousMatches; total += value * s.previousMatches
    parts.push({ label: `Stagione ${last.season} (${last.appearances} presenze)`, value })
  }
  const foreign = input.foreignSeason
  if (!last && foreign) {
    const value = clamp(foreign.appearances / 34, 0, 1)
    weight += s.previousMatches * 0.5; total += value * s.previousMatches * 0.5
    parts.push({ label: `${foreign.league} ${foreign.season} (${foreign.appearances} presenze)`, value })
  }
  let share = weight > 0 ? total / weight : s.fallback
  // infortunio / indisponibilità: tolte le giornate fino al rientro previsto
  if (input.out && finite(input.currentMatchday)) {
    const remaining = Math.max(1, ICA_PARAMETERS.seasonMatches - input.currentMatchday + 1)
    const missed = finite(input.returnMatchday) ? clamp(input.returnMatchday - input.currentMatchday, 1, remaining) : 1
    share *= 1 - missed / remaining
    parts.push({ label: `Fuori per ${missed} ${missed === 1 ? 'giornata' : 'giornate'}`, value: -missed / remaining })
  }
  return { share: Math.max(s.floor, share), parts }
}

export function calculateICa(inputs: ICaInput[]): Map<string, ICaRawResult> {
  const results = new Map<string, ICaRawResult>()
  for (const role of ['P', 'D', 'C', 'A'] as ICaRole[]) {
    const group = inputs.filter((input) => input.role === role)
    const voted = group.filter((input) => validFm(input.fm) && (input.appearances ?? 0) >= 3)
    const prior = voted.length ? voted.reduce((sum, input) => sum + (input.fm as number), 0) / voted.length : undefined
    const partial = group.map((input) => {
      const fm = expectedFm(input, prior)
      const contributions = adjustments(input)
      const adjustedFm = finite(fm) ? fm + contributions.reduce((sum, item) => sum + item.value, 0) : undefined
      const { share, parts } = expectedShare(input)
      const quality = finite(adjustedFm) ? adjustedFm * ICA_PARAMETERS.displayScale : undefined
      const score = finite(quality) ? quality * share : undefined
      return { input, fm, adjustedFm, share, parts, contributions, quality, score }
    })
    const scores = partial.flatMap((item) => finite(item.score) ? [item.score] : []).sort((a, b) => a - b)
    const pmas = partial.flatMap((item) => finite(item.input.pmaPercent) ? [item.input.pmaPercent] : []).sort((a, b) => a - b)
    for (const item of partial) {
      const rolePercentile = finite(item.score) && scores.length > 1 ? percentileRank(scores, item.score) : undefined
      results.set(item.input.id, {
        id: item.input.id,
        score: item.score,
        quality: item.quality,
        rolePercentile,
        affare: finite(rolePercentile) && finite(item.input.pmaPercent) && pmas.length > 1 ? rolePercentile - percentileRank(pmas, item.input.pmaPercent) : undefined,
        expectedFm: item.fm,
        adjustedFm: item.adjustedFm,
        expectedShare: item.share,
        contributions: item.contributions,
        shareParts: item.parts,
      })
    }
  }
  return results
}

/** Risultato usato da tutta l'app (pagine, Asta, consigli) */
export interface ICaResult {
  id: string
  /** iCà: fantamedia attesa corretta ×10 */
  score?: number
  /** posizione nel ruolo 0-100, dal rendimento */
  rolePercentile?: number
  /** posizione per rendimento − posizione per PMA */
  affare?: number
  expectedFm?: number
  adjustedFm?: number
  expectedShare?: number
  contributions: ICaStep[]
  missing: string[]
  /** rendimento = iCà × presenze attese */
  yieldScore?: number
  shareParts: ICaStep[]
}
