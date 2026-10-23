// Anagrafica avversari (database/avversari.csv) + storico aste (database/aste.csv) → profili di comportamento.
import asteCsvBundled from '../../database/aste.csv?raw'
import rivalsCsvBundled from '../../database/avversari.csv?raw'
import { getCsv, saveCsvOverrides } from './csvOverrides'
import { loadState } from '../app/storage'
import { buildRivalProfiles, findProfile } from '../domain/rivalProfiles'
import type { Purchase, RegistryRow, RivalProfile } from '../domain/rivalProfiles'
import type { AppState } from '../app/state'

type Row = Record<string, string>

function parseCsv(text: string): Row[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return []
  const header = lines[0].split(';').map((cell) => cell.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(';')
    return Object.fromEntries(header.map((name, index) => [name, (cells[index] ?? '').trim()]))
  })
}

function rivalRegistry(): RegistryRow[] {
  return parseCsv(getCsv('avversari', rivalsCsvBundled)).map((row) => ({
    nickname: row['Soprannome'], season: row['Stagione'], league: row['Lega'], team: row['Squadra'], me: row['Io'] === 'Sì',
  })).filter((row) => row.nickname && row.team)
}

let cache: { key: string; profiles: Map<string, RivalProfile> } | null = null

export function rivalProfiles(): Map<string, RivalProfile> {
  const aste = getCsv('aste', asteCsvBundled)
  const registryCsv = getCsv('avversari', rivalsCsvBundled)
  const key = `${aste.length}|${registryCsv}`
  if (cache?.key === key) return cache.profiles
  const purchases: Purchase[] = parseCsv(aste).map((row) => ({
    season: row['Stagione'], league: row['Lega'], team: row['Squadra'],
    playerId: row['ID Fantacalcio'] || row['ID FantaLab'], role: row['Ruolo'], price: Number(row['Prezzo']),
  })).filter((row) => row.playerId && Number.isFinite(row.price))
  cache = { key, profiles: buildRivalProfiles(purchases, rivalRegistry()) }
  return cache.profiles
}

/** profilo storico di un allenatore della Dashboard (soprannome tra virgolette, nome squadra o nome) */
export function profileForManager(manager: AppState['managers'][number]): RivalProfile | undefined {
  return findProfile(rivalProfiles(), [manager.alias, manager.teamName, `${manager.firstName} ${manager.lastName}`])
}

/** rinomina una persona nell'anagrafica (resta salvato nel browser) */
export function renameRival(from: string, to: string): boolean {
  const name = to.replace(/[;\r\n"]/g, '').trim()
  if (!name || name === from) return false
  const text = getCsv('avversari', rivalsCsvBundled).replace(/^﻿/, '')
  const [header, ...lines] = text.split(/\r?\n/).filter((line) => line.trim())
  const next = [header, ...lines.map((line) => line.startsWith(`${from};`) ? `${name}${line.slice(from.length)}` : line)].join('\n') + '\n'
  return saveCsvOverrides({ avversari: { fileName: 'avversari.csv', content: next, loadedAt: new Date().toISOString() } })
}

/** toglie una persona dall'anagrafica (le sue aste restano nello storico, ma non più collegate) */
export function removeRival(nickname: string): boolean {
  const text = getCsv('avversari', rivalsCsvBundled).replace(/^\uFEFF/, '')
  const [header, ...lines] = text.split(/\r?\n/).filter((line) => line.trim())
  const next = [header, ...lines.filter((line) => !line.startsWith(`${nickname};`))].join('\n') + '\n'
  return saveCsvOverrides({ avversari: { fileName: 'avversari.csv', content: next, loadedAt: new Date().toISOString() } })
}

/** le mie squadre per lega (stagione più recente): da "Sono io" sulle card allenatori, o dalla colonna Io dell'anagrafica */
export function myTeams(): Partial<Record<'SERIE_A' | 'SERIE_B', string>> {
  const owner = loadState().managers.find((manager) => manager.isOwner)
  const nickname = owner ? profileForManager(owner)?.nickname : undefined
  const rows = rivalRegistry().filter((row) => (nickname ? row.nickname === nickname : row.me))
    .sort((a, b) => a.season.localeCompare(b.season))
  const out: Partial<Record<'SERIE_A' | 'SERIE_B', string>> = {}
  for (const row of rows) out[row.league === 'SERIE_B' ? 'SERIE_B' : 'SERIE_A'] = row.team
  if (owner?.teamName && !Object.keys(out).length) out.SERIE_A = owner.teamName
  return out
}
