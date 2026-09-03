import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { defaultState } from '../src/app/state.ts'
import { getFldaPma } from '../src/domain/pma.ts'

const storageSource = readFileSync(new URL('../src/app/storage.ts', import.meta.url), 'utf8')

test('defaults PMA centrally to Classic 8 with defense modifier', () => {
  assert.deepEqual(defaultState.pmaConfiguration, {
    mode: 'classic', participants: 8, defenseModifier: true,
  })
  assert.equal(defaultState.defenseModifierEnabled, true)
  assert.equal(getFldaPma({
    player_id: 'uuid', name: 'Carnesecchi', team: 'Atalanta', role: 'P',
    classic_8_mod_median_value: 7.6,
    classic_8_no_mod_median_value: 6.4,
  }, defaultState.pmaConfiguration), 7.6)
})

test('storage normalizes missing PMA config and preserves a valid explicit one', () => {
  assert.match(storageSource, /normalizePmaConfiguration\(\s*parsed\.pmaConfiguration,\s*parsed\.defenseModifierEnabled/)
  assert.match(storageSource, /return \{ mode, participants, defenseModifier: candidate\.defenseModifier \}/)
  assert.match(storageSource, /typeof legacyDefenseModifier === 'boolean'/)
})
