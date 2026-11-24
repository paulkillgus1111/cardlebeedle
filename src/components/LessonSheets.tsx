import clsx from 'clsx'
import { format, parseISO } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Loader2, Play, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alive, db, now, save, uid, type Attachment, type Competency, type Lesson, type Observation, type SchoolClass, type Student } from '../lib/db'
import { today } from '../lib/insights'
import { SUBJECTS_BY_GRADE } from '../lib/seed'
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
export const RATING_LABEL = { gruen: 'lief gut', gelb: 'gemischt', rot: 'schwierig' } as const

/** Neueste laufende Stunde einer Klasse. */
export function latestRunning(lessons: Lesson[]) {
  return lessons.filter((l) => l.status === 'laufend').sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

function defaultSubject(subjects: string[]) {
  return subjects.includes('Mathematik') ? 'Mathematik' : (subjects[0] ?? 'Mathematik')
}

export function StartLessonSheet({ open, onClose, cls, competencies, students }: { open: boolean; onClose: () => void; cls: SchoolClass; competencies: Competency[]; students: Student[] }) {
  return (
    <Sheet open={open} onClose={onClose} title="Stunde starten" wide>
      {open && <StartLessonForm onClose={onClose} cls={cls} competencies={competencies} students={students} />}
    </Sheet>
  )
}

function StartLessonForm({ onClose, cls, competencies, students }: { onClose: () => void; cls: SchoolClass; competencies: Competency[]; students: Student[] }) {
  const nav = useNavigate()
  const subjects = cls.subjects.length ? cls.subjects : SUBJECTS_BY_GRADE[cls.gradeLevel]
  const [subject, setSubject] = useState(() => defaultSubject(subjects))
  const [topic, setTopic] = useState('')
  const [focus, setFocus] = useState('')
  const [focusCompetencyIds, setFocusCompetencyIds] = useState<string[]>([])
  const [focusStudentIds, setFocusStudentIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  // Bereits laufende Stunde dieser Klasse (neueste)
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

function ReflectionForm({ lesson, onClose, students, observations }: { lesson: Lesson; onClose: () => void; students: Student[]; observations: Observation[] }) {
  const nav = useNavigate()
  const r = lesson.reflection ?? {}
  const finishing = lesson.status === 'laufend'
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

  const done = async () => {
    if (busy) return
    setBusy(true)
    try {
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

  return (
    <div className="space-y-5">
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
              <AttachmentView a={a} className="size-20 rounded-xl object-cover ring-1 ring-slate-200" />
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
            {hasFocus ? 'Fokuskinder ohne Eintrag' : 'Heute ohne Eintrag'} · {unseen.length}
          </p>
          <p className="text-sm text-slate-600">{unseen.map((s) => s.firstName).join(', ') || (hasFocus ? 'Alle Fokuskinder dokumentiert.' : 'Alle Kinder dokumentiert.')}</p>
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
