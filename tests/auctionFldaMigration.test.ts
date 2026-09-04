import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('Auction selector is FLDA-bulk native and stores the current UUID', () => {
  const auction = source('src/pages/auction.ts')
  assert.match(auction, /dataset\.players\.filter/)
  assert.match(auction, /player\.player_id/)
  assert.match(auction, /state\.currentAuctionFldaPlayerId\s*=\s*player\.canonicalId/)
})

test('new purchases use explicit FLDA identity and guard duplicates', () => {
  const auction = source('src/pages/auction.ts')
  assert.match(auction, /fldaPlayerId:\s*player\.canonicalId/)
  assert.match(auction, /isFldaPlayerAssigned\(state\.auctionAssignments, player\.canonicalId\)/)
  const state = source('src/app/state.ts')
  assert.match(state, /playerId\?: string/)
  assert.match(state, /fldaPlayerId\?: string/)
})

test('central resolver covers canonical fields and roster totals', () => {
  const resolver = source('src/services/auctionPlayerResolver.ts')
  for (const symbol of ['getAssignmentFldaId', 'resolveAssignmentPlayer', 'resolveCurrentAuctionPlayer', 'isFldaPlayerAssigned', 'summarizeManagerAssignments']) {
    assert.match(resolver, new RegExp(`export function ${symbol}`))
  }
  assert.match(resolver, /name: flda\.name, team: flda\.team, role: flda\.role/)
  assert.match(resolver, /spent\[player\.role\] \+= assignment\.price/)
  assert.match(resolver, /slots\[player\.role\] \+= 1/)
})

test('storage reads old and new assignments and archives without remapping', () => {
  const storage = source('src/app/storage.ts')
  assert.match(storage, /currentAuctionFldaPlayerId\?: unknown/)
  assert.match(storage, /if \(!playerId && !fldaPlayerId\)/)
  assert.match(storage, /`flda:\$\{fldaPlayerId\}`/)
  assert.match(storage, /`legacy:\$\{playerId\}`/)
  assert.match(storage, /\.\.\.\(playerId \? \{ playerId \} : \{\}\)/)
  assert.match(storage, /\.\.\.\(fldaPlayerId \? \{ fldaPlayerId \} : \{\}\)/)
  assert.match(storage, /migrateArchivedAuctions[\s\S]*migrateAuctionAssignments/)
})

test('catalog rejects duplicate UUIDs and offline fallback does not fake xFM', () => {
  const repository = source('src/services/playerRepository.ts')
  assert.match(repository, /export function indexFldaPlayers/)
  assert.match(repository, /UUID duplicati/)
  assert.match(repository, /byId: new Map\(\)/)
  assert.match(repository, /fm_exp:\s*null/)
  assert.doesNotMatch(repository, /fm_exp:\s*player\.fmv/)
})

test('call actions accept FLDA UUID without requiring legacy mapping', () => {
  const overlay = source('src/components/playerDetailOverlay.ts')
  const detail = source('src/pages/playerDetail.ts')
  const main = source('src/main.ts')
  assert.match(overlay, /const callId = view\.flda\.player_id \?\? view\.legacyId/)
  assert.match(detail, /escapePlayerHtml\(flda\.player_id\)/)
  assert.match(main, /dataset\.byId\.get\(playerId\)/)
})

test('Auction uses the shared bulk and no per-row detail loading', () => {
  const auction = source('src/pages/auction.ts')
  assert.equal(auction.includes('getFldaPlayers('), false)
  assert.match(auction, /loadPlayersDataset\(\)/)
  assert.match(auction, /FLDA non disponibile/)
})
