// Profilo di comportamento degli avversari, costruito su tutte le aste passate (più stagioni, A e B).
//
// Per ogni persona (soprannome dell'anagrafica):
//   - indice di spesa: quanto paga rispetto alla sua lega. Riferimento = prezzo dello STESSO giocatore
//     nell'altra lega della stessa stagione (stesso listone, stesso momento), corretto per il livello
//     medio delle due leghe: non servono dati di oggi, quindi valgono anche i giocatori usciti dalla
//     Serie A. Totale e per ruolo.
//   - ripartizione dei crediti tra i reparti (% spesa in P/D/C/A)
//   - concentrazione: quota spesa sui 3 giocatori più cari
//   - quota di giocatori presi a 1 credito
// Le stagioni più recenti pesano di più; con pochi confronti l'indice viene avvicinato a 1 (prudenza).

export type Role = 'P' | 'D' | 'C' | 'A'
const ROLES: Role[] = ['P', 'D', 'C', 'A']

export interface Purchase {
  season: string
  league: string
  team: string
  playerId: string
  role: string
  price: number
}

export interface RegistryRow {
  nickname: string
  season: string
  league: string
  team: string
  me: boolean
}

export interface RivalProfile {
  nickname: string
  me: boolean
  seasons: string[]
  teams: Array<{ season: string; league: string; team: string }>
  /** quanto paga rispetto al mercato: 1 = in linea, 1,2 = +20% */
  spendIndex: number
  spendIndexByRole: Record<Role, number>
  /** numero di confronti usati per l'indice */
  comparisons: number
  /** % dei crediti spesi per reparto (somma 100) */
  distribution: Record<Role, number>
  /** quota spesa sui 3 giocatori più cari (0-1) */
  topThreeShare: number
  /** quota di giocatori presi a 1 credito (0-1) */
  oneCreditShare: number
}

const key = (season: string, league: string, team: string) => `${season}|${league}|${team.trim().toLowerCase()}`

/** peso di una stagione: la più recente vale 2, quella prima 1, poi 0,5… */
function seasonWeights(seasons: string[]): Map<string, number> {
  const sorted = [...new Set(seasons)].sort().reverse()
  return new Map(sorted.map((season, index) => [season, 2 / 2 ** index]))
}

/** con n confronti l'indice viene avvicinato a 1: con 8 confronti vale a metà */
const shrink = (raw: number, n: number) => 1 + (raw - 1) * (n / (n + 8))

