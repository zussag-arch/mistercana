import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  absenceScore, availabilityScore, buildICaReferences, calculateICaV2,
  hierarchyScore, historyScore, integrityScore, mvScore, percentile95,
  perspectiveScore, sampleReliability, utilizationScore, xfmScore,
} from '../src/domain/icaV2.ts'
import type { ICaV2Input } from '../src/domain/icaV2.ts'

function input(name: string, role: 'P' | 'D' | 'C' | 'A', xfm: number, extra: Record<string, unknown> = {}): ICaV2Input {
  return { player: {
    player_id: name, name, team: 'Inter', role, fm_exp: xfm,
    titolarita_display: 80, integrita: 4, is_starting_xi: true, ...extra,
  } }
}

const season = (overrides: Record<string, unknown> = {}) => ({
  season: 's_25_26', presenze: 30, min_playing_time: 2400, mv: 6.1,
  gol_fatti: 4, assist: 3, amm: 4, esp: 0, rigori_sbagliati: 0,
  clean_sheet: 8, injury_games_missed: 2, xg: 3.5, xa: 2.5, ...overrides,
})

test('xFM, utilization and integrity use absolute V2 scales', () => {
  assert.equal(xfmScore(7.2), 72)
  assert.equal(xfmScore(12), 100)
  assert.equal(utilizationScore(input('D', 'D', 7).player), 84)
  assert.equal(integrityScore(1), 20)
  assert.equal(integrityScore(5), 100)
  assert.equal(integrityScore(0), undefined)
})

test('missing XI renormalizes utilization onto titolarita', () => {
  const player = input('D', 'D', 7).player
  delete player.is_starting_xi
  assert.equal(utilizationScore(player), 80)
})

test('DCA hierarchy renormalizes available ranks and is attenuated by utilization', () => {
  const player = input('D', 'D', 7, { penalty_rank: 1 }).player
  assert.equal(hierarchyScore(player, 80), 44)
})

test('goalkeeper P1/P2/P3 scores are direct and not utilization-attenuated', () => {
  assert.equal(hierarchyScore(input('P1', 'P', 6, { goalkeeper_rank: 1 }).player, 5), 100)
  assert.equal(hierarchyScore(input('P2', 'P', 6, { goalkeeper_rank: 2 }).player, 100), 30)
  assert.equal(hierarchyScore(input('P3', 'P', 6, { goalkeeper_rank: 3 }).player, 100), 10)
})

test('sample reliability interpolates continuously and caps at one', () => {
  assert.equal(sampleReliability(5), 0.2)
  assert.equal(sampleReliability(10), 0.4)
  assert.equal(sampleReliability(20), 0.7)
  assert.equal(sampleReliability(30), 0.9)
  assert.equal(sampleReliability(38), 1)
})

test('95th percentile is an interpolated reference, not a player score', () => {
  assert.equal(percentile95([0, 10, 20, 30, 40]), 38)
})

test('availability and absence curves preserve missing data and remain continuous', () => {
  assert.equal(availabilityScore({ presenze: 0, min_playing_time: 0 }), undefined)
  assert.ok((availabilityScore({ presenze: 10, min_playing_time: 725 }) ?? 0) >= 89)
  assert.equal(availabilityScore({ presenze: 10, min_playing_time: 900 }), 100)
  assert.equal(absenceScore({}), undefined)
  assert.equal(absenceScore({ injury_games_missed: 0 }), 100)
  assert.ok((absenceScore({ injury_games_missed: 10 }) ?? 0) < 100)
})

test('MV is absolute, role-configured and capped', () => {
  assert.equal(mvScore('P', 5.5), 0)
  assert.equal(mvScore('P', 6), 50)
  assert.equal(mvScore('P', 6.5), 100)
})

test('Alpha/Beta H is the weighted mean without season-count penalties or extra division', () => {
  const player = input('Audit', 'D', 7)
  const references = { positive: {}, negative: {} }
  // Only MV is supplied: the season weights must renormalize to MV alone.
  const rows = [{ mv: 6.5 }, { mv: 6 }, { mv: 5.5 }]
  const expected = [100, (0.5 * 100 + 0.333333 * 50) / 0.833333, 0.5 * 100 + 0.333333 * 50]
  for (let count = 1; count <= 3; count++) {
    const result = calculateICaV2({ ...player, history: rows.slice(0, count) }, references)
    assert.ok(Math.abs(result.storico! - expected[count - 1]!) < 1e-10)
    assert.equal(result.score, Math.round((0.55 * result.prospettiva! + 0.45 * result.storico!) * 100) / 100)
  }
})

test('missing injury_games_missed excludes absence weight and ignores injured/Pt.Inf', () => {
  const player = input('Audit absence', 'P', 6)
  const references = { positive: {}, negative: {} }
  const row = { mv: 6, presenze: 10, min_playing_time: 900 }
  const expected = (0.15 * 50 + 0.20 * 100) / 0.35
  for (const extra of [{}, { injured: 38, 'Pt.Inf': 38 }, { injury_games_missed: null }]) {
    assert.equal(absenceScore({ ...row, ...extra }), undefined)
    assert.ok(Math.abs(historyScore({ ...player, history: [{ ...row, ...extra }] }, references)! - expected) < 1e-10)
  }
})

