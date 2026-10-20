// Ingressi dell'iCà 3 dalle tabelle FantaLab (stagione in corso, Guida,
// allenatori) e dal vecchio listone (stagione precedente). Non dipende da
// FLDA né dal calendario: è sempre calcolabile con i dati in database/.
import {
  localBulkHistory,
  localPlayers,
  localTeamGuide,
  localTeamHierarchies,
} from '../services/fantalabLocal'
import { coachScore } from '../domain/icaV2'
import type { ICaCoachRole } from '../domain/icaV2'
import { calculateICaV3 } from '../domain/icaV3'
import type { ICaV3Input, ICaV3Result, ICaV3Role } from '../domain/icaV3'
import { players as listone } from './players'

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function buildInputs(): ICaV3Input[] {
  const page = localPlayers()
  const history = new Map(localBulkHistory().players.map((item) => [item.player_id, item.history[0]]))
  const previous = new Map(listone
    .filter((player) => player.fantalabId && player.id !== player.fantalabId)
    .map((player) => [player.fantalabId as string, player]))

  const teams = new Map<string, { guide: ReturnType<typeof localTeamGuide>; ranks: ReturnType<typeof localTeamHierarchies> }>()
  const team = (name: string) => {
    let entry = teams.get(name)
    if (!entry) {
      entry = { guide: localTeamGuide(name), ranks: localTeamHierarchies(name) }
      teams.set(name, entry)
    }
    return entry
  }

  return page.players.flatMap((player): ICaV3Input[] => {
    const id = player.player_id
    const role = player.role as ICaV3Role
    if (!id || !['P', 'D', 'C', 'A'].includes(role)) return []
    const season = history.get(id)
    const old = previous.get(id)
    const { guide, ranks } = team(player.team)
    const rankOf = (type: string) => ranks.find((row) => row.player_id === id && row.hierarchy_type === type)?.source_rank as number | undefined
    const index = role === 'P' || role === 'D' ? guide.team_defense_index : guide.team_attack_index
    const coach = coachScore(player, (guide.key_roles ?? []) as ICaCoachRole[])
    const named = (key: string) => Array.isArray(guide[key])
      && (guide[key] as unknown[]).some((name) => String(name).trim().toLocaleLowerCase('it') === player.name.trim().toLocaleLowerCase('it'))
    return [{
      id,
      name: player.name,
      team: player.team,
      role,
      fm: finite(season?.fmv) ? season.fmv : undefined,
      appearances: finite(season?.presenze) ? season.presenze : undefined,
      previousFm: old?.fmv,
      previousAppearances: old?.appearances,
      titolarita: player.titolarita_display ?? undefined,
      injuryGamesMissed: finite(season?.injury_games_missed) ? season.injury_games_missed : undefined,
      penaltyRank: rankOf('PENALTY'),
      freeKickRank: rankOf('FREE_KICK'),
      cornerRank: rankOf('CORNER'),
      teamIndex: finite(index) ? index : undefined,
      coachTone: coach > 50 ? 'good' : coach < 50 ? 'bad' : 'neutral',
      coachPlayerTone: named('valorizzati') ? 'good' : named('penalizzati') ? 'bad' : undefined,
      pmaPercent: finite(player.classic_8_mod_median_value) ? player.classic_8_mod_median_value : undefined,
    }]
  })
}

let cache: Map<string, ICaV3Result> | null = null

/** Risultati iCà 3 per ID FantaLab (calcolati una volta per sessione). */
export function getICaV3Results(): Map<string, ICaV3Result> {
  if (!cache) cache = calculateICaV3(buildInputs())
  return cache
}

export function getICaV3(fantalabId: string | null | undefined): ICaV3Result | undefined {
  return fantalabId ? getICaV3Results().get(fantalabId) : undefined
}
