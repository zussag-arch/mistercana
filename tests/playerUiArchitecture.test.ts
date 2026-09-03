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
  assert.equal(repository.includes('teams.map(async (team)'), true)
  assert.equal(repository.includes('players.map(async (player)'), false)
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
  assert.match(view, /Prezzo \(crediti\)/)
  assert.match(view, /Media Saggi/)
  assert.match(view, /Valore descrittivo; non modifica i calcoli/)
  assert.match(view, />Voto</)
  assert.match(view, /chart-tick/)
  assert.ok(view.indexOf('player-chart-summary') < view.indexOf('<svg viewBox="0 0 620 245"'))
  assert.match(view, /Andamento multi-stagione MV e FMV/)
  assert.equal(/min-width:\s*[4-9]\d{2}px/i.test(playersCss + detailCss), false)
  assert.match(detailCss, /overflow-x:hidden/)
})

test('uses the auction team-grid pattern and filters teams locally', () => {
  const page = source('src/pages/players.ts')
  assert.match(page, /players-team-filter/)
  assert.match(page, /auction-team-selector/)
  assert.match(page, /auction-team-choice/)
  assert.match(page, /data-player-team="ALL">Tutte/)
  assert.equal(page.includes('playersTeamFilter'), false)
  assert.match(page, /refreshPlayerResults\(state, actions\)/)
})

test('shows the centrally selected FLDA PMA in list and shared detail metrics', () => {
  const page = source('src/pages/players.ts')
  const view = source('src/components/playerDataView.ts')
  const detail = source('src/pages/playerDetail.ts')
  assert.match(page, /getFldaPma\(player, state\.pmaConfiguration\)/)
  assert.match(page, /pmaConfiguration: state\.pmaConfiguration/)
  assert.match(detail, /pmaConfiguration: state\.pmaConfiguration/)
  assert.match(view, /getFldaPma\(view\.flda, view\.pmaConfiguration\)/)
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
  assert.equal(/Ordini editoriali/i.test(detail), false)
  assert.equal(/<details/.test(detail), false)
  assert.equal(/Espandi|Riduci/.test(detail), false)
  assert.match(detail, /Statistiche avanzate/)
})

test('keeps badges beside the player name and provides combinable filters', () => {
  const page = source('src/pages/players.ts')
  const view = source('src/components/playerDataView.ts')
  assert.match(page, /players-name-line[\s\S]*renderPlayerBadges\(view\)/)
  for (const filter of ['freeOnly', 'startingXi', 'goalkeeperOne', 'penalty', 'freeKick', 'corner']) {
    assert.match(page, new RegExp(`data-player-filter="${filter}"`))
  }
  assert.match(page, /Filtri\$\{activeFilters/)
  assert.match(page, /Azzera filtri/)
  assert.match(view, /🧤 P\$\{view\.flda\.goalkeeper_rank\}/)
  assert.match(view, /🥅/)
  assert.match(view, /👟/)
  assert.match(view, /🚩/)
})

test('filters search locally without rerendering the search input or requesting data', () => {
  const page = source('src/pages/players.ts')
  const inputHandler = page.match(/#playersSearch[^\n]+/)?.[0] ?? ''
  assert.match(inputHandler, /refreshPlayerResults\(state, actions\)/)
  assert.equal(inputHandler.includes('actions.onRender()'), false)
  assert.equal(inputHandler.includes('loadPlayersDataset'), false)
})

test('renders FLDA competition members instead of empty ballottaggi', () => {
  const detail = source('src/pages/playerDetail.ts')
  assert.match(detail, /field\(competition, 'members'\)/)
  assert.match(detail, /field\(member, 'name'\)/)
  assert.match(detail, /playerCompetitions\(field\(guide, 'competitions'\), view\.flda\.name\)/)
})
