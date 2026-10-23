import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('FLDA-only adapter maps direct inputs, iCà and does not mutate assignments', () => {
  const adapter = readFileSync(new URL('../src/services/auctionStrategyAdapter.ts', import.meta.url), 'utf8')
  assert.match(adapter, /id: legacy\?\.id \?\? flda\.player_id/)
  assert.match(adapter, /startingProbability:[\s\S]*flda\.titolarita_display/)
  assert.match(adapter, /pmaPercent: getFldaPma\(flda, state\.pmaConfiguration\)/)
  assert.match(adapter, /xFmv:[\s\S]*flda\.fm_exp/)
  assert.match(adapter, /iCa: getICa\(flda\.player_id\)\?\.rolePercentile/)
  assert.match(adapter, /adapted \? \{ \.\.\.assignment, playerId: adapted\.id \} : \{ \.\.\.assignment \}/)
})

test('auction FLDA-only flow uses UUID history and canonical strategy context', () => {
  const auction = readFileSync(new URL('../src/pages/auction.ts', import.meta.url), 'utf8')
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  assert.match(auction, /getCachedPlayerDetail\(player\.canonicalId\)/)
  assert.match(auction, /loadPlayerDetail\(selectedFldaId\)/)
  assert.match(auction, /calculatePriceAdvice\(strategy\.state, strategyPlayer, strategy\.players\)/)
  assert.match(main, /renderCompetitorAnalysis\(\s*strategy\.state,\s*player,\s*strategy\.players/)
})

test('auction strategic controls have explicit readable theme styles', () => {
  const css = readFileSync(new URL('../src/styles/auction.css', import.meta.url), 'utf8')
  assert.match(css, /\.auction-recommendation-name-button\s*\{[\s\S]*background:\s*transparent;[\s\S]*color:\s*var\(--text\);/)
  const themeCss = readFileSync(new URL('../src/styles/theme-v3-auction.css', import.meta.url), 'utf8')
  assert.match(themeCss, /\.auction-player-detail-trigger\s*\{[\s\S]*background:\s*rgba\(var\(--ink-rgb\), 0\.08\);[\s\S]*font-size:\s*12px;/)
})
