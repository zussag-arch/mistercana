import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getFldaIdFromLegacyId,
  getIdentityMatchStatus,
  getLegacyIdFromFldaId,
  initializePlayerIdentity,
} from '../src/services/playerIdentity.ts'

const uuid = '0e05ec77-0d73-452e-8d72-7ddf162ced52'
const legacy = {
  id: '0001', name: 'Carnesecchi', team: 'Atalanta', role: 'P',
}
const flda = {
  player_id: uuid, name: 'Carnesecchi', team: 'Atalanta', role: 'P',
}

test('maps legacy to FLDA and back for Carnesecchi', () => {
  initializePlayerIdentity([legacy], [flda])
  assert.equal(getFldaIdFromLegacyId('0001'), uuid)
  assert.equal(getLegacyIdFromFldaId(uuid), '0001')
})

test('prefers fantacalcio_id over names', () => {
  const summary = initializePlayerIdentity(
    [{ ...legacy, fantacalcioId: '4431' }],
    [{ ...flda, name: 'Changed', team: 'Changed', fantacalcio_id: '4431' }],
  )
  assert.equal(summary.matchedByExplicitId, 1)
  assert.equal(getIdentityMatchStatus('0001').matchedBy, 'fantacalcio_id')
})

test('reports unmatched without mapping', () => {
  initializePlayerIdentity([legacy], [])
  assert.equal(getIdentityMatchStatus('0001').status, 'identity_unmatched')
  assert.equal(getFldaIdFromLegacyId('0001'), undefined)
})

test('reports ambiguous without mapping', () => {
  initializePlayerIdentity([legacy], [flda, { ...flda, player_id: 'other' }])
  assert.equal(getIdentityMatchStatus('0001').status, 'identity_ambiguous')
  assert.equal(getFldaIdFromLegacyId('0001'), undefined)
  assert.equal(getLegacyIdFromFldaId(uuid), undefined)
})

test('does not perform fuzzy matching', () => {
  initializePlayerIdentity([{ ...legacy, name: 'Carnesec' }], [flda])
  assert.equal(getIdentityMatchStatus('0001').status, 'identity_unmatched')
})

test('does not mutate legacy auction state or persisted IDs', () => {
  const state = {
    currentAuctionPlayerId: '0001',
    auctionAssignments: [{ playerId: '0001' }],
    recommendedDiscards: ['0001'],
    objectives: [{ playerId: '0001' }],
  }
  const before = JSON.stringify(state)
  initializePlayerIdentity([legacy], [flda])
  assert.equal(JSON.stringify(state), before)
  assert.equal(state.auctionAssignments[0].playerId, '0001')
})

test('treats a candidate without FLDA UUID as unmatched', () => {
  initializePlayerIdentity([legacy], [{ ...flda, player_id: null }])
  assert.equal(getIdentityMatchStatus('0001').status, 'identity_unmatched')
})

test('tries the next explicit ID before deterministic fallback', () => {
  const summary = initializePlayerIdentity(
    [{
      ...legacy,
      fantacalcioId: 'missing',
      sportsmonksId: '22878016',
    }],
    [{ ...flda, sportsmonks_id: '22878016' }],
  )
  assert.equal(summary.matchedByExplicitId, 1)
  assert.equal(getIdentityMatchStatus('0001').matchedBy, 'sportsmonks_id')
})
