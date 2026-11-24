import clsx from 'clsx'
import { differenceInMinutes, format, getISOWeek, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { de } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookOpen,
  Check,
  ChevronLeft,
  Clock,
  Eye,
  EyeOff,
  Grid3x3,
  ImageIcon,
  LayoutGrid,
  ListChecks,
  MessageSquareText,
  Pencil,
  Play,
  SearchX,
  Square,
  Target,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AiButton, DictationSheet } from '../components/AiSheets'
import { RATING_DOT, RATING_LABEL, ReflectionSheet, StartLessonSheet, subjectDot } from '../components/LessonSheets'
import { QuickCapture, quickSave, type CaptureContext } from '../components/QuickCapture'
import { AttachmentView } from '../components/media'
import { toast } from '../components/toast'
import { Avatar, Badge, Button, Card, Empty, PageHeader, Segmented, ValenceDot } from '../components/ui'
import { alive, aliveOne, db, remove, save, type Competency, type Lesson, type Observation, type SchoolClass, type Student } from '../lib/db'
import { useActiveClass, useCompetencies, useObservations, useStudents } from '../lib/hooks'
import { latestLevels } from '../lib/insights'
import { KIND_LABEL, LEVEL_LABEL } from '../lib/seed'

export default function Unterricht() {
  const { id } = useParams()
  return id ? <LessonView key={id} id={id} /> : <LessonList />
}

const backLink = (
  <Link to="/unterricht" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
    <ChevronLeft size={16} /> Unterrichtstagebuch
  </Link>
)

/* ───────────────────────── Liste ───────────────────────── */

function weekLabel(weekStart: Date) {
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
  if (+weekStart === +thisWeek) return 'Diese Woche'
  if (+weekStart === +subWeeks(thisWeek, 1)) return 'Letzte Woche'
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 4)
  return `KW ${getISOWeek(weekStart)} · ${format(weekStart, 'd.M.')}–${format(end, 'd.M.yyyy')}`
}

