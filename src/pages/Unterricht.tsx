import clsx from 'clsx'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { Eye, EyeOff, Grid3x3, LayoutGrid, Play, Square, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ReflectionSheet, StartLessonSheet } from '../components/LessonSheets'
import { QuickCapture, quickSave, type CaptureContext } from '../components/QuickCapture'
import { AttachmentView } from '../components/media'
import { toast } from '../components/toast'
import { Avatar, Button, Card, Empty, Segmented, ValenceDot } from '../components/ui'
import { alive, db, type Lesson, type Observation, type Student } from '../lib/db'
import { useActiveClass, useCompetencies, useObservations, useStudents } from '../lib/hooks'
import { latestLevels } from '../lib/insights'
import { KIND_LABEL, LEVEL_LABEL } from '../lib/seed'

export default function Unterricht() {
  const { id } = useParams()
  return id ? <LessonView id={id} /> : <LessonList />
}

function LessonList() {
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const comps = useCompetencies(cls)
  const [starting, setStarting] = useState(false)
  const [subject, setSubject] = useState('alle')
  const lessons = useLiveQuery(async () => (cls ? alive(await db.lessons.where('classId').equals(cls.id).toArray()).sort((a, b) => b.startedAt.localeCompare(a.startedAt)) : []), [cls?.id]) ?? []
  if (!cls) return null
  const subjects = [...new Set(lessons.map((l) => l.subject))]
  const shown = lessons.filter((l) => subject === 'alle' || l.subject === subject)
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Unterrichtstagebuch</h1>
        <Button size="lg" onClick={() => setStarting(true)}>
          <Play size={18} /> Stunde starten
        </Button>
      </div>
      {subjects.length > 1 && <Segmented value={subject} onChange={setSubject} options={[{ value: 'alle', label: 'Alle' }, ...subjects.map((s) => ({ value: s, label: s }))]} />}
      <div className="space-y-2">
        {shown.map((l) => (
          <Link key={l.id} to={`/unterricht/${l.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <span className={clsx('size-3 shrink-0 rounded-full', l.status === 'laufend' ? 'animate-pulse bg-brand-500' : { gruen: 'bg-emerald-500', gelb: 'bg-amber-400', rot: 'bg-rose-500' }[l.reflection?.rating ?? 'gruen'])} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {l.subject} {l.topic && <span className="font-normal text-slate-500">· {l.topic}</span>}
              </p>
              <p className="truncate text-sm text-slate-500">{l.reflection?.note || l.focus || (l.status === 'laufend' ? 'läuft / Doku offen' : '')}</p>
            </div>
            <span className="shrink-0 text-sm text-slate-400">{format(parseISO(l.startedAt), 'EE d.M.', { locale: de })}</span>
          </Link>
        ))}
        {!shown.length && <Empty>Noch keine Stunden dokumentiert.</Empty>}
      </div>
      {starting && <StartLessonSheet open onClose={() => setStarting(false)} cls={cls} competencies={comps} students={students} />}
    </div>
  )
}

function useElapsed(start: string) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])
  return Math.round((Date.now() - parseISO(start).getTime()) / 60000)
}

function LessonView({ id }: { id: string }) {
  const lesson = useLiveQuery(() => db.lessons.get(id), [id])
  const { cls } = useActiveClass()
  const students = useStudents(lesson?.classId)
  const obs = useObservations(lesson?.classId)
  const comps = useCompetencies(cls)
  if (!lesson || !cls) return null
  return lesson.status === 'laufend' ? (
    <LiveMode lesson={lesson} students={students} obs={obs} comps={comps} gradeLevel={cls.gradeLevel} />
  ) : (
    <LessonDetail lesson={lesson} students={students} obs={obs} />
  )
}

function LiveMode({ lesson, students, obs, comps, gradeLevel }: { lesson: Lesson; students: Student[]; obs: Observation[]; comps: ReturnType<typeof useCompetencies>; gradeLevel: 1 | 2 | 3 | 4 }) {
  const plan = useLiveQuery(async () => alive(await db.seatingPlans.where('classId').equals(lesson.classId).toArray())[0], [lesson.classId])
  const [view, setView] = useState<'sitzplan' | 'raster'>('sitzplan')
  const [discreet, setDiscreet] = useState(false)
  const [multi, setMulti] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [capture, setCapture] = useState<CaptureContext | null>(null)
  const [ending, setEnding] = useState(false)
  const elapsed = useElapsed(lesson.startedAt)

  const inLesson = useMemo(() => obs.filter((o) => o.lessonId === lesson.id), [obs, lesson.id])
  const focusComps = comps.filter((c) => lesson.focusCompetencyIds.includes(c.id))
  const visible = lesson.focusStudentIds.length ? students.filter((s) => lesson.focusStudentIds.includes(s.id)) : students

  const ctx = (studentIds: string[]): CaptureContext => ({
    classId: lesson.classId,
    gradeLevel,
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

  const tile = (s: Student) => {
    const mine = inLesson.filter((o) => o.studentIds.includes(s.id))
    const sel = selected.includes(s.id)
    const dim = lesson.focusStudentIds.length > 0 && !lesson.focusStudentIds.includes(s.id)
    return (
      <button
        key={s.id}
        onClick={() => tap(s)}
        className={clsx(
          'flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl bg-white p-2 shadow-sm ring-1 transition active:scale-95',
          sel ? 'ring-2 ring-brand-600' : 'ring-slate-200',
          dim && 'opacity-40',
        )}
      >
        <Avatar student={s} size={44} />
        <span className="max-w-full truncate text-sm font-medium">{s.firstName}</span>
        <span className="flex h-2.5 gap-1">
          {mine.slice(0, 5).map((o) => (
            <ValenceDot key={o.id} v={o.valence} />
          ))}
        </span>
      </button>
    )
  }

  return (
    <div className={clsx('flex h-full flex-col', discreet && 'discreet')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {lesson.subject} {lesson.topic && <span className="font-normal text-slate-500">· {lesson.topic}</span>}
          </p>
          <p className="blur-sensitive truncate text-sm text-slate-500">
            {elapsed} min · {inLesson.length} Einträge{lesson.focus ? ` · Schwerpunkt: ${lesson.focus}` : ''}
          </p>
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'sitzplan', label: <LayoutGrid size={16} /> },
            { value: 'raster', label: <Grid3x3 size={16} /> },
          ]}
        />
        <Button variant={multi ? 'primary' : 'secondary'} size="sm" onClick={() => (setMulti((m) => !m), setSelected([]))}>
          <Users size={16} /> Mehrere
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setDiscreet((d) => !d)} aria-label="Diskret">
          {discreet ? <EyeOff size={16} /> : <Eye size={16} />}
        </Button>
        <Button variant="danger" size="sm" onClick={() => setEnding(true)}>
          <Square size={14} /> Beenden
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {view === 'sitzplan' ? (
          plan && plan.seats.length ? (
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${plan.cols}, minmax(84px, 1fr))`, gridAutoRows: '110px' }}>
              {Array.from({ length: plan.rows * plan.cols }, (_, i) => {
                const x = i % plan.cols
                const y = Math.floor(i / plan.cols)
                const seat = plan.seats.find((p) => p.x === x && p.y === y)
                const s = seat && students.find((st) => st.id === seat.studentId)
                return <div key={i}>{s ? tile(s) : null}</div>
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7" style={{ gridAutoRows: '110px' }}>
                {visible.map(tile)}
              </div>
              <p className="mt-4 text-center text-sm text-slate-400">
                Tipp: Unter <Link to="/einstellungen" className="underline">Einstellungen → Sitzplan</Link> lässt sich der Raum abbilden.
              </p>
            </>
          )
        ) : (
          <CriteriaGrid lesson={lesson} students={visible} focusComps={focusComps} obs={obs} onCell={(s) => setCapture(ctx([s.id]))} />
        )}
      </div>

      {multi && selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center md:bottom-6">
          <Button size="lg" onClick={() => setCapture(ctx(selected))} className="shadow-lg">
            Beobachtung für {selected.length} Kinder
          </Button>
        </div>
      )}

      <QuickCapture
        ctx={capture}
        onClose={() => {
          setCapture(null)
          setSelected([])
        }}
      />
      <ReflectionSheet lesson={lesson} open={ending} onClose={() => setEnding(false)} students={students} observations={obs} />
    </div>
  )
}

