import clsx from 'clsx'
import { format, parseISO, startOfWeek, formatISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CalendarClock, CheckCircle2, Info, Play, Plus, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AiButton, AiTextSheet, AskSheet as AskClassSheet, DictationSheet } from '../components/AiSheets'
import { StartLessonSheet } from '../components/LessonSheets'
import { ai, classContext } from '../lib/ai'
import { QuickCapture, type CaptureContext } from '../components/QuickCapture'
import { Avatar, Button, Card, CoverageRing, Empty, ValenceDot } from '../components/ui'
import { alive, db } from '../lib/db'
import { useActiveClass, useCompetencies, useObservations, useStudents } from '../lib/hooks'
import { agoText, daysAgo, focusChildren, signals, studentStats, today } from '../lib/insights'
import { KIND_LABEL } from '../lib/seed'

export default function Cockpit() {
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

  const stats = useMemo(() => studentStats(students, obs), [students, obs])
  const focus = useMemo(() => focusChildren(stats, goals), [stats, goals])
  const sigs = useMemo(() => signals(students, obs, comps, goals), [students, obs, comps, goals])

  if (loading) return null
  if (!cls)
    return (
      <div className="mx-auto max-w-xl p-6">
        <Card>
          <h1 className="mb-2 text-xl font-semibold">Willkommen im Cockpit 👋</h1>
          <p className="mb-4 text-slate-600">Lege zuerst eine Klasse an (Jahrgangsstufe 1–4) und trage die Kinder ein.</p>
          <Link to="/einstellungen">
            <Button>Klasse anlegen</Button>
          </Link>
        </Card>
      </div>
    )

  const running = lessons.find((l) => l.status === 'laufend')
  const todays = lessons.filter((l) => l.date === today()).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const openDocs = lessons.filter((l) => l.status === 'laufend' && l.id !== running?.id)
  const weekStart = formatISO(startOfWeek(new Date(), { weekStartsOn: 1 }), { representation: 'date' })
  const week = obs.filter((o) => o.date >= weekStart)
  const weekKids = new Set(week.flatMap((o) => o.studentIds))
  const followUps = [
    ...obs.filter((o) => o.followUp && o.followUp <= daysAgo(-3)).map((o) => ({ id: o.id, date: o.followUp!, text: o.text || KIND_LABEL[o.kind], who: o.studentIds, obs: o })),
    ...goals.filter((g) => g.status === 'offen' && g.due && g.due <= daysAgo(-7)).map((g) => ({ id: g.id, date: g.due!, text: `Ziel: ${g.text}`, who: [g.studentId], obs: undefined })),
  ].sort((a, b) => a.date.localeCompare(b.date))

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
    <div className="mx-auto max-w-7xl min-w-0 space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}</p>
          <h1 className="text-2xl font-semibold">Cockpit · {cls.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <AiButton size="lg" onClick={() => setDictating(true)}>
            Diktat → Einträge
          </AiButton>
          <Button onClick={() => setCapture(ctxFor([]))} size="lg">
            <Plus size={18} /> Beobachtung
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* JETZT */}
        <Card title="Jetzt" className="lg:col-span-2">
          {running ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold">
                  {running.subject}
                  {running.topic && <span className="font-normal text-slate-500"> · {running.topic}</span>}
                </p>
                {running.focus && <p className="text-sm text-slate-600">Schwerpunkt: {running.focus}</p>}
                <p className="text-sm text-slate-400">läuft seit {format(parseISO(running.startedAt), 'HH:mm')} · {obs.filter((o) => o.lessonId === running.id).length} Einträge</p>
              </div>
              <Link to={`/unterricht/${running.id}`}>
                <Button size="lg">
                  <Play size={18} /> Zum Unterricht
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-slate-600">Keine laufende Stunde. Lege Fach, Thema und Beobachtungsschwerpunkt fest – dann im Sitzplan beobachten.</p>
              <Button size="lg" onClick={() => setStarting(true)}>
                <Play size={18} /> Stunde starten
              </Button>
            </div>
          )}
          {todays.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {todays.map((l) => (
                <Link
                  key={l.id}
                  to={`/unterricht/${l.id}`}
                  className={clsx('rounded-xl px-3 py-1.5 text-sm ring-1', l.status === 'abgeschlossen' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200')}
                >
                  {format(parseISO(l.startedAt), 'HH:mm')} {l.subject} · {l.status === 'abgeschlossen' ? 'dokumentiert' : 'Doku offen'}
                </Link>
              ))}
            </div>
          )}
          {openDocs.length > 0 && <p className="mt-2 text-sm text-amber-700">{openDocs.length} frühere Stunde(n) noch ohne Abschluss.</p>}
        </Card>

        {/* FOKUS */}
        <Card title="Heute im Fokus">
          <div className="space-y-2">
            {focus.map((s) => (
              <button key={s.student.id} onClick={() => setCapture(ctxFor([s.student.id]))} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50">
                <CoverageRing value={s.coverage}>
                  <Avatar student={s.student} size={34} />
                </CoverageRing>
                <div className="min-w-0">
                  <p className="font-medium">{s.student.firstName}</p>
                  <p className="text-xs text-slate-500">{agoText(s.days)}</p>
                </div>
              </button>
            ))}
            {!focus.length && <Empty>Noch keine Kinder – unter Einstellungen anlegen.</Empty>}
          </div>
        </Card>

        {/* SIGNALE */}
        <Card title="Signale" className="lg:col-span-2">
          <ul className="space-y-1.5">
            {sigs.slice(0, 8).map((s) => (
              <li key={s.id}>
                <Link to={s.studentId ? `/kinder/${s.studentId}` : '/klasse'} className="flex items-start gap-2 rounded-lg p-1.5 text-sm hover:bg-slate-50">
                  {s.tone === 'warn' ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-500" /> : s.tone === 'good' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <Info size={16} className="mt-0.5 shrink-0 text-sky-500" />}
                  {s.text}
                </Link>
              </li>
            ))}
            {!sigs.length && <Empty>Keine Auffälligkeiten.</Empty>}
          </ul>
        </Card>

        {/* WIEDERVORLAGEN */}
        <Card title="Wiedervorlagen">
          <ul className="space-y-2">
            {followUps.slice(0, 6).map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-sm">
                <CalendarClock size={16} className={clsx('mt-0.5 shrink-0', f.date <= today() ? 'text-rose-500' : 'text-slate-400')} />
                <button className="text-left" onClick={() => f.obs && setCapture({ ...ctxFor(f.obs.studentIds), edit: f.obs })}>
                  <b>{f.who.map(name).join(', ')}</b> · {format(parseISO(f.date), 'd.M.')} – {f.text}
                </button>
              </li>
            ))}
            {!followUps.length && <Empty>Nichts fällig.</Empty>}
          </ul>
        </Card>

        {/* ABDECKUNG */}
        <Card title="Abdeckung der Dokumentation" className="lg:col-span-2" action={<span className="text-xs text-slate-400">Aktualität · Breite · Menge</span>}>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
            {stats.map((s) => (
              <Link key={s.student.id} to={`/kinder/${s.student.id}`} className="flex flex-col items-center gap-1 text-center">
                <CoverageRing value={s.coverage} size={52}>
                  <Avatar student={s.student} size={40} />
                </CoverageRing>
                <span className="w-full truncate text-xs">{s.student.firstName}</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* WOCHE */}
        <Card title="Diese Woche">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat n={week.length} label="Einträge" />
            <Stat n={`${weekKids.size}/${students.length}`} label="Kinder" />
            <Stat n={week.filter((o) => o.valence === 'pos').length} label="positiv" />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            <Sparkles size={14} className="mr-1 inline text-brand-600" />
            {students.length - weekKids.size > 0
              ? `Noch ohne Eintrag diese Woche: ${students.filter((s) => !weekKids.has(s.id)).map((s) => s.firstName).join(', ')}`
              : 'Alle Kinder wurden diese Woche beobachtet.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <AiButton onClick={() => setWeekly(true)}>Wochenrückblick</AiButton>
            <AiButton onClick={() => setAsking(true)}>Frage zur Klasse</AiButton>
          </div>
        </Card>

        {/* ZULETZT */}
        <Card title="Zuletzt" className="lg:col-span-3">
          <ul className="divide-y divide-slate-100">
            {obs.slice(0, 8).map((o) => (
              <li key={o.id}>
                <button onClick={() => setCapture({ ...ctxFor(o.studentIds), edit: o })} className="flex w-full items-center gap-3 py-2 text-left">
                  <ValenceDot v={o.valence} />
                  <span className="w-28 shrink-0 truncate text-sm font-medium">{o.studentIds.map(name).join(', ')}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                    <span className="text-slate-400">{KIND_LABEL[o.kind]}{o.subject ? ` · ${o.subject}` : ''} – </span>
                    {o.text || (o.level ? comps.find((c) => c.id === o.competencyId)?.text : '') || (o.attachments.length ? '📎 Anhang' : '')}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{format(parseISO(o.createdAt), 'd.M. HH:mm')}</span>
                </button>
              </li>
            ))}
            {!obs.length && <Empty>Noch keine Beobachtungen.</Empty>}
          </ul>
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
      {starting && <StartLessonSheet open onClose={() => setStarting(false)} cls={cls} competencies={comps} students={students} />}
    </div>
  )
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <p className="text-xl font-semibold">{n}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
