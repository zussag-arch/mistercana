import assert from 'node:assert/strict'
import test from 'node:test'
import { ICA_V3_PARAMETERS, calculateICaV3, expectedFm, expectedShare, fmAdjustments } from '../src/domain/icaV3.ts'

const K = ICA_V3_PARAMETERS.adjustmentScale
import type { ICaV3Input } from '../src/domain/icaV3.ts'

function attacker(id: string, extra: Partial<ICaV3Input> = {}): ICaV3Input {
  return { id, name: id, team: 'T', role: 'A', fm: 7, appearances: 7, titolarita: 75, pmaPercent: 5, ...extra }
}

test('expected FM shrinks short current seasons toward last season and the role mean', () => {
  // 7 partite a 10 in questa stagione, 30 a 6,5 la scorsa, media ruolo 7
  const value = expectedFm({ ...attacker('x'), fm: 10, appearances: 7, previousFm: 6.5, previousAppearances: 30 }, 7)!
  // pesi: 7 (corrente) + 10 (scorsa: min(30,20)*0,5) + 8 (ruolo)
  assert.equal(Math.round(value * 1000) / 1000, Math.round(((10 * 7 + 6.5 * 10 + 7 * 8) / 25) * 1000) / 1000)
  assert.ok(value < 8, 'sette partite non bastano per valere 10')
  assert.equal(expectedFm({ ...attacker('y'), fm: undefined, appearances: 0 }, 7), undefined)
  // FM 0 della stagione scorsa (es. Serie B senza voti) è un dato mancante, non uno zero
  const promoted = expectedFm({ ...attacker('r'), fm: 9.57, appearances: 7, previousFm: 0, previousAppearances: 36 }, 6.8)!
  assert.equal(promoted.toFixed(3), ((9.57 * 7 + 6.8 * 8) / 15).toFixed(3))
})

test('set pieces, team index and coach become explicit FM adjustments', () => {
  const items = fmAdjustments(attacker('x', { penaltyRank: 1, teamIndex: 4, coachTone: 'good' }))
  assert.deepEqual(items.map((item) => item.label), ['Rigorista n.1', 'Squadra in attacco 4/5', 'Ruolo valorizzato dall\'allenatore'])
  assert.equal(items.reduce((sum, item) => sum + item.value, 0).toFixed(2), (0.43 * K).toFixed(2))
  const named = fmAdjustments(attacker('x', { coachPlayerTone: 'bad' }))
  assert.deepEqual(named.map((item) => [item.label, item.value]), [['Penalizzato dall\'allenatore', -0.15 * K]])
  // il portiere sente di più la difesa della squadra
  const keeper = fmAdjustments({ ...attacker('p'), role: 'P', teamIndex: 2 })
  assert.equal(keeper[0].value.toFixed(3), (-0.15 * K).toFixed(3))
})

test('grid ease adds or removes FM by role weight', () => {
  const easy = fmAdjustments({ ...attacker('x'), role: 'D', easeIndex: 0.5, easeGridValue: 87.4, easeGridName: 'portieri' })
  const hard = fmAdjustments({ ...attacker('y'), role: 'P', easeIndex: -1 })
  assert.equal(easy[0].label, 'Partite favorevoli: griglia portieri (media 87,4)')
  assert.equal(easy[0].value.toFixed(3), (0.2 * K).toFixed(3))
  assert.equal(hard[0].value.toFixed(3), (-0.6 * K).toFixed(3))
  // squadra nella media: nessun correttivo
  assert.equal(fmAdjustments({ ...attacker('z'), easeIndex: 0 }).length, 0)
})

test('injuries reduce expected appearances up to the configured cap', () => {
  assert.equal(expectedShare(attacker('x', { titolarita: 80 })), 0.8)
  assert.equal(expectedShare(attacker('x', { titolarita: 80, appearances: 3, injuryGamesMissed: 3 })), 0.8 * 0.7)
})

test('scores rank players inside their role and Affare compares value with price', () => {
  const inputs = [
    attacker('star', { fm: 9, titolarita: 95, pmaPercent: 20 }),
    attacker('bargain', { fm: 8.5, titolarita: 95, pmaPercent: 2 }),
    attacker('bench', { fm: 6, titolarita: 25, pmaPercent: 1 }),
    attacker('overpriced', { fm: 6.2, titolarita: 50, pmaPercent: 15 }),
    attacker('mid', { fm: 7, titolarita: 75, pmaPercent: 5 }),
  ]
  const results = calculateICaV3(inputs)
  const score = (id: string) => results.get(id)!.score!
  assert.ok(score('star') > score('mid') && score('mid') > score('bench'))
  assert.ok(results.get('bargain')!.affare! > 0, 'rende tanto e costa poco')
  assert.ok(results.get('overpriced')!.affare! < 0, 'costa tanto e rende poco')
  // iCà assoluto: fantapunti attesi a partita ×10, nessun tetto
  assert.equal(results.get('star')!.score!.toFixed(2), (results.get('star')!.adjustedFm! * 0.95 * 10).toFixed(2))
  assert.ok(score('star') > 10 && score('star') < 100)
  assert.equal(results.get('star')!.rolePercentile, 100)
  for (const result of results.values()) assert.ok(result.rolePercentile! >= 0 && result.rolePercentile! <= 100)
})

test('missing titolarità is reported instead of inventing a score', () => {
  const results = calculateICaV3([attacker('a'), attacker('b', { fm: 8 }), attacker('c', { titolarita: undefined })])
  assert.equal(results.get('c')!.score, undefined)
  assert.deepEqual(results.get('c')!.missing, ['titolarità'])
})
