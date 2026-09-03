import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

test('loads the players bulk only through the shared in-memory repository', () => {
  const repository = source('src/services/playerRepository.ts')
  const page = source('src/pages/players.ts')
  assert.equal((repository.match(/getFldaPlayers\(/g) ?? []).length, 1)
  assert.equal(page.includes('getFldaPlayers('), false)
  assert.equal(page.includes('.map((player) => loadPlayerDetail'), false)
})

test('loads detail only on demand and does not request removed fixture views', () => {
  const page = source('src/pages/players.ts')
  const detail = source('src/pages/playerDetail.ts')
  assert.match(page, /loadPlayerDetail\(fldaId\)/)
  assert.equal(page.includes('loadTeamFixtures'), false)
  assert.equal(detail.includes('loadTeamFixtures'), false)
})

test('keeps unmatched players usable and exposes the full-page destination', () => {
  const overlay = source('src/components/playerDetailOverlay.ts')
  const navigation = source('src/components/navigation.ts')
  const main = source('src/main.ts')
  assert.match(overlay, /Dati FLDA non disponibili/)
  assert.match(overlay, /data-open-full-player/)
  assert.match(navigation, /'playerDetail'/)
  assert.match(main, /renderFullPlayerPage/)
})

test('renders the requested descriptive charts and avoids viewport-wide mobile content', () => {
  const view = source('src/components/playerDataView.ts')
  const playersCss = source('src/styles/players.css')
  const detailCss = source('src/styles/playerDetail.css')
  assert.match(view, /La media è descrittiva e non modifica i calcoli/)
  assert.match(view, /Andamento multi-stagione MV e FMV/)
  assert.equal(/min-width:\s*[4-9]\d{2}px/i.test(playersCss + detailCss), false)
  assert.match(detailCss, /overflow-x:hidden/)
})

test('uses compact requested columns, role/iCa default order and offline-only retry', () => {
  const page = source('src/pages/players.ts')
  assert.match(page, /sortKey: 'default'/)
  assert.match(page, /roleOrder = \['P', 'D', 'C', 'A'\]/)
  assert.match(page, /Giocatore[\s\S]*iCà[\s\S]*PMA[\s\S]*xFM[\s\S]*Titolarità[\s\S]*MV\/FMV[\s\S]*Stato/)
  assert.match(page, /dataset\?\.source === 'legacy' \? '<button id="retryPlayers"/)
})

test('full player page removes dedicated Saggi and Calendar sections', () => {
  const detail = source('src/pages/playerDetail.ts')
  assert.equal(/<h2>Saggi<\/h2>/.test(detail), false)
  assert.equal(/<h2>Calendario<\/h2>/.test(detail), false)
  assert.match(detail, /Statistiche avanzate/)
  assert.match(detail, />Espandi</)
})

test('renders FLDA competition members instead of empty ballottaggi', () => {
  const detail = source('src/pages/playerDetail.ts')
  assert.match(detail, /field\(competition, 'members'\)/)
  assert.match(detail, /field\(member, 'name'\)/)
  assert.match(detail, /playerCompetitions\(field\(guide, 'competitions'\), view\.flda\.name\)/)
})
