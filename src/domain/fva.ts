/*
 * ==========================================================
 * FVA — fantavoto atteso nella prossima partita, SE GIOCA
 * ==========================================================
 *
 * Si costruisce come un fantavoto vero, sommando voto e bonus/malus attesi:
 *   movimento:  voto atteso + 3 × gol attesi + 1 × assist attesi − 0,5 × P(giallo) − 1 × P(rosso)
 *   portiere:   voto atteso − gol subiti attesi
 * Gol, assist e cartellini si contano per 90 minuti (75% reali, 25% xG/xA), stagione in corso e scorsa,
 * frenati verso la media del ruolo, e si applicano a una partita da titolare (85 minuti); poi corretti per
 * la difesa (o l'attacco, per i portieri) dell'avversario e per casa/trasferta.
 * Pesi tarati con la prova a posteriori: statistiche della stagione scorsa → fantavoto medio delle
 * prime giornate (errore 0,51 contro 0,57 della sola media del ruolo).
 * La probabilità di giocare resta fuori: serve a scegliere la formazione, non a calcolare l'FVA.
 */

export type FvaRole = 'P' | 'D' | 'C' | 'A'

export interface FvaSeason {
  appearances?: number
  /** minuti giocati: gol, assist e cartellini si contano per 90 minuti */
  minutes?: number
  mv?: number
  goals?: number
  assists?: number
  xg?: number
  xa?: number
  yellow?: number
  red?: number
  conceded?: number
}

export interface FvaInput {
  role: FvaRole
  /** stagione in corso, poi stagione scorsa */
  seasons: FvaSeason[]
  /** forza dell'avversario 1-5 (Guida): attacco per i portieri, difesa per gli altri */
  opponentIndex?: number
  home?: boolean
  /** fascia SOS Fanta della giornata (1 = da schierare … 9 = da evitare) */
  sosFascia?: number
}

export interface FvaRoleMeans {
  mv: number
  goals: number
  assists: number
  yellow: number
  red: number
  conceded: number
}

export interface FvaResult {
  fva: number
  mv: number
  goals: number
  assists: number
  yellow: number
  red: number
  conceded: number
  parts: Array<{ label: string; value: number }>
}

