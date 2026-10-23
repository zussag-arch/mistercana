import assert from 'node:assert/strict'
import test from 'node:test'
import { decideBid } from '../src/domain/bidDecision.ts'
import type { BidInput } from '../src/domain/bidDecision.ts'

const base: BidInput = {
  role: 'P', currentPrice: 0, ceiling: 55, financialLimit: 164, value: 58,
  ownerRoleOpen: 3, alternatives: 1, rolePercentile: 95,
  rivals: [{ name: 'Davide', capacity: 381, estimatedBid: 84 }, { name: 'Simone', capacity: 30, estimatedBid: 20 }],
}

test('rilancia fino al tetto se qualcuno può ancora superarti', () => {
  const decision = decideBid(base)
  assert.equal(decision.action, 'RILANCIA')
  assert.equal(decision.maxBid, 55)
  assert.equal(decision.confidence, 'alta')
  assert.ok(decision.reasons.length <= 3)
  assert.deepEqual(decision.threats.map((rival) => rival.name), ['Davide', 'Simone'])
})

test('compra se nessun avversario ha crediti per rilanciare', () => {
  const decision = decideBid({ ...base, currentPrice: 40, rivals: [{ name: 'Simone', capacity: 30, estimatedBid: 20 }] })
  assert.equal(decision.action, 'COMPRA')
  assert.equal(decision.maxBid, 41)
  assert.match(decision.reasons.join(' '), /Nessun avversario/)
})

test('passa oltre il tetto, oltre il limite finanziario o con il reparto pieno', () => {
  assert.equal(decideBid({ ...base, currentPrice: 60 }).action, 'PASSA')
  assert.match(decideBid({ ...base, currentPrice: 60 }).reasons[0], /Oltre il tuo tetto di 55 cr/)
  assert.match(decideBid({ ...base, financialLimit: 20, currentPrice: 20 }).reasons[0], /non completi più la rosa/)
  assert.match(decideBid({ ...base, ownerRoleOpen: 0 }).reasons[0], /Hai già tutti i portieri/)
})

test('il massimo consigliato non supera mai il limite finanziario', () => {
  const decision = decideBid({ ...base, ceiling: 55, financialLimit: 164 })
  assert.ok((decision.maxBid ?? 0) <= 164)
})
