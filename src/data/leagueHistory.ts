// Storico della lega (dati dell'utente): quando si archivia un'asta, i suoi acquisti entrano nello
// storico aste e gli allenatori nell'anagrafica, così i profili degli avversari si aggiornano da soli.
import asteCsvBundled from '../../database/aste.csv?raw'
import rivalsCsvBundled from '../../database/avversari.csv?raw'
import { getCsv, saveCsvOverrides } from './csvOverrides'
import { getCachedPlayersDataset } from '../services/playerRepository'
import type { AppState } from '../app/state'
import { seasonOf } from '../domain/season'

const HISTORY_HEADER = 'Stagione;Lega;Squadra;ID Fantacalcio;ID FantaLab;Nome;Ruolo;Prezzo'
const REGISTRY_HEADER = 'Soprannome;Stagione;Lega;Squadra;Io'

const clean = (text: string | number | null | undefined) => String(text ?? '').replace(/[;\r\n"]/g, ' ').trim()

function lines(text: string): string[] {
  const rows = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim())
  return rows.length ? rows.slice(1) : []
}

/**
 * Aggiunge l'asta allo storico (sostituendo un'eventuale asta già registrata per la stessa
 * stagione e lega) e mette nell'anagrafica gli allenatori che mancano per quella stagione.
 * Restituisce quanti acquisti sono stati registrati.
 */
export function addAuctionToHistory(state: AppState, assignments: AppState['auctionAssignments'], date = new Date()): number {
  const league = state.auctionLeague
  if (!league) return 0
  const season = seasonOf(date)
  const players = new Map((getCachedPlayersDataset()?.players ?? []).map((player) => [player.player_id, player]))
  const managers = new Map(state.managers.map((manager) => [manager.id, manager]))
  const teamOf = (manager: AppState['managers'][number]) => clean(manager.teamName || manager.alias || manager.firstName)

  const rows: string[] = []
  for (const assignment of assignments) {
    const manager = managers.get(assignment.managerId)
    const player = assignment.fldaPlayerId ? players.get(assignment.fldaPlayerId) : undefined
    if (!manager || !player) continue
    rows.push([season, league, teamOf(manager), clean(player.fantacalcio_id), clean(player.player_id), clean(player.name), clean(player.role), assignment.price].join(';'))
  }
  if (!rows.length) return 0

  const history = lines(getCsv('aste', asteCsvBundled))
    .filter((line) => !line.startsWith(`${season};${league};`))
  const registry = lines(getCsv('avversari', rivalsCsvBundled))
  const known = new Set(registry.map((line) => line.split(';').slice(0, 3).join(';')))
  const buyers = new Set(assignments.map((assignment) => assignment.managerId))
  for (const manager of state.managers) {
    if (!buyers.has(manager.id)) continue
    const nickname = clean(manager.alias || manager.firstName)
    if (!nickname || known.has(`${nickname};${season};${league}`)) continue
    registry.push([nickname, season, league, teamOf(manager), manager.isOwner ? 'Sì' : ''].join(';'))
  }

  const loadedAt = date.toISOString()
  saveCsvOverrides({
    aste: { fileName: 'aste.csv', content: [HISTORY_HEADER, ...history, ...rows].join('\n') + '\n', loadedAt },
    avversari: { fileName: 'avversari.csv', content: [REGISTRY_HEADER, ...registry].join('\n') + '\n', loadedAt },
  })
  return rows.length
}
