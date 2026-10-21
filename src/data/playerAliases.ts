// Dizionario codice del listone <-> ID FantaLab.
// I giocatori storici hanno nel listone il vecchio codice ("0280"), mentre i file
// scaricati da FantaLab (Saggi, gerarchie portieri) usano l'ID FantaLab.
// Il listone registra qui le coppie; chi cerca per codice prova entrambe.

const fantalabByListone = new Map<string, string>()

export function registerPlayerAlias(listoneId: string, fantalabId: string | undefined): void {
  if (fantalabId && fantalabId !== listoneId) fantalabByListone.set(listoneId, fantalabId)
}

/** Chiavi con cui cercare un giocatore nei file: codice del listone e ID FantaLab. */
export function playerKeys(listoneId: string): string[] {
  const fantalabId = fantalabByListone.get(listoneId)
  return fantalabId ? [listoneId, fantalabId] : [listoneId]
}
