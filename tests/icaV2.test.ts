import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildICaReferences, calculateICaV2, calendarScore, coachScore,
  percentile95, setPieceBonus, utilizationScore, xfmScore,
} from '../src/domain/icaV2.ts'
import type { ICaV2Input } from '../src/domain/icaV2.ts'

function input(id: string, role: 'P' | 'D' | 'C' | 'A', xfm: number): ICaV2Input {
  return {
    player: { player_id: id, name: id, team: 'Test', role, fm_exp: xfm,
      titolarita_display: 80, mantra_roles: ['Dc'] },
    coachRoles: [{ role: 'def-center', tone: 'good' }],
    fixtures: [5, 6, 7, 8, 9].map((day) => ({ day, difficulty_category: 'medium' })),
    currentMatchday: 4,
  }
}

test('xFM is a percentile within the Classic role, including ties and missing peers', () => {
  assert.equal(xfmScore(7, [6, 7, 8]), 50)
  assert.equal(xfmScore(7, [7, 7, 7]), 50)
  assert.equal(xfmScore(7, [7]), 50)
  assert.equal(xfmScore(7, []), undefined)
  const candidates = [input('d1', 'D', 6), input('d2', 'D', 7), input('d3', 'D', 8), input('a', 'A', 10)]
  const references = buildICaReferences(candidates)
  assert.deepEqual(references.xfmByRole.D, [6, 7, 8])
  assert.equal(calculateICaV2(candidates[1], references).xfm, 50)
  assert.equal(calculateICaV2({ ...candidates[1], rolePlayers: candidates.map((item) => item.player) }).xfm, 50)
})

test('titolarita is the FLDA percentage, unaffected by XI or integrity', () => {
  const player = input('d', 'D', 7).player
  assert.equal(utilizationScore({ ...player, is_starting_xi: true, integrita: 5 }), 80)
  assert.equal(utilizationScore({ ...player, titolarita_display: null }), undefined)
})

test('coach uses Mantra roles with good, bad, mixed and neutral matches', () => {
  const player = input('d', 'D', 7).player
  assert.equal(coachScore(player, [{ role: 'def-center', tone: 'good' }]), 100)
  assert.equal(coachScore(player, [{ role: 'def-center', tone: 'bad' }]), 0)
  assert.equal(coachScore(player, [{ role: 'def-center', tone: 'good' }, { role: 'def-center', tone: 'bad' }]), 50)
  assert.equal(coachScore(player, [{ role: 'gk', tone: 'good' }]), 50)
  assert.equal(coachScore({ ...player, mantra_roles: null }), 50)
})

test('calendar orders and selects only the next five days after matchday four', () => {
  assert.equal(calendarScore([
    { day: 10, difficulty_category: 'easy' },
    { day: 4, difficulty_category: 'easy' },
    { day: 9, difficulty_category: 'difficult' },
    { day: 5, difficulty_category: 'easy' },
    { day: 8, difficulty_category: 'medium' },
    { day: 6, difficulty_category: 'medium' },
    { day: 7, difficulty_category: 'difficult' },
  ], 4), 40)
  assert.equal(calendarScore([]), undefined)
})

test('set pieces use supplied ranks with an absolute cap of eight', () => {
  const player = input('d', 'D', 7).player
  assert.equal(setPieceBonus({ ...player, penalty_rank: 1 }), 6)
  assert.equal(setPieceBonus({ ...player, penalty_rank: 2, free_kick_rank: 2, corner_rank: 2 }), 6)
  assert.equal(setPieceBonus({ ...player, penalty_rank: 1, free_kick_rank: 1, corner_rank: 1 }), 8)
  assert.equal(setPieceBonus(player), 0)
})

test('complete score uses the current weights and retains consumer result fields', () => {
  const value = input('d', 'D', 7)
  value.rolePlayers = [input('low', 'D', 6).player, value.player, input('high', 'D', 8).player]
  value.player.corner_rank = 1
  const result = calculateICaV2(value)
  // (50*50 + 80*30 + 100*20 + 50*10)/110 + 2 = 69.27.
  assert.equal(result.baseScore, 67.27)
  assert.equal(result.score, 69.27)
  assert.equal(result.prospettiva, result.baseScore)
  assert.equal(result.storico, undefined)
  assert.equal(calculateICaV2({ ...value, history: [{ mv: 10, gol_fatti: 99 }], valorizzato: true }).score, result.score)
})

test('missing required components leave score unavailable rather than renormalizing', () => {
  const value = input('d', 'D', 7)
  value.rolePlayers = [value.player]
  assert.equal(calculateICaV2({ ...value, fixtures: [] }).score, undefined)
  assert.equal(calculateICaV2({ ...value, player: { ...value.player, titolarita_display: null } }).score, undefined)
  assert.equal(calculateICaV2({ ...value, rolePlayers: [] }).score, undefined)
})

test('final score is capped and the retained percentile95 utility remains compatible', () => {
  const value = input('d', 'D', 8)
  value.rolePlayers = [input('low', 'D', 6).player, value.player]
  value.player.titolarita_display = 100
  value.player.penalty_rank = 1
  value.fixtures = [{ day: 5, difficulty_category: 'easy' }]
  assert.equal(calculateICaV2(value).score, 100)
  assert.equal(percentile95([0, 10, 20, 30, 40]), 38)
})
