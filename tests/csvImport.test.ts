import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { analyzeCsv } from '../src/data/csvImport.ts'

const players = readFileSync(new URL('../database/fantalab_giocatori.csv', import.meta.url), 'utf8')
const coaches = readFileSync(new URL('../database/fantalab_allenatori.csv', import.meta.url), 'utf8')
const grid = readFileSync(new URL('../database/griglia_attaccanti.csv', import.meta.url), 'utf8')
const current = (key: string) => key === 'fantalab_giocatori' ? players : key === 'fantalab_allenatori' ? coaches : grid

test('recognises the real FantaLab files and reports no differences against themselves', () => {
  const result = analyzeCsv('fantalab_giocatori.csv', players, current)
  assert.equal(result.key, 'fantalab_giocatori')
  assert.equal(result.ok, true, result.errors.join(' '))
  assert.match(result.summary[1], /nessun giocatore nuovo/)
  assert.equal(analyzeCsv('allenatori.csv', coaches, current).key, 'fantalab_allenatori')
  assert.equal(analyzeCsv('griglia_attaccanti_nuova.csv', grid, current).key, 'griglia_attaccanti')
})

test('detects team changes and removed players in a new listone', () => {
  const lines = players.split(/\r?\n/)
  const header = lines[0].split(';')
  const teamIndex = header.indexOf('Squadra')
  const moved = lines[1].split(';'); moved[teamIndex] = 'Como'
  const changed = [lines[0], moved.join(';'), ...lines.slice(3)].join('\n')
  const result = analyzeCsv('fantalab_giocatori.csv', changed, current)
  assert.equal(result.ok, true)
  assert.ok(result.summary.some((line) => /1 usciti/.test(line)))
  assert.ok(result.summary.some((line) => /cambi di squadra/.test(line)))
})

test('rejects unknown files and files with missing columns', () => {
  assert.equal(analyzeCsv('qualcosa.csv', 'a;b\n1;2', current).ok, false)
  const broken = players.replace('Titolarità % (Guida)', 'Titolarita')
  const result = analyzeCsv('fantalab_giocatori.csv', broken, current)
  assert.equal(result.ok, false)
  assert.match(result.errors[0], /Titolarità % \(Guida\)/)
})
