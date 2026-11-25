import clsx from 'clsx'
import { format, parseISO } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, Camera, Check, CheckCheck, Inbox, Loader2, Paperclip, Play, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alive, db, isGroup, now, save, uid, type Attachment, type Competency, type Lesson, type ObsKind, type Observation, type SchoolClass, type Student, type Valence } from '../lib/db'
import { todaysSlots, useClass, useClasses, useCompetencies, useNow, usePeriods, useStudents, useTimetable } from '../lib/hooks'
import { today } from '../lib/insights'
import { KIND_LABEL, SUBJECTS_BY_GRADE } from '../lib/seed'
import { ClassDot } from './ClassSwitcher'
import { AttachmentView, compressImage } from './media'
import { groupBy } from './QuickCapture'
import { toast } from './toast'
import { Avatar, Button, Field, inputCls, Segmented, Sheet } from './ui'

/** Farbpunkt je Fach – für Listen, Chips und Kopfzeilen. */
export function subjectDot(subject: string) {
  const s = subject.toLowerCase()
  if (s.startsWith('mathe')) return 'bg-sky-500'
  if (s.startsWith('deutsch')) return 'bg-rose-500'
  if (s.startsWith('hsu')) return 'bg-emerald-500'
  if (s.startsWith('englisch')) return 'bg-cyan-500'
  if (s.startsWith('sport')) return 'bg-amber-500'
  if (s.startsWith('musik')) return 'bg-violet-500'
  if (s.startsWith('kunst')) return 'bg-fuchsia-500'
  if (s.startsWith('werken')) return 'bg-orange-500'
  if (s.startsWith('relig') || s.startsWith('ethik')) return 'bg-indigo-500'
  return 'bg-slate-400'
}

export const RATING_DOT = { gruen: 'bg-emerald-500', gelb: 'bg-amber-400', rot: 'bg-rose-500' } as const
export const RATING_LABEL = { gruen: 'gut', gelb: 'gemischt', rot: 'schwierig' } as const

