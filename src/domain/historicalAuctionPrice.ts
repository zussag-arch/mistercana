import type { FldaPlayerDetail } from '../services/flda'

export type HistoricalDivision = 'SERIE_A' | 'SERIE_B'
export const PREVIOUS_AUCTION_SEASON = '2025/26'

export function historicalAuctionPrice(detail: FldaPlayerDetail | undefined,
  division: HistoricalDivision): number | undefined {
  const row = detail?.auction_prices?.find((item) =>
    item.season === PREVIOUS_AUCTION_SEASON && item.division === division)
  return row && Number.isInteger(row.price) ? row.price : undefined
}

export function displayHistoricalAuctionPrices(detail: FldaPlayerDetail | undefined): string {
  const serieA = historicalAuctionPrice(detail, 'SERIE_A')
  const serieB = historicalAuctionPrice(detail, 'SERIE_B')
  const pair = `${serieA ?? '—'} / ${serieB ?? '—'}`
  return serieA === undefined && serieB === undefined ? pair : `${pair} cr`
}
