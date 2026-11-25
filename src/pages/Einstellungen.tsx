import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Anchor,
  Archive,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Cloud,
  Database,
  Download,
  Eraser,
  GraduationCap,
  Layers,
  LayoutGrid,
  LogOut,
  MapPin,
  Minus,
  Monitor,
  Moon,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  School,
  Search,
  Shuffle,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from '../components/toast'
import { Avatar, Badge, Button, Card, Empty, Field, inputCls, PageHeader, Segmented, Sheet } from '../components/ui'
import { classColor } from '../lib/colors'
import {
  alive,
  CLASS_COLORS,
  db,
  getMeta,
  isGroup,
  now,
  remove,
  removeClass,
  removeStudent,
  save,
  SYNCED_TABLES,
  uid,
  type Attachment,
  type ClassColor,
  type Competency,
  type GradeLevel,
  type ObsKind,
  type SchoolClass,
  type SeatingPlan,
  type Student,
  type TimetableSlot,
  type Valence,
} from '../lib/db'
import {
  DEFAULT_PERIODS,
  setActiveClassId,
  setPeriods,
  useActiveClass,
  useArchivedClasses,
  useClasses,
  usePeriods,
  useStudents,
  useTimetable,
  type PeriodTime,
} from '../lib/hooks'
import { bandFor, DEFAULT_LEVEL_HINTS, KIND_LABEL, LEVEL_LABEL, SUBJECTS_BY_GRADE } from '../lib/seed'
import { supabase, sync } from '../lib/sync'
import { signOut as signOutLocal } from '../lib/auth'
import { setTheme, useTheme, type ThemePref } from '../lib/theme'

type Tab = 'klassen' | 'kinder' | 'sitzplan' | 'stundenplan' | 'vorlagen' | 'kompetenzen' | 'darstellung' | 'konto'

const TABS: { value: Tab; label: string; icon: LucideIcon; hint: string }[] = [
  { value: 'klassen', label: 'Klassen & Gruppen', icon: School, hint: 'Klassen und Gruppen anlegen, wechseln, versetzen und archivieren' },
  { value: 'kinder', label: 'Kinder', icon: Users, hint: 'Namensliste der aktiven Klasse' },
  { value: 'sitzplan', label: 'Sitzplan', icon: LayoutGrid, hint: 'Plätze im Klassenzimmer' },
  { value: 'stundenplan', label: 'Stundenplan', icon: CalendarDays, hint: 'Wann du welche Klasse oder Gruppe in welchem Fach hast' },
  { value: 'vorlagen', label: 'Schnell-Einträge', icon: Zap, hint: 'Beobachtungen mit einem Tipp' },
  { value: 'kompetenzen', label: 'Kompetenzen', icon: BookOpenCheck, hint: 'Kompetenzraster LehrplanPLUS mit Indikatoren' },
  { value: 'darstellung', label: 'Darstellung', icon: Palette, hint: 'Hell, dunkel oder automatisch' },
  { value: 'konto', label: 'Konto & Sync', icon: Cloud, hint: 'Anmeldung, Sync und Backup' },
]

const isTab = (t: string | null): t is Tab => !!t && TABS.some((x) => x.value === t)

const TAB_KEY = 'settingsTab'
function readTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY)
    if (t === 'klasse') return 'klassen' // früherer Name
    return isTab(t) ? t : 'klassen'
  } catch {
    return 'klassen'
  }
}
function rememberTab(t: Tab) {
  try {
    localStorage.setItem(TAB_KEY, t)
  } catch {
    /* ignorieren */
  }
}

export default function Einstellungen() {
  const [params, setParams] = useSearchParams()
  const fromUrl = params.get('bereich')
  const [stored, setStored] = useState<Tab>(readTab)
  const tab: Tab = isTab(fromUrl) ? fromUrl : fromUrl === 'klasse' ? 'klassen' : stored
  useEffect(() => {
    if (isTab(fromUrl)) rememberTab(fromUrl)
  }, [fromUrl])
  const setTab = (t: Tab) => {
    setStored(t)
    rememberTab(t)
    setParams({ bereich: t }, { replace: true })
  }
  const current = TABS.find((t) => t.value === tab)!
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Einstellungen" subtitle="Klassen, Gruppen, Stundenplan, Vorlagen und Konto verwalten." />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Schmale Bildschirme: horizontal scrollbare Leiste */}
        <nav className="-mx-4 overflow-x-auto px-4 lg:hidden" aria-label="Bereiche">
          <div className="flex w-max gap-2">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                aria-current={tab === t.value ? 'page' : undefined}
                className={clsx(
                  'inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap ring-1 transition',
                  tab === t.value ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                )}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </div>
        </nav>
        {/* Breite Bildschirme: vertikale Navigation */}
        <nav className="hidden lg:block" aria-label="Bereiche">
          <ul className="sticky top-6 space-y-1">
            {TABS.map((t) => (
              <li key={t.value}>
                <button
                  type="button"
                  onClick={() => setTab(t.value)}
                  aria-current={tab === t.value ? 'page' : undefined}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition',
                    tab === t.value ? 'bg-white text-slate-900 shadow-[var(--shadow-card)] ring-1 ring-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <span className={clsx('flex size-8 items-center justify-center rounded-lg', tab === t.value ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500')}>
                    <t.icon size={16} />
                  </span>
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{current.label}</h2>
            <p className="text-sm text-slate-500">{current.hint}</p>
          </div>
          {tab === 'klassen' && <Klassen />}
          {tab === 'kinder' && <KinderVerwalten />}
          {tab === 'sitzplan' && <Sitzplan />}
          {tab === 'stundenplan' && <Stundenplan />}
          {tab === 'vorlagen' && <Vorlagen />}
          {tab === 'kompetenzen' && <Kompetenzen />}
          {tab === 'darstellung' && <Darstellung />}
          {tab === 'konto' && <Konto />}
        </div>
      </div>
    </div>
  )
}

