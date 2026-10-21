// Ingressi dell'iCà 3 dalle tabelle FantaLab (stagione in corso, Guida,
// allenatori) e dal vecchio listone (stagione precedente). Non dipende da
// FLDA né dal calendario: è sempre calcolabile con i dati in database/.
import {
  localBulkHistory,
  localPlayers,
  localTeamGuide,
  localTeamHierarchies,
} from '../services/fantalabLocal'
import { calculateICaV3, coachRoleTone } from '../domain/icaV3'
import type { ICaCoachRole } from '../domain/icaV3'
import type { ICaV3Input, ICaV3Result, ICaV3Role } from '../domain/icaV3'
import { players as listone } from './players'
import goalkeeperGridCsvBundled from '../../database/griglia_portieri.csv?raw'
import attackerGridCsvBundled from '../../database/griglia_attaccanti.csv?raw'
import { getCsv } from './csvOverrides'

// CSV caricati dalla pagina Import/Export, altrimenti quelli del progetto
const goalkeeperGridCsv = getCsv('griglia_portieri', goalkeeperGridCsvBundled)
const attackerGridCsv = getCsv('griglia_attaccanti', attackerGridCsvBundled)

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

// Facilità partite per squadra da una griglia abbinamenti (CSV squadra × squadra):
// media della riga, scalata fra −1 (squadra più sfavorita) e +1 (più favorita).
function gridEase(csv: string): Map<string, { mean: number; index: number }> {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  const means = new Map<string, number>()
  for (const line of lines.slice(1)) {
    const [team, ...cells] = line.split(/[,;]/)
    const values = cells.map((cell) => Number(cell.replace(',', '.'))).filter((value, index) => cells[index].trim() !== '' && Number.isFinite(value))
    if (team && values.length) means.set(team.trim(), values.reduce((sum, value) => sum + value, 0) / values.length)
  }
  const all = [...means.values()]
  const center = all.reduce((sum, value) => sum + value, 0) / (all.length || 1)
  const spread = Math.max(...all.map((value) => Math.abs(value - center)), 0)
  return new Map([...means].map(([team, mean]) => [team, { mean, index: spread > 0 ? (mean - center) / spread : 0 }]))
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

  const goalkeeperEase = gridEase(goalkeeperGridCsv)
  const attackerEase = gridEase(attackerGridCsv)
  const ease = (teamName: string, role: ICaV3Role) => {
    const defensive = role === 'P' || role === 'D'
    const entry = (defensive ? goalkeeperEase : attackerEase).get(teamName)
    return entry
      ? { easeIndex: entry.index, easeGridValue: entry.mean, easeGridName: defensive ? 'portieri' : 'attaccanti' }
      : {}
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
    const coachTone = coachRoleTone(player.mantra_roles, (guide.key_roles ?? []) as ICaCoachRole[])
    const named = (key: string) => Array.isArray(guide[key])
      && (guide[key] as unknown[]).some((name) => String(name).trim().toLocaleLowerCase('it') === player.name.trim().toLocaleLowerCase('it'))
    return [{
      id,
      name: player.name,
      team: player.team,
      role,
      fm: finite(season?.fmv) ? season.fmv : undefined,
      appearances: finite(season?.presenze) ? season.presenze : undefined,
      // nel vecchio listone FMV 0 = voti assenti (es. Serie B): non è uno storico
      previousFm: old?.fmv && old.fmv > 0 ? old.fmv : undefined,
      previousAppearances: old?.fmv && old.fmv > 0 ? old.appearances : undefined,
      titolarita: player.titolarita_display ?? undefined,
      injuryGamesMissed: finite(season?.injury_games_missed) ? season.injury_games_missed : undefined,
      penaltyRank: rankOf('PENALTY'),
      freeKickRank: rankOf('FREE_KICK'),
      cornerRank: rankOf('CORNER'),
      teamIndex: finite(index) ? index : undefined,
      coachTone,
      coachPlayerTone: named('valorizzati') ? 'good' : named('penalizzati') ? 'bad' : undefined,
      ...ease(player.team, role),
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
