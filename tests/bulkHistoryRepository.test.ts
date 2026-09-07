import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const client = readFileSync(new URL('../src/services/flda.ts', import.meta.url), 'utf8')
const repository = readFileSync(new URL('../src/services/playerRepository.ts', import.meta.url), 'utf8')
const playersPage = readFileSync(new URL('../src/pages/players.ts', import.meta.url), 'utf8')
const auction = readFileSync(new URL('../src/pages/auction.ts', import.meta.url), 'utf8')

test('bulk history client performs one typed request for three seasons', () => {
  assert.match(client, /interface FldaBulkHistoryResponse[\s\S]*players: FldaBulkHistoryPlayer\[\]/)
  assert.match(client, /getFldaBulkHistory[\s\S]*`\/api\/history\/bulk\?\$\{query\.toString\(\)\}`/)
})

test('repository has shared loading loaded and error states distinct from empty history', () => {
  assert.match(repository, /'idle' \| 'loading' \| 'loaded' \| 'error'/)
  assert.match(repository, /byPlayerId\.set\(player\.player_id, player\.history\)/)
  assert.match(repository, /historyState = \{ status: 'loaded'/)
  assert.match(repository, /historyState = \{ status: 'error'/)
})

test('bulk history fetch and computation are cached once without per-player detail requests', () => {
  assert.match(repository, /if \(historyRequest\) return historyRequest/)
  assert.match(repository, /if \(historyState\.status === 'loaded' && !force\) return Promise\.resolve/)
  const loadBody = repository.slice(repository.indexOf('export function loadBulkHistory'), repository.indexOf('export function getBulkHistoryState'))
  assert.equal((loadBody.match(/getFldaBulkHistory\(/g) ?? []).length, 1)
  assert.doesNotMatch(loadBody, /getFldaPlayerDetail/)
})

test('Players and Auction consume the same cached V2 value', () => {
  assert.match(playersPage, /getCachedICaV2\(player\.player_id\)\?\.score/)
  assert.match(auction, /getCachedICaV2\(flda\.player_id\)\?\.score/)
})
