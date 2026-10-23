// Export delle rose per l'app che gestisce la stagione (stesso formato dei file "rosters" di Serie A e B):
//   $,$,$                      ← inizio di ogni squadra
//   Nome squadra,ID fantacalcio,Prezzo
// Prima del file si controlla che ogni acquisto abbia l'ID fantacalcio e che le rose siano complete.
import type { AppState } from '../app/state'
import type { PlayerRole } from './player'
import { ROLE_ORDER, ROSTER_SLOT_LIMITS } from './auctionContext.ts'

export interface ExportPlayer {
  fantalabId: string
  fantacalcioId?: string | null
  name: string
  role: string
}

export interface LeagueExport {
  csv: string
  teams: number
  players: number
  /** problemi che impediscono l'import (ID mancanti, nomi squadra doppi) */
  errors: string[]
  /** avvisi che non bloccano (rose incomplete) */
  warnings: string[]
}

export function teamLabel(manager: AppState['managers'][number]): string {
  return manager.teamName.trim()
    || manager.alias.trim()
    || [manager.firstName.trim(), manager.lastName.trim()].filter(Boolean).join(' ')
    || manager.id
}

// la virgola separa le colonne: nel nome squadra va tolta
const clean = (text: string) => text.replace(/[,\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()

export function buildLeagueRosters(
  state: AppState,
  players: Map<string, ExportPlayer>,
  resolveId: (assignment: AppState['auctionAssignments'][number]) => string | undefined,
): LeagueExport {
  const errors: string[] = []
  const warnings: string[] = []
  const managers = state.managers.filter((manager) => manager.active && !manager.archived)
  const names = managers.map((manager) => clean(teamLabel(manager)))
  names.forEach((name, index) => {
    if (names.indexOf(name) !== index) errors.push(`Due squadre si chiamano "${name}": cambia il nome in Dashboard → Allenatori.`)
  })

  const lines: string[] = []
  let count = 0
  managers.forEach((manager, index) => {
    const team = names[index]
    const rows = state.auctionAssignments
      .filter((assignment) => assignment.managerId === manager.id)
      .map((assignment) => {
        const id = resolveId(assignment)
        return { assignment, player: id ? players.get(id) : undefined }
      })
      .sort((a, b) => ROLE_ORDER.indexOf((a.player?.role ?? 'A') as PlayerRole) - ROLE_ORDER.indexOf((b.player?.role ?? 'A') as PlayerRole))

    lines.push('$,$,$')
    for (const { assignment, player } of rows) {
      const fantacalcioId = player?.fantacalcioId?.trim()
      if (!fantacalcioId) {
        errors.push(`${team}: manca l'ID fantacalcio di ${player?.name ?? 'un giocatore'} (${assignment.price} cr).`)
        continue
      }
      lines.push(`${team},${fantacalcioId},${Math.round(assignment.price)}`)
      count++
    }

    const missing = ROLE_ORDER
      .map((role) => [role, ROSTER_SLOT_LIMITS[role] - rows.filter((row) => row.player?.role === role).length] as const)
      .filter(([, gap]) => gap > 0)
    if (missing.length) warnings.push(`${team}: mancano ${missing.map(([role, gap]) => `${gap} ${role}`).join(', ')}.`)
  })

  return { csv: lines.join('\n') + '\n', teams: managers.length, players: count, errors, warnings }
}
