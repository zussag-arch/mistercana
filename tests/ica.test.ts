import assert from 'node:assert/strict'
import test from 'node:test'
import { adjustments, calculateICa, coachRoleTone, expectedFm, expectedShare, ICA_PARAMETERS } from '../src/domain/ica.ts'
import type { ICaInput } from '../src/domain/ica.ts'

const base = (extra: Partial<ICaInput> = {}): ICaInput => ({
  id: 'x', name: 'Test', team: 'Inter', role: 'A', pastSeasons: [], ...extra,
})

test('fantamedia su più stagioni, frenata verso la media del ruolo', () => {
  const fm = expectedFm(base({ fm: 9, appearances: 7, pastSeasons: [{ season: '2025/26', fm: 8, appearances: 30 }] }), 6.5)!
  assert.ok(fm > 6.5 && fm < 8.5, String(fm))
  // senza storico: xFM di FantaLab pesata poco
  assert.ok(Math.abs(expectedFm(base({ fantalabXfm: 8 }), 6.5)! - 6.5) < 0.3)
})

test('i correttivi hanno un tetto complessivo', () => {
  const items = adjustments(base({ penaltyRank: 1, freeKickRank: 1, cornerRank: 1, teamIndex: 5, coachTone: 'good', coachPlayerTone: 'good', easeIndex: 1 }))
  const sum = items.reduce((total, item) => total + item.value, 0)
  assert.ok(Math.abs(sum - ICA_PARAMETERS.adjustments.cap) < 1e-9, String(sum))
  assert.equal(adjustments(base({ penaltyRank: 1 }))[0].value, 0.35)
})

test('presenze attese continue: un dato da solo non azzera il giocatore', () => {
  const { share } = expectedShare(base({ titolarita: 1, appearances: 6, minutes: 500, teamMatches: 7 }))
  assert.ok(share > 0.3, String(share)) // prima: 1%
  const injured = expectedShare(base({ titolarita: 95, appearances: 7, minutes: 630, teamMatches: 7, out: true, currentMatchday: 8, returnMatchday: 20 }))
  assert.ok(injured.share < 0.7)
})

test('rendimento = qualità × presenze attese', () => {
  const result = calculateICa([base({ fm: 7, appearances: 7, minutes: 630, teamMatches: 7, titolarita: 95 }), base({ id: 'y', fm: 6, appearances: 7 })]).get('x')!
  assert.ok(Math.abs(result.score! - result.quality! * result.expectedShare!) < 1e-9)
})

test('nuovo arrivo senza Serie A: la stagione estera entra nella fantamedia e nelle presenze', () => {
  const foreign = { season: '2025/2026', league: 'Eredivisie', appearances: 32, bonusPerMatch: 0.9, tier: 1 }
  const withForeign = expectedFm(base({ fm: 6, appearances: 2, foreignSeason: foreign }), 6.2)!
  const without = expectedFm(base({ fm: 6, appearances: 2 }), 6.2)!
  assert.ok(withForeign > without, `${withForeign} > ${without}`)
  const share = expectedShare(base({ titolarita: 50, appearances: 2, teamMatches: 7, foreignSeason: foreign }))
  assert.ok(share.parts.some((part) => part.label.startsWith('Eredivisie')))
})


test("i ruoli chiave dell'allenatore si collegano ai ruoli Mantra", () => {
  const roles = [{ role: 'att-center', tone: 'good' }, { role: 'def-fullbacks', tone: 'bad' }]
  assert.equal(coachRoleTone(['Pc'], roles), 'good')
  assert.equal(coachRoleTone(['Dd'], roles), 'bad')
  assert.equal(coachRoleTone(['C'], roles), 'neutral')
  assert.equal(coachRoleTone(['Pc', 'Dd'], roles), 'neutral')
})
