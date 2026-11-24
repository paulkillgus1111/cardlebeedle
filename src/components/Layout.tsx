import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Cloud, CloudOff, Gauge, Grid3x3, Loader2, MessagesSquare, Moon, Presentation, Settings, Sun, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { db } from '../lib/db'
import { setActiveClassId, useActiveClass, useClasses } from '../lib/hooks'
import { supabase, sync } from '../lib/sync'
import { setTheme, useTheme } from '../lib/theme'

const NAV: { to: string; label: string; short?: string; icon: typeof Gauge; end?: boolean }[] = [
  { to: '/', label: 'Cockpit', icon: Gauge, end: true },
  { to: '/unterricht', label: 'Unterricht', icon: Presentation },
  { to: '/kinder', label: 'Kinder', icon: Users },
  { to: '/klasse', label: 'Klassenblick', short: 'Klasse', icon: Grid3x3 },
  { to: '/gespraeche', label: 'Gespräche', icon: MessagesSquare },
  { to: '/einstellungen', label: 'Einstellungen', short: 'Mehr', icon: Settings },
]

function useAutoSync() {
  const [state, setState] = useState<'off' | 'idle' | 'syncing' | 'error'>('off')
  const dirty = useLiveQuery(async () => {
    let n = 0
    for (const t of ['observations', 'lessons', 'students', 'classes', 'goals', 'conversations', 'seatingPlans', 'competencies', 'quickTemplates'])
      n += await db.table(t).where('dirty').equals(1).count()
    return n
  })
  useEffect(() => {
    let alive = true
    const run = async () => {
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      if (!data.session) return setState('off')
      if (!navigator.onLine) return setState('error')
      setState('syncing')
      try {
        await sync()
        if (alive) setState('idle')
      } catch {
        if (alive) setState('error')
      }
    }
    run()
    const iv = setInterval(run, 60_000)
    window.addEventListener('online', run)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => (event === 'SIGNED_OUT' ? setState('off') : event === 'SIGNED_IN' ? run() : undefined))
    return () => {
      alive = false
      clearInterval(iv)
      window.removeEventListener('online', run)
      sub.subscription.unsubscribe()
    }
  }, [])
  // Nach lokalen Änderungen zeitnah hochladen
  useEffect(() => {
    if (!dirty || state === 'off') return
    const t = setTimeout(() => sync().then(() => setState('idle')).catch(() => setState('error')), 4000)
    return () => clearTimeout(t)
  }, [dirty, state])
  return { state, dirty: dirty ?? 0 }
}

export function Layout() {
  const classes = useClasses()
  const { cls } = useActiveClass()
  const { state, dirty } = useAutoSync()
  const theme = useTheme()
  const loc = useLocation()
  const live = /^\/unterricht\/.+/.test(loc.pathname)

  const classSelect = classes && classes.length > 0 && (
    <div className="relative">
      <select
        value={cls?.id}
        onChange={(e) => setActiveClassId(e.target.value)}
        aria-label="Klasse wählen"
        className="w-full appearance-none rounded-xl bg-slate-100 py-2 pr-8 pl-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200/60 outline-none ring-inset hover:bg-slate-200/60"
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            Klasse {c.name} · Jgst. {c.gradeLevel}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400" />
    </div>
  )

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col lg:flex border-r border-slate-200/70 bg-white/70 px-3 py-4 backdrop-blur-xl print:hidden">
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <img src="/favicon.svg" alt="" className="size-8 rounded-[10px] shadow-[var(--shadow-glow)]" />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-tight">Cardle Beedle</p>
            <p className="text-xs text-slate-500">Beobachten · Dokumentieren</p>
          </div>
        </div>
        <div className="mb-4 px-1">{classSelect}</div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-white text-slate-900 shadow-[var(--shadow-card)] ring-1 ring-slate-200/80' : 'text-slate-500 hover:bg-slate-100/70 hover:text-slate-900',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={isActive ? 2.3 : 2} className={isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-1">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100"
          >
            {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            Darstellung: {theme === 'system' ? 'automatisch' : theme === 'dark' ? 'dunkel' : 'hell'}
          </button>
          <div className="px-2.5">
            <SyncBadge state={state} dirty={dirty} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {!live && (
          <header className="flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-xl lg:hidden print:hidden">
            <img src="/favicon.svg" alt="" className="size-7 rounded-lg" />
            <div className="min-w-0 flex-1">{classSelect || <span className="text-sm text-slate-500">Noch keine Klasse</span>}</div>
            <SyncBadge state={state} dirty={dirty} compact />
          </header>
        )}
        <main className="min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-0 print:overflow-visible print:pb-0">
          <Outlet />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-200/70 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden print:hidden">
          {NAV.map(({ to, label, short, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx('flex flex-col items-center gap-1 pt-2 pb-1.5 text-[10px] font-medium', isActive ? 'text-brand-600' : 'text-slate-400')}
            >
              <Icon size={21} />
              <span className="max-w-full truncate px-0.5">{short ?? label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

function SyncBadge({ state, dirty, compact }: { state: string; dirty: number; compact?: boolean }) {
  if (state === 'off')
    return (
      <NavLink to="/einstellungen" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
        <CloudOff size={14} /> {compact ? '' : 'Nur lokal – anmelden für Sync'}
      </NavLink>
    )
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs', state === 'error' ? 'text-amber-600' : 'text-slate-400')}>
      {state === 'syncing' ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
      {compact
        ? dirty || ''
        : state === 'syncing'
          ? 'Synchronisiere …'
          : state === 'error'
            ? `Offline · ${dirty} offen`
            : dirty
              ? `${dirty} Änderungen offen`
              : 'Alles synchronisiert'}
    </span>
  )
}
