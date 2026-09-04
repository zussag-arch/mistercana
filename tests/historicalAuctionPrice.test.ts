import assert from 'node:assert/strict'
import test from 'node:test'
import { displayHistoricalAuctionPrices, historicalAuctionPrice } from '../src/domain/historicalAuctionPrice.ts'

const detail = { auction_prices: [
  { season: '2025/26', division: 'SERIE_A' as const, coach_name: 'A', price: 10 },
  { season: '2025/26', division: 'SERIE_B' as const, coach_name: 'B', price: 22 },
] } as any

test('seleziona esclusivamente stagione e divisione richieste', () => {
  assert.equal(historicalAuctionPrice(detail, 'SERIE_A'), 10)
  assert.equal(historicalAuctionPrice(detail, 'SERIE_B'), 22)
  assert.equal(displayHistoricalAuctionPrices(detail), '10 / 22 cr')
})

test('non usa fallback da un’altra divisione', () => {
  const onlyA = { ...detail, auction_prices: detail.auction_prices.slice(0, 1) }
  const onlyB = { ...detail, auction_prices: detail.auction_prices.slice(1) }
  assert.equal(displayHistoricalAuctionPrices(onlyA), '10 / — cr')
  assert.equal(displayHistoricalAuctionPrices(onlyB), '— / 22 cr')
  assert.equal(displayHistoricalAuctionPrices(undefined), '— / —')
})

test('gestisce un payload dettaglio legacy con auction_prices nullo', () => {
  assert.equal(displayHistoricalAuctionPrices({ auction_prices: null } as any), '— / —')
})
