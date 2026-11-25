import clsx from 'clsx'
import { format, parseISO, startOfWeek, formatISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Info,
  Mic,
  Paperclip,
  Play,
  Plus,
  Radar,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AiTextSheet, AskSheet as AskClassSheet, DictationSheet } from '../components/AiSheets'
import { latestRunning, StartLessonSheet, subjectDot } from '../components/LessonSheets'
import { ai, classContext } from '../lib/ai'
import { QuickCapture, type CaptureContext } from '../components/QuickCapture'
import { Avatar, Badge, Button, Card, CoverageRing, Empty, PageHeader, Segmented, Stat, ValenceDot } from '../components/ui'
import { ClassDot } from '../components/ClassSwitcher'
import { classColor } from '../lib/colors'
import { alive, db, isGroup, type Competency, type Goal, type Lesson, type Observation, type SchoolClass, type Student } from '../lib/db'
import { todaysSlots, useActiveClass, useClasses, useCompetencies, useNow, useObservations, usePeriods, useStudents, useTimetable, type SlotNow } from '../lib/hooks'
import { agoText, daysAgo, focusRotation, signals, studentStats, today, type Signal } from '../lib/insights'
import { bandFor, KIND_LABEL, SUBJECTS_BY_GRADE } from '../lib/seed'

function useMinuteTick() {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])
}

type Scope = 'klasse' | 'alle'
const SCOPE_KEY = 'cockpit.scope'
function readScope(): Scope {
  try {
    return localStorage.getItem(SCOPE_KEY) === 'alle' ? 'alle' : 'klasse'
  } catch {
    return 'klasse'
  }
}

/** Daten je Klasse/Gruppe für die Ansicht „Alle Klassen“. */
interface ClassData {
  cls: SchoolClass
  students: Student[]
  obs: Observation[]
  goals: Goal[]
  comps: Competency[]
}

const ctxName = (c?: SchoolClass) => (!c ? '' : isGroup(c) ? c.name : `Klasse ${c.name}`)
const subjectsOf = (c: SchoolClass) => (c.subjects.length ? c.subjects : SUBJECTS_BY_GRADE[c.gradeLevel])

function ClassTag({ c }: { c?: SchoolClass }) {
  if (!c) return null
  return (
    <span className={clsx('inline-flex max-w-[10rem] shrink-0 items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium', classColor(c).soft)}>
      <ClassDot c={c} className="size-1.5" />
      <span className="truncate">{c.name}</span>
    </span>
  )
}