function currentSchoolYear() {
  const d = new Date()
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}/${String(y + 1).slice(2)}`
}

/** „2025/26“ → „2026/27“ */
function nextSchoolYear(sy: string) {
  const m = /^(\d{4})\s*\/\s*\d{2,4}$/.exec(sy.trim())
  if (!m) return currentSchoolYear()
  const y = parseInt(m[1], 10) + 1
  return `${y}/${String(y + 1).slice(2)}`
}

const ALL_SUBJECTS = [...new Set(Object.values(SUBJECTS_BY_GRADE).flat())]

const COLOR_NAMES: Record<ClassColor, string> = {
  teal: 'Petrol',
  sky: 'Himmelblau',
  violet: 'Violett',
  amber: 'Bernstein',
  rose: 'Rosa',
  lime: 'Limette',
  orange: 'Orange',
  indigo: 'Indigo',
  pink: 'Pink',
  emerald: 'Smaragd',
}

/** Gespeicherter oder (wie in colors.ts) aus der ID abgeleiteter Farbschlüssel. */
function colorKey(c: Pick<SchoolClass, 'id' | 'color'>): ClassColor {
  if (c.color && (CLASS_COLORS as readonly string[]).includes(c.color)) return c.color as ClassColor
  return CLASS_COLORS[[...c.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % CLASS_COLORS.length]
}

const ctxName = (c: SchoolClass) => (isGroup(c) ? c.name : `Klasse ${c.name}`)

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-slate-600">
      {children}
      {hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
    </span>
  )
}

function ColorPicker({ value, onChange }: { value?: string; onChange: (c: ClassColor) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
      {CLASS_COLORS.map((c) => {
        const on = value === c
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={COLOR_NAMES[c]}
            title={COLOR_NAMES[c]}
            onClick={() => onChange(c)}
            className={clsx(
              'flex size-10 items-center justify-center rounded-full transition active:scale-95',
              classColor({ id: c, color: c }).dot,
              on ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white' : 'opacity-80 hover:opacity-100',
            )}
          >
            {on && <Check size={18} className="!text-[#fff]" strokeWidth={3} />}
          </button>
        )
      })}
    </div>
  )
}

function SubjectChips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((s) => {
        const on = value.includes(s)
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== s) : [...value, s])}
            className={clsx('inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ring-1 transition', on ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50')}
          >
            {on && <Check size={14} />}
            {s}
          </button>
        )
      })}
    </div>
  )
}

function CheckBox({ on, className }: { on: boolean; className?: string }) {
  return (
    <span className={clsx('flex size-5 shrink-0 items-center justify-center rounded-md ring-1 transition', on ? 'bg-brand-600 ring-brand-600' : 'bg-white ring-slate-300', className)} aria-hidden>
      {on && <Check size={13} strokeWidth={3} className="!text-[#fff]" />}
    </span>
  )
}

/* ───────────────────────── Klassen & Gruppen ───────────────────────── */

function useStudentCounts() {
  return (
    useLiveQuery(async () => {
      const students = alive(await db.students.toArray())
      const byClass = new Map<string, number>()
      for (const s of students) byClass.set(s.classId, (byClass.get(s.classId) ?? 0) + 1)
      return { byClass, ids: new Set(students.map((s) => s.id)) }
    }, []) ?? { byClass: new Map<string, number>(), ids: new Set<string>() }
  )
}

function Klassen() {
  const classes = useClasses()
  const archived = useArchivedClasses()
  const { cls: active } = useActiveClass()
  const counts = useStudentCounts()
  const [params, setParams] = useSearchParams()
  const [editClass, setEditClass] = useState<SchoolClass | null>(null)
  const [editGroup, setEditGroup] = useState<SchoolClass | null>(null)
  const [promote, setPromote] = useState<SchoolClass | null>(null)
  const [showArchive, setShowArchive] = useState(false)
  const archiveRef = useRef<HTMLDivElement>(null)

  const list = classes ?? []
  const realClasses = list.filter((c) => !isGroup(c))
  const groups = list.filter(isGroup)
  const knownIds = new Set([...list, ...archived].map((c) => c.id))

  const nextColor = (): ClassColor => {
    const used = new Set(list.map((c) => colorKey(c)))
    return CLASS_COLORS.find((c) => !used.has(c)) ?? CLASS_COLORS[list.length % CLASS_COLORS.length]
  }
  const blankClass = (): SchoolClass => ({ id: uid(), kind: 'klasse', name: '', gradeLevel: 1, schoolYear: currentSchoolYear(), subjects: SUBJECTS_BY_GRADE[1], color: nextColor(), updatedAt: now() })
  const blankGroup = (): SchoolClass => ({
    id: uid(),
    kind: 'gruppe',
    name: '',
    gradeLevel: active?.gradeLevel ?? 1,
    schoolYear: active?.schoolYear ?? currentSchoolYear(),
    subjects: [],
    memberIds: [],
    color: nextColor(),
    updatedAt: now(),
  })

  // Aufrufe per URL: ?bereich=klassen&neu=klasse|gruppe, &archiv=1, &bearbeiten=<id>
  const neu = params.get('neu')
  const archiv = params.get('archiv')
  const bearbeiten = params.get('bearbeiten')
  const loaded = classes !== undefined
  useEffect(() => {
    if (!loaded || (!neu && !archiv && !bearbeiten)) return
    if (neu === 'klasse') setEditClass(blankClass())
    else if (neu === 'gruppe') setEditGroup(blankGroup())
    if (bearbeiten) {
      const c = list.find((x) => x.id === bearbeiten)
      if (c) (isGroup(c) ? setEditGroup : setEditClass)(c)
    }
    if (archiv) {
      setShowArchive(true)
      setTimeout(() => archiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    }
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.delete('neu')
        n.delete('archiv')
        n.delete('bearbeiten')
        return n
      },
      { replace: true },
    )
  }, [loaded, neu, archiv, bearbeiten])

  const archive = async (c: SchoolClass) => {
    const fresh = (await db.classes.get(c.id)) ?? c
    await save(db.classes, { ...fresh, archived: 1 })
    if (active?.id === c.id) {
      const next = realClasses.find((x) => x.id !== c.id) ?? list.find((x) => x.id !== c.id)
      if (next) await setActiveClassId(next.id)
    }
    setEditClass(null)
    setEditGroup(null)
    toast(`${ctxName(c)} archiviert – alle Daten bleiben erhalten`, () => void db.classes.get(c.id).then((x) => x && save(db.classes, { ...x, archived: 0 })))
  }
  const restore = async (c: SchoolClass) => {
    await save(db.classes, { ...c, archived: 0 })
    toast(`${ctxName(c)} wiederhergestellt`)
  }
  const purge = async (c: SchoolClass) => {
    const typed = prompt(
      `${ctxName(c)} ENDGÜLTIG löschen?\n\n` +
        (isGroup(c)
          ? 'Die Gruppe, ihre Stunden, Beobachtungen und Gespräche, die in dieser Gruppe entstanden sind, werden gelöscht. Die Kinder selbst bleiben in ihren Klassen.'
          : 'Gelöscht werden: alle Kinder, die noch in dieser Klasse sind, sowie alle Beobachtungen, Stunden, Ziele und Gespräche, die in dieser Klasse entstanden sind – auch von Kindern, die inzwischen versetzt wurden.') +
        `\n\nDas lässt sich nicht rückgängig machen. Zum Bestätigen den Namen „${c.name}“ eingeben:`,
    )
    if (typed === null) return
    if (typed.trim() !== c.name.trim()) {
      toast('Name stimmt nicht überein – nichts gelöscht.')
      return
    }
    const slots = alive(await db.timetable.where('classId').equals(c.id).toArray())
    for (const s of slots) await remove(db.timetable, s.id)
    await removeClass(c.id)
    toast(`${ctxName(c)} endgültig gelöscht`)
  }

  const Row = ({ c }: { c: SchoolClass }) => {
    const isActive = active?.id === c.id
    const group = isGroup(c)
    const n = group ? (c.memberIds ?? []).filter((id) => counts.ids.has(id)).length : (counts.byClass.get(c.id) ?? 0)
    const col = classColor(c)
    return (
      <li className={clsx('flex items-center gap-3 px-4 py-3 sm:px-5', isActive && 'bg-brand-50/40')}>
        <span className={clsx('relative flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold', col.soft)}>
          {group ? <Layers size={18} /> : c.name.length <= 3 ? c.name : c.gradeLevel}
          <span className={clsx('absolute -top-0.5 -right-0.5 size-3 rounded-full ring-2 ring-white', col.dot)} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium text-slate-900">
            <span className="truncate">{ctxName(c)}</span>
            {isActive && (
              <Badge tone="brand">
                <Check size={12} /> aktiv
              </Badge>
            )}
          </p>
          <p className="truncate text-xs text-slate-500">
            {group ? `${c.subjects.join(', ') || 'ohne Fach'} · Jgst. ${c.gradeLevel}` : `Jgst. ${c.gradeLevel} · ${c.schoolYear}`} · {n} {n === 1 ? 'Kind' : 'Kinder'}
          </p>
        </div>
        {!isActive && (
          <Button size="sm" variant="soft" onClick={() => setActiveClassId(c.id)}>
            Aktivieren
          </Button>
        )}
        {!group && (
          <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => setPromote(c)} aria-label={`${c.name} versetzen`} title="Schuljahr wechseln / versetzen">
            <GraduationCap size={16} />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => (group ? setEditGroup(c) : setEditClass(c))} aria-label={`${c.name} bearbeiten`} title="Bearbeiten">
          <Pencil size={16} />
        </Button>
      </li>
    )
  }

  return (
    <>
      <Card
        title="Meine Klassen"
        icon={School}
        action={
          <Button size="sm" onClick={() => setEditClass(blankClass())}>
            <Plus size={16} /> Neue Klasse
          </Button>
        }
        padded={false}
      >
        {classes && !realClasses.length ? (
          <div className="px-5 pb-5">
            <Empty icon={School}>Noch keine Klasse. Leg deine erste Klasse an – danach kannst du Kinder hinzufügen.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {realClasses.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Gruppen"
        icon={Layers}
        action={
          <Button size="sm" variant="secondary" onClick={() => setEditGroup(blankGroup())}>
            <Plus size={16} /> Neue Gruppe
          </Button>
        }
        padded={false}
      >
        <p className="-mt-2 px-5 pb-3 text-sm text-slate-500">Klassenübergreifend, z. B. Religion, Ethik, Förderkurs oder DaZ. Die Kinder bleiben in ihrer Stammklasse.</p>
        {groups.length ? (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {groups.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </ul>
        ) : (
          <div className="px-5 pb-5">
            <Empty icon={Layers}>Noch keine Gruppe.</Empty>
          </div>
        )}
      </Card>

      {realClasses.length > 0 && (
        <Card title="Neues Schuljahr" icon={GraduationCap}>
          <p className="-mt-2 mb-3 text-sm text-slate-500">
            Versetze eine Klasse ins nächste Schuljahr (z. B. 2b → 3b). Die alte Klasse wird archiviert, der Verlauf jedes Kindes mit allen Beobachtungen läuft weiter.
          </p>
          <div className="flex flex-wrap gap-2">
            {realClasses.map((c) => (
              <Button key={c.id} variant="secondary" size="sm" onClick={() => setPromote(c)}>
                <span className={clsx('size-2.5 rounded-full', classColor(c).dot)} />
                {c.name} versetzen <ArrowRight size={14} className="text-slate-400" />
              </Button>
            ))}
          </div>
        </Card>
      )}

      {(archived.length > 0 || showArchive) && (
        <div ref={archiveRef} className="scroll-mt-6">
          <Card
            title={`Archiv (${archived.length})`}
            icon={Archive}
            padded={false}
            action={
              <Button size="sm" variant="ghost" onClick={() => setShowArchive(!showArchive)} aria-expanded={showArchive}>
                {showArchive ? 'Ausblenden' : 'Anzeigen'} <ChevronDown size={16} className={clsx('transition', showArchive && 'rotate-180')} />
              </Button>
            }
          >
            <p className="-mt-2 px-5 pb-3 text-sm text-slate-500">Archivierte Klassen und Gruppen sind ausgeblendet, ihre Daten bleiben vollständig erhalten.</p>
            {showArchive &&
              (archived.length ? (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {archived.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                      <span className={clsx('flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold opacity-60', classColor(c).soft)}>
                        {isGroup(c) ? <Layers size={17} /> : c.name.length <= 3 ? c.name : c.gradeLevel}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-700">{ctxName(c)}</p>
                        <p className="truncate text-xs text-slate-400">
                          {isGroup(c) ? `Gruppe · ${c.subjects.join(', ') || 'ohne Fach'}` : `Jgst. ${c.gradeLevel} · ${c.schoolYear}`}
                          {!isGroup(c) && ` · ${counts.byClass.get(c.id) ?? 0} Kinder verblieben`}
                        </p>
                      </div>
                      <Button size="sm" variant="soft" onClick={() => restore(c)}>
                        <RotateCcw size={15} /> Wiederherstellen
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => purge(c)}>
                        <Trash2 size={15} /> <span className="hidden sm:inline">Endgültig löschen</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-5 pb-5">
                  <Empty icon={Archive}>Das Archiv ist leer.</Empty>
                </div>
              ))}
          </Card>
        </div>
      )}

      <ClassEditor
        value={editClass}
        isExisting={!!editClass && knownIds.has(editClass.id)}
        onChange={setEditClass}
        onClose={() => setEditClass(null)}
        onArchive={archive}
        onPromote={(c) => {
          setEditClass(null)
          setPromote(c)
        }}
      />
      <GroupEditor value={editGroup} isExisting={!!editGroup && knownIds.has(editGroup.id)} onChange={setEditGroup} onClose={() => setEditGroup(null)} onArchive={archive} />
      {promote && <PromoteSheet from={promote} onClose={() => setPromote(null)} />}
    </>
  )
}

function EditorFooter({ isExisting, canSave, onArchive, onClose, onSave, extra }: { isExisting: boolean; canSave: boolean; onArchive: () => void; onClose: () => void; onSave: () => void; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
      {isExisting && (
        <Button variant="ghost" onClick={onArchive}>
          <Archive size={16} /> Archivieren
        </Button>
      )}
      {extra}
      <span className="flex-1" />
      <Button variant="ghost" onClick={onClose}>
        Abbrechen
      </Button>
      <Button disabled={!canSave} onClick={onSave}>
        {isExisting ? 'Speichern' : 'Anlegen'}
      </Button>
    </div>
  )
}

function ClassEditor({
  value: edit,
  isExisting,
  onChange: setEdit,
  onClose,
  onArchive,
  onPromote,
}: {
  value: SchoolClass | null
  isExisting: boolean
  onChange: (c: SchoolClass) => void
  onClose: () => void
  onArchive: (c: SchoolClass) => void
  onPromote: (c: SchoolClass) => void
}) {
  const saveEdit = async () => {
    if (!edit) return
    const row: SchoolClass = { ...edit, kind: 'klasse', name: edit.name.trim(), schoolYear: edit.schoolYear.trim() }
    await save(db.classes, row)
    // Neue Klasse immer aktiv machen (auch wenn die gespeicherte aktive ID veraltet ist)
    if (!isExisting) await setActiveClassId(row.id)
    onClose()
    toast(isExisting ? 'Klasse gespeichert' : `Klasse ${row.name} angelegt und aktiviert`)
  }
  return (
    <Sheet open={!!edit} onClose={onClose} title={isExisting ? `Klasse ${edit?.name}` : 'Neue Klasse'}>
      {edit && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} placeholder="z. B. 2b" autoFocus={!isExisting} />
            </Field>
            <Field label="Schuljahr">
              <input value={edit.schoolYear} onChange={(e) => setEdit({ ...edit, schoolYear: e.target.value })} className={inputCls} placeholder="2026/27" />
            </Field>
          </div>
          <div>
            <Label>Jahrgangsstufe</Label>
            <Segmented
              value={edit.gradeLevel}
              onChange={(g: GradeLevel) => setEdit({ ...edit, gradeLevel: g, subjects: SUBJECTS_BY_GRADE[g] })}
              options={([1, 2, 3, 4] as const).map((g) => ({ value: g, label: `Jgst. ${g}` }))}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Kompetenzraster LehrplanPLUS Jgst. {bandFor(edit.gradeLevel)} · {edit.gradeLevel === 4 ? 'Übertritt' : 'LEG möglich'}
            </p>
          </div>
          <div>
            <Label hint={`${edit.subjects.length} gewählt`}>Fächer, die ich in dieser Klasse unterrichte</Label>
            <SubjectChips options={SUBJECTS_BY_GRADE[edit.gradeLevel]} value={edit.subjects} onChange={(subjects) => setEdit({ ...edit, subjects })} />
          </div>
          <div>
            <Label>Farbe</Label>
            <ColorPicker value={colorKey(edit)} onChange={(color) => setEdit({ ...edit, color })} />
            <p className="mt-1.5 text-xs text-slate-400">Hilft im Stundenplan und beim Wechseln, die Klasse auf einen Blick zu erkennen.</p>
          </div>
          <EditorFooter
            isExisting={isExisting}
            canSave={!!edit.name.trim()}
            onArchive={() => onArchive(edit)}
            onClose={onClose}
            onSave={saveEdit}
            extra={
              isExisting && (
                <Button variant="ghost" onClick={() => onPromote(edit)}>
                  <GraduationCap size={16} /> Versetzen
                </Button>
              )
            }
          />
        </div>
      )}
    </Sheet>
  )
}

const GROUP_NAME_IDEAS = ['Religion ev.', 'Religion kath.', 'Ethik', 'Förderkurs Deutsch', 'Förderkurs Mathe', 'DaZ', 'Englisch']

function GroupEditor({
  value: edit,
  isExisting,
  onChange: setEdit,
  onClose,
  onArchive,
}: {
  value: SchoolClass | null
  isExisting: boolean
  onChange: (c: SchoolClass) => void
  onClose: () => void
  onArchive: (c: SchoolClass) => void
}) {
  const saveEdit = async () => {
    if (!edit) return
    const row: SchoolClass = { ...edit, kind: 'gruppe', name: edit.name.trim(), memberIds: [...new Set(edit.memberIds ?? [])] }
    await save(db.classes, row)
    if (!isExisting) await setActiveClassId(row.id)
    onClose()
    const n = row.memberIds?.length ?? 0
    toast(isExisting ? `Gruppe gespeichert · ${n} ${n === 1 ? 'Kind' : 'Kinder'}` : `Gruppe ${row.name} angelegt und aktiviert`)
  }
  return (
    <Sheet open={!!edit} onClose={onClose} title={isExisting ? `Gruppe ${edit?.name}` : 'Neue Gruppe'} wide>
      {edit && (
        <div className="space-y-5">
          <div>
            <Field label="Name">
              <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} placeholder="z. B. Religion ev." autoFocus={!isExisting} />
            </Field>
            {!edit.name.trim() && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {GROUP_NAME_IDEAS.map((n) => (
                  <button key={n} type="button" onClick={() => setEdit({ ...edit, name: n })} className="h-8 rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-600 hover:bg-slate-200">
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label hint="bestimmt, welche Kompetenzen angezeigt werden">Fach</Label>
            <SubjectChips options={ALL_SUBJECTS} value={edit.subjects} onChange={(subjects) => setEdit({ ...edit, subjects })} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Jahrgangsstufe</Label>
              <Segmented value={edit.gradeLevel} onChange={(g: GradeLevel) => setEdit({ ...edit, gradeLevel: g })} options={([1, 2, 3, 4] as const).map((g) => ({ value: g, label: String(g) }))} />
              <p className="mt-1.5 text-xs text-slate-400">Für das Kompetenzraster Jgst. {bandFor(edit.gradeLevel)}</p>
            </div>
            <Field label="Schuljahr">
              <input value={edit.schoolYear} onChange={(e) => setEdit({ ...edit, schoolYear: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div>
            <Label>Farbe</Label>
            <ColorPicker value={colorKey(edit)} onChange={(color) => setEdit({ ...edit, color })} />
          </div>
          <div>
            <Label hint={`${edit.memberIds?.length ?? 0} gewählt`}>Kinder in der Gruppe</Label>
            <MemberPicker value={edit.memberIds ?? []} onChange={(memberIds) => setEdit({ ...edit, memberIds })} />
          </div>
          <EditorFooter isExisting={isExisting} canSave={!!edit.name.trim()} onArchive={() => onArchive(edit)} onClose={onClose} onSave={saveEdit} />
        </div>
      )}
    </Sheet>
  )
}

/** Alle Kinder nach Stammklasse gruppiert, mit Suche und „ganze Klasse“. */
function MemberPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const data = useLiveQuery(async () => ({ students: alive(await db.students.toArray()), classes: alive(await db.classes.toArray()).filter((c) => !isGroup(c)) }), [])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string> | null>(null)
  const selected = new Set(value)

  const buckets = useMemo(() => {
    if (!data) return []
    const byClass = new Map<string, Student[]>()
    for (const s of data.students) byClass.set(s.classId, [...(byClass.get(s.classId) ?? []), s])
    const sortKids = (k: Student[]) => k.sort((a, b) => a.firstName.localeCompare(b.firstName, 'de') || a.lastName.localeCompare(b.lastName, 'de'))
    const sortedClasses = [...data.classes].sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || a.name.localeCompare(b.name, 'de', { numeric: true }))
    const out: { id: string; cls?: SchoolClass; label: string; kids: Student[] }[] = []
    for (const c of sortedClasses) {
      const kids = byClass.get(c.id) ?? []
      byClass.delete(c.id)
      if (!kids.length) continue
      // Archivierte Klassen nur zeigen, wenn dort noch gewählte Kinder sind
      if (c.archived && !kids.some((k) => selected.has(k.id))) continue
      out.push({ id: c.id, cls: c, label: `Klasse ${c.name}${c.archived ? ' (archiviert)' : ''}`, kids: sortKids(kids) })
    }
    const rest = [...byClass.values()].flat()
    if (rest.length) out.push({ id: '_', label: 'Ohne Klasse', kids: sortKids(rest) })
    return out
  }, [data])

  if (!data) return null
  if (!buckets.length) return <Empty icon={Users}>Noch keine Kinder. Lege zuerst Klassen mit Kindern an.</Empty>

  const needle = q.trim().toLowerCase()
  const match = (s: Student) => !needle || `${s.firstName} ${s.lastName}`.toLowerCase().includes(needle)
  // Standard: Klassen mit gewählten Kindern aufgeklappt (bzw. alle, wenn es nur eine gibt)
  const openSet = open ?? new Set(buckets.filter((b) => buckets.length === 1 || b.kids.some((k) => selected.has(k.id))).map((b) => b.id))
  const toggleOpen = (id: string) => {
    const n = new Set(openSet)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setOpen(n)
  }
  const toggleKid = (id: string) => onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id])
  const toggleAll = (kids: Student[]) => {
    const all = kids.every((k) => selected.has(k.id))
    const ids = new Set(kids.map((k) => k.id))
    onChange(all ? value.filter((x) => !ids.has(x)) : [...value, ...kids.filter((k) => !selected.has(k.id)).map((k) => k.id)])
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kind suchen …" className={clsx(inputCls, 'pl-9')} type="search" />
      </div>
      <div className="space-y-2">
        {buckets.map((b) => {
          const visible = b.kids.filter(match)
          if (needle && !visible.length) return null
          const isOpen = !!needle || openSet.has(b.id)
          const nSel = b.kids.filter((k) => selected.has(k.id)).length
          const all = nSel === b.kids.length
          return (
            <div key={b.id} className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <div className="flex items-center gap-2 bg-slate-50/70 pr-2">
                <button type="button" onClick={() => toggleOpen(b.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-3 text-left" aria-expanded={isOpen}>
                  <ChevronDown size={16} className={clsx('shrink-0 text-slate-400 transition', !isOpen && '-rotate-90')} />
                  <span className={clsx('size-2.5 shrink-0 rounded-full', b.cls ? classColor(b.cls).dot : 'bg-slate-300')} />
                  <span className="truncate text-sm font-semibold text-slate-800">{b.label}</span>
                  <span className={clsx('text-xs tabular-nums', nSel ? 'font-medium text-brand-700' : 'text-slate-400')}>
                    {nSel}/{b.kids.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleAll(b.kids)}
                  className={clsx('h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium ring-1 transition', all ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}
                >
                  {all ? 'Alle abwählen' : 'Ganze Klasse'}
                </button>
              </div>
              {isOpen && (
                <ul className="grid gap-px bg-slate-100 sm:grid-cols-2">
                  {visible.map((s) => {
                    const on = selected.has(s.id)
                    return (
                      <li key={s.id} className="bg-white">
                        <button type="button" onClick={() => toggleKid(s.id)} aria-pressed={on} className={clsx('flex min-h-11 w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition', on ? 'bg-brand-50/50' : 'hover:bg-slate-50')}>
                          <CheckBox on={on} />
                          <Avatar student={s} size={26} />
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium text-slate-800">{s.firstName}</span> <span className="text-slate-500">{s.lastName}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Schuljahreswechsel: neue Klasse anlegen, Kinder mitnehmen, alte Klasse archivieren. */
function PromoteSheet({ from, onClose }: { from: SchoolClass; onClose: () => void }) {
  const kids = useStudents(from.id)
  const nextGrade = Math.min(4, from.gradeLevel + 1) as GradeLevel
  const [grade, setGrade] = useState<GradeLevel>(nextGrade)
  const [name, setName] = useState(() => from.name.replace(new RegExp(`^${from.gradeLevel}`), String(nextGrade)))
  const [year, setYear] = useState(() => nextSchoolYear(from.schoolYear))
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [moveSlots, setMoveSlots] = useState(true)
  const [busy, setBusy] = useState(false)
  const slotCount = useLiveQuery(async () => alive(await db.timetable.where('classId').equals(from.id).toArray()).length, [from.id]) ?? 0
  const moving = kids.filter((k) => !excluded.has(k.id))
  const staying = kids.length - moving.length
  const col = classColor(from)
  // Fächer der neuen Jgst.: bisherige behalten, neu hinzukommende (z. B. Englisch ab Jgst. 3) ergänzen
  const subjects = SUBJECTS_BY_GRADE[grade].filter((s) => from.subjects.includes(s) || !SUBJECTS_BY_GRADE[from.gradeLevel].includes(s))

  const toggle = (id: string) => {
    const n = new Set(excluded)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setExcluded(n)
  }

  const go = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const newId = uid()
      const ids = moving.map((k) => k.id)
      await db.transaction('rw', [db.classes, db.students, db.timetable, db.meta], async () => {
        await save(db.classes, {
          id: newId,
          kind: 'klasse',
          name: name.trim(),
          gradeLevel: grade,
          schoolYear: year.trim(),
          subjects,
          color: colorKey(from),
          previousClassId: from.id,
          updatedAt: now(),
        })
        for (const id of ids) {
          const s = await db.students.get(id)
          if (!s || s.deleted) continue
          await save(db.students, { ...s, classId: newId, history: [...(s.history ?? []), { classId: from.id, schoolYear: from.schoolYear, className: from.name }] })
        }
        if (moveSlots) {
          const slots = alive(await db.timetable.where('classId').equals(from.id).toArray())
          for (const sl of slots) await save(db.timetable, { ...sl, classId: newId })
        }
        const old = await db.classes.get(from.id)
        if (old) await save(db.classes, { ...old, archived: 1 })
        await setActiveClassId(newId)
      })
      toast(`Klasse ${name.trim()} angelegt · ${ids.length} ${ids.length === 1 ? 'Kind' : 'Kinder'} versetzt · ${from.name} archiviert`)
      onClose()
    } catch (e) {
      toast(`Versetzen fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title={`Klasse ${from.name} versetzen`} wide>
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <div className="text-center">
            <span className={clsx('mx-auto flex size-12 items-center justify-center rounded-2xl text-base font-bold opacity-60', col.soft)}>{from.name.length <= 3 ? from.name : from.gradeLevel}</span>
            <p className="mt-1 text-xs text-slate-500">{from.schoolYear}</p>
          </div>
          <ArrowRight size={20} className="text-slate-400" />
          <div className="text-center">
            <span className={clsx('mx-auto flex size-12 items-center justify-center rounded-2xl text-base font-bold ring-2', col.soft, col.ring)}>{name.trim().length && name.trim().length <= 3 ? name.trim() : grade}</span>
            <p className="mt-1 text-xs font-medium text-slate-700">{year || '–'}</p>
          </div>
        </div>

        <section className="space-y-3">
          <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">1 · Neue Klasse</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="z. B. 3b" />
            </Field>
            <Field label="Schuljahr">
              <input value={year} onChange={(e) => setYear(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div>
            <Label hint={`bisher Jgst. ${from.gradeLevel}`}>Jahrgangsstufe</Label>
            <Segmented value={grade} onChange={(g: GradeLevel) => setGrade(g)} options={([1, 2, 3, 4] as const).map((g) => ({ value: g, label: `Jgst. ${g}` }))} />
          </div>
          {from.gradeLevel === 4 && (
            <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200/60">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" /> Jgst. 4 ist die letzte Jahrgangsstufe. Für Kinder, die die Grundschule verlassen, genügt es, die Klasse zu archivieren.
            </p>
          )}
          <p className="text-xs text-slate-400">
            Fächer: {subjects.join(', ')} · Farbe wird übernommen <span className={clsx('ml-1 inline-block size-2 rounded-full align-middle', col.dot)} />
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              2 · Wer geht mit? <span className="ml-1 text-brand-700 tabular-nums">{moving.length}/{kids.length}</span>
            </p>
            <Button size="sm" variant="ghost" onClick={() => setExcluded(excluded.size ? new Set() : new Set(kids.map((k) => k.id)))} disabled={!kids.length}>
              {excluded.size ? 'Alle wählen' : 'Keine'}
            </Button>
          </div>
          {kids.length ? (
            <ul className="grid gap-px overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 sm:grid-cols-2">
              {kids.map((s) => {
                const on = !excluded.has(s.id)
                return (
                  <li key={s.id} className="bg-white">
                    <button type="button" onClick={() => toggle(s.id)} aria-pressed={on} className={clsx('flex min-h-11 w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm', !on && 'text-slate-400')}>
                      <CheckBox on={on} />
                      <Avatar student={s} size={26} />
                      <span className="min-w-0 flex-1 truncate">
                        {s.firstName} {s.lastName}
                      </span>
                      {!on && <span className="text-[11px] text-slate-400">bleibt</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Diese Klasse hat keine Kinder.</p>
          )}
          {staying > 0 && <p className="text-xs text-slate-500">Nicht gewählte Kinder bleiben in der archivierten Klasse {from.name} (z. B. bei Wiederholung oder Wegzug).</p>}
        </section>

        <section className="space-y-2 rounded-2xl bg-brand-50/50 p-4 text-sm text-slate-700 ring-1 ring-brand-100">
          <p className="font-semibold text-slate-900">Was passiert</p>
          <ul className="space-y-1.5">
            <li className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-brand-600" /> Klasse {name.trim() || '…'} ({year}, Jgst. {grade}) wird angelegt und aktiviert.
            </li>
            <li className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-brand-600" /> {moving.length} {moving.length === 1 ? 'Kind wechselt' : 'Kinder wechseln'} – Beobachtungen, Ziele und Gespräche bleiben im Verlauf erhalten.
            </li>
            <li className="flex gap-2">
              <Archive size={16} className="mt-0.5 shrink-0 text-brand-600" /> Klasse {from.name} wird archiviert, nicht gelöscht.
            </li>
          </ul>
          {slotCount > 0 && (
            <button type="button" onClick={() => setMoveSlots(!moveSlots)} className="mt-2 flex w-full items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-left ring-1 ring-slate-200">
              <CheckBox on={moveSlots} />
              <span>
                {slotCount} {slotCount === 1 ? 'Stundenplan-Eintrag' : 'Stundenplan-Einträge'} auf die neue Klasse übertragen
              </span>
            </button>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={!name.trim() || !year.trim() || busy} onClick={go}>
            <GraduationCap size={16} /> {busy ? 'Versetze …' : `${moving.length} ${moving.length === 1 ? 'Kind' : 'Kinder'} versetzen`}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

/* ───────────────────────── Kinder ───────────────────────── */

type ParsedRow = { line: string; firstName: string; lastName: string; status: 'neu' | 'doppelt' }

const HEADER_WORDS = new Set(['name', 'namen', 'vorname', 'vornamen', 'nachname', 'nachnamen', 'familienname', 'rufname'])
const nameKey = (first: string, last: string) => `${first.trim().toLowerCase()}|${last.trim().toLowerCase()}`

/** Eine Zeile in Vor-/Nachname zerlegen. Mit Trennzeichen: „Nachname, Vorname" (Excel/Schulmanager). */
function parseLine(line: string): { firstName: string; lastName: string } | null {
  if (/[\t;,]/.test(line)) {
    const parts = line
      .split(/[\t;,]/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (!parts.length) return null
    return { lastName: parts[0], firstName: parts[1] ?? '' }
  }
  const words = line.split(/\s+/).filter(Boolean)
  if (!words.length) return null
  if (words.length === 1) return { firstName: words[0], lastName: '' }
  return { lastName: words[words.length - 1], firstName: words.slice(0, -1).join(' ') }
}

function parseBulk(text: string, existing: Student[]) {
  const seen = new Set(existing.map((s) => nameKey(s.firstName, s.lastName)))
  const rows: ParsedRow[] = []
  let headers = 0
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const tokens = line.toLowerCase().split(/[\s\t;,.:]+/).filter(Boolean)
    if (tokens.some((t) => HEADER_WORDS.has(t))) {
      headers++
      continue
    }
    const p = parseLine(line)
    if (!p || !(p.firstName || p.lastName)) continue
    const k = nameKey(p.firstName, p.lastName)
    rows.push({ line, ...p, status: seen.has(k) ? 'doppelt' : 'neu' })
    seen.add(k)
  }
  return { rows, headers }
}

/** Aktiver Kontext ist eine Gruppe: Mitglieder nur anzeigen, Pflege im Gruppen-Editor. */
function GroupMembers({ cls, students }: { cls: SchoolClass; students: Student[] }) {
  const [, setParams] = useSearchParams()
  const classes = useLiveQuery(async () => new Map(alive(await db.classes.toArray()).map((c) => [c.id, c])), []) ?? new Map<string, SchoolClass>()
  const byHome = new Map<string, Student[]>()
  for (const s of students) byHome.set(s.classId, [...(byHome.get(s.classId) ?? []), s])
  const edit = () => setParams({ bereich: 'klassen', bearbeiten: cls.id })
  return (
    <>
      <div className={clsx('flex flex-wrap items-center gap-3 rounded-2xl p-4 ring-1', classColor(cls).soft, classColor(cls).ring)}>
        <Layers size={20} className="shrink-0" />
        <p className="min-w-0 flex-1 text-sm">
          <b className="font-semibold">{cls.name}</b> ist eine Gruppe. Die Kinder gehören weiter zu ihrer Stammklasse – wer dabei ist, legst du im Gruppen-Editor fest. Namen und neue Kinder pflegst du in der jeweiligen Klasse.
        </p>
        <Button size="sm" variant="secondary" onClick={edit}>
          <Pencil size={15} /> Mitglieder bearbeiten
        </Button>
      </div>
      <Card title={`${students.length} ${students.length === 1 ? 'Kind' : 'Kinder'} in ${cls.name}`} icon={Users} padded={false}>
        {!students.length ? (
          <div className="px-5 pb-5">
            <Empty icon={Users}>Noch keine Mitglieder. Wähle sie im Gruppen-Editor aus.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {[...byHome.entries()].sort(([a], [b]) => (classes.get(a)?.name ?? '~').localeCompare(classes.get(b)?.name ?? '~', 'de', { numeric: true })).map(([homeId, kids]) => {
              const home = classes.get(homeId)
              return kids.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <Avatar student={s} size={34} />
                  <span className="min-w-0 flex-1 truncate text-[15px]">
                    <span className="font-medium text-slate-900">{s.firstName}</span> <span className="text-slate-500">{s.lastName}</span>
                  </span>
                  <span className={clsx('inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium', home ? classColor(home).soft : 'bg-slate-100 text-slate-500')}>
                    {home && <span className={clsx('size-2 rounded-full', classColor(home).dot)} />}
                    {home ? `Klasse ${home.name}` : 'ohne Klasse'}
                  </span>
                </li>
              ))
            })}
          </ul>
        )}
      </Card>
    </>
  )
}

function KinderVerwalten() {
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const [bulk, setBulk] = useState('')
  const parsed = useMemo(() => parseBulk(bulk, students), [bulk, students])
  if (!cls) return <Empty icon={Users}>Zuerst unter „Klassen & Gruppen“ eine Klasse anlegen.</Empty>
  if (isGroup(cls)) return <GroupMembers cls={cls} students={students} />
  const fresh = parsed.rows.filter((r) => r.status === 'neu')
  const dupes = parsed.rows.length - fresh.length

  const add = async () => {
    for (const r of fresh) await save(db.students, { id: uid(), classId: cls.id, firstName: r.firstName, lastName: r.lastName, updatedAt: now() })
    setBulk('')
    const skipped = dupes + parsed.headers
    toast(`${fresh.length} ${fresh.length === 1 ? 'Kind' : 'Kinder'} hinzugefügt${skipped ? ` · ${skipped} übersprungen` : ''}`)
  }

  return (
    <>
      <Card title={`Kinder hinzufügen · ${cls.name}`} icon={Plus}>
        <p className="mb-3 text-sm text-slate-500">
          Ein Kind pro Zeile. Aus Excel oder dem Schulmanager einfach einfügen: Mit Tab, Komma oder Semikolon gilt <b className="font-medium text-slate-700">Nachname, Vorname</b>. Ohne Trennzeichen
          ist das letzte Wort der Nachname. Kopfzeilen und doppelte Kinder werden übersprungen.
        </p>
        <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} className={inputCls} placeholder={'Lena Huber\nMaier, Tim\nYılmaz;Elif'} />
        {parsed.rows.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                <tr>
                  <th className="px-3 py-2">Vorname</th>
                  <th className="px-3 py-2">Nachname</th>
                  <th className="w-24 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.rows.map((r, i) => (
                  <tr key={i} className={clsx(r.status === 'doppelt' && 'text-slate-400')}>
                    <td className="px-3 py-2">{r.firstName || <span className="text-slate-300">–</span>}</td>
                    <td className="px-3 py-2">{r.lastName || <span className="text-slate-300">–</span>}</td>
                    <td className="px-3 py-2 text-right">{r.status === 'neu' ? <Badge tone="green">neu</Badge> : <Badge tone="amber">schon da</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          {(dupes > 0 || parsed.headers > 0) && (
            <span className="text-xs text-slate-400">
              {[dupes && `${dupes} doppelt`, parsed.headers && `${parsed.headers} Kopfzeile${parsed.headers > 1 ? 'n' : ''}`].filter(Boolean).join(' · ')} – wird übersprungen
            </span>
          )}
          <Button onClick={add} disabled={!fresh.length}>
            {fresh.length ? `${fresh.length} ${fresh.length === 1 ? 'Kind' : 'Kinder'} hinzufügen` : 'Hinzufügen'}
          </Button>
        </div>
      </Card>

      <Card title={`${students.length} ${students.length === 1 ? 'Kind' : 'Kinder'} in ${cls.name}`} icon={Users} padded={false}>
        {!students.length ? (
          <div className="px-5 pb-5">
            <Empty icon={Users}>Noch keine Kinder. Füge oben die Namensliste ein.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {students.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-5">
                <Avatar student={s} size={34} />
                <input
                  defaultValue={s.firstName}
                  aria-label="Vorname"
                  onBlur={(e) => e.target.value.trim() !== s.firstName && save(db.students, { ...s, firstName: e.target.value.trim() })}
                  className="h-10 w-28 min-w-0 rounded-lg bg-transparent px-2 text-[15px] font-medium outline-none hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 sm:w-40"
                />
                <input
                  defaultValue={s.lastName}
                  aria-label="Nachname"
                  onBlur={(e) => e.target.value.trim() !== s.lastName && save(db.students, { ...s, lastName: e.target.value.trim() })}
                  className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[15px] text-slate-600 outline-none hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`${s.firstName} entfernen`}
                  onClick={async () => {
                    if (!confirm(`${s.firstName} ${s.lastName} entfernen?\n\nZiele, Gespräche und eigene Beobachtungen des Kindes werden ebenfalls gelöscht.`)) return
                    await removeStudent(s.id)
                    toast(`${s.firstName} entfernt`)
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

/* ───────────────────────── Sitzplan ───────────────────────── */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v) || min))

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-600">{label}</span>
      <div className="inline-flex items-center rounded-xl bg-white shadow-[var(--shadow-card)] ring-1 ring-slate-200">
        <button type="button" className="flex size-10 items-center justify-center text-slate-500 hover:text-slate-900 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`${label} weniger`}>
          <Minus size={16} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10)
            if (!Number.isNaN(n)) onChange(clamp(n, min, max))
          }}
          className="w-10 bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          aria-label={label}
        />
        <button type="button" className="flex size-10 items-center justify-center text-slate-500 hover:text-slate-900 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`${label} mehr`}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

function Sitzplan() {
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const stored = useLiveQuery(async () => (cls ? (alive(await db.seatingPlans.where('classId').equals(cls.id).toArray())[0] ?? null) : null), [cls?.id])
  const [plan, setPlan] = useState<SeatingPlan | null>(null)
  const [dirty, setDirty] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  // Nur einmal pro Klasse/Plan initialisieren – ungespeicherte Änderungen bleiben erhalten,
  // wenn die Live-Abfrage erneut feuert.
  useEffect(() => {
    if (stored === undefined || !cls) return
    if (stored && stored.classId !== cls.id) return // Abfrage der vorherigen Klasse
    if (!plan || plan.classId !== cls.id) {
      setPlan(stored ?? { id: uid(), classId: cls.id, cols: 6, rows: 4, seats: [], updatedAt: now() })
      setDirty(false)
      setPicked(null)
      return
    }
    if (dirty) return
    // Keine lokalen Änderungen: Stand aus der Datenbank (z. B. nach Sync) übernehmen
    if (stored && (plan.id !== stored.id || plan.updatedAt !== stored.updatedAt)) setPlan(stored)
  }, [stored, cls, dirty, plan])

  if (!cls) return <Empty icon={LayoutGrid}>Zuerst unter „Klassen & Gruppen“ eine Klasse anlegen.</Empty>
  if (!plan || plan.classId !== cls.id) return null

  const byId = new Map(students.map((s) => [s.id, s]))
  const seats = plan.seats.filter((s) => byId.has(s.studentId))
  const at = (x: number, y: number) => seats.find((s) => s.x === x && s.y === y)
  const placed = new Set(seats.map((s) => s.studentId))
  const unplaced = students.filter((s) => !placed.has(s.id))
  const pickedStudent = picked ? byId.get(picked) : undefined
  const pickedSeated = !!picked && placed.has(picked)

  const update = (next: SeatingPlan) => {
    setPlan(next)
    setDirty(true)
  }
  const tapCell = (x: number, y: number) => {
    const occ = at(x, y)
    if (!picked) {
      if (occ) setPicked(occ.studentId)
      return
    }
    if (occ?.studentId === picked) {
      setPicked(null)
      return
    }
    const from = seats.find((s) => s.studentId === picked)
    const next = seats.filter((s) => s.studentId !== picked && !(s.x === x && s.y === y))
    next.push({ studentId: picked, x, y })
    if (occ && from) next.push({ studentId: occ.studentId, x: from.x, y: from.y })
    setPicked(null)
    update({ ...plan, seats: next })
  }
  const unseat = () => {
    if (!picked) return
    update({ ...plan, seats: seats.filter((s) => s.studentId !== picked) })
    setPicked(null)
  }
  const resize = (cols: number, rows: number) => {
    cols = clamp(cols, 2, 12)
    rows = clamp(rows, 1, 10)
    const keep = seats.filter((s) => s.x < cols && s.y < rows)
    const moved = seats.length - keep.length
    if (moved) toast(`${moved} ${moved === 1 ? 'Kind' : 'Kinder'} zurück zu „Noch ohne Platz"`)
    update({ ...plan, cols, rows, seats: keep })
  }
  const shuffle = () => {
    const cells = Array.from({ length: plan.rows * plan.cols }, (_, i) => ({ x: i % plan.cols, y: Math.floor(i / plan.cols) }))
    const kids = [...students].sort(() => Math.random() - 0.5)
    update({ ...plan, seats: kids.slice(0, cells.length).map((s, i) => ({ studentId: s.id, ...cells[i] })) })
    setPicked(null)
  }
  const store = async () => {
    await save(db.seatingPlans, { ...plan, seats })
    setDirty(false)
    toast('Sitzplan gespeichert')
  }

  return (
    <Card
      title={`Sitzplan · ${cls.name}`}
      icon={LayoutGrid}
      action={
        <div className="flex items-center gap-2">
          {dirty && (
            <Badge tone="amber" className="hidden sm:inline-flex">
              Ungespeichert
            </Badge>
          )}
          <Button size="sm" disabled={!dirty} onClick={store}>
            Speichern
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Stepper label="Spalten" value={plan.cols} min={2} max={12} onChange={(c) => resize(c, plan.rows)} />
        <Stepper label="Reihen" value={plan.rows} min={1} max={10} onChange={(r) => resize(plan.cols, r)} />
        <span className="flex-1" />
        <Button variant="secondary" onClick={shuffle} disabled={!students.length}>
          <Shuffle size={16} /> Zufällig
        </Button>
        <Button
          variant="ghost"
          disabled={!seats.length}
          onClick={() => {
            update({ ...plan, seats: [] })
            setPicked(null)
          }}
        >
          <Eraser size={16} /> Leeren
        </Button>
      </div>

      {dirty && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:hidden">
          <TriangleAlert size={15} /> Ungespeicherte Änderungen
        </p>
      )}

      <div className={clsx('mb-3 flex min-h-10 flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm', pickedStudent ? 'bg-brand-50 text-brand-800' : 'bg-slate-50 text-slate-500')}>
        {pickedStudent ? (
          <>
            <Avatar student={pickedStudent} size={24} />
            <span className="flex-1">
              <b className="font-semibold">{pickedStudent.firstName}</b> gewählt – jetzt einen Platz antippen{pickedSeated ? ' (belegte Plätze werden getauscht)' : ''}.
            </span>
            {pickedSeated && (
              <Button size="sm" variant="ghost" onClick={unseat}>
                Platz freigeben
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
              Abbrechen
            </Button>
          </>
        ) : (
          <span>Kind antippen, dann einen Platz antippen.</span>
        )}
      </div>

      {/* Klassenzimmer */}
      <div className="overflow-x-auto rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70 sm:p-5">
        <div style={{ minWidth: plan.cols * 68 }}>
          <div className="mx-auto mb-5 flex h-9 w-2/3 max-w-md items-center justify-center rounded-lg bg-gradient-to-b from-emerald-700 to-emerald-900 text-xs font-semibold tracking-wider !text-[#fff] uppercase shadow-md ring-4 ring-amber-900/20">
            Tafel
          </div>
          <div className="grid gap-2 sm:gap-2.5" style={{ gridTemplateColumns: `repeat(${plan.cols}, minmax(60px, 1fr))` }}>
            {Array.from({ length: plan.rows * plan.cols }, (_, i) => {
              const x = i % plan.cols
              const y = Math.floor(i / plan.cols)
              const seat = at(x, y)
              const s = seat && byId.get(seat.studentId)
              const isPicked = !!s && picked === s.id
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => tapCell(x, y)}
                  className={clsx(
                    'relative flex h-20 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs transition active:scale-[0.97]',
                    s
                      ? 'bg-white font-medium text-slate-700 shadow-[var(--shadow-card)] ring-1 ring-slate-200'
                      : clsx('border border-dashed text-slate-300', picked ? 'border-brand-300 bg-brand-50/50 text-brand-400' : 'border-slate-300 bg-white/40'),
                    isPicked && 'ring-2 ring-brand-500',
                  )}
                  aria-label={s ? `${s.firstName}, Reihe ${y + 1}, Platz ${x + 1}` : `Freier Platz, Reihe ${y + 1}, Platz ${x + 1}`}
                >
                  {s ? (
                    <>
                      <Avatar student={s} size={30} />
                      <span className="w-full truncate text-center">{s.firstName}</span>
                    </>
                  ) : (
                    picked && <Plus size={16} />
                  )}
                  <span className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-slate-200" aria-hidden />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-600">
          Noch ohne Platz <Badge>{unplaced.length}</Badge>
        </p>
        {unplaced.length ? (
          <div className="flex flex-wrap gap-2">
            {unplaced.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setPicked(picked === s.id ? null : s.id)}
                className={clsx('flex h-10 items-center gap-2 rounded-full pr-3.5 pl-1 text-sm font-medium ring-1 transition', picked === s.id ? 'bg-brand-50 text-brand-800 ring-2 ring-brand-500' : 'bg-white ring-slate-200 hover:bg-slate-50')}
              >
                <Avatar student={s} size={30} /> {s.firstName}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{students.length ? 'Alle Kinder haben einen Platz.' : 'Noch keine Kinder in dieser Klasse.'}</p>
        )}
      </div>
    </Card>
  )
}

/* ───────────────────────── Schnell-Einträge ───────────────────────── */

function Vorlagen() {
  const list = useLiveQuery(async () => alive(await db.quickTemplates.orderBy('order').toArray())) ?? []
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<ObsKind>('arbeitsverhalten')
  const [valence, setValence] = useState<Valence>('pos')
  const add = async () => {
    if (!label.trim()) return
    await save(db.quickTemplates, { id: uid(), label: label.trim(), kind, valence, order: list.length, updatedAt: now() })
    setLabel('')
  }
  return (
    <>
      <Card title="Meine Schnell-Einträge" icon={Zap} padded={false}>
        <p className="-mt-2 px-5 pb-3 text-sm text-slate-500">Erscheinen im Unterricht als Knöpfe – ein Tipp genügt für eine Beobachtung.</p>
        {list.length ? (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {list.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className={clsx('size-2.5 shrink-0 rounded-full', t.valence === 'pos' ? 'bg-emerald-500' : t.valence === 'neg' ? 'bg-rose-500' : 'bg-slate-300')} />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{t.label}</span>
                <Badge className="hidden sm:inline-flex">{KIND_LABEL[t.kind]}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`${t.label} löschen`}
                  onClick={async () => {
                    await remove(db.quickTemplates, t.id)
                    toast(`„${t.label}" gelöscht`, () => void save(db.quickTemplates, { ...t, deleted: 0 }))
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 pb-5">
            <Empty icon={Zap}>Noch keine Schnell-Einträge. Lege unten typische Beobachtungen an.</Empty>
          </div>
        )}
      </Card>
      <Card title="Neuer Schnell-Eintrag" icon={Plus}>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field label="Text">
            <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="z. B. rechnet nicht zählend" className={inputCls} />
          </Field>
          <Field label="Art">
            <select value={kind} onChange={(e) => setKind(e.target.value as ObsKind)} className={inputCls}>
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={valence}
            onChange={setValence}
            options={[
              { value: 'pos', label: <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />positiv</span> },
              { value: 'neu', label: <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-300" />neutral</span> },
              { value: 'neg', label: <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500" />Sorge</span> },
            ]}
          />
          <Button disabled={!label.trim()} onClick={add}>
            <Plus size={16} /> Hinzufügen
          </Button>
        </div>
      </Card>
    </>
  )
}

/* ───────────────────────── Stundenplan ───────────────────────── */

const WEEKDAYS: { n: TimetableSlot['weekday']; short: string; long: string }[] = [
  { n: 1, short: 'Mo', long: 'Montag' },
  { n: 2, short: 'Di', long: 'Dienstag' },
  { n: 3, short: 'Mi', long: 'Mittwoch' },
  { n: 4, short: 'Do', long: 'Donnerstag' },
  { n: 5, short: 'Fr', long: 'Freitag' },
]

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const fromMin = (min: number) => {
  const m = Math.max(0, Math.min(23 * 60 + 59, min))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

type CellRef = { weekday: TimetableSlot['weekday']; period: number; slot?: TimetableSlot }

function Stundenplan() {
  const periods = usePeriods()
  const slots = useTimetable()
  const allClasses = useLiveQuery(async () => alive(await db.classes.toArray()), []) ?? []
  const byId = new Map(allClasses.map((c) => [c.id, c]))
  const [cell, setCell] = useState<CellRef | null>(null)
  const today = new Date().getDay()
  const at = (wd: number, p: number) => slots.find((s) => s.weekday === wd && s.period === p)
  const activeClasses = allClasses.filter((c) => !c.archived)
  const perWeek = new Map<string, number>()
  for (const s of slots) if (periods.some((p) => p.period === s.period)) perWeek.set(s.classId, (perWeek.get(s.classId) ?? 0) + 1)

  return (
    <>
      <Card title="Wochenplan" icon={CalendarDays} padded={false}>
        <p className="-mt-2 px-5 pb-3 text-sm text-slate-500">Feld antippen, um Klasse oder Gruppe und Fach einzutragen. Das Cockpit zeigt dann, was gleich ansteht.</p>
        {!activeClasses.length ? (
          <div className="px-5 pb-5">
            <Empty icon={School}>Lege zuerst unter „Klassen & Gruppen“ eine Klasse an.</Empty>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100 px-3 py-4 sm:px-5">
            <div className="grid min-w-[620px] gap-1.5" style={{ gridTemplateColumns: '64px repeat(5, minmax(104px, 1fr))' }}>
              <div />
              {WEEKDAYS.map((d) => (
                <div key={d.n} className={clsx('rounded-lg py-1.5 text-center text-xs font-semibold tracking-wide uppercase', d.n === today ? 'bg-brand-50 text-brand-700' : 'text-slate-400')}>
                  <span className="sm:hidden">{d.short}</span>
                  <span className="hidden sm:inline">{d.long}</span>
                </div>
              ))}
              {periods.map((p) => (
                <PeriodRow key={p.period} p={p}>
                  {WEEKDAYS.map((d) => {
                    const s = at(d.n, p.period)
                    const c = s && byId.get(s.classId)
                    const col = classColor(c)
                    return (
                      <button
                        key={d.n}
                        type="button"
                        onClick={() => setCell({ weekday: d.n, period: p.period, slot: s })}
                        aria-label={`${d.long}, ${p.period}. Stunde${s ? `: ${c ? ctxName(c) : 'unbekannt'}, ${s.subject}` : ', frei'}`}
                        className={clsx(
                          'group relative flex h-[68px] min-w-0 flex-col items-start justify-center rounded-xl px-2.5 text-left transition active:scale-[0.98]',
                          s
                            ? clsx(c ? col.soft : 'bg-slate-100 text-slate-500', 'ring-1 ring-inset', c ? col.ring : 'ring-slate-200', c?.archived && 'opacity-50')
                            : 'border border-dashed border-slate-200 text-slate-300 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-400',
                        )}
                      >
                        {s ? (
                          <>
                            <span className="flex w-full min-w-0 items-center gap-1.5">
                              <span className={clsx('size-2 shrink-0 rounded-full', c ? col.dot : 'bg-slate-300')} />
                              <span className="truncate text-[13px] font-semibold">{c ? c.name : 'gelöscht'}</span>
                            </span>
                            <span className="w-full truncate text-xs opacity-80">{s.subject}</span>
                            {s.room && (
                              <span className="flex w-full items-center gap-0.5 truncate text-[11px] opacity-60">
                                <MapPin size={10} className="shrink-0" />
                                {s.room}
                              </span>
                            )}
                          </>
                        ) : (
                          <Plus size={16} className="mx-auto opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-60" />
                        )}
                      </button>
                    )
                  })}
                </PeriodRow>
              ))}
            </div>
          </div>
        )}
        {perWeek.size > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3">
            {[...perWeek.entries()].map(([id, n]) => {
              const c = byId.get(id)
              if (!c) return null
              return (
                <span key={id} className={clsx('inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium', classColor(c).soft)}>
                  <span className={clsx('size-2 rounded-full', classColor(c).dot)} />
                  {c.name} · {n} Std.
                </span>
              )
            })}
          </div>
        )}
      </Card>

      <PeriodsEditor slots={slots} />

      {cell && <SlotSheet cell={cell} classes={activeClasses} byId={byId} periods={periods} onClose={() => setCell(null)} />}
    </>
  )
}

function PeriodRow({ p, children }: { p: PeriodTime; children: ReactNode }) {
  return (
    <>
      <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 text-center">
        <span className="text-sm font-semibold text-slate-700 tabular-nums">{p.period}.</span>
        <span className="text-[10px] leading-tight text-slate-400 tabular-nums">
          {p.start}
          <br />
          {p.end}
        </span>
      </div>
      {children}
    </>
  )
}

function SlotSheet({ cell, classes, byId, periods, onClose }: { cell: CellRef; classes: SchoolClass[]; byId: Map<string, SchoolClass>; periods: PeriodTime[]; onClose: () => void }) {
  const [classId, setClassId] = useState(cell.slot?.classId ?? '')
  const [subject, setSubject] = useState(cell.slot?.subject ?? '')
  const [room, setRoom] = useState(cell.slot?.room ?? '')
  const cls = byId.get(classId)
  const subjectOptions = [...new Set([...(cls?.subjects ?? []), ...(subject ? [subject] : [])])]
  const time = periods.find((p) => p.period === cell.period)
  const day = WEEKDAYS.find((d) => d.n === cell.weekday)!
  // Archivierte/gelöschte Klasse eines bestehenden Eintrags trotzdem anzeigen
  const options = cls && !classes.some((c) => c.id === cls.id) ? [...classes, cls] : classes

  const pick = (c: SchoolClass) => {
    setClassId(c.id)
    if (!c.subjects.includes(subject)) setSubject(c.subjects.length === 1 ? c.subjects[0] : '')
  }
  const store = async () => {
    if (!classId || !subject.trim()) return
    await save(db.timetable, {
      id: cell.slot?.id ?? uid(),
      weekday: cell.weekday,
      period: cell.period,
      classId,
      subject: subject.trim(),
      room: room.trim() || undefined,
      updatedAt: now(),
    })
    onClose()
  }
  const clear = async () => {
    if (!cell.slot) return
    const s = cell.slot
    await remove(db.timetable, s.id)
    onClose()
    toast(`${day.short}, ${cell.period}. Stunde geleert`, () => void db.timetable.get(s.id).then((x) => x && save(db.timetable, { ...x, deleted: 0 })))
  }

  return (
    <Sheet open onClose={onClose} title={`${day.long}, ${cell.period}. Stunde${time ? ` · ${time.start}–${time.end}` : ''}`}>
      <div className="space-y-5">
        <div>
          <Label>Klasse oder Gruppe</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((c) => {
              const on = c.id === classId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  aria-pressed={on}
                  className={clsx('flex min-h-12 items-center gap-2.5 rounded-xl px-3 py-2 text-left ring-1 transition', on ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-slate-200 hover:bg-slate-50')}
                >
                  <span className={clsx('size-3 shrink-0 rounded-full', classColor(c).dot)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{ctxName(c)}</span>
                    <span className="block truncate text-xs text-slate-500">{isGroup(c) ? 'Gruppe' : `Jgst. ${c.gradeLevel}`}{c.archived ? ' · archiviert' : ''}</span>
                  </span>
                  {on && <Check size={16} className="shrink-0 text-brand-600" />}
                </button>
              )
            })}
          </div>
        </div>
        {cls && (
          <div>
            <Label>Fach</Label>
            {subjectOptions.length ? (
              <div className="flex flex-wrap gap-2">
                {subjectOptions.map((s) => {
                  const on = s === subject
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSubject(s)}
                      className={clsx('inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ring-1 transition', on ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}
                    >
                      {on && <Check size={14} />}
                      {s}
                    </button>
                  )
                })}
              </div>
            ) : (
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder="z. B. Religion/Ethik" list="tt-subjects" />
            )}
            <datalist id="tt-subjects">
              {ALL_SUBJECTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        )}
        <Field label="Raum (optional)">
          <input value={room} onChange={(e) => setRoom(e.target.value)} className={inputCls} placeholder="z. B. Turnhalle, R 104" />
        </Field>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {cell.slot && (
            <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={clear}>
              <Eraser size={16} /> Leeren
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={!classId || !subject.trim()} onClick={store}>
            Speichern
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

function PeriodsEditor({ slots }: { slots: TimetableSlot[] }) {
  const periods = usePeriods()
  const [draft, setDraft] = useState<PeriodTime[] | null>(null)
  const rows = draft ?? periods
  const invalid = (p: PeriodTime, i: number) => !p.start || !p.end || toMin(p.end) <= toMin(p.start) || (i > 0 && toMin(p.start) < toMin(rows[i - 1].end))
  const anyInvalid = rows.some(invalid)
  const setRow = (i: number, patch: Partial<PeriodTime>) => setDraft(rows.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const add = () => {
    const last = rows[rows.length - 1]
    const start = last ? fromMin(toMin(last.end) + 5) : '08:00'
    setDraft([...rows, { period: (last?.period ?? 0) + 1, start, end: fromMin(toMin(start) + 45) }])
  }
  const removeLast = () => setDraft(rows.slice(0, -1))
  const store = async () => {
    const keep = new Set(rows.map((p) => p.period))
    const orphans = slots.filter((s) => !keep.has(s.period))
    if (orphans.length && !confirm(`${orphans.length} ${orphans.length === 1 ? 'Eintrag liegt' : 'Einträge liegen'} in einer entfernten Stunde und ${orphans.length === 1 ? 'wird' : 'werden'} aus dem Stundenplan gelöscht. Fortfahren?`)) return
    for (const s of orphans) await remove(db.timetable, s.id)
    await setPeriods(rows)
    setDraft(null)
    toast('Zeiten gespeichert')
  }
  const isDefault = JSON.stringify(rows) === JSON.stringify(DEFAULT_PERIODS)

  return (
    <Card
      title="Zeiten der Stunden"
      icon={Clock}
      action={
        <div className="flex items-center gap-2">
          {draft && (
            <Badge tone="amber" className="hidden sm:inline-flex">
              Ungespeichert
            </Badge>
          )}
          <Button size="sm" disabled={!draft || anyInvalid} onClick={store}>
            Speichern
          </Button>
        </div>
      }
    >
      <ul className="space-y-2">
        {rows.map((p, i) => {
          const bad = invalid(p, i)
          const isLast = i === rows.length - 1
          return (
            <li key={p.period} className="flex items-center gap-2 sm:gap-3">
              <span className="w-14 shrink-0 text-sm font-semibold text-slate-700 tabular-nums">{p.period}. Std.</span>
              <input type="time" value={p.start} onChange={(e) => setRow(i, { start: e.target.value })} aria-label={`${p.period}. Stunde Beginn`} className={clsx(inputCls, '!w-auto min-w-0 flex-1 tabular-nums sm:flex-none', bad && 'ring-2 ring-rose-400')} />
              <span className="text-slate-400">–</span>
              <input type="time" value={p.end} onChange={(e) => setRow(i, { end: e.target.value })} aria-label={`${p.period}. Stunde Ende`} className={clsx(inputCls, '!w-auto min-w-0 flex-1 tabular-nums sm:flex-none', bad && 'ring-2 ring-rose-400')} />
              <span className="hidden text-xs text-slate-400 tabular-nums sm:inline">{!bad && `${toMin(p.end) - toMin(p.start)} min`}</span>
              <span className="flex-1 max-sm:hidden" />
              {isLast && rows.length > 1 ? (
                <Button size="sm" variant="ghost" className="text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={removeLast} aria-label={`${p.period}. Stunde entfernen`}>
                  <Trash2 size={15} />
                </Button>
              ) : (
                <span className="w-9 shrink-0" />
              )}
            </li>
          )
        })}
      </ul>
      {anyInvalid && (
        <p className="mt-3 flex items-center gap-2 text-sm text-rose-600">
          <TriangleAlert size={15} /> Eine Stunde muss nach ihrem Beginn und nach der vorigen Stunde enden.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" size="sm" onClick={add} disabled={rows.length >= 12}>
          <Plus size={15} /> Stunde hinzufügen
        </Button>
        <span className="flex-1" />
        {draft && (
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
            Verwerfen
          </Button>
        )}
        <Button variant="ghost" size="sm" disabled={isDefault} onClick={() => setDraft(DEFAULT_PERIODS.map((p) => ({ ...p })))}>
          <RotateCcw size={15} /> Standard wiederherstellen
        </Button>
      </div>
    </Card>
  )
}

/* ───────────────────────── Kompetenzen ───────────────────────── */

type Band = '1/2' | '3/4'

const LEVEL_DOT = ['', 'bg-rose-400', 'bg-amber-400', 'bg-sky-400', 'bg-emerald-500']

function CompetencyRow({ c }: { c: Competency }) {
  const [open, setOpen] = useState(false)
  const stored = [0, 1, 2, 3].map((i) => c.indicators?.[i] ?? '')
  const [draft, setDraft] = useState<string[]>(stored)
  const nInd = stored.filter((s) => s.trim()).length
  const nAnchors = Object.values(c.anchors ?? {}).reduce((n, ids) => n + (ids?.length ?? 0), 0)

  const commit = async (next: string[]) => {
    const clean = next.map((s) => s.trim())
    if (clean.join('\u0000') === stored.map((s) => s.trim()).join('\u0000')) return
    const indicators = clean.map((s) => s || undefined) as Competency['indicators']
    await save(db.competencies, { ...c, indicators: clean.some(Boolean) ? indicators : undefined })
    toast('Indikatoren gespeichert')
  }

  return (
    <li className="text-sm">
      <div className="flex items-center gap-1 py-1 pr-1 pl-1">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
          <ChevronDown size={15} className={clsx('shrink-0 text-slate-400 transition', !open && '-rotate-90')} />
          <span className="min-w-0 flex-1 text-slate-700">{c.text}</span>
          {nInd > 0 && (
            <Badge tone="brand" className="shrink-0">
              {nInd}/4 <span className="hidden sm:inline">Indikatoren</span>
            </Badge>
          )}
          {nAnchors > 0 && (
            <Badge tone="violet" className="shrink-0">
              <Anchor size={11} /> {nAnchors}
            </Badge>
          )}
        </button>
        <Button
          size="sm"
          variant="ghost"
          className="text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          aria-label="Kompetenz löschen"
          onClick={async () => {
            if (!confirm(`Kompetenz löschen?\n\n„${c.text}"`)) return
            await remove(db.competencies, c.id)
            toast('Kompetenz gelöscht')
          }}
        >
          <Trash2 size={15} />
        </Button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-3 py-3 sm:pl-9">
          <p className="text-xs text-slate-500">Woran erkennst du die Stufe? Beobachtbare Indikatoren helfen beim Einschätzen – leer lassen, um den allgemeinen Hinweis zu nutzen.</p>
          {[1, 2, 3, 4].map((lvl) => (
            <label key={lvl} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <span className="flex w-28 shrink-0 items-center gap-2 text-[13px] font-medium text-slate-600">
                <span className={clsx('size-2 rounded-full', LEVEL_DOT[lvl])} />
                {LEVEL_LABEL[lvl]}
                {(c.anchors?.[lvl as 1 | 2 | 3 | 4]?.length ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-normal text-violet-600" title="Ankerbeispiele">
                    <Anchor size={10} />
                    {c.anchors?.[lvl as 1 | 2 | 3 | 4]?.length}
                  </span>
                )}
              </span>
              <input
                value={draft[lvl - 1]}
                onChange={(e) => setDraft(draft.map((d, i) => (i === lvl - 1 ? e.target.value : d)))}
                onBlur={() => void commit(draft)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                placeholder={DEFAULT_LEVEL_HINTS[lvl]}
                className={clsx(inputCls, 'py-2 text-sm')}
              />
            </label>
          ))}
        </div>
      )}
    </li>
  )
}

function Kompetenzen() {
  const { cls } = useActiveClass()
  // Auswahl gilt nur für die Klasse, in der sie getroffen wurde – sonst folgt das Band der aktiven Klasse.
  const [override, setOverride] = useState<{ classId?: string; band: Band } | null>(null)
  const band: Band = override && override.classId === cls?.id ? override.band : cls ? bandFor(cls.gradeLevel) : '1/2'
  const [subjectPick, setSubject] = useState<string | null>(null)
  const subject = subjectPick ?? (cls && isGroup(cls) && cls.subjects[0] && ALL_SUBJECTS.includes(cls.subjects[0]) ? cls.subjects[0] : 'Mathematik')
  const comps = useLiveQuery(async () => alive(await db.competencies.where('band').equals(band).toArray()), [band]) ?? []
  const [area, setArea] = useState('')
  const [text, setText] = useState('')
  const shown = comps.filter((c) => c.subject === subject)
  const areas = [...new Set(shown.map((c) => c.area))]
  const withInd = shown.filter((c) => c.indicators?.some((s) => s?.trim())).length
  return (
    <>
      <Card title="Kompetenzraster" icon={BookOpenCheck}>
        <p className="-mt-2 mb-4 text-sm text-slate-500">Vorbelegt nach LehrplanPLUS Bayern. Tippe eine Kompetenz an, um Indikatoren für die Stufen nicht · teilweise · überwiegend · sicher festzulegen.</p>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Segmented
            value={band}
            onChange={(b: Band) => setOverride({ classId: cls?.id, band: b })}
            options={[
              { value: '1/2', label: 'Jgst. 1/2' },
              { value: '3/4', label: 'Jgst. 3/4' },
            ]}
          />
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={clsx(inputCls, '!w-auto py-2 text-sm')}>
            {SUBJECTS_BY_GRADE[4].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400 tabular-nums">
            {shown.length} Einträge{withInd ? ` · ${withInd} mit Indikatoren` : ''}
          </span>
        </div>
        <div className="space-y-4">
          {areas.map((a) => (
            <div key={a}>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{a}</p>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200/80">
                {shown
                  .filter((c) => c.area === a)
                  .map((c) => (
                    <CompetencyRow key={c.id} c={c} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
        {!shown.length && <Empty icon={BookOpenCheck}>Für {subject} noch keine Kompetenzen – unten anlegen.</Empty>}
      </Card>
      <Card title="Kompetenz ergänzen" icon={Plus}>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label="Lernbereich">
            <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="z. B. Zahlen und Operationen" list="areas" className={inputCls} />
          </Field>
          <datalist id="areas">
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          <Field label="Kompetenzerwartung">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Die Schülerinnen und Schüler …" className={inputCls} />
          </Field>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            Wird gespeichert für {subject}, Jgst. {band}
          </span>
          <Button
            disabled={!area.trim() || !text.trim()}
            onClick={async () => {
              await save(db.competencies, { id: uid(), subject, band, area: area.trim(), text: text.trim(), updatedAt: now() })
              setText('')
              toast('Kompetenz ergänzt')
            }}
          >
            <Plus size={16} /> Hinzufügen
          </Button>
        </div>
      </Card>
    </>
  )
}

/* ───────────────────────── Darstellung ───────────────────────── */

function Darstellung() {
  const pref = useTheme()
  const opts: { value: ThemePref; label: string; hint: string; icon: LucideIcon }[] = [
    { value: 'light', label: 'Hell', hint: 'Immer helle Oberfläche', icon: Sun },
    { value: 'dark', label: 'Dunkel', hint: 'Schont die Augen am Abend', icon: Moon },
    { value: 'system', label: 'Automatisch', hint: 'Folgt der Einstellung des Geräts', icon: Monitor },
  ]
  return (
    <Card title="Erscheinungsbild" icon={Palette}>
      <div className="grid gap-3 sm:grid-cols-3">
        {opts.map((o) => {
          const on = pref === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setTheme(o.value)}
              aria-pressed={on}
              className={clsx('relative flex flex-col items-start gap-3 rounded-2xl p-4 text-left ring-1 transition', on ? 'bg-brand-50/60 ring-2 ring-brand-500' : 'bg-white ring-slate-200 hover:bg-slate-50')}
            >
              <span className={clsx('flex size-10 items-center justify-center rounded-xl', on ? 'bg-brand-600 !text-[#fff]' : 'bg-slate-100 text-slate-500')}>
                <o.icon size={18} />
              </span>
              <span>
                <span className="block font-semibold text-slate-900">{o.label}</span>
                <span className="block text-xs text-slate-500">{o.hint}</span>
              </span>
              {on && (
                <span className="absolute top-3 right-3 text-brand-600">
                  <Check size={18} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/* ───────────────────────── Konto & Sync ───────────────────────── */

type AnyRow = { id?: string; updatedAt?: string; attachments?: Attachment[] }
const ts = (s?: string) => (s ? Date.parse(s) || 0 : 0)

function Konto() {
  const [user, setUser] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const lastSync = useLiveQuery(() => getMeta<string | null>('lastSync', null))
  const syncErrors = useLiveQuery(() => getMeta<string[]>('lastSyncErrors', [])) ?? []
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user?.email ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user?.email ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const exportJson = async () => {
    const out: Record<string, unknown[]> = {}
    for (const t of SYNCED_TABLES) {
      const rows = await db.table(t).toArray()
      out[t] = rows.map((r) => (r.attachments ? { ...r, attachments: r.attachments.map(({ blob: _b, ...a }: { blob?: Blob }) => (void _b, a)) } : r))
    }
    const blob = new Blob([JSON.stringify({ exportedAt: now(), ...out }, null, 1)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cockpit-backup-${now().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const importJson = async (file?: File) => {
    if (!file) return
    let data: Record<string, unknown>
    try {
      data = JSON.parse(await file.text())
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error()
    } catch {
      toast('Datei konnte nicht gelesen werden – ist das ein Backup (JSON) aus dieser App?')
      return
    }
    if (!SYNCED_TABLES.some((t) => Array.isArray(data[t]))) {
      toast('Diese Datei enthält keine Backup-Daten.')
      return
    }
    const when = typeof data.exportedAt === 'string' ? ` vom ${new Date(data.exportedAt).toLocaleString('de-DE')}` : ''
    if (!confirm(`Backup${when} importieren?\n\nEinträge, die auf diesem Gerät neuer sind, bleiben erhalten. Fotos und Sprachmemos auf diesem Gerät bleiben erhalten.`)) return
    setImporting(true)
    let imported = 0
    let skipped = 0
    try {
      for (const t of SYNCED_TABLES) {
        const rows = data[t]
        if (!Array.isArray(rows)) continue
        const table = db.table(t)
        await db.transaction('rw', table, async () => {
          const puts: AnyRow[] = []
          for (const row of rows as AnyRow[]) {
            if (!row || typeof row !== 'object' || typeof row.id !== 'string') {
              skipped++
              continue
            }
            const local = (await table.get(row.id)) as AnyRow | undefined
            if (local && ts(row.updatedAt) <= ts(local.updatedAt)) {
              skipped++
              continue
            }
            let next: AnyRow = { ...row }
            if (Array.isArray(row.attachments) && local?.attachments?.length) {
              const blobs = new Map(local.attachments.filter((a) => a.blob).map((a) => [a.id, a.blob]))
              next = { ...next, attachments: row.attachments.map((a) => (blobs.has(a.id) ? { ...a, blob: blobs.get(a.id) } : a)) }
            }
            puts.push({ ...next, dirty: 1 } as AnyRow)
          }
          if (puts.length) await table.bulkPut(puts)
          imported += puts.length
        })
      }
      toast(`Backup importiert: ${imported} übernommen, ${skipped} übersprungen (lokal neuer oder gleich)`)
    } catch (e) {
      toast(`Import fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Card title="Cloud-Sync" icon={Cloud}>
        {user ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <span className="flex size-10 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold !text-[#fff]">{user[0]?.toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{user}</p>
                <p className="text-xs text-slate-500">Letzte Synchronisation: {lastSync ? new Date(lastSync).toLocaleString('de-DE') : 'noch nie'}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => signOutLocal()}
              >
                <LogOut size={16} /> Abmelden / Konto wechseln
              </Button>
            </div>
            {syncErrors.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200/60">
                <p className="mb-1 flex items-center gap-2 font-medium">
                  <TriangleAlert size={16} /> Beim letzten Sync gab es {syncErrors.length === 1 ? 'ein Problem' : `${syncErrors.length} Probleme`}
                </p>
                <ul className="list-disc space-y-0.5 pl-6 text-[13px] text-amber-800">
                  {syncErrors.slice(0, 8).map((e, i) => (
                    <li key={i} className="break-words">
                      {e}
                    </li>
                  ))}
                  {syncErrors.length > 8 && <li>… und {syncErrors.length - 8} weitere</li>}
                </ul>
              </div>
            )}
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const r = await sync()
                  toast(r.errors.length ? `Sync mit ${r.errors.length} Problem(en): ${r.pushed} hoch, ${r.pulled} runter` : `Sync: ${r.pushed} hoch, ${r.pulled} runter`)
                } catch (e) {
                  toast(`Sync fehlgeschlagen: ${(e as Error).message}`)
                } finally {
                  setBusy(false)
                }
              }}
            >
              <RefreshCw size={16} className={clsx(busy && 'animate-spin')} /> Jetzt synchronisieren
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nicht angemeldet.</p>
        )}
      </Card>
      <Card title="Backup" icon={Database}>
        <p className="-mt-2 mb-4 text-sm text-slate-500">Sichere alle Daten als Datei, z. B. vor einem Gerätewechsel. Beim Import bleiben neuere Einträge auf diesem Gerät erhalten.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportJson}>
            <Download size={16} /> Als JSON exportieren
          </Button>
          <label className={clsx('inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-slate-800 shadow-[var(--shadow-card)] ring-1 ring-slate-200 hover:bg-slate-50', importing && 'pointer-events-none opacity-50')}>
            <Upload size={16} /> {importing ? 'Importiere …' : 'JSON importieren'}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                void importJson(f)
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-400">Fotos und Sprachmemos sind im JSON nicht enthalten (liegen auf dem Gerät bzw. im Cloud-Speicher).</p>
      </Card>
    </>
  )
}
