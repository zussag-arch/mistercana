import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as ica from '../src/domain/icaV2.ts'

// Exercise the real repository with isolated transport fixtures, without HTTP or storage.
function repositoryFixture(historyFails = false) {
  const calls: string[] = []
  const inputs: ica.ICaV2Input[] = []
  const players = ['d1', 'd2', 'p1', 'a1'].map((id, index) => ({
    player_id: id, name: id, team: id === 'a1' ? 'Unavailable' : 'Test',
    role: id[0].toUpperCase(), mantra_roles: ['Dc'], fm_exp: 6 + index,
    titolarita_display: 80,
  }))
  const transport = {
    getFldaPlayers: async () => ({ players }),
    getFldaBulkHistory: async () => {
      if (historyFails) throw new Error('HTTP 404')
      return { players: players.map((player) => ({ player_id: player.player_id, history: [] })) }
    },
    getFldaTeamGuide: async () => ({
      starting_xi: [{ player_id: 'd1' }],
      key_roles: [{ role: 'def-center', tone: 'good' }, { role: 'gk', tone: 'bad' },
        null, { role: 1, tone: 'good' }, { role: 'gk', tone: 'unknown' }],
    }),
    getFldaTeamHierarchies: async () => ['PENALTY', 'FREE_KICK', 'CORNER', 'GOALKEEPER']
      .map((hierarchy_type) => ({ player_id: 'd1', hierarchy_type, source_rank: 1 })),
    getFldaTeamFixtures: async (team: string, context: string) => {
      calls.push(`${team}|${context}`)
      if (team === 'Unavailable') throw new Error('Fixture unavailable')
      return [{ day: 4, difficulty_category: 'difficult' },
        ...[5, 6, 7, 8, 9].map((day) => ({ day, difficulty_category: 'easy' })),
        { day: 10, difficulty_category: 'difficult' }]
    },
  }
  const source = readFileSync(new URL('../src/services/playerRepository.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: Record<string, (...args: any[]) => any> = {}
  runInNewContext(compiled, { exports, require: (name: string) => {
    if (name === '../data/players') return { players: [] }
    if (name === './flda') return transport
    if (name === './playerIdentity') return { initializePlayerIdentity() {} }
    if (name === '../domain/icaV2') return { ...ica, calculateICaV2: (input: ica.ICaV2Input, refs: ica.ICaReferences) => {
      inputs.push(input)
      return ica.calculateICaV2(input, refs)
    } }
    throw new Error(`Unexpected dependency: ${name}`)
  } })
  return { repository: exports, calls, inputs }
}

test('repository forwards enriched ICA inputs and deduplicates fixtures by team/context', async () => {
  const { repository, calls, inputs } = repositoryFixture()
  const dataset = await repository.loadPlayersDataset()
  assert.equal(dataset.source, 'flda')
  assert.equal(inputs.length, 4)
  assert.deepEqual(calls.sort(), ['Test|attacker', 'Test|goalkeeper', 'Unavailable|attacker'])
  const input = inputs.find((item) => item.player.player_id === 'd1')!
  assert.deepEqual(input.player.mantra_roles, ['Dc'])
  assert.equal(input.rolePlayers, dataset.players)
  assert.equal(input.coachRoles?.length, 2)
  assert.equal(input.coachRoles?.[0].tone, 'good')
  assert.equal(input.currentMatchday, 4)
  assert.equal(input.player.is_starting_xi, true)
  for (const rank of ['penalty_rank', 'free_kick_rank', 'corner_rank', 'goalkeeper_rank'] as const) {
    assert.equal(input.player[rank], 1)
  }
  assert.equal(repository.getCachedICaV2('d1').calendario, 100)
  assert.equal(repository.getCachedICaV2('d1').piazzati, 8)
  assert.equal(repository.getCachedICaV2('a1').score, undefined)
  assert.equal(repository.getBulkHistoryState().status, 'loaded')
  await repository.loadPlayersDataset()
  assert.equal(calls.length, 3)
})

test('technical history failure stays distinct from loaded empty history', async () => {
  const { repository, inputs } = repositoryFixture(true)
  await repository.loadPlayersDataset()
  assert.equal(repository.getBulkHistoryState().status, 'error')
  assert.equal(repository.getCachedICaV2('d1'), undefined)
  assert.equal(inputs.length, 0)
})