export default function Cockpit() {
  const nav = useNavigate()
  const { cls, loading } = useActiveClass()
  const classes = useClasses() ?? []
  const students = useStudents(cls?.id)
  const obs = useObservations(cls?.id)
  const comps = useCompetencies(cls)
  const goals = useLiveQuery(async () => (cls ? alive(await db.goals.where('classId').equals(cls.id).toArray()) : []), [cls?.id]) ?? []
  const allLessons = useLiveQuery(async () => alive(await db.lessons.toArray()), []) ?? []
  const [scope, setScopeState] = useState<Scope>(readScope)
  const setScope = (v: Scope) => {
    setScopeState(v)
    try {
      localStorage.setItem(SCOPE_KEY, v)
    } catch {
      /* egal */
    }
  }
  const all = scope === 'alle' && classes.length > 1
  const [capture, setCapture] = useState<CaptureContext | null>(null)
  const [starting, setStarting] = useState<{ classId?: string; subject?: string } | null>(null)
  const [dictating, setDictating] = useState(false)
  const [weekly, setWeekly] = useState(false)
  const [asking, setAsking] = useState(false)
  useMinuteTick()

  // Stundenplan (alle Klassen/Gruppen)
  const timetable = useTimetable()
  const periods = usePeriods()
  const nowDate = useNow()
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes])
  const slots = useMemo(() => todaysSlots(timetable, periods, nowDate).filter((x) => classById.has(x.slot.classId)), [timetable, periods, nowDate, classById])
  const slotNow = slots.find((x) => x.state === 'jetzt') ?? slots.find((x) => x.state === 'gleich')

  // Aggregierte Daten für „Alle Klassen“ (nur laden, wenn gebraucht)
  const agg = useLiveQuery(async () => {
    if (!all) return undefined
    const [st, ob, gl, cp] = await Promise.all([db.students.toArray(), db.observations.toArray(), db.goals.toArray(), db.competencies.toArray()])
    return { students: alive(st), obs: alive(ob).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), goals: alive(gl), comps: alive(cp) }
  }, [all])
  const perClass = useMemo<ClassData[]>(() => {
    if (!agg) return []
    return classes.map((c) => {
      const members = new Set(c.memberIds ?? [])
      const st = agg.students.filter((s) => (isGroup(c) ? members.has(s.id) : s.classId === c.id)).sort((a, b) => a.firstName.localeCompare(b.firstName, 'de'))
      const ids = new Set(st.map((s) => s.id))
      const band = bandFor(c.gradeLevel)
      return {
        cls: c,
        students: st,
        obs: agg.obs.filter((o) => o.studentIds.some((id) => ids.has(id))),
        goals: agg.goals.filter((g) => g.classId === c.id),
        comps: agg.comps.filter((x) => x.band === band && (!isGroup(c) || !c.subjects.length || c.subjects.includes(x.subject))),
      }
    })
  }, [agg, classes])

  const stats = useMemo(() => studentStats(students, obs), [students, obs])
  const sigs = useMemo<(Signal & { cls?: SchoolClass })[]>(() => {
    if (!all || !perClass.length) return cls ? signals(students, obs, comps, goals, subjectsOf(cls)) : []
    const out: (Signal & { cls?: SchoolClass })[] = []
    const seenStudentSig = new Set<string>()
    for (const d of perClass) {
      for (const s of signals(d.students, d.obs, d.comps, d.goals, subjectsOf(d.cls))) {
        // Kind in Klasse UND Gruppe: Signal nur einmal zeigen
        if (s.studentId) {
          if (seenStudentSig.has(s.id)) continue
          seenStudentSig.add(s.id)
        }
        out.push({ ...s, id: `${d.cls.id}:${s.id}`, cls: d.cls })
      }
    }
    const order = { warn: 0, info: 1, good: 2 }
    return out.sort((a, b) => order[a.tone] - order[b.tone])
  }, [all, perClass, students, obs, comps, goals, cls])

  if (loading) return null
  if (!cls)
    return (
      <div className="mx-auto max-w-xl px-4 py-10 md:px-8">
        <Card>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Users size={22} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight">Willkommen im Cockpit</h1>
            <p className="max-w-sm text-sm text-slate-500">Lege zuerst eine Klasse an (Jahrgangsstufe 1–4) und trage die Kinder ein.</p>
            <Link
              to="/einstellungen"
              className="mt-1 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 px-4 text-sm font-medium !text-[#fff] shadow-[var(--shadow-glow)] ring-1 ring-brand-700/40 ring-inset"
            >
              <Plus size={16} /> Klasse anlegen
            </Link>
          </div>
        </Card>
      </div>
    )

  const activeIds = new Set(classes.map((c) => c.id))
  const scopeLessons = all ? allLessons.filter((l) => activeIds.has(l.classId)) : allLessons.filter((l) => l.classId === cls.id)
  const lessons = allLessons.filter((l) => l.classId === cls.id)
  const runningAll = scopeLessons.filter((l) => l.status === 'laufend').sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const running = all ? runningAll[0] : latestRunning(lessons)
  const runningFor = (classId: string) => latestRunning(allLessons.filter((l) => l.classId === classId))
  const todays = scopeLessons.filter((l) => l.date === today()).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const todaysAll = allLessons.filter((l) => l.date === today())
  const openDocs = runningAll.filter((l) => l.id !== running?.id)

  const allObs = all ? (agg?.obs ?? []) : obs
  const allStudents = all ? (agg?.students ?? []) : students
  const weekStart = formatISO(startOfWeek(new Date(), { weekStartsOn: 1 }), { representation: 'date' })
  const scopeStudents = all ? [...new Map(perClass.flatMap((d) => d.students).map((s) => [s.id, s])).values()] : students
  const scopeIds = new Set(scopeStudents.map((s) => s.id))
  const scopeObs = all ? allObs.filter((o) => o.studentIds.some((id) => scopeIds.has(id))) : obs
  const week = scopeObs.filter((o) => o.date >= weekStart)
  const weekKids = new Set(week.flatMap((o) => o.studentIds))
  const missingWeek = scopeStudents.filter((s) => !weekKids.has(s.id))
  const scopeGoals = all ? perClass.flatMap((d) => d.goals) : goals
  const followUps = [
    ...scopeObs
      .filter((o) => o.followUp && o.followUp <= daysAgo(-3))
      .map((o) => ({ id: o.id, date: o.followUp!, text: o.text || KIND_LABEL[o.kind], who: o.studentIds, obs: o as Observation | undefined, classId: o.classId })),
    ...scopeGoals
      .filter((g) => g.status === 'offen' && g.due && g.due <= daysAgo(-7))
      .map((g) => ({ id: g.id, date: g.due!, text: `Ziel: ${g.text}`, who: [g.studentId], obs: undefined as Observation | undefined, classId: g.classId })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const runningObs = running ? allObs.filter((o) => o.lessonId === running.id) : []
  const runningKids = new Set(runningObs.flatMap((o) => o.studentIds)).size
  const runningCls = running ? classById.get(running.classId) : undefined
  const runningTotal = running ? running.focusStudentIds.length || (all ? (perClass.find((d) => d.cls.id === running.classId)?.students.length ?? 0) : students.length) : 0
  const elapsed = running ? Math.max(0, Math.round((Date.now() - parseISO(running.startedAt).getTime()) / 60000)) : 0

  /** Kontext für die Schnellerfassung – in „Alle Klassen“ die passende Klasse/Gruppe. */
  const ctxFor = (studentIds: string[], classId?: string): CaptureContext => {
    const d = classId && classId !== cls.id ? perClass.find((x) => x.cls.id === classId) : undefined
    const c = d?.cls ?? cls
    const r = d ? runningFor(c.id) : latestRunning(lessons)
    return {
      classId: c.id,
      gradeLevel: c.gradeLevel,
      subjects: c.subjects,
      students: d?.students ?? students,
      competencies: d?.comps ?? comps,
      studentIds,
      lessonId: r?.id,
      subject: r?.subject,
      focusCompetencyIds: r?.focusCompetencyIds,
    }
  }
  const name = (id: string) => allStudents.find((s) => s.id === id)?.firstName ?? students.find((s) => s.id === id)?.firstName ?? '?'
  const homeClassOf = (studentId: string) => classById.get(allStudents.find((s) => s.id === studentId)?.classId ?? '')

  // Stundenplan: passende Stunde von heute (gleiche Klasse + Fach)
  const lessonForSlot = (x: SlotNow): Lesson | undefined =>
    todaysAll.filter((l) => l.classId === x.slot.classId && l.subject === x.slot.subject).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  const slotLessonIds = new Set(slots.map(lessonForSlot).filter(Boolean).map((l) => l!.id))
  const extraLessons = todays.filter((l) => !slotLessonIds.has(l.id))
  const startSlot = (x: SlotNow) => setStarting({ classId: x.slot.classId, subject: x.slot.subject })
  const heroSlot = slotNow && !(running && lessonForSlot(slotNow)?.id === running.id) ? slotNow : undefined
  const heroSlotLesson = heroSlot ? lessonForSlot(heroSlot) : undefined
  const heroSlotCls = heroSlot ? classById.get(heroSlot.slot.classId) : undefined

  // Fokus: Rotation (wer ist dran?) – mit offenen Zielen
  const focusList = (d: { students: Student[]; obs: Observation[]; goals: Goal[]; cls: SchoolClass }, n: number) => {
    const r = runningFor(d.cls.id)
    const st = studentStats(d.students, d.obs)
    return focusRotation(d.students, d.obs, d.goals, r?.focusCompetencyIds ?? [], n).map((s) => ({
      student: s,
      stat: st.find((x) => x.student.id === s.id),
      goal: d.goals.find((g) => g.studentId === s.id && g.status === 'offen'),
      cls: d.cls,
    }))
  }
  const focus = all ? perClass.flatMap((d) => focusList(d, 2)) : focusList({ students, obs, goals, cls }, 4)

  const greeting = `Guten ${new Date().getHours() < 11 ? 'Morgen' : new Date().getHours() < 17 ? 'Tag' : 'Abend'}`

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow={format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}
        title={greeting}
        subtitle={all ? `${classes.length} Klassen & Gruppen · ${scopeStudents.length} Kinder` : `${ctxName(cls)} · ${students.length} Kinder`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {classes.length > 1 && (
              <Segmented
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'klasse', label: 'Diese Klasse' },
                  { value: 'alle', label: 'Alle Klassen' },
                ]}
              />
            )}
            <Button onClick={() => setCapture(ctxFor([]))} size="lg">
              <Plus size={18} /> Beobachtung
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        {/* JETZT */}
        <section className="relative min-w-0 overflow-hidden rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-slate-200/80 md:p-6 lg:col-span-2">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-100/60 blur-3xl" />
          <div className="relative">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {running ? (
                <Badge tone="brand">
                  <span className="relative mr-0.5 flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-500 opacity-70" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-brand-500" />
                  </span>
                  Läuft · {elapsed} min
                </Badge>
              ) : heroSlot ? (
                <Badge tone={heroSlot.state === 'jetzt' ? 'brand' : 'slate'}>
                  {heroSlot.state === 'jetzt' ? 'Jetzt' : 'Gleich'} · {heroSlot.slot.period}. Stunde
                </Badge>
              ) : (
                <Badge>Jetzt</Badge>
              )}
              {running && <span className="text-xs text-slate-400 tabular-nums">seit {format(parseISO(running.startedAt), 'HH:mm')} Uhr</span>}
              {!running && heroSlot?.time && (
                <span className="text-xs text-slate-400 tabular-nums">
                  {heroSlot.time.start}–{heroSlot.time.end} Uhr
                </span>
              )}
            </div>

            {running ? (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[22px] leading-tight font-semibold tracking-tight text-slate-900">
                    <span className={clsx('size-2.5 shrink-0 rounded-full', subjectDot(running.subject))} />
                    {running.subject}
                    {(all || running.classId !== cls.id) && <ClassTag c={runningCls} />}
                  </p>
                  {running.topic && <p className="mt-1 text-slate-600">{running.topic}</p>}
                  {running.focus && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500">
                      <Target size={14} className="text-slate-400" /> {running.focus}
                    </p>
                  )}
                  <div className="mt-4 flex gap-6 text-sm">
                    <div>
                      <p className="text-xl font-semibold tabular-nums">{runningObs.length}</p>
                      <p className="text-xs text-slate-500">Einträge</p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold tabular-nums">
                        {runningKids}
                        <span className="text-slate-400">/{runningTotal}</span>
                      </p>
                      <p className="text-xs text-slate-500">Kinder beobachtet</p>
                    </div>
                  </div>
                </div>
                <Button size="lg" onClick={() => nav(`/unterricht/${running.id}`)}>
                  <Play size={18} /> Zum Unterricht
                </Button>
              </div>
            ) : heroSlot ? (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[22px] leading-tight font-semibold tracking-tight text-slate-900">
                    <span className={clsx('size-2.5 shrink-0 rounded-full', subjectDot(heroSlot.slot.subject))} />
                    {heroSlot.slot.subject}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className={clsx('inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 font-medium', classColor(heroSlotCls).soft)}>
                      <ClassDot c={heroSlotCls} /> {ctxName(heroSlotCls)}
                    </span>
                    {heroSlot.slot.room && <span className="text-slate-400">Raum {heroSlot.slot.room}</span>}
                    {heroSlotLesson?.status === 'abgeschlossen' && (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 size={14} /> dokumentiert
                      </span>
                    )}
                  </p>
                </div>
                {heroSlotLesson?.status === 'laufend' ? (
                  <Button size="lg" onClick={() => nav(`/unterricht/${heroSlotLesson.id}`)}>
                    <Play size={18} /> Zum Unterricht
                  </Button>
                ) : (
                  <Button size="lg" onClick={() => startSlot(heroSlot)}>
                    <Play size={18} /> Stunde starten
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <p className="text-[22px] leading-tight font-semibold tracking-tight text-slate-900">Bereit für die nächste Stunde?</p>
                  <p className="mt-1 max-w-md text-sm text-slate-500">Fach, Thema und Schwerpunkt festlegen – dann im Sitzplan mit einem Tipp beobachten.</p>
                </div>
                <Button size="lg" onClick={() => setStarting({})}>
                  <Play size={18} /> Stunde starten
                </Button>
              </div>
            )}

            {running && heroSlot && heroSlotLesson?.status !== 'abgeschlossen' && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200/70">
                <span className="text-slate-500">Laut Stundenplan {heroSlot.state === 'jetzt' ? 'jetzt' : 'gleich'}:</span>
                <span className="inline-flex min-w-0 flex-1 items-center gap-2 font-medium text-slate-800">
                  <ClassDot c={heroSlotCls} />
                  <span className="truncate">
                    {heroSlot.slot.subject} · {ctxName(heroSlotCls)}
                  </span>
                </span>
                {heroSlotLesson?.status === 'laufend' ? (
                  <Button variant="secondary" size="sm" onClick={() => nav(`/unterricht/${heroSlotLesson.id}`)}>
                    Öffnen
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => startSlot(heroSlot)}>
                    <Play size={14} /> Stunde starten
                  </Button>
                )}
              </div>
            )}

            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="mb-2.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Heute{slots.length > 0 && ' · Stundenplan'}</p>
              {slots.length > 0 || todays.length > 0 ? (
                <ol className="flex gap-2 overflow-x-auto pb-1">
                  {slots.map((x) => {
                    const l = lessonForSlot(x)
                    const c = classById.get(x.slot.classId)
                    const past = x.state === 'vorbei'
                    const current = x.state === 'jetzt' || x.state === 'gleich'
                    const body = (
                      <>
                        <span className="text-xs font-medium text-slate-400 tabular-nums">{x.time?.start ?? `${x.slot.period}.`}</span>
                        <ClassDot c={c} />
                        <span className="min-w-0 text-left">
                          <span className="block font-medium text-slate-800">{x.slot.subject}</span>
                          <span className="block max-w-[8rem] truncate text-[11px] text-slate-500">{ctxName(c)}</span>
                        </span>
                        {l?.status === 'laufend' ? (
                          <Badge tone="brand">läuft</Badge>
                        ) : l ? (
                          l.reflection ? (
                            <CheckCircle2 size={15} className="text-emerald-500" aria-label="dokumentiert" />
                          ) : (
                            <Badge tone="amber">Doku offen</Badge>
                          )
                        ) : x.state === 'jetzt' ? (
                          <Badge tone="brand">jetzt</Badge>
                        ) : x.state === 'gleich' ? (
                          <Badge>gleich</Badge>
                        ) : null}
                      </>
                    )
                    const cn = clsx(
                      'flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm ring-1 transition hover:bg-slate-50',
                      current ? clsx('bg-white ring-2', classColor(c).ring) : 'bg-white ring-slate-200',
                      past && !current && 'opacity-55',
                    )
                    return (
                      <li key={x.slot.id} className="shrink-0">
                        {l ? (
                          <Link to={`/unterricht/${l.id}`} className={cn}>
                            {body}
                          </Link>
                        ) : (
                          <button type="button" onClick={() => startSlot(x)} className={cn} title="Stunde starten">
                            {body}
                          </button>
                        )}
                      </li>
                    )
                  })}
                  {extraLessons.map((l) => {
                    const live = l.status === 'laufend'
                    const docOpen = live && l.id !== running?.id
                    return (
                      <li key={l.id} className="shrink-0">
                        <Link
                          to={`/unterricht/${l.id}`}
                          className={clsx(
                            'flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm ring-1 transition hover:bg-slate-50',
                            live && !docOpen ? 'bg-brand-50/60 ring-brand-100' : 'bg-white ring-slate-200',
                          )}
                        >
                          <span className="text-xs font-medium text-slate-400 tabular-nums">{format(parseISO(l.startedAt), 'HH:mm')}</span>
                          {all ? <ClassDot c={classById.get(l.classId)} /> : <span className={clsx('size-2 rounded-full', subjectDot(l.subject))} />}
                          <span className="font-medium text-slate-800">{l.subject}</span>
                          {all && <span className="max-w-[6rem] truncate text-[11px] text-slate-500">{ctxName(classById.get(l.classId))}</span>}
                          {live && !docOpen ? (
                            <Badge tone="brand">läuft</Badge>
                          ) : docOpen || !l.reflection ? (
                            <Badge tone="amber">Doku offen</Badge>
                          ) : (
                            <CheckCircle2 size={15} className="text-emerald-500" aria-label="dokumentiert" />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="text-sm text-slate-400">Heute noch keine Stunde.</p>
              )}
              {!timetable.length && (
                <Link to="/einstellungen?bereich=stundenplan" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-700">
                  <CalendarClock size={13} /> Stundenplan eintragen – dann schlägt das Cockpit die passende Stunde vor
                  <ArrowRight size={13} />
                </Link>
              )}
              {openDocs.length > 0 && (
                <Link to="/unterricht" className="mt-3 flex w-fit items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800">
                  <AlertTriangle size={14} /> {openDocs.length} weitere Stunde{openDocs.length > 1 ? 'n' : ''} noch ohne Abschluss
                  {all && (
                    <span className="inline-flex items-center gap-1">
                      {[...new Set(openDocs.map((l) => l.classId))].map((id) => (
                        <ClassDot key={id} c={classById.get(id)} className="size-2" />
                      ))}
                    </span>
                  )}
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* FOKUS */}
        <Card title={all ? 'Heute im Fokus · je Klasse' : 'Heute im Fokus'} icon={Target}>
          <div className="-mx-2 space-y-0.5">
            {focus.map((f) => (
              <button
                key={`${f.cls.id}-${f.student.id}`}
                type="button"
                onClick={() => setCapture(ctxFor([f.student.id], f.cls.id))}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50"
              >
                <CoverageRing value={f.stat?.coverage ?? 0}>
                  <Avatar student={f.student} size={34} />
                </CoverageRing>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium text-slate-900">
                    {f.student.firstName}
                    {all && <ClassTag c={f.cls} />}
                  </p>
                  {f.goal ? (
                    <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                      <Target size={11} className="shrink-0 text-brand-600" />
                      <span className="truncate">{f.goal.text}</span>
                    </p>
                  ) : (
                    <p className="truncate text-xs text-slate-500">{agoText(f.stat?.days ?? Infinity)}</p>
                  )}
                </div>
                <span className="flex size-9 items-center justify-center rounded-lg text-slate-400" aria-hidden>
                  <Plus size={16} />
                </span>
              </button>
            ))}
            {!focus.length && (
              <Empty icon={Users}>
                Noch keine Kinder. Unter{' '}
                <Link to="/einstellungen" className="font-medium text-brand-700 underline">
                  Einstellungen
                </Link>{' '}
                anlegen.
              </Empty>
            )}
          </div>
        </Card>

        {/* SIGNALE */}
        <Card title="Signale" icon={Activity} className="lg:col-span-2" action={sigs.length > 0 && <Badge>{sigs.length}</Badge>}>
          <ul className="-mx-2 space-y-0.5">
            {sigs.slice(0, all ? 12 : 8).map((s, i) => {
              const balance = s.id.includes('bal-')
              const Icon = balance ? Scale : s.tone === 'warn' ? AlertTriangle : s.tone === 'good' ? CheckCircle2 : Info
              return (
                <li key={`${s.id}-${i}`}>
                  <Link to={s.studentId ? `/kinder/${s.studentId}` : '/klasse'} className="group flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition hover:bg-slate-50">
                    <span
                      className={clsx(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                        s.tone === 'warn' ? 'bg-rose-50 text-rose-600' : s.tone === 'good' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600',
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                      {all && s.cls && <ClassTag c={s.cls} />}
                      <span className="min-w-0 text-slate-700">{s.text}</span>
                      {balance && <span className="text-[11px] text-sky-700/80">Ausgewogenheit</span>}
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-slate-300 group-hover:text-slate-500" />
                  </Link>
                </li>
              )
            })}
            {!sigs.length && <Empty icon={CheckCircle2}>Keine Auffälligkeiten – alles im grünen Bereich.</Empty>}
          </ul>
        </Card>

        {/* WIEDERVORLAGEN */}
        <Card title="Wiedervorlagen" icon={CalendarClock}>
          <ul className="-mx-2 space-y-0.5">
            {followUps.slice(0, all ? 10 : 6).map((f) => {
              const due = f.date <= today()
              const fc = classById.get(f.classId) ?? homeClassOf(f.who[0])
              const content = (
                <>
                  <span className={clsx('mt-0.5 w-12 shrink-0 text-xs font-semibold tabular-nums', due ? 'text-rose-600' : 'text-slate-400')}>{format(parseISO(f.date), 'd.M.')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-slate-800">{f.who.map(name).join(', ')}</span>
                      {all && <ClassTag c={fc} />}
                    </span>
                    <span className="line-clamp-2 text-slate-500">{f.text}</span>
                  </span>
                </>
              )
              return (
                <li key={f.id}>
                  {f.obs ? (
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left text-sm transition hover:bg-slate-50"
                      onClick={() => setCapture({ ...ctxFor(f.obs!.studentIds, all ? f.classId : undefined), edit: f.obs })}
                    >
                      {content}
                    </button>
                  ) : (
                    <Link to={`/kinder/${f.who[0]}`} className="flex items-start gap-2 rounded-xl px-2 py-2 text-sm transition hover:bg-slate-50">
                      {content}
                    </Link>
                  )}
                </li>
              )
            })}
            {!followUps.length && <Empty icon={CalendarClock}>Nichts fällig.</Empty>}
          </ul>
        </Card>

        {/* ABDECKUNG */}
        <Card
          title={all ? `Abdeckung · ${ctxName(cls)}` : 'Abdeckung der Dokumentation'}
          icon={Radar}
          className="lg:col-span-2"
          action={
            <span className="hidden items-center gap-3 text-xs text-slate-400 sm:flex">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-500" /> gut
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-amber-500" /> mittel
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-rose-500" /> wenig
              </span>
            </span>
          }
        >
          {stats.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-x-2 gap-y-3">
              {stats.map((s) => (
                <Link key={s.student.id} to={`/kinder/${s.student.id}`} className="flex flex-col items-center gap-1.5 rounded-xl p-1.5 text-center transition hover:bg-slate-50">
                  <CoverageRing value={s.coverage} size={54}>
                    <Avatar student={s.student} size={42} />
                  </CoverageRing>
                  <span className="w-full truncate text-xs font-medium text-slate-700">{s.student.firstName}</span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty icon={Radar}>Sobald Kinder angelegt sind, siehst du hier, wer gut dokumentiert ist.</Empty>
          )}
        </Card>

        {/* WOCHE + KI */}
        <div className="flex min-w-0 flex-col gap-5">
          <Card title="Diese Woche" icon={TrendingUp}>
            <div className="grid grid-cols-3 gap-2">
              <Stat value={week.length} label="Einträge" />
              <Stat value={`${scopeStudents.filter((s) => weekKids.has(s.id)).length}/${scopeStudents.length}`} label="Kinder" />
              <Stat value={week.filter((o) => o.valence === 'pos').length} label="positiv" tone="green" />
            </div>
            {all && perClass.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {perClass.map((d) => {
                  const seen = d.students.filter((s) => weekKids.has(s.id)).length
                  const pct = d.students.length ? seen / d.students.length : 0
                  return (
                    <li key={d.cls.id} className="flex items-center gap-2 text-sm">
                      <ClassDot c={d.cls} />
                      <span className="w-24 shrink-0 truncate text-slate-700">{ctxName(d.cls)}</span>
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span className={clsx('block h-full rounded-full', classColor(d.cls).dot)} style={{ width: `${Math.round(pct * 100)}%` }} />
                      </span>
                      <span className="w-12 shrink-0 text-right text-xs text-slate-500 tabular-nums">
                        {seen}/{d.students.length}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            {!all && students.length > 0 && (
              <div className="mt-4">
                {missingWeek.length ? (
                  <>
                    <p className="mb-2 text-xs text-slate-500">Noch ohne Eintrag ({missingWeek.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {missingWeek.slice(0, 12).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setCapture(ctxFor([s.id]))}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-50 py-1 pr-3 pl-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                        >
                          <Avatar student={s} size={24} /> {s.firstName}
                        </button>
                      ))}
                      {missingWeek.length > 12 && <span className="self-center text-xs text-slate-400">+{missingWeek.length - 12}</span>}
                    </div>
                  </>
                ) : (
                  <p className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
                    <CheckCircle2 size={15} /> Alle Kinder wurden diese Woche beobachtet.
                  </p>
                )}
              </div>
            )}
          </Card>

          <section className="rounded-2xl bg-violet-50/60 p-5 ring-1 ring-violet-100">
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-slate-900">
              <span className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <Sparkles size={15} strokeWidth={2.2} />
              </span>
              KI-Assistent
            </h2>
            <div className="grid gap-2">
              <AiAction icon={Mic} label="Diktat → Einträge" hint="Frei erzählen, KI sortiert" onClick={() => setDictating(true)} />
              <AiAction icon={Sparkles} label="Wochenrückblick" hint="Zusammenfassung dieser Woche" onClick={() => setWeekly(true)} />
              <AiAction icon={Info} label="Frage zur Klasse" hint="z. B. Wer braucht Unterstützung?" onClick={() => setAsking(true)} />
            </div>
            <p className="mt-3 text-[11px] text-violet-700/70">KI-Entwürfe immer prüfen.</p>
          </section>
        </div>

        {/* ZULETZT */}
        <Card title="Zuletzt" icon={Clock} className="lg:col-span-3" padded={false}>
          <ul className="divide-y divide-slate-100 px-2 pb-2">
            {scopeObs.slice(0, all ? 10 : 8).map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => setCapture({ ...ctxFor(o.studentIds, all ? o.classId : undefined), edit: o })} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50">
                  <ValenceDot v={o.valence} />
                  {all && <ClassDot c={classById.get(o.classId) ?? homeClassOf(o.studentIds[0])} />}
                  <span className="w-24 shrink-0 truncate text-sm font-medium text-slate-800 sm:w-36">{o.studentIds.map(name).join(', ')}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                    <span className="text-slate-400">
                      {KIND_LABEL[o.kind]}
                      {o.subject ? ` · ${o.subject}` : ''} –{' '}
                    </span>
                    {o.text || (o.level ? (agg?.comps ?? comps).find((c) => c.id === o.competencyId)?.text : '') || (o.attachments.length ? 'Anhang' : '')}
                  </span>
                  {o.attachments.length > 0 && <Paperclip size={14} className="shrink-0 text-slate-400" aria-label="Anhang" />}
                  <span className="shrink-0 text-xs text-slate-400 tabular-nums">{format(parseISO(o.createdAt), 'd.M. HH:mm')}</span>
                </button>
              </li>
            ))}
          </ul>
          {!scopeObs.length && (
            <div className="px-5 pb-5">
              <Empty icon={Clock}>Noch keine Beobachtungen. Tippe oben auf „Beobachtung“ oder starte eine Stunde.</Empty>
            </div>
          )}
        </Card>
      </div>

      <QuickCapture ctx={capture} onClose={() => setCapture(null)} />
      {dictating && <DictationSheet open onClose={() => setDictating(false)} cls={cls} students={students} comps={comps} lessonId={latestRunning(lessons)?.id} subject={latestRunning(lessons)?.subject} />}
      {weekly && (
        <AiTextSheet
          open
          onClose={() => setWeekly(false)}
          title="Wochenrückblick"
          deps={[]}
          run={async () => (await ai('weekly', classContext(cls, students, obs, comps, lessons, weekStart))).text}
        />
      )}
      <AskClassSheet open={asking} onClose={() => setAsking(false)} data={() => classContext(cls, students, obs, comps, lessons, daysAgo(90))} />
      <StartLessonSheet
        open={!!starting}
        onClose={() => setStarting(null)}
        cls={cls}
        competencies={comps}
        students={students}
        initialClassId={starting?.classId}
        initialSubject={starting?.subject}
      />
    </div>
  )
}

function AiAction({ icon: Icon, label, hint, onClick }: { icon: typeof Sparkles; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-white px-3 py-2 text-left shadow-[var(--shadow-card)] ring-1 ring-violet-100 transition hover:ring-violet-400/50">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="block truncate text-xs text-slate-500">{hint}</span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-violet-300" />
    </button>
  )
}
