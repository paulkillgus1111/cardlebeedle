import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, CloudOff, Gauge, MessagesSquare, Settings, Users, Grid3x3, Presentation } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { db } from '../lib/db'
import { setActiveClassId, useActiveClass, useClasses } from '../lib/hooks'
import { supabase, sync } from '../lib/sync'

const NAV = [
  { to: '/', label: 'Cockpit', icon: Gauge, end: true },
  { to: '/unterricht', label: 'Unterricht', icon: Presentation },
  { to: '/kinder', label: 'Kinder', icon: Users },
  { to: '/klasse', label: 'Klassenblick', icon: Grid3x3 },
  { to: '/gespraeche', label: 'Gespräche', icon: MessagesSquare },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
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
    const { data: sub } = supabase.auth.onAuthStateChange(() => run())
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

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="hidden print:hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-3 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2 pt-2">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="font-semibold">Lehrer-Cockpit</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50')
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2 pb-2 text-xs text-slate-400">
          <SyncBadge state={state} dirty={dirty} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print:hidden flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-2.5 backdrop-blur md:px-6">
          {classes && classes.length > 0 ? (
            <select
              value={cls?.id}
              onChange={(e) => setActiveClassId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · Jgst. {c.gradeLevel}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-slate-500">Noch keine Klasse</span>
          )}
          <div className="ml-auto md:hidden">
            <SyncBadge state={state} dirty={dirty} />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto pb-24 md:pb-6 print:overflow-visible print:pb-0">
          <Outlet />
        </main>
        <nav className="print:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium', isActive ? 'text-brand-700' : 'text-slate-500')}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

function SyncBadge({ state, dirty }: { state: string; dirty: number }) {
  if (state === 'off')
    return (
      <NavLink to="/einstellungen" className="inline-flex items-center gap-1.5 text-xs text-slate-400">
        <CloudOff size={14} /> Nur lokal
      </NavLink>
    )
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs', state === 'error' ? 'text-amber-600' : 'text-slate-400')}>
      <Cloud size={14} />
      {state === 'syncing' ? 'Synchronisiere …' : state === 'error' ? `Offline · ${dirty} offen` : dirty ? `${dirty} offen` : 'Synchron'}
    </span>
  )
}
