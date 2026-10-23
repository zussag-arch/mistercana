import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRivalProfiles, findProfile } from '../src/domain/rivalProfiles.ts'
import type { Purchase, RegistryRow } from '../src/domain/rivalProfiles.ts'

// due leghe nella stessa stagione: in A "Spendaccione" paga il doppio di B per gli stessi giocatori,
// "Parsimonioso" paga come B. La lega A in media paga 1,5× → Spendaccione +33%, Parsimonioso −33%.
const purchases: Purchase[] = [
  { season: '2025/26', league: 'SERIE_A', team: 'Spendaccione FC', playerId: '1', role: 'A', price: 100 },
  { season: '2025/26', league: 'SERIE_A', team: 'Parsimonioso', playerId: '2', role: 'C', price: 50 },
  { season: '2025/26', league: 'SERIE_B', team: 'Altri', playerId: '1', role: 'A', price: 50 },
  { season: '2025/26', league: 'SERIE_B', team: 'Altri', playerId: '2', role: 'C', price: 50 },
]
const registry: RegistryRow[] = [
  { nickname: 'Brosky', season: '2025/26', league: 'SERIE_A', team: 'Spendaccione FC', me: false },
  { nickname: 'Pacca', season: '2025/26', league: 'SERIE_A', team: 'Parsimonioso', me: true },
]

test('indice di spesa rispetto alla propria lega, ridotto verso 1 con pochi confronti', () => {
  const profiles = buildRivalProfiles(purchases, registry)
  const brosky = profiles.get('Brosky')!
  const pacca = profiles.get('Pacca')!
  assert.ok(brosky.spendIndex > 1 && brosky.spendIndex < 1.33)
  assert.ok(pacca.spendIndex < 1 && pacca.spendIndex > 0.67)
  assert.equal(pacca.me, true)
  assert.equal(brosky.distribution.A, 100)
})

test('il profilo si trova dal soprannome tra virgolette o dal nome squadra', () => {
  const profiles = buildRivalProfiles(purchases, registry)
  assert.equal(findProfile(profiles, ['brosky'])?.nickname, 'Brosky')
  assert.equal(findProfile(profiles, ['', 'spendaccione fc'])?.nickname, 'Brosky')
  assert.equal(findProfile(profiles, ['sconosciuto']), undefined)
})