/** Systematische Beobachtung: Kind × Kriterium, ein Tipp = Stufe weiterschalten. */
function CriteriaGrid({ lesson, students, focusComps, obs, onCell }: { lesson: Lesson; students: Student[]; focusComps: ReturnType<typeof useCompetencies>; obs: Observation[]; onCell: (s: Student) => void }) {
  const latest = latestLevels(obs.filter((o) => o.lessonId === lesson.id))
  const before = latestLevels(obs.filter((o) => o.lessonId !== lesson.id))
  if (!focusComps.length)
    return (
      <Card>
        <Empty>Für das Raster beim Stundenstart Kompetenzen als Schwerpunkt wählen. Kindernamen antippen öffnet die freie Erfassung.</Empty>
        <div className="flex flex-wrap justify-center gap-2">
          {students.map((s) => (
            <Button key={s.id} variant="secondary" size="sm" onClick={() => onCell(s)}>
              {s.firstName}
            </Button>
          ))}
        </div>
      </Card>
    )
  const set = async (s: Student, compId: string, current?: number) => {
    const level = ((current ?? 0) % 4) + 1
    const c = focusComps.find((x) => x.id === compId)!
    await quickSave({ classId: lesson.classId, studentIds: [s.id], lessonId: lesson.id, kind: 'lernstand', valence: level >= 3 ? 'pos' : level === 1 ? 'neg' : 'neu', subject: c.subject, competencyId: compId, level: level as 1 | 2 | 3 | 4, text: '' })
    toast(`${s.firstName}: ${LEVEL_LABEL[level]}`)
  }
  const colors = ['bg-slate-50 text-slate-300', 'bg-rose-100 text-rose-800', 'bg-amber-100 text-amber-800', 'bg-lime-100 text-lime-800', 'bg-emerald-100 text-emerald-800']
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white p-3 text-left font-medium">Kind</th>
            {focusComps.map((c) => (
              <th key={c.id} className="min-w-36 p-3 text-left text-xs font-medium text-slate-500">
                {c.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="border-t border-slate-100">
              <td className="sticky left-0 bg-white p-2">
                <button onClick={() => onCell(s)} className="flex items-center gap-2 font-medium">
                  <Avatar student={s} size={28} /> {s.firstName}
                </button>
              </td>
              {focusComps.map((c) => {
                const cur = latest.get(`${s.id}:${c.id}`)?.level
                const prev = before.get(`${s.id}:${c.id}`)?.level
                return (
                  <td key={c.id} className="p-1.5">
                    <button onClick={() => set(s, c.id, cur)} className={clsx('h-11 w-full rounded-lg text-xs font-semibold', colors[cur ?? 0])}>
                      {cur ? LEVEL_LABEL[cur] : prev ? <span className="text-slate-400">zuvor: {LEVEL_LABEL[prev]}</span> : '–'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LessonDetail({ lesson, students, obs }: { lesson: Lesson; students: Student[]; obs: Observation[] }) {
  const [editing, setEditing] = useState(false)
  const inLesson = obs.filter((o) => o.lessonId === lesson.id)
  const name = (id: string) => students.find((s) => s.id === id)?.firstName ?? '?'
  const r = lesson.reflection
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <Link to="/unterricht" className="text-sm text-slate-500">
        ← Unterrichtstagebuch
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">
          {lesson.subject} · {format(parseISO(lesson.startedAt), 'EEEE d.M.yyyy', { locale: de })}
        </h1>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Abschluss bearbeiten
        </Button>
      </div>
      <Card title="Stunde">
        <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-slate-500">Thema</dt>
          <dd>{lesson.topic || '–'}</dd>
          <dt className="text-slate-500">Gemacht</dt>
          <dd>{r?.whatWasDone || '–'}</dd>
          <dt className="text-slate-500">Schwerpunkt</dt>
          <dd>{lesson.focus || '–'}</dd>
          <dt className="text-slate-500">Verlauf</dt>
          <dd>
            {r?.rating && <span className={clsx('mr-2 inline-block size-3 rounded-full', { gruen: 'bg-emerald-500', gelb: 'bg-amber-400', rot: 'bg-rose-500' }[r.rating])} />}
            Ziel erreicht: {r?.goalReached ?? '–'}
          </dd>
          <dt className="text-slate-500">Reflexion</dt>
          <dd className="whitespace-pre-wrap">{r?.note || '–'}</dd>
          <dt className="text-slate-500">Nächstes Mal</dt>
          <dd>{r?.nextTime || '–'}</dd>
        </dl>
        {!!lesson.attachments?.length && (
          <div className="mt-3 flex gap-2">
            {lesson.attachments.map((a) => (
              <AttachmentView key={a.id} a={a} className="h-32 rounded-lg object-cover" />
            ))}
          </div>
        )}
      </Card>
      <Card title={`Beobachtungen (${inLesson.length})`}>
        <ul className="divide-y divide-slate-100">
          {inLesson.map((o) => (
            <li key={o.id} className="flex items-start gap-3 py-2 text-sm">
              <ValenceDot v={o.valence} />
              <span className="w-28 shrink-0 font-medium">{o.studentIds.map(name).join(', ')}</span>
              <span className="text-slate-600">
                <span className="text-slate-400">{KIND_LABEL[o.kind]} – </span>
                {o.text || (o.level ? LEVEL_LABEL[o.level] : '')}
              </span>
            </li>
          ))}
          {!inLesson.length && <Empty>Keine Einträge in dieser Stunde.</Empty>}
        </ul>
      </Card>
      <ReflectionSheet lesson={lesson} open={editing} onClose={() => setEditing(false)} students={students} observations={obs} />
    </div>
  )
}
