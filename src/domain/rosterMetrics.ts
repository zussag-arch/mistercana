export type RosterMetricRole = 'P' | 'D' | 'C' | 'A'

export interface RosterMetricPlayer {
  id: string
  team: string
  role: RosterMetricRole
  iCa?: number | null
  titolarita?: number | null
  xFm?: number | null
  presenze?: number | null
  mv?: number | null
  rigoriParati?: number | null
  ammonizioni?: number | null
  espulsioni?: number | null
}

export interface RoleRosterMetric {
  iCa: number | null
  titolarita: number | null
  prestazione: number | null
  players: number
}

export type RosterMetrics = Record<RosterMetricRole, RoleRosterMetric>

export const ROSTER_METRICS_V1 = {
  teamAttack: { minGoals: 25, maxGoals: 89, promotedScore: 3 },
  goalkeeperTeam: {
    minGoalsAgainst: 29,
    maxGoalsAgainst: 71,
    minPoints: 18,
    maxPoints: 87,
    promotedScore: 15,
  },
  promotedTeams: new Set(['Venezia', 'Monza', 'Frosinone']),
  fieldPerformanceWeights: {
    D: { individual: 0.9, team: 0.1 },
    C: { individual: 0.8, team: 0.2 },
    A: { individual: 0.7, team: 0.3 },
  },
  goalkeeperPerformanceWeights: { team: 0.65, individual: 0.35 },
  goalkeeperIndividualWeights: { mv: 0.6, penaltiesSaved: 0.25, yellow: 0.1, red: 0.05 },
} as const

// Dati finali Serie A 2025/26. Sono input V1 sostituibili, non formule definitive.
export const SERIE_A_2025_26_TEAM_STATS: Readonly<Record<string, {
  goalsFor: number
  goalsAgainst: number
  points: number
}>> = {
  Inter: { goalsFor: 89, goalsAgainst: 35, points: 87 },
  Napoli: { goalsFor: 58, goalsAgainst: 36, points: 76 },
  Roma: { goalsFor: 59, goalsAgainst: 31, points: 73 },
  Como: { goalsFor: 65, goalsAgainst: 29, points: 71 },
  Milan: { goalsFor: 53, goalsAgainst: 35, points: 70 },
  Juventus: { goalsFor: 61, goalsAgainst: 34, points: 69 },
  Atalanta: { goalsFor: 51, goalsAgainst: 36, points: 59 },
  Bologna: { goalsFor: 49, goalsAgainst: 46, points: 56 },
  Lazio: { goalsFor: 41, goalsAgainst: 40, points: 54 },
  Udinese: { goalsFor: 45, goalsAgainst: 48, points: 50 },
  Sassuolo: { goalsFor: 46, goalsAgainst: 50, points: 49 },
  Torino: { goalsFor: 44, goalsAgainst: 63, points: 45 },
  Parma: { goalsFor: 28, goalsAgainst: 46, points: 45 },
  Cagliari: { goalsFor: 40, goalsAgainst: 53, points: 43 },
  Fiorentina: { goalsFor: 41, goalsAgainst: 50, points: 42 },
  Genoa: { goalsFor: 41, goalsAgainst: 51, points: 41 },
  Lecce: { goalsFor: 28, goalsAgainst: 50, points: 38 },
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(Math.max(value, min), max)
}

function weightedMean(values: Array<{ value: number | null | undefined; weight: number }>): number | null {
  const valid = values.filter((item) => finite(item.value) && item.weight > 0)
  const weight = valid.reduce((sum, item) => sum + item.weight, 0)
  return weight > 0
    ? valid.reduce((sum, item) => sum + (item.value as number) * item.weight, 0) / weight
    : null
}

export function structuralSlot(player: RosterMetricPlayer, catalog: RosterMetricPlayer[], participants: number): number | null {
  if (!finite(player.iCa) || participants <= 0) return null
  const better = catalog.filter((candidate) =>
    candidate.role === player.role && finite(candidate.iCa) && candidate.iCa > player.iCa!,
  ).length
  return Math.ceil((1 + better) / participants)
}

export function slotWeight(role: Exclude<RosterMetricRole, 'P'>, slot: number | null): number {
  if (slot === null) return 0
  if ((role === 'D' || role === 'C') && slot <= 4) return 1
  if ((role === 'D' || role === 'C') && slot <= 6) return 0.6
  if ((role === 'D' || role === 'C') && slot <= 8) return 0.35
  if (role === 'A' && slot <= 3) return 1
  if (role === 'A' && slot === 4) return 0.6
  if (role === 'A' && slot <= 6) return 0.35
  return 0
}

export function teamAttackScore(team: string): number | null {
  if (ROSTER_METRICS_V1.promotedTeams.has(team)) return ROSTER_METRICS_V1.teamAttack.promotedScore
  const stats = SERIE_A_2025_26_TEAM_STATS[team]
  if (!stats) return null
  const { minGoals, maxGoals } = ROSTER_METRICS_V1.teamAttack
  return clamp(100 * (stats.goalsFor - minGoals) / (maxGoals - minGoals))
}

export function goalkeeperTeamScore(team: string): number | null {
  if (ROSTER_METRICS_V1.promotedTeams.has(team)) return ROSTER_METRICS_V1.goalkeeperTeam.promotedScore
  const stats = SERIE_A_2025_26_TEAM_STATS[team]
  if (!stats) return null
  const config = ROSTER_METRICS_V1.goalkeeperTeam
  const goalsScore = 100 * (config.maxGoalsAgainst - stats.goalsAgainst)
    / (config.maxGoalsAgainst - config.minGoalsAgainst)
  const pointsScore = 100 * (stats.points - config.minPoints)
    / (config.maxPoints - config.minPoints)
  return 0.75 * clamp(goalsScore) + 0.25 * clamp(pointsScore)
}

