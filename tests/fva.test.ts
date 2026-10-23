import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateFva } from '../src/domain/fva.ts'

const means = { mv: 6.2, goals: 0.25, assists: 0.1, yellow: 0.15, red: 0.01, conceded: 1.3 }

test('FVA di un attaccante = voto + bonus attesi − malus, più alto contro una difesa debole', () => {
  const striker = { role: 'A' as const, seasons: [{ appearances: 7, mv: 6.7, goals: 5, assists: 1, xg: 4, xa: 1, yellow: 1, red: 0 }] }
  const weak = calculateFva({ ...striker, opponentIndex: 1, home: true }, means)
  const strong = calculateFva({ ...striker, opponentIndex: 5, home: false }, means)
  assert.ok(weak.fva > strong.fva)
  assert.ok(Math.abs(weak.fva - (weak.mv + 3 * weak.goals + weak.assists - 0.5 * weak.yellow - weak.red)) < 1e-9)
})

test('FVA del portiere sottrae i gol subiti attesi', () => {
  const keeper = calculateFva({ role: 'P', seasons: [{ appearances: 7, mv: 6.3, conceded: 7 }], opponentIndex: 3 }, means)
  assert.ok(keeper.conceded > 0.9 && keeper.fva < keeper.mv)
})

test('pochi dati: frenata verso la media del ruolo', () => {
  const rookie = calculateFva({ role: 'C', seasons: [{ appearances: 1, mv: 8, goals: 2 }] }, means)
  assert.ok(rookie.mv < 6.6 && rookie.goals < 0.5)
})
