import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  calculateRosterMetrics,
  goalkeeperIndividualScore,
  goalkeeperTeamScore,
  playerPerformance,
  sampleReliability,
  slotWeight,
  structuralSlot,
  teamAttackScore,
  type RosterMetricPlayer,
} from '../src/domain/rosterMetrics.ts'

test('structural slots use strict-greater rank and preserve ties', () => {
  const catalog: RosterMetricPlayer[] = [90, 80, 80, 70].map((iCa, index) => ({
    id: String(index), team: 'Inter', role: 'D', iCa,
  }))
  assert.equal(structuralSlot(catalog[1], catalog, 2), 1)
  assert.equal(structuralSlot(catalog[2], catalog, 2), 1)
  assert.equal(structuralSlot(catalog[3], catalog, 2), 2)
})

test('V1 slot weights match D/C/A bands', () => {
  assert.deepEqual([1, 4, 5, 6, 7, 8, 9].map((slot) => slotWeight('D', slot)), [1, 1, 0.6, 0.6, 0.35, 0.35, 0])
  assert.deepEqual([1, 3, 4, 5, 6, 7].map((slot) => slotWeight('A', slot)), [1, 1, 0.6, 0.35, 0.35, 0])
})

test('team attack uses V1 min-max and promoted fallback', () => {
  assert.equal(teamAttackScore('Inter'), 100)
  assert.equal(teamAttackScore('Venezia'), 3)
  assert.equal(teamAttackScore('sconosciuta'), null)
})

test('field performance combines xFM and attack score by role', () => {
  const player: RosterMetricPlayer = { id: '1', team: 'Inter', role: 'D', xFm: 6 }
  assert.equal(playerPerformance(player), 64)
  assert.equal(playerPerformance({ ...player, xFm: null }), 100)
})

test('goalkeeper team score is normalized and promoted fallback is stable', () => {
  assert.equal(goalkeeperTeamScore('Como'), 0.75 * 100 + 0.25 * (53 / 69 * 100))
  assert.equal(goalkeeperTeamScore('Monza'), 15)
})

test('sample reliability interpolates approved reference points', () => {
  const actual = [10, 20, 30, 35, 38].map(sampleReliability)
  const expected = [0.4, 0.7, 0.9, 1, 1]
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-12))
})

test('goalkeeper individual score keeps missing components out and renormalizes', () => {
  const onlyMv: RosterMetricPlayer = { id: '1', team: 'Inter', role: 'P', mv: 6 }
  assert.equal(goalkeeperIndividualScore(onlyMv), 50)
  assert.equal(goalkeeperIndividualScore({ ...onlyMv, mv: null }), null)
})

test('goalkeeper card rates are attenuated by sample reliability', () => {
  const player: RosterMetricPlayer = {
    id: '1', team: 'Inter', role: 'P', presenze: 10,
    rigoriParati: 1 / 3, ammonizioni: 10 / 38, espulsioni: 10 / 38,
  }
  const score = goalkeeperIndividualScore(player)
  assert.ok(score !== null && score > 50 && score < 100)
})

test('field roster metrics use purchased players only and role weights', () => {
  const catalog: RosterMetricPlayer[] = [
    { id: 'owned', team: 'Inter', role: 'A', iCa: 90, titolarita: 80, xFm: 7 },
    { id: 'free', team: 'Napoli', role: 'A', iCa: 80, titolarita: 95, xFm: 8 },
  ]
  const result = calculateRosterMetrics(catalog, new Set(['owned']), 8)
  assert.equal(result.A.iCa, 90)
  assert.equal(result.A.titolarita, 80)
  assert.equal(result.A.players, 1)
})

test('goalkeeper coverage weights iCa and averages represented packages', () => {
  const catalog: RosterMetricPlayer[] = [
    { id: 'a1', team: 'Atalanta', role: 'P', iCa: 80, titolarita: 60, xFm: 6 },
    { id: 'a2', team: 'Atalanta', role: 'P', iCa: 50, titolarita: 40, xFm: 5 },
    { id: 'i1', team: 'Inter', role: 'P', iCa: 90, titolarita: 100, xFm: 7 },
  ]
  const result = calculateRosterMetrics(catalog, new Set(['a1', 'i1']), 8)
  assert.equal(result.P.titolarita, 80)
  assert.equal(result.P.iCa, 85)
})

test('missing FLDA values remain unavailable rather than numeric zero', () => {
  const result = calculateRosterMetrics([
    { id: '1', team: 'Unknown', role: 'C', iCa: 70, titolarita: null, xFm: null },
  ], new Set(['1']), 8)
  assert.equal(result.C.titolarita, null)
  assert.equal(result.C.prestazione, null)
})

test('Auction places roster cards at right and top/history below participants', () => {
  const page = readFileSync(new URL('../src/pages/auction.ts', import.meta.url), 'utf8')
  assert.match(page, /renderSuggestedPlayersPanel[\s\S]*renderRosterMetricsPanel/)
  assert.match(page, /renderParticipants[\s\S]*auction-market-followup[\s\S]*renderTopICaPanel[\s\S]*renderAssignmentHistory/)
  assert.doesNotMatch(page, /iCà \/ CIA rosa/)
  assert.match(page, /Titolarità rosa[\s\S]*Prestazione rosa/)
})

test('Auction mobile layout stacks top players and assignment history', () => {
  const css = readFileSync(new URL('../src/styles/auction.css', import.meta.url), 'utf8')
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.auction-market-followup\s*\{\s*grid-template-columns: 1fr/)
})
