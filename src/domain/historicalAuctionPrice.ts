import type { FldaPlayerDetail } from '../services/flda'

export type HistoricalDivision = 'SERIE_A' | 'SERIE_B'
/** stagione dell'asta più recente presente nei dati (es. "2026/27") */
export function latestAuctionSeason(detail: FldaPlayerDetail | undefined): string | undefined {
  return (detail?.auction_prices ?? []).map((item) => item.season).sort().pop()
}

export function historicalAuctionPrice(detail: FldaPlayerDetail | undefined,
  division: HistoricalDivision): number | undefined {
  const season = latestAuctionSeason(detail)
  const row = detail?.auction_prices?.find((item) =>
    item.season === season && item.division === division)
  return row && Number.isInteger(row.price) ? row.price : undefined
}

export function displayHistoricalAuctionPrices(detail: FldaPlayerDetail | undefined): string {
  const serieA = historicalAuctionPrice(detail, 'SERIE_A')
  const serieB = historicalAuctionPrice(detail, 'SERIE_B')
  const pair = `${serieA ?? '—'} / ${serieB ?? '—'}`
  return serieA === undefined && serieB === undefined ? pair : `${pair} cr`
}