function LessonList() {
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const comps = useCompetencies(cls)
  const obs = useObservations(cls?.id)
  const [starting, setStarting] = useState(false)
  const [subject, setSubject] = useState('alle')
  const lessons = useLiveQuery(async () => (cls ? alive(await db.lessons.where('classId').equals(cls.id).toArray()).sort((a, b) => b.startedAt.localeCompare(a.startedAt)) : []), [cls?.id]) ?? []

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of obs) if (o.lessonId) m.set(o.lessonId, (m.get(o.lessonId) ?? 0) + 1)
    return m
  }, [obs])

  if (!cls) return null
  const subjects = [...new Set(lessons.map((l) => l.subject))]
  const shown = lessons.filter((l) => subject === 'alle' || l.subject === subject)

  const groups: { key: string; label: string; items: Lesson[] }[] = []
  for (const l of shown) {
    const ws = startOfWeek(parseISO(l.date), { weekStartsOn: 1 })
    const key = format(ws, 'yyyy-MM-dd')
    let g = groups.find((x) => x.key === key)
    if (!g) groups.push((g = { key, label: weekLabel(ws), items: [] }))
    g.items.push(l)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow={`Klasse ${cls.name}`}
        title="Unterrichtstagebuch"
        subtitle={lessons.length ? `${lessons.length} Stunde${lessons.length === 1 ? '' : 'n'} dokumentiert` : undefined}
        actions={
          <Button size="lg" onClick={() => setStarting(true)}>
            <Play size={18} /> Stunde starten
          </Button>
        }
      />
      {subjects.length > 1 && <Segmented value={subject} onChange={setSubject} options={[{ value: 'alle', label: 'Alle' }, ...subjects.map((s) => ({ value: s, label: s }))]} />}

      {groups.map((g) => (
        <section key={g.key}>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{g.label}</h2>
            <span className="text-xs text-slate-400 tabular-nums">{g.items.length}</span>
          </div>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-slate-200/80">
            {g.items.map((l) => {
              const live = l.status === 'laufend'
              const r = l.reflection
              const line = r?.note || r?.whatWasDone || l.focus
              const n = counts.get(l.id) ?? 0
              return (
                <li key={l.id}>
                  <Link to={`/unterricht/${l.id}`} className="flex min-h-16 items-center gap-4 px-4 py-3 transition hover:bg-slate-50">
                    <div className="w-11 shrink-0 text-center leading-tight">
                      <p className="text-[11px] font-medium text-slate-400 uppercase">{format(parseISO(l.startedAt), 'EE', { locale: de })}</p>
                      <p className="text-lg font-semibold tracking-tight text-slate-800 tabular-nums">{format(parseISO(l.startedAt), 'd.')}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className={clsx('size-2 shrink-0 rounded-full', subjectDot(l.subject))} />
                        <span className="shrink-0 font-medium text-slate-900">{l.subject}</span>
                        {l.topic && <span className="truncate text-slate-500">· {l.topic}</span>}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-slate-500">{line || <span className="text-slate-400">{live ? 'läuft gerade' : 'ohne Reflexion'}</span>}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {n > 0 && (
                        <span className="hidden items-center gap-1 text-xs text-slate-400 tabular-nums sm:inline-flex">
                          <MessageSquareText size={13} /> {n}
                        </span>
                      )}
                      {live ? (
                        <Badge tone="brand">läuft</Badge>
                      ) : r?.rating ? (
                        <span className={clsx('size-2.5 rounded-full', RATING_DOT[r.rating])} title={RATING_LABEL[r.rating]} aria-label={RATING_LABEL[r.rating]} />
                      ) : (
                        <Badge tone="amber">Doku offen</Badge>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {!shown.length && (
        <Card>
          <Empty icon={BookOpen}>Noch keine Stunden dokumentiert. Starte eine Stunde – Beobachtungen und Reflexion landen dann hier.</Empty>
        </Card>
      )}
      <StartLessonSheet open={starting} onClose={() => setStarting(false)} cls={cls} competencies={comps} students={students} />
    </div>
  )
}

/* ───────────────────────── Einzelne Stunde ───────────────────────── */

function useElapsed(start: string) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])
  return Math.max(0, Math.round((Date.now() - parseISO(start).getTime()) / 60000))
}

function LessonView({ id }: { id: string }) {
  // undefined = lädt, null = nicht vorhanden/gelöscht
  const data = useLiveQuery(async () => {
    const lesson = aliveOne(await db.lessons.get(id))
    if (!lesson) return null
    return { lesson, cls: aliveOne(await db.classes.get(lesson.classId)) ?? null }
  }, [id])
  const lesson = data?.lesson
  const cls = data?.cls ?? undefined
  const students = useStudents(lesson?.classId)
  const obs = useObservations(lesson?.classId)
  const comps = useCompetencies(cls)

  if (data === undefined) return null
  if (!data || !lesson || !cls)
    return (
      <div className="mx-auto max-w-xl px-4 py-10 md:px-8">
        <Card>
          <Empty icon={SearchX}>Stunde nicht gefunden. Vielleicht wurde sie gelöscht oder gehört zu einer entfernten Klasse.</Empty>
          <div className="flex justify-center">{backLink}</div>
        </Card>
      </div>
    )
  return lesson.status === 'laufend' ? (
    <LiveMode lesson={lesson} cls={cls} students={students} obs={obs} comps={comps} />
  ) : (
    <LessonDetail lesson={lesson} students={students} obs={obs} comps={comps} />
  )
}

/* ───────────────────────── Live-Modus ───────────────────────── */

function LiveMode({ lesson, cls, students, obs, comps }: { lesson: Lesson; cls: SchoolClass; students: Student[]; obs: Observation[]; comps: Competency[] }) {
  const plan = useLiveQuery(async () => alive(await db.seatingPlans.where('classId').equals(lesson.classId).toArray())[0], [lesson.classId])
  const [view, setView] = useState<'sitzplan' | 'raster'>('sitzplan')
  const [discreet, setDiscreet] = useState(false)
  const [multi, setMulti] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [capture, setCapture] = useState<CaptureContext | null>(null)
  const [ending, setEnding] = useState(false)
  const [dictating, setDictating] = useState(false)
  const elapsed = useElapsed(lesson.startedAt)

  const inLesson = useMemo(() => obs.filter((o) => o.lessonId === lesson.id), [obs, lesson.id])
  const focusComps = comps.filter((c) => lesson.focusCompetencyIds.includes(c.id))
  const hasFocus = lesson.focusStudentIds.length > 0
  const isFocus = (s: Student) => !hasFocus || lesson.focusStudentIds.includes(s.id)
  const visible = hasFocus ? students.filter(isFocus) : students
  const ordered = hasFocus ? [...students].sort((a, b) => Number(isFocus(b)) - Number(isFocus(a))) : students
  const seenKids = new Set(inLesson.flatMap((o) => o.studentIds))

  // Sitzplan: nur gültige Plätze innerhalb Reihen × Spalten, jedes Kind höchstens einmal
  const layout = useMemo(() => {
    if (!plan || !plan.seats.length) return null
    const byId = new Map(students.map((s) => [s.id, s]))
    const cells = new Map<string, Student>()
    const placed = new Set<string>()
    for (const seat of plan.seats) {
      if (seat.x < 0 || seat.y < 0 || seat.x >= plan.cols || seat.y >= plan.rows) continue
      const s = byId.get(seat.studentId)
      const key = `${seat.x}:${seat.y}`
      if (!s || placed.has(s.id) || cells.has(key)) continue
      cells.set(key, s)
      placed.add(s.id)
    }
    return { cells, unplaced: students.filter((s) => !placed.has(s.id)) }
  }, [plan, students])

  const ctx = (studentIds: string[]): CaptureContext => ({
    classId: lesson.classId,
    gradeLevel: cls.gradeLevel,
    students,
    competencies: comps,
    studentIds,
    lessonId: lesson.id,
    subject: lesson.subject,
    focusCompetencyIds: lesson.focusCompetencyIds,
  })

  const tap = (s: Student) => {
    if (multi) setSelected((ids) => (ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id]))
    else setCapture(ctx([s.id]))
  }

  const tile = (s: Student, compact = false) => {
    const mine = inLesson.filter((o) => o.studentIds.includes(s.id))
    const sel = selected.includes(s.id)
    const dim = !isFocus(s) && !sel
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => tap(s)}
        aria-pressed={multi ? sel : undefined}
        aria-label={`${s.firstName}${mine.length ? `, ${mine.length} Einträge` : ''}`}
        className={clsx(
          'relative flex h-full w-full flex-col items-center justify-center rounded-2xl shadow-[var(--shadow-card)] ring-1 transition duration-150 select-none active:scale-[0.96]',
          sel ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-slate-200/80 hover:ring-slate-300',
          compact ? 'min-h-[104px] gap-1 p-1.5' : 'min-h-[120px] gap-1.5 p-2',
          dim && 'opacity-45',
        )}
      >
        {sel && (
          <span className="absolute top-2 left-2 flex size-6 items-center justify-center rounded-full bg-brand-600 !text-[#fff] shadow-sm">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        {mine.length > 0 && (
          <span className="blur-sensitive absolute top-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-600 tabular-nums">{mine.length}</span>
        )}
        <Avatar student={s} size={compact ? 40 : 52} />
        <span className={clsx('max-w-full truncate font-medium text-slate-900', compact ? 'text-[13px]' : 'text-[15px]')}>{s.firstName}</span>
        <span className="flex h-2 items-center gap-1">
          {!discreet && mine.slice(0, compact ? 4 : 6).map((o) => <ValenceDot key={o.id} v={o.valence} />)}
        </span>
      </button>
    )
  }

  const tileGrid = (list: Student[]) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3" style={{ gridAutoRows: 'minmax(128px, auto)' }}>
      {list.map((s) => tile(s))}
    </div>
  )

  const toolBtn = 'h-10 min-w-10'

  return (
    <div className={clsx('flex h-full min-h-0 flex-col', discreet && 'discreet')}>
      {/* Toolbar */}
      <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="flex flex-col gap-2 px-3 py-2.5 md:px-5 xl:flex-row xl:items-center xl:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link to="/unterricht" aria-label="Zurück zum Unterrichtstagebuch" className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <ChevronLeft size={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-2 leading-tight">
              <span className={clsx('size-2.5 shrink-0 rounded-full', subjectDot(lesson.subject))} />
              <span className="min-w-0 truncate">
                <span className="font-semibold tracking-tight text-slate-900">{lesson.subject}</span>
                {lesson.topic && <span className="text-slate-500"> · {lesson.topic}</span>}
              </span>
            </p>
            <p className="blur-sensitive mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700 tabular-nums">
                <Clock size={12} /> {elapsed} min
              </span>
              <span className="shrink-0 tabular-nums">
                {inLesson.length} Einträge · {seenKids.size}/{visible.length} Kinder
              </span>
              {lesson.focus && (
                <span className="hidden min-w-0 items-center gap-1 truncate md:inline-flex">
                  <Target size={12} className="shrink-0" /> {lesson.focus}
                </span>
              )}
            </p>
          </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                {
                  value: 'sitzplan',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <LayoutGrid size={16} />
                      Sitzplan
                    </span>
                  ),
                },
                {
                  value: 'raster',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Grid3x3 size={16} />
                      Raster
                    </span>
                  ),
                },
              ]}
            />
            <Button variant={multi ? 'soft' : 'secondary'} className={toolBtn} aria-pressed={multi} onClick={() => (setMulti((m) => !m), setSelected([]))}>
              <Users size={16} /> Mehrere
            </Button>
            <Button variant={discreet ? 'soft' : 'secondary'} className={toolBtn + ' px-0'} onClick={() => setDiscreet((d) => !d)} aria-label="Diskreter Modus" aria-pressed={discreet} title="Diskreter Modus">
              {discreet ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
            <AiButton size="md" onClick={() => setDictating(true)}>
              Diktat
            </AiButton>
            <Button variant="danger" className={toolBtn} onClick={() => setEnding(true)}>
              <Square size={14} fill="currentColor" /> Beenden
            </Button>
          </div>
        </div>

        {multi && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-brand-50/50 px-3 py-2 md:px-5">
            <p className="mr-auto text-sm text-slate-600">{selected.length ? <b className="text-slate-900">{selected.length} ausgewählt</b> : 'Kinder antippen, um sie auszuwählen'}</p>
            <Button variant="ghost" size="sm" onClick={() => setSelected(visible.map((s) => s.id))}>
              Alle
            </Button>
            {selected.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                <X size={14} /> Leeren
              </Button>
            )}
            <Button size="md" disabled={!selected.length} onClick={() => setCapture(ctx(selected))}>
              <Pencil size={16} /> Beobachtung für {selected.length || '…'} {selected.length === 1 ? 'Kind' : 'Kinder'}
            </Button>
          </div>
        )}
      </div>

      {/* Inhalt */}
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3 md:p-5">
        {!students.length ? (
          <Card>
            <Empty icon={Users}>
              Diese Klasse hat noch keine Kinder. Unter{' '}
              <Link to="/einstellungen" className="font-medium text-brand-700 underline">
                Einstellungen
              </Link>{' '}
              anlegen.
            </Empty>
          </Card>
        ) : view === 'sitzplan' ? (
          layout && plan ? (
            <div className="space-y-6">
              <div className="relative">
                <div className="overflow-x-auto pb-1">
                  <div className="mb-2 flex justify-center">
                    <span className="rounded-full bg-slate-100 px-4 py-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Tafel</span>
                  </div>
                  <div className="grid gap-2 md:gap-3" style={{ gridTemplateColumns: `repeat(${plan.cols}, minmax(64px, 1fr))`, gridAutoRows: 'minmax(104px, auto)', minWidth: plan.cols * 72 }}>
                    {Array.from({ length: plan.rows * plan.cols }, (_, i) => {
                      const s = layout.cells.get(`${i % plan.cols}:${Math.floor(i / plan.cols)}`)
                      return s ? <div key={i}>{tile(s, true)}</div> : <div key={i} className="rounded-2xl bg-slate-100/50 ring-1 ring-slate-200/50 ring-dashed" aria-hidden />
                    })}
                  </div>
                </div>
                {plan.cols > 4 && (
                  <>
                    <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--app-bg,#f4f6f8)] to-transparent sm:hidden" />
                    <p className="mt-1 text-center text-xs text-slate-400 sm:hidden">← Seitlich wischen für den ganzen Raum →</p>
                  </>
                )}
              </div>
              {layout.unplaced.length > 0 && (
                <section>
                  <p className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Nicht im Sitzplan · {layout.unplaced.length}</p>
                  {tileGrid(layout.unplaced)}
                </section>
              )}
            </div>
          ) : (
            <>
              {tileGrid(ordered)}
              <p className="mt-6 text-center text-sm text-slate-400">
                Tipp: Unter{' '}
                <Link to="/einstellungen" className="underline hover:text-slate-600">
                  Einstellungen → Sitzplan
                </Link>{' '}
                lässt sich der Raum abbilden.
              </p>
            </>
          )
        ) : (
          <CriteriaGrid lesson={lesson} students={visible} focusComps={focusComps} obs={obs} discreet={discreet} onCell={(s) => setCapture(ctx([s.id]))} />
        )}
      </div>

      <QuickCapture
        ctx={capture}
        onClose={() => {
          setCapture(null)
          setSelected([])
          setMulti(false)
        }}
      />
      <ReflectionSheet lesson={lesson} open={ending} onClose={() => setEnding(false)} students={students} observations={obs} />
      {dictating && <DictationSheet open onClose={() => setDictating(false)} cls={cls} students={students} comps={comps} lessonId={lesson.id} subject={lesson.subject} />}
    </div>
  )
}

