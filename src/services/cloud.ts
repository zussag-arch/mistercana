/*
 * Salvataggio online (Supabase): con il login, i dati dell'app (stato + CSV caricati) vanno anche
 * in una riga della tabella app_state, letta e scritta solo dal proprietario (regole RLS).
 * Il telefono resta la copia di lavoro: si salva in locale come sempre e, dopo qualche secondo
 * senza modifiche, si manda la copia online. All'avvio vince la copia modificata più di recente.
 * Qui stanno solo l'indirizzo del progetto e la chiave pubblica: senza login non aprono niente.
 */
import { createClient, type Session } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rxzqphgvgdsnlogdyixy.supabase.co'
const SUPABASE_KEY = 'sb_publishable_kFD9KcdgYfvSnMht79hMHw_VTtAzKbc'

/** chiavi di localStorage che viaggiano online */
const SYNCED_KEYS = ['mistercana_app_state_v1', 'mistercana_csv_overrides_v1']
/** ultima modifica locale e ultima versione online già allineata */
const MODIFIED_KEY = 'mistercana_cloud_modified_at'
const SYNCED_KEY = 'mistercana_cloud_synced_at'
const PUSH_DELAY_MS = 3000

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export type CloudStatus = 'off' | 'syncing' | 'synced' | 'error'
let session: Session | null = null
let status: CloudStatus = 'off'
let lastError = ''
let timer: number | undefined

const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* memoria piena */ } }

function setStatus(next: CloudStatus, error = ''): void {
  status = next
  lastError = error
  document.dispatchEvent(new CustomEvent('mistercana:cloud-status'))
}

export const cloudInfo = () => ({ email: session?.user.email ?? null, status, lastError, syncedAt: read(SYNCED_KEY) })

function snapshot(): Record<string, string> {
  const data: Record<string, string> = {}
  for (const key of SYNCED_KEYS) {
    const value = read(key)
    if (value !== null) data[key] = value
  }
  return data
}

async function push(): Promise<void> {
  if (!session) return
  setStatus('syncing')
  const updatedAt = new Date().toISOString()
  const { error } = await supabase.from('app_state')
    .upsert({ user_id: session.user.id, data: snapshot(), updated_at: updatedAt })
  if (error) return setStatus('error', error.message)
  write(SYNCED_KEY, updatedAt)
  write(MODIFIED_KEY, updatedAt)
  setStatus('synced')
}

/** All'avvio (o dopo il login): copia online più recente → si scarica e si ricarica l'app;
 *  copia locale più recente (o online vuota, al primo accesso) → si carica online. */
async function reconcile(): Promise<void> {
  if (!session) return
  setStatus('syncing')
  const { data, error } = await supabase.from('app_state').select('data, updated_at').maybeSingle()
  if (error) return setStatus('error', error.message)
  // date confrontate come numeri: Supabase e il browser le scrivono in formati diversi
  const time = (value: string | null | undefined) => (value ? Date.parse(value) : 0) || 0
  const localModified = time(read(MODIFIED_KEY))
  const remoteAt = time(data?.updated_at)
  if (data && remoteAt > localModified && remoteAt !== time(read(SYNCED_KEY))) {
    const remote = (data.data ?? {}) as Record<string, string>
    for (const key of SYNCED_KEYS) {
      if (typeof remote[key] === 'string') write(key, remote[key])
      else { try { localStorage.removeItem(key) } catch { /* niente */ } }
    }
    write(SYNCED_KEY, data.updated_at)
    write(MODIFIED_KEY, data.updated_at)
    window.location.reload()
    return
  }
  if (!data || localModified > remoteAt) return push()
  setStatus('synced')
}

/** da chiamare dopo ogni salvataggio locale */
export function markLocalChange(): void {
  write(MODIFIED_KEY, new Date().toISOString())
  if (!session) return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { void push() }, PUSH_DELAY_MS)
}

export async function sendLoginLink(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // niente registrazioni: entra solo chi è stato invitato
    options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
  })
  return error ? error.message : null
}

/** Accesso da passare all'app installata su iPhone: lì il link dell'email si apre in Safari,
 *  che ha una memoria separata. Si copia in Safari e si incolla nell'app. */
export function accessCode(): string | null {
  return session?.refresh_token ?? null
}

export async function useAccessCode(code: string): Promise<string | null> {
  const { error } = await supabase.auth.refreshSession({ refresh_token: code })
  return error ? error.message : null
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}

export function initCloud(): void {
  window.addEventListener('mistercana:saved', markLocalChange)
  // prima di chiudere l'app si prova a mandare le ultime modifiche
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer !== undefined) { window.clearTimeout(timer); timer = undefined; void push() }
  })
  supabase.auth.onAuthStateChange((event, next) => {
    session = next
    if (!next) return setStatus('off')
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') void reconcile()
    else document.dispatchEvent(new CustomEvent('mistercana:cloud-status'))
  })
}
