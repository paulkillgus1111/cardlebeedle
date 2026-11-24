import { supabase } from './sync'

const KEY = 'knownAccounts'

/** Zuletzt genutzte Konten (nur E-Mail-Adressen) für den schnellen Kontowechsel. */
export function knownAccounts(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function rememberAccount(email: string) {
  try {
    const list = [email, ...knownAccounts().filter((e) => e !== email)].slice(0, 6)
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* ignorieren */
  }
}

export function forgetAccount(email: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(knownAccounts().filter((e) => e !== email)))
  } catch {
    /* ignorieren */
  }
}

/** Abmelden – funktioniert auch offline (lokale Sitzung wird verworfen). */
export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' })
}

/** Deutsche Fehlermeldungen für die häufigsten Auth-Fehler. */
export function authError(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort stimmt nicht.'
  if (m.includes('email not confirmed')) return 'Bitte zuerst den Link in der Bestätigungs-Mail öffnen.'
  if (m.includes('user already registered')) return 'Für diese E-Mail gibt es schon ein Konto – bitte anmelden.'
  if (m.includes('password should be')) return 'Das Passwort muss mindestens 6 Zeichen haben.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Zu viele Versuche – bitte kurz warten.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Keine Internetverbindung.'
  return msg
}
