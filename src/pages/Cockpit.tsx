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
import { Avatar, Badge, Button, Card, CoverageRing, Empty, PageHeader, Stat, ValenceDot } from '../components/ui'
import { ClassDot } from '../components/ClassSwitcher'
import { classColor } from '../lib/colors'
import { alive, db, isGroup, type Competency, type Goal, type Lesson, type Observation, type SchoolClass, type Student } from '../lib/db'
import { todaysSlots, useActiveClass, useClasses, useCompetencies, useNow, useObservations, usePeriods, useStudents, useTimetable, type SlotNow } from '../lib/hooks'
import { agoText, daysAgo, focusRotation, signals, studentStats, today, type Signal } from '../lib/insights'
import { bandFor, KIND_LABEL, SUBJECTS_BY_GRADE } from '../lib/seed'
import { Segmented } from '../components/ui'

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
      <span className="truncate">{isGroup(c) ? c.name : c.name}</span>
    </span>
  )
}

export default function Cockpit() {
  const nav = useNavigate()
  const { cls, loading } = useActiveClass()
  const students = useStudents(cls?.id)
  const obs = useObservations(cls?.id)
  const comps = useCompetencies(cls)
  const goals = useLiveQuery(async () => (cls ? alive(await db.goals.where('classId').equals(cls.id).toArray()) : []), [cls?.id]) ?? []
  const lessons = useLiveQuery(async () => (cls ? alive(await db.lessons.where('classId').equals(cls.id).toArray()) : []), [cls?.id]) ?? []
  const [capture, setCapture] = useState<CaptureContext | null>(null)
  const [starting, setStarting] = useState(false)
  const [dictating, setDictating] = useState(false)
  const [weekly, setWeekly] = useState(false)
  const [asking, setAsking] = useState(false)
  useMinuteTick()

  const stats = useMemo(() => studentStats(students, obs), [students, obs])
  const focus = useMemo(() => focusChildren(stats, goals), [stats, goals])
  const sigs = useMemo(() => signals(students, obs, comps, goals), [students, obs, comps, goals])

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

  const running = latestRunning(lessons)
  const todays = lessons.filter((l) => l.date === today()).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const openDocs = lessons.filter((l) => l.status === 'laufend' && l.id !== running?.id)
  const weekStart = formatISO(startOfWeek(new Date(), { weekStartsOn: 1 }), { representation: 'date' })
  const week = obs.filter((o) => o.date >= weekStart)
  const weekKids = new Set(week.flatMap((o) => o.studentIds))
  const missingWeek = students.filter((s) => !weekKids.has(s.id))
  const followUps = [
    ...obs.filter((o) => o.followUp && o.followUp <= daysAgo(-3)).map((o) => ({ id: o.id, date: o.followUp!, text: o.text || KIND_LABEL[o.kind], who: o.studentIds, obs: o })),
    ...goals.filter((g) => g.status === 'offen' && g.due && g.due <= daysAgo(-7)).map((g) => ({ id: g.id, date: g.due!, text: `Ziel: ${g.text}`, who: [g.studentId], obs: undefined })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const runningObs = running ? obs.filter((o) => o.lessonId === running.id) : []
  const runningKids = new Set(runningObs.flatMap((o) => o.studentIds)).size
  const elapsed = running ? Math.max(0, Math.round((Date.now() - parseISO(running.startedAt).getTime()) / 60000)) : 0

  const ctxFor = (studentIds: string[]): CaptureContext => ({
    classId: cls.id,
    gradeLevel: cls.gradeLevel,
    students,
    competencies: comps,
    studentIds,
    lessonId: running?.id,
    subject: running?.subject,
    focusCompetencyIds: running?.focusCompetencyIds,
  })
  const name = (id: string) => students.find((s) => s.id === id)?.firstName ?? '?'

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow={format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}
        title={`Guten ${new Date().getHours() < 11 ? 'Morgen' : new Date().getHours() < 17 ? 'Tag' : 'Abend'}`}
        subtitle={`Klasse ${cls.name} · ${students.length} Kinder`}
        actions={
          <Button onClick={() => setCapture(ctxFor([]))} size="lg">
            <Plus size={18} /> Beobachtung
          </Button>
        }
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        {/* JETZT */}
        <section className="relative min-w-0 overflow-hidden rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-slate-200/80 md:p-6 lg:col-span-2">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-100/60 blur-3xl" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2">
              {running ? (
                <Badge tone="brand">
                  <span className="relative mr-0.5 flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-500 opacity-70" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-brand-500" />
                  </span>
                  Läuft · {elapsed} min
                </Badge>
              ) : (
                <Badge>Jetzt</Badge>
              )}
              {running && <span className="text-xs text-slate-400 tabular-nums">seit {format(parseISO(running.startedAt), 'HH:mm')} Uhr</span>}
            </div>

            {running ? (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[22px] leading-tight font-semibold tracking-tight text-slate-900">
                    <span className={clsx('size-2.5 shrink-0 rounded-full', subjectDot(running.subject))} />
                    {running.subject}
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
                        <span className="text-slate-400">/{running.focusStudentIds.length || students.length}</span>
                      </p>
                      <p className="text-xs text-slate-500">Kinder beobachtet</p>
                    </div>
                  </div>
                </div>
                <Button size="lg" onClick={() => nav(`/unterricht/${running.id}`)}>
                  <Play size={18} /> Zum Unterricht
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <p className="text-[22px] leading-tight font-semibold tracking-tight text-slate-900">Bereit für die nächste Stunde?</p>
                  <p className="mt-1 max-w-md text-sm text-slate-500">Fach, Thema und Schwerpunkt festlegen – dann im Sitzplan mit einem Tipp beobachten.</p>
                </div>
                <Button size="lg" onClick={() => setStarting(true)}>
                  <Play size={18} /> Stunde starten
                </Button>
              </div>
            )}

            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="mb-2.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Heute</p>
              {todays.length ? (
                <ol className="flex gap-2 overflow-x-auto pb-1">
                  {todays.map((l) => {
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
                          <span className={clsx('size-2 rounded-full', subjectDot(l.subject))} />
                          <span className="font-medium text-slate-800">{l.subject}</span>
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
              {openDocs.length > 0 && (
                <Link to="/unterricht" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800">
                  <AlertTriangle size={14} /> {openDocs.length} weitere Stunde{openDocs.length > 1 ? 'n' : ''} noch ohne Abschluss
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* FOKUS */}
        <Card title="Heute im Fokus" icon={Target}>
          <div className="-mx-2 space-y-0.5">
            {focus.map((s) => (
              <button
                key={s.student.id}
                type="button"
                onClick={() => setCapture(ctxFor([s.student.id]))}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50"
              >
                <CoverageRing value={s.coverage}>
                  <Avatar student={s.student} size={34} />
                </CoverageRing>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{s.student.firstName}</p>
                  <p className="truncate text-xs text-slate-500">{agoText(s.days)}</p>
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
            {sigs.slice(0, 8).map((s) => {
              const Icon = s.tone === 'warn' ? AlertTriangle : s.tone === 'good' ? CheckCircle2 : Info
              return (
                <li key={s.id}>
                  <Link to={s.studentId ? `/kinder/${s.studentId}` : '/klasse'} className="group flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition hover:bg-slate-50">
                    <span
                      className={clsx(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                        s.tone === 'warn' ? 'bg-rose-50 text-rose-600' : s.tone === 'good' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600',
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1 text-slate-700">{s.text}</span>
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
            {followUps.slice(0, 6).map((f) => {
              const due = f.date <= today()
              const content = (
                <>
                  <span className={clsx('mt-0.5 w-12 shrink-0 text-xs font-semibold tabular-nums', due ? 'text-rose-600' : 'text-slate-400')}>{format(parseISO(f.date), 'd.M.')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">{f.who.map(name).join(', ')}</span>
                    <span className="line-clamp-2 text-slate-500">{f.text}</span>
                  </span>
                </>
              )
              return (
                <li key={f.id}>
                  {f.obs ? (
                    <button type="button" className="flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left text-sm transition hover:bg-slate-50" onClick={() => setCapture({ ...ctxFor(f.obs!.studentIds), edit: f.obs })}>
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
          title="Abdeckung der Dokumentation"
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
              <Stat value={`${weekKids.size}/${students.length}`} label="Kinder" />
              <Stat value={week.filter((o) => o.valence === 'pos').length} label="positiv" tone="green" />
            </div>
            {students.length > 0 && (
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
            {obs.slice(0, 8).map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => setCapture({ ...ctxFor(o.studentIds), edit: o })} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50">
                  <ValenceDot v={o.valence} />
                  <span className="w-24 shrink-0 truncate text-sm font-medium text-slate-800 sm:w-36">{o.studentIds.map(name).join(', ')}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                    <span className="text-slate-400">
                      {KIND_LABEL[o.kind]}
                      {o.subject ? ` · ${o.subject}` : ''} –{' '}
                    </span>
                    {o.text || (o.level ? comps.find((c) => c.id === o.competencyId)?.text : '') || (o.attachments.length ? 'Anhang' : '')}
                  </span>
                  {o.attachments.length > 0 && <Paperclip size={14} className="shrink-0 text-slate-400" aria-label="Anhang" />}
                  <span className="shrink-0 text-xs text-slate-400 tabular-nums">{format(parseISO(o.createdAt), 'd.M. HH:mm')}</span>
                </button>
              </li>
            ))}
          </ul>
          {!obs.length && (
            <div className="px-5 pb-5">
              <Empty icon={Clock}>Noch keine Beobachtungen. Tippe oben auf „Beobachtung“ oder starte eine Stunde.</Empty>
            </div>
          )}
        </Card>
      </div>

      <QuickCapture ctx={capture} onClose={() => setCapture(null)} />
      {dictating && <DictationSheet open onClose={() => setDictating(false)} cls={cls} students={students} comps={comps} lessonId={running?.id} subject={running?.subject} />}
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
      <StartLessonSheet open={starting} onClose={() => setStarting(false)} cls={cls} competencies={comps} students={students} />
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