export function buildRivalProfiles(purchases: Purchase[], registry: RegistryRow[]): Map<string, RivalProfile> {
  const personOf = new Map(registry.map((row) => [key(row.season, row.league, row.team), row]))
  const weights = seasonWeights(purchases.map((item) => item.season))

  // prezzo dello stesso giocatore nelle altre leghe della stessa stagione
  const byPlayerSeason = new Map<string, Purchase[]>()
  for (const item of purchases) {
    const list = byPlayerSeason.get(`${item.season}|${item.playerId}`) ?? []
    list.push(item)
    byPlayerSeason.set(`${item.season}|${item.playerId}`, list)
  }

  const othersOf = (item: Purchase) => (byPlayerSeason.get(`${item.season}|${item.playerId}`) ?? []).filter((other) => other.league !== item.league)
  const referenceOf = (item: Purchase) => {
    const others = othersOf(item)
    return others.length ? others.reduce((sum, other) => sum + other.price, 0) / others.length : undefined
  }
  // livello di ogni lega in ogni stagione (es. la Serie A paga in media più della B):
  // l'indice di una persona è misurato rispetto alla SUA lega, non all'altra
  const leagueLevel = new Map<string, number>()
  {
    const totals = new Map<string, [number, number]>()
    for (const item of purchases) {
      const reference = referenceOf(item)
      if (reference === undefined) continue
      const [own, ref] = totals.get(`${item.season}|${item.league}`) ?? [0, 0]
      totals.set(`${item.season}|${item.league}`, [own + item.price, ref + reference])
    }
    for (const [league, [own, ref]] of totals) leagueLevel.set(league, ref > 0 ? own / ref : 1)
  }

  const groups = new Map<string, { row: RegistryRow; items: Purchase[] }>()
  for (const item of purchases) {
    const row = personOf.get(key(item.season, item.league, item.team))
    if (!row) continue
    const group = groups.get(row.nickname) ?? { row, items: [] }
    group.items.push(item)
    groups.set(row.nickname, group)
  }

  const profiles = new Map<string, RivalProfile>()
  for (const [nickname, { items }] of groups) {
    // indice di spesa (pesato per stagione), totale e per ruolo
    const sums = { all: [0, 0, 0], ...Object.fromEntries(ROLES.map((role) => [role, [0, 0, 0]])) } as Record<string, number[]>
    for (const item of items) {
      const crossLeague = referenceOf(item)
      if (crossLeague === undefined) continue
      const reference = crossLeague * (leagueLevel.get(`${item.season}|${item.league}`) ?? 1)
      const weight = weights.get(item.season) ?? 1
      for (const bucket of ['all', item.role]) {
        if (!sums[bucket]) continue
        sums[bucket][0] += item.price * weight
        sums[bucket][1] += reference * weight
        sums[bucket][2] += 1
      }
    }
    const index = (bucket: string) => {
      const [own, reference, count] = sums[bucket]
      return reference > 0 ? shrink(own / reference, count) : 1
    }

    // ripartizione, concentrazione e giocatori a 1 credito: media pesata delle singole aste
    const teams = [...new Set(items.map((item) => `${item.season}|${item.league}|${item.team}`))]
    const distribution: Record<Role, number> = { P: 0, D: 0, C: 0, A: 0 }
    let top = 0, ones = 0, totalWeight = 0
    for (const team of teams) {
      const list = items.filter((item) => `${item.season}|${item.league}|${item.team}` === team)
      const spent = list.reduce((sum, item) => sum + item.price, 0)
      if (!spent) continue
      const weight = weights.get(list[0].season) ?? 1
      totalWeight += weight
      for (const role of ROLES) distribution[role] += weight * list.filter((item) => item.role === role).reduce((sum, item) => sum + item.price, 0) / spent
      top += weight * [...list].sort((a, b) => b.price - a.price).slice(0, 3).reduce((sum, item) => sum + item.price, 0) / spent
      ones += weight * list.filter((item) => item.price <= 1).length / list.length
    }
    for (const role of ROLES) distribution[role] = totalWeight ? Math.round(distribution[role] / totalWeight * 1000) / 10 : 25

    const registryRows = registry.filter((row) => row.nickname === nickname)
    profiles.set(nickname, {
      nickname,
      me: registryRows.some((row) => row.me),
      seasons: [...new Set(registryRows.map((row) => row.season))].sort(),
      teams: registryRows.map(({ season, league, team }) => ({ season, league, team })),
      spendIndex: index('all'),
      spendIndexByRole: Object.fromEntries(ROLES.map((role) => [role, index(role)])) as Record<Role, number>,
      comparisons: sums.all[2],
      distribution,
      topThreeShare: totalWeight ? top / totalWeight : 0,
      oneCreditShare: totalWeight ? ones / totalWeight : 0,
    })
  }
  return profiles
}

const normalize = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/** profilo di un allenatore della Dashboard: per soprannome, nome squadra o nome */
export function findProfile(
  profiles: Map<string, RivalProfile>,
  candidates: string[],
): RivalProfile | undefined {
  const wanted = candidates.map(normalize).filter(Boolean)
  for (const profile of profiles.values()) {
    const names = [profile.nickname, ...profile.teams.map((team) => team.team)].map(normalize)
    if (wanted.some((name) => names.includes(name))) return profile
  }
  return undefined
}