/** Neueste laufende Stunde einer Klasse. */
export function latestRunning(lessons: Lesson[]) {
  return lessons.filter((l) => l.status === 'laufend').sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

function defaultSubject(subjects: string[]) {
  return subjects.includes('Mathematik') ? 'Mathematik' : (subjects[0] ?? 'Mathematik')
}

export function StartLessonSheet({
  open,
  onClose,
  cls,
  competencies,
  students,
  initialClassId,
  initialSubject,
}: {
  open: boolean
  onClose: () => void
  /** Aktive Klasse/Gruppe (Rückfall, wenn nichts vorgewählt ist) */
  cls: SchoolClass
  competencies?: Competency[]
  students?: Student[]
  /** Vorgewählte Klasse/Gruppe, z. B. aus dem Stundenplan */
  initialClassId?: string
  /** Vorgewähltes Fach, z. B. aus dem Stundenplan */
  initialSubject?: string
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Stunde starten" wide>
      {open && <StartLessonForm onClose={onClose} cls={cls} competencies={competencies} students={students} initialClassId={initialClassId} initialSubject={initialSubject} />}
    </Sheet>
  )
}

function StartLessonForm({
  onClose,
  cls: activeCls,
  competencies: activeComps,
  students: activeStudents,
  initialClassId,
  initialSubject,
}: {
  onClose: () => void
  cls: SchoolClass
  competencies?: Competency[]
  students?: Student[]
  initialClassId?: string
  initialSubject?: string
}) {
  const nav = useNavigate()
  const classes = useClasses()
  const slotsNow = todaysSlots(useTimetable(), usePeriods(), useNow())
  const known = (id?: string) => !!id && (!classes || classes.some((c) => c.id === id))
  const currentSlot = slotsNow.find((x) => x.state === 'jetzt' && known(x.slot.classId)) ?? slotsNow.find((x) => x.state === 'gleich' && known(x.slot.classId))

  // Gewählte Klasse/Gruppe: explizit gewählt → vorgegeben → Stundenplan (jetzt/gleich) → aktive Klasse
  const [pickedClassId, setPickedClassId] = useState<string | null>(null)
  const classId = pickedClassId ?? (known(initialClassId) ? initialClassId! : currentSlot?.slot.classId ?? activeCls.id)
  const loadedCls = useClass(classId)
  const cls = loadedCls ?? classes?.find((c) => c.id === classId) ?? activeCls
  const loadedStudents = useStudents(classId)
  const loadedComps = useCompetencies(cls)
  const isActive = cls.id === activeCls.id
  const students = isActive && activeStudents && !loadedStudents.length ? activeStudents : loadedStudents
  const competencies = isActive && activeComps && !loadedComps.length ? activeComps : loadedComps

  const presetSubject =
    classId === initialClassId && initialSubject ? initialSubject : !initialClassId && initialSubject && isActive ? initialSubject : currentSlot && currentSlot.slot.classId === classId ? currentSlot.slot.subject : undefined
  const baseSubjects = cls.subjects.length ? cls.subjects : SUBJECTS_BY_GRADE[cls.gradeLevel]
  const subjects = presetSubject && !baseSubjects.includes(presetSubject) ? [...baseSubjects, presetSubject] : baseSubjects
  const [pickedSubject, setPickedSubject] = useState<string | null>(null)
  const subject = pickedSubject && subjects.includes(pickedSubject) ? pickedSubject : (presetSubject ?? defaultSubject(subjects))
  const setSubject = (s: string) => setPickedSubject(s)
  const [topic, setTopic] = useState('')
  const [focus, setFocus] = useState('')
  const [focusCompetencyIds, setFocusCompetencyIds] = useState<string[]>([])
  const [focusStudentIds, setFocusStudentIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const pickClass = (id: string) => {
    if (id === classId) return
    setPickedClassId(id)
    setPickedSubject(null)
    setFocusCompetencyIds([])
    setFocusStudentIds([])
  }

  // Bereits laufende Stunde dieser Klasse/Gruppe (neueste)
  const running = useLiveQuery(async () => latestRunning(alive(await db.lessons.where('classId').equals(cls.id).toArray())), [cls.id])

  // Notiz „für nächstes Mal“ aus der letzten Stunde des Fachs
  const lastNote = useLiveQuery(async () => {
    const ls = alive(await db.lessons.where('classId').equals(cls.id).toArray())
      .filter((l) => l.subject === subject && l.reflection?.nextTime)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    return ls[0]
  }, [cls.id, subject])

  const comps = competencies.filter((c) => c.subject === subject)

  const start = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      // Laufende Stunden der Klasse beenden (Abschluss lässt sich später nachtragen)
      const open = alive(await db.lessons.where('classId').equals(cls.id).toArray()).filter((l) => l.status === 'laufend')
      for (const l of open) await save(db.lessons, { ...l, status: 'abgeschlossen', endedAt: l.endedAt ?? now() })
      const lesson: Lesson = {
        id: uid(),
        classId: cls.id,
        date: today(),
        subject,
        topic: topic.trim(),
        focus: focus.trim(),
        focusCompetencyIds,
        focusStudentIds,
        status: 'laufend',
        startedAt: now(),
        updatedAt: now(),
      }
      await save(db.lessons, lesson)
      onClose()
      nav(`/unterricht/${lesson.id}`)
    } catch {
      toast('Stunde konnte nicht gestartet werden')
      busyRef.current = false
      setBusy(false)
    }
  }

  const chip = (on: boolean) => (on ? 'bg-brand-600 !text-[#fff] ring-brand-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')

  return (
    <div className="space-y-5">
      {classes && classes.length > 1 && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-slate-600">Klasse / Gruppe</p>
          <div className="flex flex-wrap gap-1.5">
            {classes.map((c) => {
              const on = c.id === cls.id
              const slotHere = currentSlot?.slot.classId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickClass(c.id)}
                  className={clsx('inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium ring-1 transition', on ? 'bg-slate-900 !text-[#fff] ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')}
                >
                  <ClassDot c={c} className={on ? 'ring-2 ring-white/70' : undefined} />
                  {isGroup(c) ? c.name : `Klasse ${c.name}`}
                  {slotHere && <span className={clsx('text-[11px] font-normal', on ? 'text-white/70' : 'text-slate-400')}>{currentSlot!.state === 'jetzt' ? '· jetzt' : '· gleich'}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {running && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-200/70">
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
          </span>
          <p className="min-w-0 flex-1 text-sm text-amber-900">
            <b>{running.subject}</b> läuft noch seit {format(parseISO(running.startedAt), 'HH:mm')} Uhr.
            <span className="block text-amber-800/80">Beim Start wird sie beendet – den Abschluss kannst du später nachtragen.</span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onClose()
              nav(`/unterricht/${running.id}`)
            }}
          >
            Fortsetzen
          </Button>
        </div>
      )}

      <div>
        <p className="mb-2 text-[13px] font-medium text-slate-600">Fach</p>
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => (setSubject(s), setFocusCompetencyIds([]))}
              className={clsx('inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium ring-1 transition', chip(subject === s))}
            >
              <span className={clsx('size-2 rounded-full', subject === s ? 'bg-white' : subjectDot(s))} />
              {s}
            </button>
          ))}
        </div>
      </div>

      {lastNote?.reflection?.nextTime && (
        <div className="rounded-2xl bg-amber-50 p-3.5 text-sm text-amber-900 ring-1 ring-amber-200/60">
          <p className="mb-0.5 text-[11px] font-semibold tracking-wider text-amber-700 uppercase">Für diese Stunde notiert</p>
          {lastNote.reflection.nextTime}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thema">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} className={inputCls} placeholder="z. B. Zehnerübergang" />
        </Field>
        <Field label="Beobachtungsschwerpunkt (optional)">
          <input value={focus} onChange={(e) => setFocus(e.target.value)} className={inputCls} placeholder="z. B. Welche Strategie nutzen die Kinder?" />
        </Field>
      </div>

      {comps.length > 0 && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-slate-600">
            Kompetenzen, die ich heute einschätze {focusCompetencyIds.length > 0 && <span className="text-brand-700">· {focusCompetencyIds.length} gewählt</span>}
          </p>
          <div className="max-h-56 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
            {Object.entries(groupBy(comps, (c) => c.area)).map(([area, cs]) => (
              <div key={area}>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{area}</p>
                <div className="flex flex-wrap gap-1.5">
                  {cs.map((c) => {
                    const on = focusCompetencyIds.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setFocusCompetencyIds((ids) => (on ? ids.filter((x) => x !== c.id) : [...ids, c.id]))}
                        className={clsx('min-h-9 rounded-lg px-2.5 py-1.5 text-left text-xs ring-1 transition', chip(on))}
                      >
                        {c.text}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[13px] font-medium text-slate-600">
          Gezielt beobachten <span className="font-normal text-slate-400">(optional, sonst ganze Klasse)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {students.map((s) => {
            const on = focusStudentIds.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFocusStudentIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                className={clsx('inline-flex h-10 items-center gap-2 rounded-full py-1 pr-3.5 pl-1 text-sm ring-1 transition', chip(on))}
              >
                <Avatar student={s} size={28} />
                {s.firstName}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Abbrechen
        </Button>
        <Button size="lg" onClick={start} disabled={busy}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          {running ? 'Beenden & neu starten' : "Los geht's"}
        </Button>
      </div>
    </div>
  )
}

export function ReflectionSheet({ lesson, open, onClose, students, observations }: { lesson: Lesson; open: boolean; onClose: () => void; students: Student[]; observations: Observation[] }) {
  return (
    <Sheet open={open} onClose={onClose} title={lesson.status === 'laufend' ? 'Stundenabschluss' : 'Abschluss bearbeiten'} wide>
      {open && <ReflectionForm lesson={lesson} onClose={onClose} students={students} observations={observations} />}
    </Sheet>
  )
}

function ReflectionForm({ lesson, onClose, students: propStudents, observations }: { lesson: Lesson; onClose: () => void; students: Student[]; observations: Observation[] }) {
  const nav = useNavigate()
  const r = lesson.reflection ?? {}
  const finishing = lesson.status === 'laufend'
  const ctxStudents = useStudents(lesson.classId)
  const students = ctxStudents.length ? ctxStudents : propStudents
  const [whatWasDone, setWhat] = useState(r.whatWasDone ?? lesson.topic)
  const [rating, setRating] = useState(r.rating ?? 'gruen')
  const [goalReached, setGoal] = useState(r.goalReached ?? 'ja')
  const [note, setNote] = useState(r.note ?? '')
  const [nextTime, setNext] = useState(r.nextTime ?? '')
  const [attachments, setAttachments] = useState<Attachment[]>(lesson.attachments ?? [])
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

  const inLesson = observations.filter((o) => o.lessonId === lesson.id)
  const seen = new Set(inLesson.flatMap((o) => o.studentIds))
  const notable = students.filter((s) => inLesson.some((o) => o.studentIds.includes(s.id) && o.valence !== 'neu'))
  const hasFocus = lesson.focusStudentIds.length > 0
  const target = hasFocus ? students.filter((s) => lesson.focusStudentIds.includes(s.id)) : students
  const unseen = target.filter((s) => !seen.has(s.id))
  const unsorted = inLesson.filter((o) => o.unsorted)

  // Stundenende-Durchgang: Kinder ohne Eintrag (beim Öffnen festgehalten, damit die Liste nicht springt)
  const [sweepIds] = useState(() => new Set(unseen.map((s) => s.id)))
  const sweepKids = target.filter((s) => sweepIds.has(s.id))
  const [step, setStep] = useState<'durchgang' | 'reflexion'>(finishing && (unseen.length > 0 || unsorted.length > 0) ? 'durchgang' : 'reflexion')
  const [seenOk, setSeenOk] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [noteOpen, setNoteOpen] = useState<string | null>(null)

  const toggleSeen = (id: string) =>
    setSeenOk((set) => {
      const next = new Set(set)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const sweepObservation = (studentIds: string[], text: string, seenOnly: boolean): Observation => ({
    id: uid(),
    classId: lesson.classId,
    studentIds,
    lessonId: lesson.id,
    date: lesson.date || today(),
    createdAt: now(),
    updatedAt: now(),
    kind: 'beobachtung',
    valence: 'neu',
    subject: lesson.subject,
    text,
    tags: [],
    attachments: [],
    ...(seenOnly ? { seenOnly: true } : {}),
  })

  /** Erfasste Durchgangs-Einträge speichern (einmalig). */
  const savedSweep = useRef(false)
  const saveSweep = async () => {
    if (savedSweep.current) return
    savedSweep.current = true
    for (const s of sweepKids) {
      const text = notes[s.id]?.trim()
      if (text) await save(db.observations, sweepObservation([s.id], text, false))
      else if (seenOk.has(s.id)) await save(db.observations, sweepObservation([s.id], 'gesehen, unauffällig', true))
    }
  }

  const done = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (finishing) await saveSweep()
      // aktuellen Stand lesen, damit parallele Änderungen nicht überschrieben werden
      const fresh = (await db.lessons.get(lesson.id)) ?? lesson
      await save(db.lessons, {
        ...fresh,
        status: 'abgeschlossen',
        endedAt: fresh.endedAt ?? now(),
        reflection: { whatWasDone, rating, goalReached, note, nextTime },
        attachments,
      })
      toast(finishing ? 'Stunde dokumentiert' : 'Abschluss gespeichert')
      onClose()
      if (finishing) nav('/')
    } catch {
      toast('Speichern fehlgeschlagen')
      setBusy(false)
    }
  }

  const marked = sweepKids.filter((s) => seenOk.has(s.id) || notes[s.id]?.trim()).length

  if (step === 'durchgang')
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] !text-[#fff]">1</span> Durchgang
          <span className="h-px w-6 bg-slate-200" />
          <span className="flex size-5 items-center justify-center rounded-full bg-slate-200 text-[11px] text-slate-600">2</span> Reflexion
        </div>

        {sweepKids.length > 0 && (
          <div>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[15px] font-semibold tracking-tight text-slate-900">Stundenende-Durchgang</p>
                <p className="text-sm text-slate-500">
                  {hasFocus ? 'Fokuskinder' : 'Kinder'} ohne Eintrag in dieser Stunde · {marked}/{sweepKids.length} erfasst. Tippen = „gesehen, unauffällig“.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setSeenOk(new Set(sweepKids.map((s) => s.id)))}>
                <CheckCheck size={15} /> Alle gesehen
              </Button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
              {sweepKids.map((s) => {
                const ok = seenOk.has(s.id)
                const hasNote = !!notes[s.id]?.trim()
                const editing = noteOpen === s.id
                return (
                  <div key={s.id} className={clsx('rounded-2xl p-2 ring-1 transition', hasNote ? 'bg-sky-50 ring-sky-200' : ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-slate-200')}>
                    <button type="button" aria-pressed={ok} onClick={() => toggleSeen(s.id)} className="flex min-h-11 w-full items-center gap-2 rounded-xl text-left">
                      <span className="relative">
                        <Avatar student={s} size={34} />
                        {(ok || hasNote) && (
                          <span className={clsx('absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full ring-2 ring-white', hasNote ? 'bg-sky-500' : 'bg-emerald-500')}>
                            <Check size={10} className="!text-[#fff]" strokeWidth={3} />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{s.firstName}</span>
                        <span className="block truncate text-[11px] text-slate-500">{hasNote ? 'Notiz' : ok ? 'gesehen, unauffällig' : 'offen'}</span>
                      </span>
                    </button>
                    {editing ? (
                      <input
                        autoFocus
                        value={notes[s.id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                        onBlur={() => setNoteOpen(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setNoteOpen(null)}
                        placeholder="kurze Notiz …"
                        className={clsx(inputCls, 'mt-1.5 h-9 text-sm')}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setNoteOpen(s.id)}
                        className="mt-1 flex h-8 w-full items-center justify-center gap-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      >
                        {hasNote ? <span className="truncate px-1 text-slate-700">{notes[s.id]}</span> : <><Plus size={13} /> Notiz</>}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {unsorted.length > 0 && <UnsortedList items={unsorted} students={students} />}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="ghost" size="lg" onClick={onClose}>
            Abbrechen
          </Button>
          <Button size="lg" onClick={() => setStep('reflexion')}>
            Weiter <ArrowRight size={18} />
          </Button>
        </div>
      </div>
    )

  const stillUnseen = unseen.filter((s) => !seenOk.has(s.id) && !notes[s.id]?.trim())
  const hadSweep = finishing && (sweepKids.length > 0 || unsorted.length > 0)

  return (
    <div className="space-y-5">
      {hadSweep && (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <button type="button" onClick={() => setStep('durchgang')} className="inline-flex items-center gap-2 hover:text-slate-700">
            <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 !text-[#fff]">
              <Check size={11} strokeWidth={3} />
            </span>
            Durchgang{marked > 0 && ` · ${marked}`}
          </button>
          <span className="h-px w-6 bg-slate-200" />
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] !text-[#fff]">2</span> <span className="text-slate-700">Reflexion</span>
        </div>
      )}
      {!finishing && unsorted.length > 0 && <UnsortedList items={unsorted} students={students} />}
      <Field label="Was wurde gemacht?">
        <textarea value={whatWasDone} onChange={(e) => setWhat(e.target.value)} rows={2} className={inputCls} />
      </Field>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div>
          <p className="mb-2 text-[13px] font-medium text-slate-600">Wie lief es?</p>
          <div className="flex gap-2.5">
            {(['gruen', 'gelb', 'rot'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setRating(c)}
                aria-pressed={rating === c}
                aria-label={RATING_LABEL[c]}
                title={RATING_LABEL[c]}
                className={clsx('size-11 rounded-full ring-offset-2 ring-offset-white transition', RATING_DOT[c], rating === c ? 'scale-105 ring-2 ring-slate-900' : 'opacity-60 hover:opacity-100')}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-slate-600">Ziel erreicht?</p>
          <Segmented value={goalReached} onChange={setGoal} options={[{ value: 'ja', label: 'ja' }, { value: 'teilweise', label: 'teilweise' }, { value: 'nein', label: 'nein' }]} />
        </div>
      </div>
      <Field label="Reflexion – was würde ich anders machen?">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputCls} placeholder="z. B. Erklärphase zu lang, Material für Gruppe Rot zu schwer" />
      </Field>
      <Field label="Für nächstes Mal" hint="Erscheint beim nächsten Start in diesem Fach.">
        <input value={nextTime} onChange={(e) => setNext(e.target.value)} className={inputCls} />
      </Field>

      <div>
        <p className="mb-2 text-[13px] font-medium text-slate-600">Tafelbild</p>
        <div className="flex flex-wrap items-center gap-3">
          {attachments.map((a) => (
            <div key={a.id} className="relative">
              <AttachmentView a={a} owner={{ table: 'lessons', id: lesson.id }} className="size-20 rounded-xl object-cover ring-1 ring-slate-200" />
              <button
                type="button"
                onClick={() => setAttachments((list) => list.filter((x) => x.id !== a.id))}
                aria-label="Foto entfernen"
                className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-slate-900 !text-[#fff] shadow ring-2 ring-white"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <label className="inline-flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 text-xs font-medium text-slate-500 ring-1 ring-slate-200 ring-dashed hover:bg-slate-100">
            {photoBusy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            Foto
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const input = e.currentTarget
                const f = input.files?.[0]
                input.value = ''
                if (!f) return
                setPhotoBusy(true)
                try {
                  const blob = await compressImage(f)
                  setAttachments((a) => [...a, { id: uid(), type: 'image', mime: 'image/jpeg', blob }])
                } catch {
                  toast('Foto konnte nicht geladen werden')
                } finally {
                  setPhotoBusy(false)
                }
              }}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Aufgefallen · {notable.length}</p>
          <div className="flex flex-wrap gap-2">
            {notable.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                <Avatar student={s} size={22} /> {s.firstName}
              </span>
            ))}
            {!notable.length && <span className="text-sm text-slate-400">–</span>}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            {hasFocus ? 'Fokuskinder ohne Eintrag' : 'Heute ohne Eintrag'} · {stillUnseen.length}
          </p>
          <p className="text-sm text-slate-600">{stillUnseen.map((s) => s.firstName).join(', ') || (hasFocus ? 'Alle Fokuskinder dokumentiert.' : 'Alle Kinder dokumentiert.')}</p>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="ghost" size="lg" onClick={onClose}>
          Abbrechen
        </Button>
        <Button size="lg" onClick={done} disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" />}
          {finishing ? 'Stunde abschließen' : 'Speichern'}
        </Button>
      </div>
    </div>
  )
}

const SORT_KINDS: ObsKind[] = ['beobachtung', 'lernstand', 'arbeitsverhalten', 'sozialverhalten', 'staerke', 'foerderbedarf', 'zitat', 'arbeitsprobe']
const SORT_VALENCE: { value: Valence; label: string }[] = [
  { value: 'pos', label: '+' },
  { value: 'neu', label: '○' },
  { value: 'neg', label: '–' },
]

/** Roh erfasste Einträge dieser Stunde schnell einsortieren (Art + Tendenz). */
function UnsortedList({ items, students }: { items: Observation[]; students: Student[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const name = (id: string) => students.find((s) => s.id === id)
  return (
    <div className="rounded-2xl bg-amber-50/60 p-3.5 ring-1 ring-amber-200/60">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-amber-700 uppercase">
        <Inbox size={13} /> Unsortiert · {items.length}
      </p>
      <ul className="space-y-2">
        {items.map((o) => {
          const kids = o.studentIds.map(name).filter((s): s is Student => !!s)
          return (
            <li key={o.id} className="rounded-xl bg-white p-2.5 ring-1 ring-amber-100">
              <div className="flex items-center gap-2.5">
                {kids[0] ? <Avatar student={kids[0]} size={28} /> : <span className="size-7 shrink-0 rounded-full bg-slate-100" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{kids.map((k) => k.firstName).join(', ') || 'ohne Kind'}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                    {o.attachments.length > 0 && <Paperclip size={12} className="shrink-0" />}
                    {o.text || (o.attachments.length ? 'Anhang' : '–')}
                  </p>
                </div>
                {o.attachments[0] && <AttachmentView a={o.attachments[0]} owner={{ table: 'observations', id: o.id }} className="size-11 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />}
                {openId !== o.id && (
                  <Button variant="secondary" size="sm" onClick={() => setOpenId(o.id)}>
                    Einsortieren
                  </Button>
                )}
              </div>
              {openId === o.id && <SortPicker obs={o} onDone={() => setOpenId(null)} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SortPicker({ obs, onDone }: { obs: Observation; onDone: () => void }) {
  const [kind, setKind] = useState<ObsKind>(obs.kind)
  const [valence, setValence] = useState<Valence>(obs.valence)
  const [busy, setBusy] = useState(false)
  const apply = async () => {
    setBusy(true)
    try {
      const fresh = (await db.observations.get(obs.id)) ?? obs
      await save(db.observations, { ...fresh, kind, valence, unsorted: false })
      toast('Einsortiert')
      onDone()
    } catch {
      toast('Speichern fehlgeschlagen')
      setBusy(false)
    }
  }
  return (
    <div className="mt-2.5 space-y-2.5 border-t border-slate-100 pt-2.5">
      <div className="flex flex-wrap gap-1.5">
        {SORT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={clsx('h-9 rounded-lg px-2.5 text-xs font-medium ring-1 transition', kind === k ? 'bg-brand-600 !text-[#fff] ring-brand-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={valence} onChange={setValence} options={SORT_VALENCE} />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDone}>
            Abbrechen
          </Button>
          <Button size="sm" onClick={apply} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Übernehmen
          </Button>
        </div>
      </div>
    </div>
  )
}
