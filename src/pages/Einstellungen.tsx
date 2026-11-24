import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookOpenCheck,
  Check,
  Cloud,
  Database,
  Download,
  Eraser,
  KeyRound,
  LayoutGrid,
  LogOut,
  Minus,
  Monitor,
  Moon,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  School,
  Shuffle,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '../components/toast'
import { Avatar, Badge, Button, Card, Empty, Field, inputCls, PageHeader, Segmented, Sheet } from '../components/ui'
import {
  alive,
  db,
  getMeta,
  now,
  remove,
  removeClass,
  removeStudent,
  save,
  SYNCED_TABLES,
  uid,
  type Attachment,
  type GradeLevel,
  type ObsKind,
  type SchoolClass,
  type SeatingPlan,
  type Student,
  type Valence,
} from '../lib/db'
import { setActiveClassId, useActiveClass, useClasses, useStudents } from '../lib/hooks'
import { bandFor, KIND_LABEL, SUBJECTS_BY_GRADE } from '../lib/seed'
import { supabase, sync } from '../lib/sync'
import { setTheme, useTheme, type ThemePref } from '../lib/theme'

type Tab = 'klasse' | 'kinder' | 'sitzplan' | 'vorlagen' | 'kompetenzen' | 'darstellung' | 'konto'

const TABS: { value: Tab; label: string; icon: LucideIcon; hint: string }[] = [
  { value: 'klasse', label: 'Klassen', icon: School, hint: 'Klassen anlegen und wechseln' },
  { value: 'kinder', label: 'Kinder', icon: Users, hint: 'Namensliste der aktiven Klasse' },
  { value: 'sitzplan', label: 'Sitzplan', icon: LayoutGrid, hint: 'Plätze im Klassenzimmer' },
  { value: 'vorlagen', label: 'Schnell-Einträge', icon: Zap, hint: 'Beobachtungen mit einem Tipp' },
  { value: 'kompetenzen', label: 'Kompetenzen', icon: BookOpenCheck, hint: 'Kompetenzraster LehrplanPLUS' },
  { value: 'darstellung', label: 'Darstellung', icon: Palette, hint: 'Hell, dunkel oder automatisch' },
  { value: 'konto', label: 'Konto & Sync', icon: Cloud, hint: 'Anmeldung, Sync und Backup' },
]

const TAB_KEY = 'settingsTab'
function readTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY) as Tab | null
    return t && TABS.some((x) => x.value === t) ? t : 'klasse'
  } catch {
    return 'klasse'
  }
}

