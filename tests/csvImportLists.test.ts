import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeCsv } from '../src/data/csvImport.ts'

// i file "a elenco" esportati da FLDA non vanno controllati come griglie squadra × squadra
test('i CSV a elenco di FLDA vengono riconosciuti e accettati', () => {
  const files: Array<[string, string]> = [
    ['sos_consigli.csv', 'ID FantaLab;Ruolo;Fascia;Giornata;Nome;Fonte\nabc;C;1;8;Paz N;https://x'],
    ['voti_giornate.csv', 'ID Fantacalcio;Nome;Squadra;Ruolo;Giornata;Voto;Fantavoto\n1;Rossi;Inter;D;1;6;6'],
    ['storico_stagioni.csv', 'ID Fantacalcio;Nome;Stagione;Squadra;Presenze;MV;FMV\n1;Rossi;2025/26;Inter;30;6;6.5'],
    ['sos_probabili.csv', 'ID FantaLab;Squadra;Nome;Modulo;Probabilità;Ballottaggio\nabc;Inter;Rossi;3-5-2;80;'],
    ['probabili.csv', 'ID FantaLab;Giornata;Squadra;Avversario;Casa;Probabilità\nabc;8;Inter;Milan;Sì;80'],
  ]
  for (const [name, content] of files) {
    const result = analyzeCsv(name, content, () => '')
    assert.equal(result.ok, true, `${name}: ${result.errors.join(' ')}`)
    assert.ok(!result.errors.some((error) => error.includes('Squadre senza riga')))
  }
})
