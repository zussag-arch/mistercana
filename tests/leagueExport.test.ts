import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLeagueRosters } from '../src/domain/leagueExport.ts'
import type { ExportPlayer } from '../src/domain/leagueExport.ts'

const manager = (id: string, teamName: string) => ({ id, firstName: id, lastName: '', alias: '', teamName, isOwner: false, active: true, archived: false })
const players = new Map<string, ExportPlayer>([
  ['a', { fantalabId: 'a', fantacalcioId: '5672', name: 'Lautaro', role: 'A' }],
  ['p', { fantalabId: 'p', fantacalcioId: '4463', name: 'Sommer', role: 'P' }],
  ['x', { fantalabId: 'x', fantacalcioId: null, name: 'Sconosciuto', role: 'C' }],
])
const state = (assignments: Array<[string, string, number]>, managers = [manager('m1', 'BAMBY TEAM'), manager('m2', 'AC Picchia')]) => ({
  managers,
  auctionAssignments: assignments.map(([player, managerId, price], index) => ({ id: String(index), fldaPlayerId: player, managerId, price })),
}) as never

test('rose nel formato $,$,$ con squadra, ID fantacalcio e prezzo, portieri prima', () => {
  const result = buildLeagueRosters(state([['a', 'm1', 101], ['p', 'm1', 4]]), players, (item) => item.fldaPlayerId)
  assert.equal(result.csv, '$,$,$\nBAMBY TEAM,4463,4\nBAMBY TEAM,5672,101\n$,$,$\n')
  assert.deepEqual(result.errors, [])
  assert.equal(result.players, 2)
  assert.match(result.warnings.join(' '), /BAMBY TEAM: mancano 2 P, 8 D, 8 C, 5 A/)
})

test('ID fantacalcio mancante e nomi squadra doppi bloccano l’export', () => {
  const result = buildLeagueRosters(state([['x', 'm1', 3]], [manager('m1', 'Uno'), manager('m2', 'Uno')]), players, (item) => item.fldaPlayerId)
  assert.match(result.errors.join(' '), /Due squadre si chiamano "Uno"/)
  assert.match(result.errors.join(' '), /manca l'ID fantacalcio di Sconosciuto/)
})

test('la virgola nel nome squadra non rompe le colonne', () => {
  const result = buildLeagueRosters(state([['a', 'm1', 1]], [manager('m1', 'Rossi, Bianchi')]), players, (item) => item.fldaPlayerId)
  assert.match(result.csv, /^\$,\$,\$\nRossi Bianchi,5672,1\n$/)
})
