import clsx from 'clsx'
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, LogIn, Mail, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { authError, forgetAccount, knownAccounts, rememberAccount } from '../lib/auth'
import { supabase } from '../lib/sync'
import { Button, Field, inputCls } from '../components/ui'

type Mode = 'login' | 'reset'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[780px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-300/30 via-sky-300/20 to-violet-300/20 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/favicon.svg" alt="" className="mb-4 size-14 rounded-2xl shadow-[var(--shadow-glow)]" />
          <h1 className="text-[28px] font-semibold tracking-tight">Cardle Beedle</h1>
          <p className="mt-1 text-sm text-slate-500">Beobachten · Dokumentieren · Verstehen</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-[var(--shadow-pop)] ring-1 ring-slate-200/70 sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-slate-400">Jedes Konto hat seine eigenen, getrennten Daten – auch auf diesem Gerät.</p>
      </div>
    </div>
  )
}

export default function AuthScreen() {
  const accounts = knownAccounts()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState(accounts[0] ?? '')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [, rerender] = useState(0)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const mail = email.trim().toLowerCase()
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
        if (error) throw error
        rememberAccount(mail)
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: location.origin })
        if (error) throw error
        setInfo('Wenn es ein Konto gibt, kommt gleich eine E-Mail mit einem Link zum Zurücksetzen.')
        setMode('login')
      }
    } catch (err) {
      setError(authError((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const title = { login: 'Anmelden', reset: 'Passwort zurücksetzen' }[mode]

  return (
    <Shell>
      {mode !== 'login' && (
        <button onClick={() => (setMode('login'), setError(''))} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Zurück zur Anmeldung
        </button>
      )}
      <h2 className="mb-5 text-xl font-semibold tracking-tight">{title}</h2>

      {mode === 'login' && accounts.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Zuletzt verwendet</p>
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <span
                key={a}
                className={clsx(
                  'group inline-flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-3 text-sm ring-1 transition',
                  a === email ? 'bg-brand-50 text-brand-700 ring-brand-300' : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300',
                )}
              >
                <button type="button" onClick={() => (setEmail(a), setPassword(''))} className="max-w-[220px] truncate">
                  {a}
                </button>
                <button
                  type="button"
                  aria-label={`${a} aus der Liste entfernen`}
                  onClick={() => (forgetAccount(a), a === email && setEmail(''), rerender((x) => x + 1))}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <Field label="E-Mail">
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={clsx(inputCls, 'pl-10')} placeholder="name@schule.de" autoFocus={!email} />
          </div>
        </Field>
        {mode !== 'reset' && (
          <Field label="Passwort">
            <div className="relative">
              <KeyRound size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type={show ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={clsx(inputCls, 'pr-11 pl-10')}
                autoFocus={!!email}
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-700">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
        )}

        {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
        {info && <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">{info}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : mode === 'login' ? <LogIn size={18} /> : <Mail size={18} />}
          {mode === 'login' ? 'Anmelden' : 'Link senden'}
        </Button>
      </form>

      {mode === 'login' && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-5 text-sm">
          <span className="text-slate-400">Zugänge werden zentral vergeben.</span>
          <button onClick={() => (setMode('reset'), setError(''))} className="text-slate-500 hover:text-slate-800">
            Passwort vergessen?
          </button>
        </div>
      )}
    </Shell>
  )
}

/** Nach Klick auf den Link aus der „Passwort zurücksetzen“-Mail. */
export function SetNewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <Shell>
      <h2 className="mb-5 text-xl font-semibold tracking-tight">Neues Passwort festlegen</h2>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          const { error } = await supabase.auth.updateUser({ password })
          setBusy(false)
          if (error) setError(authError(error.message))
          else onDone()
        }}
      >
        <Field label="Neues Passwort" hint="Mindestens 6 Zeichen.">
          <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} autoFocus />
        </Field>
        {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" />} Passwort speichern
        </Button>
      </form>
    </Shell>
  )
}

export function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <img src="/favicon.svg" alt="" className="size-12 animate-pulse rounded-2xl" />
    </div>
  )
}