export function sampleReliability(appearances: number): number {
  if (appearances <= 0) return 0
  if (appearances <= 10) return 0.4 * appearances / 10
  if (appearances <= 20) return 0.4 + 0.3 * (appearances - 10) / 10
  if (appearances <= 30) return 0.7 + 0.2 * (appearances - 20) / 10
  if (appearances <= 35) return 0.9 + 0.1 * (appearances - 30) / 5
  return 1
}

function attenuate(score: number, neutral: number, reliability: number): number {
  return neutral + (score - neutral) * reliability
}

export function goalkeeperIndividualScore(player: RosterMetricPlayer): number | null {
  const weights = ROSTER_METRICS_V1.goalkeeperIndividualWeights
  const components: Array<{ value: number | null; weight: number }> = []
  if (finite(player.mv)) components.push({ value: clamp((player.mv - 5.5) * 100), weight: weights.mv })
  if (finite(player.presenze) && player.presenze > 0) {
    const reliability = sampleReliability(player.presenze)
    if (finite(player.rigoriParati)) {
      const rate30 = player.rigoriParati / player.presenze * 30
      const score = clamp(50 + Math.min(rate30, 3) * 15 + Math.max(rate30 - 3, 0) * 5)
      components.push({ value: attenuate(score, 50, reliability), weight: weights.penaltiesSaved })
    }
    if (finite(player.ammonizioni)) {
      const equivalent38 = player.ammonizioni / player.presenze * 38
      const score = clamp(100 - Math.min(equivalent38, 5) * 10 - Math.max(equivalent38 - 5, 0) * 10, 40, 100)
      components.push({ value: attenuate(score, 100, reliability), weight: weights.yellow })
    }
    if (finite(player.espulsioni)) {
      const equivalent38 = player.espulsioni / player.presenze * 38
      const score = equivalent38 <= 2 ? 100 - equivalent38 * 40 : clamp(60 - equivalent38 * 20)
      components.push({ value: attenuate(score, 100, reliability), weight: weights.red })
    }
  }
  return weightedMean(components)
}

export function playerPerformance(player: RosterMetricPlayer): number | null {
  if (player.role === 'P') {
    const team = goalkeeperTeamScore(player.team)
    const individual = goalkeeperIndividualScore(player)
    return weightedMean([
      { value: team, weight: ROSTER_METRICS_V1.goalkeeperPerformanceWeights.team },
      { value: individual, weight: ROSTER_METRICS_V1.goalkeeperPerformanceWeights.individual },
    ])
  }
  const weights = ROSTER_METRICS_V1.fieldPerformanceWeights[player.role]
  return weightedMean([
    { value: finite(player.xFm) ? player.xFm * 10 : null, weight: weights.individual },
    { value: teamAttackScore(player.team), weight: weights.team },
  ])
}

export function calculateRosterMetrics(catalog: RosterMetricPlayer[], ownedIds: ReadonlySet<string>, participants: number): RosterMetrics {
  const owned = catalog.filter((player) => ownedIds.has(player.id))
  const output = {} as RosterMetrics
  for (const role of ['D', 'C', 'A'] as const) {
    const rolePlayers = owned.filter((player) => player.role === role)
    const rows = rolePlayers.map((player) => ({
      player,
      weight: slotWeight(role, structuralSlot(player, catalog, participants)),
    }))
    output[role] = {
      iCa: weightedMean(rows.map(({ player, weight }) => ({ value: player.iCa, weight }))),
      titolarita: weightedMean(rows.map(({ player, weight }) => ({ value: player.titolarita, weight }))),
      prestazione: weightedMean(rows.map(({ player, weight }) => ({ value: playerPerformance(player), weight }))),
      players: rolePlayers.length,
    }
  }

  const allKeepers = catalog.filter((player) => player.role === 'P')
  const ownedKeepers = owned.filter((player) => player.role === 'P')
  const packages = [...new Set(ownedKeepers.map((player) => player.team))].map((team) => {
    const teamTotal = allKeepers.filter((player) => player.team === team && finite(player.titolarita))
      .reduce((sum, player) => sum + player.titolarita!, 0)
    const keepers = ownedKeepers.filter((player) => player.team === team)
    const shares = keepers.map((player) => ({
      player,
      share: teamTotal > 0 && finite(player.titolarita) ? 100 * player.titolarita / teamTotal : 0,
    }))
    return {
      coverage: teamTotal > 0 ? shares.reduce((sum, row) => sum + row.share, 0) : null,
      iCa: weightedMean(shares.map(({ player, share }) => ({ value: player.iCa, weight: share }))),
      prestazione: weightedMean(shares.map(({ player, share }) => ({ value: playerPerformance(player), weight: share }))),
    }
  })
  output.P = {
    iCa: weightedMean(packages.map((item) => ({ value: item.iCa, weight: 1 }))),
    titolarita: weightedMean(packages.map((item) => ({ value: item.coverage, weight: 1 }))),
    prestazione: weightedMean(packages.map((item) => ({ value: item.prestazione, weight: 1 }))),
    players: ownedKeepers.length,
  }
  return output
}