export default function Einstellungen() {
  const [tab, setTabState] = useState<Tab>(readTab)
  const setTab = (t: Tab) => {
    setTabState(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* ignorieren */
    }
  }
  const current = TABS.find((t) => t.value === tab)!
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Einstellungen" subtitle="Klassen, Kinder, Vorlagen und Konto verwalten." />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Schmale Bildschirme: horizontal scrollbare Leiste */}
        <nav className="-mx-4 overflow-x-auto px-4 lg:hidden" aria-label="Bereiche">
          <div className="flex w-max gap-2">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
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
          {tab === 'klasse' && <Klassen />}
          {tab === 'kinder' && <KinderVerwalten />}
          {tab === 'sitzplan' && <Sitzplan />}
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

/* ───────────────────────── Klassen ───────────────────────── */

function Klassen() {
  const classes = useClasses()
  const { cls: active } = useActiveClass()
  const [edit, setEdit] = useState<SchoolClass | null>(null)
  const blank = (): SchoolClass => ({ id: uid(), name: '', gradeLevel: 1, schoolYear: currentSchoolYear(), subjects: SUBJECTS_BY_GRADE[1], updatedAt: now() })
  const list = classes ?? []
  const isExisting = !!edit && list.some((c) => c.id === edit.id)

  const saveEdit = async () => {
    if (!edit) return
    await save(db.classes, { ...edit, name: edit.name.trim() })
    // Neue Klasse immer aktiv machen (auch wenn die gespeicherte aktive ID veraltet ist)
    if (!isExisting) setActiveClassId(edit.id)
    setEdit(null)
    toast(isExisting ? 'Klasse gespeichert' : `Klasse ${edit.name.trim()} angelegt und aktiviert`)
  }
  const deleteEdit = async () => {
    if (!edit) return
    if (!confirm(`Klasse ${edit.name} wirklich löschen?\n\nAlle Kinder, Beobachtungen, Stunden und Gespräche dieser Klasse werden ebenfalls gelöscht.`)) return
    await removeClass(edit.id)
    setEdit(null)
    toast(`Klasse ${edit.name} gelöscht`)
  }

  return (
    <>
      <Card
        title="Meine Klassen"
        icon={School}
        action={
          <Button size="sm" onClick={() => setEdit(blank())}>
            <Plus size={16} /> Neue Klasse
          </Button>
        }
        padded={false}
      >
        {classes && !list.length ? (
          <div className="px-5 pb-5">
            <Empty icon={School}>Noch keine Klasse. Leg deine erste Klasse an – danach kannst du Kinder hinzufügen.</Empty>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {list.map((c) => {
              const isActive = active?.id === c.id
              return (
                <li key={c.id} className={clsx('flex items-center gap-3 px-5 py-3', isActive && 'bg-brand-50/40')}>
                  <span className={clsx('flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold tabular-nums', isActive ? 'bg-brand-600 !text-[#fff]' : 'bg-slate-100 text-slate-600')}>
                    {c.gradeLevel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium text-slate-900">
                      {c.name}
                      {isActive && (
                        <Badge tone="brand">
                          <Check size={12} /> aktiv
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      Jgst. {c.gradeLevel} · {c.schoolYear} · {c.subjects.length} Fächer
                    </p>
                  </div>
                  {!isActive && (
                    <Button size="sm" variant="soft" onClick={() => setActiveClassId(c.id)}>
                      Aktivieren
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEdit(c)} aria-label={`${c.name} bearbeiten`}>
                    <Pencil size={16} />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={isExisting ? `Klasse ${edit?.name}` : 'Neue Klasse'}>
        {edit && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} placeholder="z. B. 2b" autoFocus />
              </Field>
              <Field label="Schuljahr">
                <input value={edit.schoolYear} onChange={(e) => setEdit({ ...edit, schoolYear: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-slate-600">Jahrgangsstufe</span>
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
              <span className="mb-1.5 block text-[13px] font-medium text-slate-600">Fächer, die ich in dieser Klasse unterrichte</span>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS_BY_GRADE[edit.gradeLevel].map((s) => {
                  const on = edit.subjects.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEdit({ ...edit, subjects: on ? edit.subjects.filter((x) => x !== s) : [...edit.subjects, s] })}
                      className={clsx('inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ring-1 transition', on ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50')}
                    >
                      {on && <Check size={14} />}
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              {isExisting && (
                <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={deleteEdit}>
                  <Trash2 size={16} /> Löschen
                </Button>
              )}
              <span className="flex-1" />
              <Button variant="ghost" onClick={() => setEdit(null)}>
                Abbrechen
              </Button>
              <Button disabled={!edit.name.trim()} onClick={saveEdit}>
                {isExisting ? 'Speichern' : 'Anlegen'}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
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

function KinderVerwalten() {
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const [bulk, setBulk] = useState('')
  const parsed = useMemo(() => parseBulk(bulk, students), [bulk, students])
  if (!cls) return <Empty icon={Users}>Zuerst unter „Klassen" eine Klasse anlegen.</Empty>
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

  if (!cls) return <Empty icon={LayoutGrid}>Zuerst unter „Klassen" eine Klasse anlegen.</Empty>
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

/* ───────────────────────── Kompetenzen ───────────────────────── */

type Band = '1/2' | '3/4'

function Kompetenzen() {
  const { cls } = useActiveClass()
  // Auswahl gilt nur für die Klasse, in der sie getroffen wurde – sonst folgt das Band der aktiven Klasse.
  const [override, setOverride] = useState<{ classId?: string; band: Band } | null>(null)
  const band: Band = override && override.classId === cls?.id ? override.band : cls ? bandFor(cls.gradeLevel) : '1/2'
  const [subject, setSubject] = useState('Mathematik')
  const comps = useLiveQuery(async () => alive(await db.competencies.where('band').equals(band).toArray()), [band]) ?? []
  const [area, setArea] = useState('')
  const [text, setText] = useState('')
  const shown = comps.filter((c) => c.subject === subject)
  const areas = [...new Set(shown.map((c) => c.area))]
  return (
    <>
      <Card title="Kompetenzraster" icon={BookOpenCheck}>
        <p className="-mt-2 mb-4 text-sm text-slate-500">Vorbelegt nach LehrplanPLUS Bayern. Du kannst eigene Kompetenzerwartungen ergänzen oder entfernen.</p>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Segmented
            value={band}
            onChange={(b: Band) => setOverride({ classId: cls?.id, band: b })}
            options={[
              { value: '1/2', label: 'Jgst. 1/2' },
              { value: '3/4', label: 'Jgst. 3/4' },
            ]}
          />
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={clsx(inputCls, 'w-auto py-2 text-sm')}>
            {SUBJECTS_BY_GRADE[4].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400 tabular-nums">{shown.length} Einträge</span>
        </div>
        <div className="space-y-4">
          {areas.map((a) => (
            <div key={a}>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{a}</p>
              <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200/80">
                {shown
                  .filter((c) => c.area === a)
                  .map((c) => (
                    <li key={c.id} className="flex items-center gap-2 py-1 pr-1 pl-3 text-sm">
                      <span className="flex-1 py-1.5 text-slate-700">{c.text}</span>
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
                    </li>
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
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
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
                onClick={async () => {
                  await supabase.auth.signOut()
                  toast('Abgemeldet – deine Daten bleiben auf diesem Gerät.')
                }}
              >
                <LogOut size={16} /> Abmelden
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
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Die App funktioniert komplett offline. Mit einem Konto werden deine Daten zusätzlich gesichert und zwischen iPad und Laptop abgeglichen.
            </p>
            <div className="rounded-xl bg-slate-50 p-3 text-[13px] text-slate-600 ring-1 ring-slate-100">
              <p className="mb-1 flex items-center gap-2 font-medium text-slate-800">
                <KeyRound size={15} /> So funktioniert die Anmeldung
              </p>
              <ol className="list-decimal space-y-0.5 pl-5">
                <li>
                  Beim ersten Mal: E-Mail und ein selbst gewähltes Passwort (mind. 6 Zeichen) eingeben, dann <b className="font-medium">Konto anlegen</b>.
                </li>
                <li>Den Link in der Bestätigungs-Mail öffnen.</li>
                <li>
                  Danach auf jedem Gerät mit denselben Daten <b className="font-medium">Anmelden</b>.
                </li>
              </ol>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-Mail">
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@schule.de" className={inputCls} />
              </Field>
              <Field label="Passwort" hint="Mindestens 6 Zeichen">
                <input type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="••••••" className={inputCls} />
              </Field>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                disabled={!email || code.length < 6 || busy}
                onClick={async () => {
                  setBusy(true)
                  const { data, error } = await supabase.auth.signUp({ email, password: code, options: { emailRedirectTo: location.origin } })
                  setBusy(false)
                  if (error) toast(error.message)
                  else if (!data.session) setSent(true)
                  else toast('Konto angelegt')
                }}
              >
                Konto anlegen
              </Button>
              <Button
                disabled={!email || code.length < 6 || busy}
                onClick={async () => {
                  setBusy(true)
                  const { error } = await supabase.auth.signInWithPassword({ email, password: code })
                  setBusy(false)
                  toast(error ? `Anmeldung fehlgeschlagen: ${error.message}` : 'Angemeldet')
                }}
              >
                Anmelden
              </Button>
            </div>
            {sent && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Bestätigungs-Mail verschickt. Link in der Mail öffnen, danach hier anmelden.</p>}
          </div>
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
