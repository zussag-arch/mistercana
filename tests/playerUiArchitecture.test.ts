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

test('loads detail on overlay open and fixtures only for goalkeepers and attackers', () => {
  const page = source('src/pages/players.ts')
  assert.match(page, /loadPlayerDetail\(fldaId\)/)
  assert.match(page, /role === 'P' \|\| role === 'A'/)
  assert.match(page, /role === 'P' \? 'goalkeeper' : 'attacker'/)
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

test('does not calculate Saggi averages and avoids viewport-wide mobile content', () => {
  const view = source('src/components/playerDataView.ts')
  const playersCss = source('src/styles/players.css')
  const detailCss = source('src/styles/playerDetail.css')
  assert.equal(/media prezzo|reduce\(|average|media\(/i.test(view), false)
  assert.equal(/min-width:\s*[4-9]\d{2}px/i.test(playersCss + detailCss), false)
  assert.match(detailCss, /overflow-x:hidden/)
})

test('renders FLDA competition members instead of empty ballottaggi', () => {
  const detail = source('src/pages/playerDetail.ts')
  assert.match(detail, /field\(competition, 'members'\)/)
  assert.match(detail, /field\(member, 'name'\)/)
  assert.match(detail, /competitionList\(field\(guide,'competitions'\)\)/)
})
