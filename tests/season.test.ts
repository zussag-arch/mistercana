import test from 'node:test'
import assert from 'node:assert/strict'
import { seasonOf } from '../src/domain/season.ts'

test("stagione dell'asta dalla data: da luglio comincia la nuova", () => {
  assert.equal(seasonOf(new Date(2027, 7, 20)), '2027/28')
  assert.equal(seasonOf(new Date(2027, 6, 1)), '2027/28')
  assert.equal(seasonOf(new Date(2027, 1, 10)), '2026/27')
  assert.equal(seasonOf(new Date(2099, 8, 1)), '2099/00')
})
