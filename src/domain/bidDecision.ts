// Decisione durante la chiamata: COMPRA, RILANCIA FINO A, PASSA.
// Gli avversari sono valutati in modo probabilistico (potenziale e comportamento), senza IA.
//
//   PASSA        reparto già completo, prezzo oltre il limite finanziario o oltre il tetto consigliato
//   COMPRA       probabilità che qualcuno rilanci sotto il 15%
//   RILANCIA     altrimenti, fino al tetto consigliato, con la probabilità di prenderlo entro il tetto
//
// Motivi (al massimo 3): fabbisogno nel ruolo, probabilità, avversari più probabili.

type BidAction = 'COMPRA' | 'RILANCIA' | 'PASSA'
type BidConfidence = 'alta' | 'media' | 'bassa'

export interface BidRival {
  name: string
  /** potenziale: spesa ponderata nel ruolo (divisione dei crediti per reparto) */
  capacity: number
  /** comportamento: puntata tipica = valore × quanto tende a pagare rispetto al valore */
  estimatedBid: number
}

interface BidThreat extends BidRival {
  /** probabilità che rilanci sul prezzo attuale */
  chance: number
  /** prezzo fino al quale arriva con probabilità almeno del 50% */
  likely: number
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
  /** avversari con almeno il 5% di probabilità di superare il prezzo, dal più probabile */
  threats: BidThreat[]
  /** quanto il prezzo si avvicina al tetto: 0 = lontano (verde) … 1 = al tetto o oltre (rosso) */
  pressure: number
}

const ROLE_PLURAL: Record<string, [string, string]> = {
  P: ['portiere', 'portieri'], D: ['difensore', 'difensori'], C: ['centrocampista', 'centrocampisti'], A: ['attaccante', 'attaccanti'],
}
const noun = (role: string, count: number) => (ROLE_PLURAL[role] ?? [role, role])[count === 1 ? 0 : 1]
/* =========================
   PROBABILITÀ DEGLI AVVERSARI
   Per ogni avversario la "disponibilità a spendere" su questo giocatore è incerta:
   - comportamento: la puntata tipica (valore × quanto tende a pagare rispetto al valore,
     dallo storico dei suoi acquisti) è il centro della stima, con un margine del ±30%;
   - potenziale: oltre la sua spesa ponderata nel ruolo la probabilità cala rapidamente
     (può sforare un po', non di molto).
========================= */

// funzione di ripartizione della normale standard (approssimazione di Abramowitz-Stegun)
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

/** probabilità che l'avversario sia disposto a offrire almeno `price` */
export function rivalChance(rival: BidRival, price: number): number {
  const center = Math.max(1, rival.estimatedBid)
  const spread = Math.max(3, center * 0.3)
  const willing = 1 - normalCdf((price - center) / spread)
  const cap = Math.max(1, rival.capacity)
  const potential = price <= cap ? 1 : Math.exp(-(price - cap) / (cap * 0.15 + 3))
  return Math.max(0, Math.min(1, willing * potential))
}

/** prezzo fino al quale l'avversario arriva con probabilità almeno del 50% */
function likelyMax(rival: BidRival): number {
  let price = 1
  while (price < 1000 && rivalChance(rival, price + 1) >= 0.5) price++
  return price
}

const outbidChance = (rivals: BidRival[], price: number) => 1 - rivals.reduce((keep, rival) => keep * (1 - rivalChance(rival, price)), 1)
const pct = (value: number) => `${Math.round(value * 100)}%`

export function decideBid(input: BidInput): BidDecision {
  const price = Math.max(0, Math.round(input.currentPrice || 0))
  const next = price + 1
  const threats: BidThreat[] = input.rivals
    .map((rival) => ({ ...rival, chance: rivalChance(rival, next), likely: likelyMax(rival) }))
    .filter((rival) => rival.chance >= 0.05)
    .sort((a, b) => b.chance - a.chance)
  const reasons: string[] = []
  const pressure = input.ceiling && input.ceiling > 0 ? Math.min(1, Math.max(0, price / input.ceiling)) : 1

  const pass = (reason: string, confidence: BidConfidence = 'alta'): BidDecision =>
    ({ action: 'PASSA', confidence, reasons: [reason, ...reasons].slice(0, 3), threats, pressure: 1 })

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

  const outbidNow = outbidChance(input.rivals, next)
  if (outbidNow < 0.15) {
    reasons.push(`Probabilità che qualcuno rilanci: ${pct(outbidNow)}`)
    if (input.alternatives <= 2) reasons.push(`Solo ${input.alternatives} ${noun(input.role, input.alternatives)} di livello simile`)
    return { action: 'COMPRA', maxBid: next, confidence: outbidNow < 0.07 ? 'alta' : 'media', reasons: reasons.slice(0, 3), threats, pressure }
  }

  // probabilità di prenderlo se sei disposto ad arrivare al tetto
  const win = 1 - outbidChance(input.rivals, input.ceiling + 1)
  reasons.push(`Probabilità di prenderlo entro ${input.ceiling} cr: ${pct(win)}`)
  if (threats.length) {
    const top = threats.slice(0, 2)
    reasons.push(`${top.length === 1 ? 'Il più probabile a rilanciare' : 'I più probabili a rilanciare'}: ${top.map((rival) => `${rival.name} (${pct(rival.chance)})`).join(' e ')}`)
  }
  const confidence: BidConfidence = win >= 0.6 ? 'alta' : win >= 0.3 ? 'media' : 'bassa'
  return { action: 'RILANCIA', maxBid: input.ceiling, confidence, reasons: reasons.slice(0, 3), threats, pressure }
}
