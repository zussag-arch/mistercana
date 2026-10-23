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

async function upload(): Promise<void> {
  if (!session) return
  const updatedAt = new Date().toISOString()
  const { error } = await supabase.from('app_state')
    .upsert({ user_id: session.user.id, data: snapshot(), updated_at: updatedAt })
  if (error) return setStatus('error', error.message)
  write(SYNCED_KEY, updatedAt)
  write(MODIFIED_KEY, updatedAt)
  setStatus('synced')
}

function download(remote: Record<string, string>, updatedAt: string): void {
  for (const key of SYNCED_KEYS) {
    if (typeof remote[key] === 'string') write(key, remote[key])
    else { try { localStorage.removeItem(key) } catch { /* niente */ } }
  }
  write(SYNCED_KEY, updatedAt)
  write(MODIFIED_KEY, updatedAt)
  window.location.reload()
}

let running = false

/** Allinea questo dispositivo con la copia online (all'avvio, al rientro nell'app, dopo le modifiche):
 *  - online cambiato da un altro dispositivo, qui niente di nuovo → si scarica e si ricarica l'app;
 *  - qui modifiche nuove, online fermo → si carica online;
 *  - cambiati entrambi → si chiede quale tenere, invece di sovrascrivere. */
async function sync(): Promise<void> {
  if (!session || running) return
  running = true
  try {
    setStatus('syncing')
    const { data, error } = await supabase.from('app_state').select('data, updated_at').maybeSingle()
    if (error) return setStatus('error', error.message)
    if (!data) return await upload()
    // date confrontate come numeri: Supabase e il browser le scrivono in formati diversi
    const time = (value: string | null | undefined) => (value ? Date.parse(value) : 0) || 0
    const synced = time(read(SYNCED_KEY))
    const localChanged = time(read(MODIFIED_KEY)) > synced
    const remoteChanged = time(data.updated_at) !== synced
    const remote = (data.data ?? {}) as Record<string, string>
    if (remoteChanged && !localChanged) return download(remote, data.updated_at)
    if (remoteChanged && localChanged) {
      const when = new Date(data.updated_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
      const useOnline = window.confirm(
        `I dati online sono stati modificati da un altro dispositivo (${when}), ma anche qui ci sono modifiche non ancora salvate online.\n\n` +
        'OK = usa i dati online (si perdono le modifiche fatte qui)\nAnnulla = tieni i dati di questo dispositivo (sostituiscono quelli online)')
      return useOnline ? download(remote, data.updated_at) : await upload()
    }
    if (localChanged) return await upload()
    setStatus('synced')
  } finally {
    running = false
  }
}

/** da chiamare dopo ogni salvataggio locale */
export function markLocalChange(): void {
  write(MODIFIED_KEY, new Date().toISOString())
  if (!session) return
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { timer = undefined; void sync() }, PUSH_DELAY_MS)
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
  // uscendo dall'app si mandano subito le ultime modifiche; rientrando si controlla se online c'è di nuovo
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer === undefined) return
    window.clearTimeout(timer)
    timer = undefined
    void sync()
  })
  supabase.auth.onAuthStateChange((event, next) => {
    session = next
    if (!next) return setStatus('off')
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') void sync()
    else document.dispatchEvent(new CustomEvent('mistercana:cloud-status'))
  })
}