const LEVEL_CHIP = [
  'bg-slate-50 text-slate-400 ring-slate-200/70',
  'bg-rose-100 text-rose-800 ring-rose-200',
  'bg-amber-100 text-amber-800 ring-amber-200',
  'bg-lime-100 text-lime-800 ring-lime-200',
  'bg-emerald-100 text-emerald-800 ring-emerald-200',
]

/** Systematische Beobachtung: Kind × Kriterium, ein Tipp = Stufe weiterschalten. */
function CriteriaGrid({ lesson, students, focusComps, obs, discreet, onCell }: { lesson: Lesson; students: Student[]; focusComps: Competency[]; obs: Observation[]; discreet: boolean; onCell: (s: Student) => void }) {
  const latest = latestLevels(obs.filter((o) => o.lessonId === lesson.id))
  const before = latestLevels(obs.filter((o) => o.lessonId !== lesson.id))
  if (!focusComps.length)
    return (
      <Card>
        <Empty icon={ListChecks}>Für das Raster beim Stundenstart Kompetenzen als Schwerpunkt wählen. Ein Name öffnet die freie Erfassung.</Empty>
        <div className="flex flex-wrap justify-center gap-2">
          {students.map((s) => (
            <button key={s.id} type="button" onClick={() => onCell(s)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white py-1 pr-3.5 pl-1 text-sm font-medium ring-1 ring-slate-200 hover:bg-slate-50">
              <Avatar student={s} size={30} /> {s.firstName}
            </button>
          ))}
        </div>
      </Card>
    )
  /** Ein Eintrag je Kind × Kompetenz × Stunde: weiterschalten statt neu anlegen, nach „sicher“ leeren. */
  const set = async (s: Student, compId: string) => {
    const c = focusComps.find((x) => x.id === compId)!
    const existing = obs.find((o) => o.lessonId === lesson.id && o.competencyId === compId && o.kind === 'lernstand' && o.studentIds.length === 1 && o.studentIds[0] === s.id && !o.text)
    const cur = existing?.level ?? 0
    try {
      if (existing && cur >= 4) {
        await remove(db.observations, existing.id)
        toast(discreet ? 'Gespeichert' : `${s.firstName}: zurückgesetzt`)
        return
      }
      const level = (cur + 1) as 1 | 2 | 3 | 4
      const valence = level >= 3 ? 'pos' : level === 1 ? 'neg' : 'neu'
      if (existing) await save(db.observations, { ...existing, level, valence })
      else await quickSave({ classId: lesson.classId, studentIds: [s.id], lessonId: lesson.id, kind: 'lernstand', valence, subject: c.subject, competencyId: compId, level, text: '' })
      toast(discreet ? 'Gespeichert' : `${s.firstName}: ${LEVEL_LABEL[level]}`)
    } catch {
      toast('Speichern fehlgeschlagen')
    }
  }
  return (
    <div className="space-y-3">
      <div className={clsx('flex flex-wrap items-center gap-2 px-1 text-xs text-slate-500', discreet && 'invisible')}>
        <span className="mr-1">Antippen schaltet weiter (nach „sicher“ wieder leer):</span>
        {[1, 2, 3, 4].map((l) => (
          <span key={l} className={clsx('rounded-md px-2 py-1 font-semibold ring-1', LEVEL_CHIP[l])}>
            {LEVEL_LABEL[l]}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-slate-200/80">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-3 text-left text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Kind</th>
              {focusComps.map((c) => (
                <th key={c.id} className="min-w-40 border-b border-slate-100 px-2 py-3 text-left align-bottom text-xs leading-snug font-medium text-slate-600">
                  {c.text}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-2 py-1.5 shadow-[1px_0_0_var(--color-slate-100)]">
                  <button type="button" onClick={() => onCell(s)} className="flex min-h-11 items-center gap-2 rounded-lg pr-2 font-medium text-slate-900 hover:bg-slate-50">
                    <Avatar student={s} size={30} />
                    <span className="max-w-28 truncate">{s.firstName}</span>
                  </button>
                </td>
                {focusComps.map((c) => {
                  const cur = latest.get(`${s.id}:${c.id}`)?.level
                  const prev = before.get(`${s.id}:${c.id}`)?.level
                  return (
                    <td key={c.id} className="border-b border-slate-100 p-1.5">
                      <button
                        type="button"
                        onClick={() => set(s, c.id)}
                        aria-label={`${s.firstName}, ${c.text}: ${cur ? (discreet ? 'erfasst' : LEVEL_LABEL[cur]) : 'noch nicht eingeschätzt'}`}
                        className={clsx('h-12 w-full rounded-xl text-xs font-semibold ring-1 transition active:scale-[0.97]', discreet ? (cur ? 'bg-slate-100 text-slate-500 ring-slate-200' : LEVEL_CHIP[0]) : LEVEL_CHIP[cur ?? 0])}
                      >
                        {discreet ? (cur ? '●' : '–') : cur ? LEVEL_LABEL[cur] : prev ? <span className="font-normal text-slate-400">zuvor: {LEVEL_LABEL[prev]}</span> : '–'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ───────────────────────── Detail (abgeschlossen) ───────────────────────── */

const GOAL_LABEL = { ja: 'erreicht', teilweise: 'teilweise', nein: 'nicht erreicht' } as const

function LessonDetail({ lesson, students, obs, comps }: { lesson: Lesson; students: Student[]; obs: Observation[]; comps: Competency[] }) {
  const [editing, setEditing] = useState(false)
  const inLesson = obs.filter((o) => o.lessonId === lesson.id)
  const byId = new Map(students.map((s) => [s.id, s]))
  const name = (id: string) => byId.get(id)?.firstName ?? '?'
  const r = lesson.reflection
  const start = parseISO(lesson.startedAt)
  const end = lesson.endedAt ? parseISO(lesson.endedAt) : undefined
  const minutes = end ? Math.max(0, differenceInMinutes(end, start)) : undefined
  const kids = new Set(inLesson.flatMap((o) => o.studentIds)).size
  const focusComps = comps.filter((c) => lesson.focusCompetencyIds.includes(c.id))
  const focusKids = lesson.focusStudentIds.map((id) => byId.get(id)).filter((s): s is Student => !!s)
  const hasFocusInfo = !!lesson.focus || focusComps.length > 0 || focusKids.length > 0
  const hasNotes = !!(r?.whatWasDone || r?.note || r?.nextTime)

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        back={backLink}
        eyebrow={`${format(start, 'EEEE, d. MMMM yyyy', { locale: de })} · ${format(start, 'HH:mm')}${end ? `–${format(end, 'HH:mm')}` : ''} Uhr`}
        title={
          <span className="flex items-center gap-2.5">
            <span className={clsx('size-3 shrink-0 rounded-full', subjectDot(lesson.subject))} />
            {lesson.subject}
          </span>
        }
        subtitle={lesson.topic || undefined}
        actions={
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={16} /> Abschluss bearbeiten
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Verlauf" className="col-span-2 sm:col-span-2">
          {r?.rating || r?.goalReached ? (
            <span className="inline-flex flex-wrap items-center gap-x-2">
              {r?.rating && <span className={clsx('size-3 rounded-full', RATING_DOT[r.rating])} />}
              {[r?.rating && RATING_LABEL[r.rating], r?.goalReached && `Ziel ${GOAL_LABEL[r.goalReached]}`].filter(Boolean).join(' · ')}
            </span>
          ) : (
            <span className="font-normal text-slate-400">noch nicht bewertet</span>
          )}
        </SummaryTile>
        <SummaryTile label="Dauer">{minutes !== undefined ? <span className="tabular-nums">{minutes} min</span> : <span className="font-normal text-slate-400">–</span>}</SummaryTile>
        <SummaryTile label="Einträge">
          <span className="tabular-nums">
            {inLesson.length}
            <span className="ml-1.5 text-sm font-normal text-slate-400">· {kids} Kinder</span>
          </span>
        </SummaryTile>
      </div>

      <div className={clsx('grid gap-5', hasFocusInfo && 'md:grid-cols-5')}>
        <Card title="Reflexion" icon={BookOpen} className={hasFocusInfo ? 'md:col-span-3' : undefined}>
          {hasNotes ? (
            <dl className="space-y-4 text-sm">
              <DetailRow label="Was wurde gemacht?">{r?.whatWasDone}</DetailRow>
              <DetailRow label="Was würde ich anders machen?">{r?.note}</DetailRow>
              <DetailRow label="Für nächstes Mal">{r?.nextTime}</DetailRow>
            </dl>
          ) : (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {r ? 'Keine Notizen zur Stunde.' : 'Noch kein Abschluss erfasst.'}{' '}
              <button type="button" className="font-semibold underline" onClick={() => setEditing(true)}>
                {r ? 'Ergänzen' : 'Jetzt nachtragen'}
              </button>
            </div>
          )}
        </Card>
        {hasFocusInfo && (
          <Card title="Schwerpunkt" icon={Target} className="md:col-span-2">
            <div className="space-y-3 text-sm">
              {lesson.focus && <p className="text-slate-700">{lesson.focus}</p>}
              {focusComps.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {focusComps.map((c) => (
                    <Badge key={c.id} tone="brand" className="font-medium">
                      {c.text}
                    </Badge>
                  ))}
                </div>
              )}
              {focusKids.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {focusKids.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 py-0.5 pr-2.5 pl-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                      <Avatar student={s} size={20} /> {s.firstName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {!!lesson.attachments?.length && (
        <Card title="Tafelbild" icon={ImageIcon}>
          <div className="flex flex-wrap gap-3">
            {lesson.attachments.map((a) => (
              <AttachmentView key={a.id} a={a} owner={{ table: 'lessons', id: lesson.id }} className="h-40 cursor-zoom-in rounded-xl object-cover ring-1 ring-slate-200" />
            ))}
          </div>
        </Card>
      )}

      <Card title="Beobachtungen" icon={MessageSquareText} action={<Badge>{inLesson.length}</Badge>} padded={false}>
        <ul className="divide-y divide-slate-100 px-5 pb-3">
          {inLesson.map((o) => {
            const first = byId.get(o.studentIds[0])
            return (
              <li key={o.id} className="flex items-start gap-3 py-3 text-sm">
                {first ? <Avatar student={first} size={30} /> : <span className="size-[30px]" />}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{o.studentIds.map(name).join(', ')}</span>
                    <ValenceDot v={o.valence} />
                    <span className="text-xs text-slate-400">{KIND_LABEL[o.kind]}</span>
                  </p>
                  <p className="mt-0.5 text-slate-600">
                    {o.text || (o.level ? `${comps.find((c) => c.id === o.competencyId)?.text ?? 'Kompetenz'}: ${LEVEL_LABEL[o.level]}` : <span className="text-slate-400">ohne Text</span>)}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400 tabular-nums">{format(parseISO(o.createdAt), 'HH:mm')}</span>
              </li>
            )
          })}
        </ul>
        {!inLesson.length && (
          <div className="px-5 pb-5">
            <Empty icon={MessageSquareText}>Keine Einträge in dieser Stunde.</Empty>
          </div>
        )}
      </Card>

      <ReflectionSheet lesson={lesson} open={editing} onClose={() => setEditing(false)} students={students} observations={obs} />
    </div>
  )
}

function SummaryTile({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-2xl bg-white px-4 py-3.5 shadow-[var(--shadow-card)] ring-1 ring-slate-200/80', className)}>
      <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{label}</p>
      <p className="mt-1 text-[15px] font-semibold text-slate-900">{children}</p>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children?: React.ReactNode }) {
  if (!children) return null
  return (
    <div>
      <dt className="mb-0.5 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-800">{children}</dd>
    </div>
  )
}
