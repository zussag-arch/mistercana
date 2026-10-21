import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const playersPage = readFileSync(new URL('../src/pages/players.ts', import.meta.url), 'utf8')
const auction = readFileSync(new URL('../src/pages/auction.ts', import.meta.url), 'utf8')
const repository = readFileSync(new URL('../src/services/playerRepository.ts', import.meta.url), 'utf8')

test('Players and Auction consume the same iCà 3 value', () => {
  assert.match(playersPage, /getICaV3\(player\.player_id\)\?\.score/)
  assert.match(auction, /getICaV3\(flda\.player_id\)\?\.score/)
})

test('the player repository no longer computes the retired iCà V2', () => {
  assert.doesNotMatch(repository, /icaV2|ICaV2|getFldaBulkHistory|getFldaTeamFixtures/)
})