export const FVA_PARAMETERS = {
  bonus: { goal: 3, assist: 1, yellow: -0.5, red: -1, conceded: -1 },
  previousSeasonWeight: 0.75,
  /** frenata verso la media del ruolo, in partite (o in "90 minuti" per gol, assist, cartellini) */
  priorMatches: { mv: 4, rates: 6 },
  /** minuti attesi in una partita da titolare: l'FVA è il fantavoto se gioca */
  startMinutes: 85,
  /** quota di gol/assist reali rispetto a xG/xA */
  realShare: 0.75,
  /** correzione del voto atteso per ruolo: la media voto della stagione tende a sovrastimare il voto
   *  della partita successiva (prova a posteriori sulle prime giornate; portieri soprattutto) */
  mvShift: { P: -0.6, D: -0.15, C: -0.1, A: -0.3 } as Record<FvaRole, number>,
  /** avversario: ±10% di gol per ogni punto di forza (scala 1-5, media 3) */
  opponentPerPoint: 0.1,
  /** voto: ±0,05 per punto di forza dell'avversario */
  opponentMvPerPoint: 0.05,
  home: { rate: 1.06, away: 0.94, mv: 0.05 },
  /** fascia SOS: correzione in punti di fantavoto (prima fascia +0,3 … ultima −0,3) */
  sos: { 1: 0.3, 2: 0.2, 3: 0.1, 4: 0, 5: -0.05, 6: -0.1, 7: -0.2, 8: -0.25, 9: -0.3, 10: -0.3 } as Record<number, number>,
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** quante "partite da 90 minuti" vale una stagione (minuti/90; senza minuti, le presenze) */
const nineties = (season: FvaSeason) => finite(season.minutes) && season.minutes > 0 ? season.minutes / 90 : season.appearances ?? 0

/** grandezza per 90 minuti (stagione in corso e scorsa), frenata verso la media del ruolo per 90 minuti */
function rate(seasons: FvaSeason[], value: (season: FvaSeason) => number | undefined, prior: number, priorMatches: number): number {
  let weight = priorMatches
  let total = prior * priorMatches
  seasons.slice(0, 2).forEach((season, index) => {
    const n = nineties(season)
    const v = value(season)
    if (n <= 0 || !finite(v)) return
    const w = Math.min(n, 38) * (index === 0 ? 1 : FVA_PARAMETERS.previousSeasonWeight)
    weight += w
    total += (v / n) * w
  })
  return total / weight
}

function meanMv(seasons: FvaSeason[], prior: number): number {
  let weight = FVA_PARAMETERS.priorMatches.mv
  let total = prior * weight
  seasons.slice(0, 2).forEach((season, index) => {
    const apps = season.appearances ?? 0
    if (apps <= 0 || !finite(season.mv) || season.mv <= 0) return
    const w = Math.min(apps, 38) * (index === 0 ? 1 : FVA_PARAMETERS.previousSeasonWeight)
    weight += w
    total += season.mv * w
  })
  return total / weight
}

const blend = (real?: number, expected?: number) => {
  if (!finite(real) && !finite(expected)) return undefined
  if (!finite(expected)) return real
  if (!finite(real)) return expected
  return FVA_PARAMETERS.realShare * real + (1 - FVA_PARAMETERS.realShare) * expected
}

export function calculateFva(input: FvaInput, means: FvaRoleMeans): FvaResult {
  const p = FVA_PARAMETERS
  const k = p.priorMatches.rates
  const parts: FvaResult['parts'] = []
  const strength = finite(input.opponentIndex) ? input.opponentIndex : 3
  const homeRate = input.home === true ? p.home.rate : input.home === false ? p.home.away : 1

  let mv = meanMv(input.seasons, means.mv) + p.mvShift[input.role]
  // avversario debole → voto un filo più alto; in casa +0,05
  mv += (3 - strength) * p.opponentMvPerPoint + (input.home === true ? p.home.mv : input.home === false ? -p.home.mv : 0)
  parts.push({ label: 'Voto atteso', value: mv })

  const play = p.startMinutes / 90
  let goals = 0, assists = 0, yellow = 0, red = 0, conceded = 0
  if (input.role === 'P') {
    // gol subiti: più contro un attacco forte, meno in casa
    conceded = rate(input.seasons, (s) => s.conceded, means.conceded, k) * (1 + (strength - 3) * p.opponentPerPoint) * (input.home === true ? p.home.away : input.home === false ? p.home.rate : 1)
    parts.push({ label: 'Gol subiti attesi', value: conceded * p.bonus.conceded })
  } else {
    const opponent = 1 + (3 - strength) * p.opponentPerPoint
    goals = rate(input.seasons, (s) => blend(s.goals, s.xg), means.goals, k) * opponent * homeRate * play
    assists = rate(input.seasons, (s) => blend(s.assists, s.xa), means.assists, k) * opponent * homeRate * play
    if (goals > 0.005) parts.push({ label: 'Gol attesi', value: goals * p.bonus.goal })
    if (assists > 0.005) parts.push({ label: 'Assist attesi', value: assists * p.bonus.assist })
  }
  // probabilità di almeno un cartellino nei minuti attesi
  yellow = 1 - Math.exp(-rate(input.seasons, (s) => s.yellow, means.yellow, k) * play)
  red = 1 - Math.exp(-rate(input.seasons, (s) => s.red, means.red, k) * play)
  parts.push({ label: 'Cartellini', value: yellow * p.bonus.yellow + red * p.bonus.red })

  let fva = mv + goals * p.bonus.goal + assists * p.bonus.assist + yellow * p.bonus.yellow + red * p.bonus.red + conceded * p.bonus.conceded
  const sos = finite(input.sosFascia) ? p.sos[input.sosFascia] ?? 0 : 0
  if (sos) {
    fva += sos
    parts.push({ label: `SOS ${input.sosFascia}ª fascia`, value: sos })
  }
  return { fva, mv, goals, assists, yellow, red, conceded, parts }
}

/** medie del ruolo per partita (frenate a quei valori i giocatori con pochi dati) */
export function roleMeans(inputs: Array<{ role: FvaRole; seasons: FvaSeason[] }>): Record<FvaRole, FvaRoleMeans> {
  const out = {} as Record<FvaRole, FvaRoleMeans>
  for (const role of ['P', 'D', 'C', 'A'] as FvaRole[]) {
    const totals = { apps: 0, nineties: 0, mvApps: 0, mv: 0, goals: 0, assists: 0, yellow: 0, red: 0, conceded: 0 }
    for (const input of inputs.filter((item) => item.role === role)) {
      for (const season of input.seasons.slice(0, 2)) {
        const apps = season.appearances ?? 0
        if (apps < 5) continue
        totals.apps += apps
        totals.nineties += nineties(season)
        if (finite(season.mv) && season.mv > 0) { totals.mvApps += apps; totals.mv += season.mv * apps }
        totals.goals += blend(season.goals, season.xg) ?? 0
        totals.assists += blend(season.assists, season.xa) ?? 0
        totals.yellow += season.yellow ?? 0
        totals.red += season.red ?? 0
        totals.conceded += season.conceded ?? 0
      }
    }
    const per = (value: number) => totals.nineties ? value / totals.nineties : 0
    out[role] = {
      mv: totals.mvApps ? totals.mv / totals.mvApps : 6,
      goals: per(totals.goals), assists: per(totals.assists), yellow: per(totals.yellow), red: per(totals.red),
      conceded: role === 'P' ? (per(totals.conceded) || 1.3) : 0,
    }
  }
  return out
}