test('history uses three seasons and renormalizes one or two available seasons', () => {
  const full = input('Dimarco', 'D', 7)
  full.history = [season({ mv: 6.5 }), season({ mv: 6 }), season({ mv: 5.5 })]
  const references = buildICaReferences([full])
  const all = historyScore(full, references)
  const one = historyScore({ ...full, history: full.history.slice(0, 1) }, references)
  const two = historyScore({ ...full, history: full.history.slice(0, 2) }, references)
  assert.ok(typeof all === 'number' && typeof one === 'number' && typeof two === 'number')
  assert.ok(one >= two && two >= all)
})

test('complete V2 result contains measurable perspective and bulk history contributions', () => {
  const player = input('Complete', 'A', 7.2, { penalty_rank: 1 })
  player.history = [season({ mv: 6.4 }), season({ mv: 6.1 }), season({ mv: 5.9 })]
  const references = buildICaReferences([player])
  const result = calculateICaV2(player, references)
  assert.ok(typeof result.prospettiva === 'number')
  assert.ok(typeof result.storico === 'number')
  assert.ok(typeof result.score === 'number')
  assert.notEqual(result.score, Math.round(result.prospettiva! * 100) / 100)
})

test('real reference builder produces non-empty role/event references from bulk-shaped history', () => {
  const samples = (['P', 'D', 'C', 'A'] as const).map((role) => {
    const item = input(role, role, 7, role === 'P' ? { goalkeeper_rank: 1 } : {})
    item.history = [season({ rigori_parati: 1, gol_subiti: 30 })]
    return item
  })
  const references = buildICaReferences(samples)
  assert.ok(typeof references.positive.P?.cleanSheet === 'number')
  assert.ok(typeof references.negative.P?.goalsConceded === 'number')
  assert.ok(typeof references.positive.D?.goal === 'number')
  assert.ok(typeof references.negative.C?.yellow === 'number')
  assert.ok(typeof references.positive.A?.assist === 'number')
})

test('loaded empty history follows explicit no-history behavior', () => {
  const player = input('No history', 'C', 7)
  const result = calculateICaV2({ ...player, history: [] }, buildICaReferences([]))
  assert.equal(result.storico, undefined)
  assert.equal(result.score, Math.round(result.prospettiva! * 100) / 100)
})

test('goalkeeper history uses clean sheets, saved penalties and conceded goals', () => {
  const keeper = input('Svilar', 'P', 6.5, { goalkeeper_rank: 1 })
  keeper.history = [season({ rigori_parati: 2, gol_subiti: 28, clean_sheet: 14 })]
  const score = historyScore(keeper, buildICaReferences([keeper]))
  assert.ok(typeof score === 'number' && score >= 0 && score <= 100)
})

test('missing components are excluded rather than changed to zero', () => {
  const sparse = input('Vicario', 'P', 6.4, { titolarita_display: null, integrita: null, goalkeeper_rank: null })
  delete sparse.player.is_starting_xi
  assert.equal(perspectiveScore(sparse.player), 64)
  assert.equal(calculateICaV2(sparse).score, 64)
})

test('editorial correctors multiply after base and final result is capped', () => {
  const base = input('Base', 'A', 8)
  const plain = calculateICaV2(base).score!
  const corrected = calculateICaV2({ ...base, valorizzato: true, ruoloChiave: true }).score!
  assert.equal(corrected, Math.min(100, Math.round(plain * 1.06 * 1.05 * 100) / 100))
  assert.ok(calculateICaV2(input('Ideal', 'A', 100, { titolarita_display: 100, integrita: 5 })).score! <= 100)
})

test('FLDA-only player is calculable and no Saggi input exists', () => {
  const vicario = input('e962868a-c447-43cd-8306-5378a88ee2d3', 'P', 6.3, { goalkeeper_rank: 1 })
  assert.ok(typeof calculateICaV2(vicario).score === 'number')
  assert.equal('saggi' in vicario, false)
  const source = readFileSync(new URL('../src/domain/icaV2.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source.toLocaleLowerCase('it'), /saggi/)
})

test('synthetic P/D/A regression benchmark has sensible order and bounded values', () => {
  const groups = [
    [input('Svilar', 'P', 6.8, { goalkeeper_rank: 1 }), input('Maignan', 'P', 6.5, { goalkeeper_rank: 1 }), input('Falcone', 'P', 6.2, { goalkeeper_rank: 1 }), input('Meret', 'P', 6, { goalkeeper_rank: 2 }), input('Paleari', 'P', 5.8, { goalkeeper_rank: 3 })],
    [input('Dimarco', 'D', 8, { penalty_rank: 1 }), input('Wesley', 'D', 7.5, { penalty_rank: 1 }), input('Mina', 'D', 7, { penalty_rank: 1 }), input('Gila', 'D', 6.5, { penalty_rank: 1 }), input('Comuzzo', 'D', 6, { penalty_rank: 1 })],
    [input('Lautaro Martinez', 'A', 8.5, { penalty_rank: 1 }), input('Malen', 'A', 7.8, { penalty_rank: 1 }), input('Scamacca', 'A', 7.2, { penalty_rank: 1 }), input('Colombo', 'A', 6.5, { penalty_rank: 1 }), input('Adams', 'A', 6, { penalty_rank: 1 })],
  ]
  for (const group of groups) {
    const values = group.map((item) => calculateICaV2(item).score!)
    assert.ok(values.every((value) => value >= 0 && value <= 100))
    assert.deepEqual(values, [...values].sort((a, b) => b - a))
  }
})
