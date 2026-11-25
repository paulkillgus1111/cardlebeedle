import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, Check, ChevronDown, Layers, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { classColor } from '../lib/colors'
import { alive, db, isGroup, type SchoolClass } from '../lib/db'
import { setActiveClassId, useActiveClass, useClasses } from '../lib/hooks'
import { Sheet } from './ui'

/** Label einer Klasse/Gruppe, z. B. „Klasse 3a · Jgst. 3“ oder „Religion ev. · Gruppe“. */
export function contextLabel(c: SchoolClass) {
  return isGroup(c) ? `${c.name} · Gruppe` : `Klasse ${c.name} · Jgst. ${c.gradeLevel}`
}

export function ClassDot({ c, className }: { c?: SchoolClass; className?: string }) {
  return <span className={clsx('inline-block size-2.5 shrink-0 rounded-full', classColor(c).dot, className)} />
}

/** Gut sichtbarer Chip mit der aktiven Klasse – öffnet die Auswahl. */
export function ClassChip({ compact }: { compact?: boolean }) {
  const { cls } = useActiveClass()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={clsx(
          'flex w-full min-w-0 items-center gap-2.5 rounded-xl bg-white px-3 text-left shadow-[var(--shadow-card)] ring-1 ring-slate-200 transition hover:ring-slate-300',
          compact ? 'py-1.5' : 'py-2.5',
        )}
        aria-label="Klasse wechseln"
      >
        <ClassDot c={cls} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{cls ? (isGroup(cls) ? cls.name : `Klasse ${cls.name}`) : 'Keine Klasse'}</span>
          {!compact && cls && <span className="block truncate text-xs text-slate-500">{isGroup(cls) ? ['Gruppe', cls.subjects.join(', ')].filter(Boolean).join(' · ') : `Jgst. ${cls.gradeLevel} · ${cls.schoolYear}`}</span>}
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>
      <ClassSwitcherSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function ClassSwitcherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const classes = useClasses() ?? []
  const { cls: active } = useActiveClass()
  const nav = useNavigate()
  const counts = useLiveQuery(async () => {
    const students = alive(await db.students.toArray())
    const m = new Map<string, number>()
    for (const s of students) m.set(s.classId, (m.get(s.classId) ?? 0) + 1)
    return m
  }, []) ?? new Map<string, number>()
  const archivedCount = useLiveQuery(async () => alive(await db.classes.toArray()).filter((c) => c.archived).length) ?? 0

  const pick = async (id: string) => {
    await setActiveClassId(id)
    onClose()
  }
  const go = (q: string) => {
    onClose()
    nav(`/einstellungen?bereich=klassen${q}`)
  }
  const realClasses = classes.filter((c) => !isGroup(c))
  const groups = classes.filter(isGroup)

  const Row = ({ c }: { c: SchoolClass }) => {
    const n = isGroup(c) ? c.memberIds?.length ?? 0 : counts.get(c.id) ?? 0
    const on = active?.id === c.id
    return (
      <button onClick={() => pick(c.id)} className={clsx('flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 transition', on ? 'bg-brand-50 ring-brand-300' : 'bg-white ring-slate-200 hover:ring-slate-300')}>
        <span className={clsx('flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold', classColor(c).soft)}>{isGroup(c) ? <Layers size={18} /> : c.name}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-slate-900">{isGroup(c) ? c.name : `Klasse ${c.name}`}</span>
          <span className="block truncate text-xs text-slate-500">
            {isGroup(c) ? `Gruppe · ${c.subjects.join(', ') || 'ohne Fach'}` : `Jgst. ${c.gradeLevel} · ${c.schoolYear}`} · {n} {n === 1 ? 'Kind' : 'Kinder'}
          </span>
        </span>
        {on && <Check size={18} className="shrink-0 text-brand-600" />}
      </button>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Klasse wählen">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Klassen</p>
          {realClasses.map((c) => (
            <Row key={c.id} c={c} />
          ))}
          {!realClasses.length && <p className="text-sm text-slate-500">Noch keine Klasse.</p>}
        </div>
        {groups.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Gruppen (klassenübergreifend)</p>
            {groups.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => go('&neu=klasse')} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 p-3 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700">
            <Plus size={16} /> Neue Klasse
          </button>
          <button onClick={() => go('&neu=gruppe')} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 p-3 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700">
            <Users size={16} /> Neue Gruppe
          </button>
        </div>
        {archivedCount > 0 && (
          <button onClick={() => go('&archiv=1')} className="flex w-full items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-800">
            <Archive size={15} /> Archiv ({archivedCount})
          </button>
        )}
      </div>
    </Sheet>
  )
}
