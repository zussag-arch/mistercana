// Decisione durante la chiamata: COMPRA, RILANCIA FINO A, PASSA.
// Calcolo deterministico (nessuna IA): stessi dati → stessa decisione.
//
//   PASSA        reparto già completo, prezzo oltre il limite finanziario o oltre il tetto consigliato
//   COMPRA       nessun avversario ha slot liberi nel ruolo e crediti per rilanciare
//   RILANCIA     altrimenti, fino al tetto consigliato
//
// Motivi (al massimo 3): fabbisogno nel ruolo, alternative rimaste, valore, avversari.

export type BidAction = 'COMPRA' | 'RILANCIA' | 'PASSA'
export type BidConfidence = 'alta' | 'media' | 'bassa'

export interface BidRival {
  name: string
  /** massimo che può spendere ora tenendo 1 cr per ogni altro slot vuoto */
  capacity: number
  /** puntata tipica stimata dallo storico */
  estimatedBid: number
}

export interface BidInput {
  role: string
  currentPrice: number
  /** tetto consigliato (valore, reparto e finanze già combinati) */
  ceiling?: number
  /** massimo spendibile da te ora */
  financialLimit?: number
  /** valore d'asta stimato */
  value?: number
  /** slot ancora liberi nella tua rosa per questo ruolo */
  ownerRoleOpen: number
  /** giocatori dello stesso ruolo ancora liberi e di livello simile (iCà non più basso di 5 punti) */
  alternatives: number
  /** posizione nel ruolo secondo l'iCà, 0-100 */
  rolePercentile?: number
  /** avversari con almeno uno slot libero nel ruolo */
  rivals: BidRival[]
}

export interface BidDecision {
  action: BidAction
  maxBid?: number
  confidence: BidConfidence
  reasons: string[]
  /** avversari che possono ancora superare il prezzo, dal più pericoloso */
  threats: BidRival[]
}

const ROLE_PLURAL: Record<string, [string, string]> = {
  P: ['portiere', 'portieri'], D: ['difensore', 'difensori'], C: ['centrocampista', 'centrocampisti'], A: ['attaccante', 'attaccanti'],
}
const noun = (role: string, count: number) => (ROLE_PLURAL[role] ?? [role, role])[count === 1 ? 0 : 1]
const names = (list: BidRival[]) => list.slice(0, 2).map((rival) => rival.name).join(' e ') + (list.length > 2 ? ` (+${list.length - 2})` : '')

export function decideBid(input: BidInput): BidDecision {
  const price = Math.max(0, Math.round(input.currentPrice || 0))
  const next = price + 1
  const threats = input.rivals
    .filter((rival) => rival.capacity >= next)
    .sort((a, b) => b.estimatedBid - a.estimatedBid || b.capacity - a.capacity)
  const reasons: string[] = []

  const pass = (reason: string, confidence: BidConfidence = 'alta'): BidDecision =>
    ({ action: 'PASSA', confidence, reasons: [reason, ...reasons].slice(0, 3), threats })

  if (input.ownerRoleOpen <= 0) return pass(`Hai già tutti i ${noun(input.role, 2)}`)
  if (input.financialLimit === undefined || next > input.financialLimit) {
    return pass(`Oltre ${input.financialLimit ?? 0} cr non completi più la rosa`)
  }
  if (input.ceiling === undefined) return pass('Tetto non calcolabile: dati insufficienti', 'bassa')
  if (next > input.ceiling) {
    if (input.alternatives > 0) reasons.push(`${input.alternatives === 1 ? 'Resta' : 'Restano'} ${input.alternatives} ${noun(input.role, input.alternatives)} di livello simile`)
    return pass(`Oltre il tuo tetto di ${input.ceiling} cr`, input.ceiling - price <= -5 ? 'alta' : 'media')
  }

  // motivi a favore, dal più importante
  reasons.push(`Ti ${input.ownerRoleOpen === 1 ? 'manca' : 'mancano'} ${input.ownerRoleOpen} ${noun(input.role, input.ownerRoleOpen)}`)
  if (input.alternatives <= 2) {
    reasons.push(input.alternatives === 0
      ? `Nessun altro ${noun(input.role, 1)} di questo livello`
      : `Solo ${input.alternatives} ${noun(input.role, input.alternatives)} di livello simile`)
  } else if (typeof input.rolePercentile === 'number' && input.rolePercentile >= 70) {
    reasons.push(`Meglio del ${Math.round(input.rolePercentile)}% del ruolo`)
  }

  if (!threats.length) {
    reasons.push('Nessun avversario ha slot e crediti per rilanciare')
    return { action: 'COMPRA', maxBid: next, confidence: 'alta', reasons: reasons.slice(0, 3), threats }
  }

  const strongest = threats[0]
  reasons.push(strongest.estimatedBid >= input.ceiling
    ? `${names(threats)} ${threats.length === 1 ? 'può' : 'possono'} superarti (stima ${strongest.estimatedBid} cr)`
    : `${names(threats)} ${threats.length === 1 ? 'può' : 'possono'} rilanciare`)

  const room = input.ceiling - price
  const confidence: BidConfidence = room >= 10 && (input.rolePercentile ?? 0) >= 60 && input.alternatives <= 3
    ? 'alta'
    : room < 5 || input.rolePercentile === undefined ? 'bassa' : 'media'
  return { action: 'RILANCIA', maxBid: input.ceiling, confidence, reasons: reasons.slice(0, 3), threats }
}
