import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Carica la sorgente locale sulle tabelle FantaLab reali in database/.
function localSource() {
  const source = readFileSync(new URL('../src/services/fantalabLocal.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: Record<string, (...args: any[]) => any> = {}
  runInNewContext(compiled, { exports, require: (name: string) => {
    if (name.endsWith('fantalab_giocatori.csv?raw')) return { __esModule: true, default: readFileSync(new URL('../database/fantalab_giocatori.csv', import.meta.url), 'utf8') }
    if (name.endsWith('fantalab_allenatori.csv?raw')) return { __esModule: true, default: readFileSync(new URL('../database/fantalab_allenatori.csv', import.meta.url), 'utf8') }
    for (const file of ['fantalab_stagione_precedente', 'voti_giornate', 'storico_stagioni', 'aste']) {
      if (name.endsWith(`${file}.csv?raw`)) return { __esModule: true, default: readFileSync(new URL(`../database/${file}.csv`, import.meta.url), 'utf8') }
    }
    if (name === '../data/csvOverrides') return { getCsv: (_key: string, bundled: string) => bundled }
    throw new Error(`Unexpected dependency: ${name}`)
  } })
  return exports
}

test('reads the FantaLab player table in the FLDA player shape', () => {
  const page = localSource().localPlayers()
  assert.ok(page.players.length > 450)
  const ids = new Set(page.players.map((player: any) => player.player_id))
  assert.equal(ids.size, page.players.length)
  for (const player of page.players) {
    assert.match(player.player_id, /^[0-9a-f-]{36}$/)
    assert.match(player.role, /^[PDCA]$/)
  }
  const varela = page.players.find((player: any) => player.name === 'Varela G.')
  assert.equal(varela.team, 'Monza')
  assert.equal(varela.titolarita_display, 95)
  assert.equal(varela.fm_exp, 10.08)
  assert.equal(varela.classic_10_mod_median_value, 0.2)
  assert.deepEqual([...varela.mantra_roles], ['Pc'])
})

test('builds team guide and set-piece hierarchies from the coaches table', () => {
  const local = localSource()
  const guide = local.localTeamGuide('Atalanta')
  assert.ok(guide.starting_xi.length >= 9)
  assert.deepEqual({ ...guide.key_roles[0] }, { role: 'att-wings', tone: 'good' })
  const hierarchies = local.localTeamHierarchies('Atalanta')
  const penalty = hierarchies.filter((row: any) => row.hierarchy_type === 'PENALTY')
  assert.ok(penalty.length >= 2)
  assert.equal(penalty[0].source_rank, 1)
  assert.equal(hierarchies.filter((row: any) => row.hierarchy_type === 'GOALKEEPER' && row.source_rank === 1).length, 1)
})

test('exposes current-season history and detail for every player', () => {
  const local = localSource()
  const history = local.localBulkHistory()
  const first = history.players[0]
  assert.equal(first.history[0].season, '2026/27')
  const detail = local.localPlayerDetail(first.player_id)
  assert.equal(detail.current.player_id, first.player_id)
  assert.ok(detail.guide)
})
