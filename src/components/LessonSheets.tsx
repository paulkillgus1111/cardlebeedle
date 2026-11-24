import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alive, db, now, save, uid, type Competency, type Lesson, type Observation, type SchoolClass, type Student } from '../lib/db'
import { today } from '../lib/insights'
import { SUBJECTS_BY_GRADE } from '../lib/seed'
import { AttachmentView, compressImage } from './media'
import { groupBy } from './QuickCapture'
import { toast } from './toast'
import { Avatar, Button, Field, inputCls, Segmented, Sheet } from './ui'

export function StartLessonSheet({ open, onClose, cls, competencies, students }: { open: boolean; onClose: () => void; cls: SchoolClass; competencies: Competency[]; students: Student[] }) {
  const nav = useNavigate()
  const [subject, setSubject] = useState('Mathematik')
  const [topic, setTopic] = useState('')
  const [focus, setFocus] = useState('')
  const [focusCompetencyIds, setFocusCompetencyIds] = useState<string[]>([])
  const [focusStudentIds, setFocusStudentIds] = useState<string[]>([])

  // Notiz „für nächstes Mal“ aus der letzten Stunde des Fachs
  const lastNote = useLiveQuery(async () => {
    const ls = alive(await db.lessons.where('classId').equals(cls.id).toArray())
      .filter((l) => l.subject === subject && l.reflection?.nextTime)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    return ls[0]
  }, [cls.id, subject])

  const comps = competencies.filter((c) => c.subject === subject)

  const start = async () => {
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
  }

  return (
    <Sheet open={open} onClose={onClose} title="Stunde starten" wide>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {(cls.subjects.length ? cls.subjects : SUBJECTS_BY_GRADE[cls.gradeLevel]).map((s) => (
            <button
              key={s}
              onClick={() => (setSubject(s), setFocusCompetencyIds([]))}
              className={clsx('rounded-xl px-3 py-2 text-sm font-medium', subject === s ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700')}
            >
              {s}
            </button>
          ))}
        </div>
        {lastNote?.reflection?.nextTime && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <b>Für diese Stunde notiert:</b> {lastNote.reflection.nextTime}
          </div>
        )}
        <Field label="Thema">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} className={inputCls} placeholder="z. B. Zehnerübergang mit Rechenschiffchen" />
        </Field>
        <Field label="Beobachtungsschwerpunkt (optional)">
          <input value={focus} onChange={(e) => setFocus(e.target.value)} className={inputCls} placeholder="z. B. Welche Strategie nutzen die Kinder?" />
        </Field>
        {comps.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-600">Kompetenzen, die ich heute einschätze</p>
            <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
              {Object.entries(groupBy(comps, (c) => c.area)).map(([area, cs]) => (
                <div key={area}>
                  <p className="mb-1 text-xs font-semibold text-slate-400 uppercase">{area}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cs.map((c) => {
                      const on = focusCompetencyIds.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          onClick={() => setFocusCompetencyIds((ids) => (on ? ids.filter((x) => x !== c.id) : [...ids, c.id]))}
                          className={clsx('rounded-lg px-2.5 py-1.5 text-left text-xs', on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700')}
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
          <p className="mb-2 text-sm font-medium text-slate-600">Gezielt beobachten (optional, sonst ganze Klasse)</p>
          <div className="flex flex-wrap gap-1.5">
            {students.map((s) => {
              const on = focusStudentIds.includes(s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => setFocusStudentIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                  className={clsx('rounded-full px-3 py-1.5 text-sm', on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700')}
                >
                  {s.firstName}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="lg" onClick={start}>
            Los geht's
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

export function ReflectionSheet({ lesson, open, onClose, students, observations }: { lesson: Lesson; open: boolean; onClose: () => void; students: Student[]; observations: Observation[] }) {
  const nav = useNavigate()
  const r = lesson.reflection ?? {}
  const [whatWasDone, setWhat] = useState(r.whatWasDone ?? lesson.topic)
  const [rating, setRating] = useState(r.rating ?? 'gruen')
  const [goalReached, setGoal] = useState(r.goalReached ?? 'ja')
  const [note, setNote] = useState(r.note ?? '')
  const [nextTime, setNext] = useState(r.nextTime ?? '')
  const [attachments, setAttachments] = useState(lesson.attachments ?? [])

  const inLesson = observations.filter((o) => o.lessonId === lesson.id)
  const seen = new Set(inLesson.flatMap((o) => o.studentIds))
  const notable = students.filter((s) => inLesson.some((o) => o.studentIds.includes(s.id) && o.valence !== 'neu'))
  const unseen = students.filter((s) => !seen.has(s.id))

  const done = async () => {
    await save(db.lessons, {
      ...lesson,
      status: 'abgeschlossen',
      endedAt: lesson.endedAt ?? now(),
      reflection: { whatWasDone, rating, goalReached, note, nextTime },
      attachments,
    })
    toast('Stunde dokumentiert')
    onClose()
    nav('/')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Stundenabschluss" wide>
      <div className="space-y-4">
        <Field label="Was wurde gemacht?">
          <textarea value={whatWasDone} onChange={(e) => setWhat(e.target.value)} rows={2} className={inputCls} />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-600">Wie lief es?</p>
            <div className="flex gap-2">
              {(['gruen', 'gelb', 'rot'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setRating(c)}
                  className={clsx('size-11 rounded-full ring-offset-2', { gruen: 'bg-emerald-500', gelb: 'bg-amber-400', rot: 'bg-rose-500' }[c], rating === c && 'ring-2 ring-slate-900')}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-600">Ziel erreicht?</p>
            <Segmented value={goalReached} onChange={setGoal} options={[{ value: 'ja', label: 'ja' }, { value: 'teilweise', label: 'teilweise' }, { value: 'nein', label: 'nein' }]} />
          </div>
        </div>
        <Field label="Reflexion (was würde ich anders machen?)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputCls} placeholder="z. B. Erklärphase zu lang, Material für Gruppe Rot zu schwer" />
        </Field>
        <Field label="Für nächstes Mal (erscheint beim nächsten Start in diesem Fach)">
          <input value={nextTime} onChange={(e) => setNext(e.target.value)} className={inputCls} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium ring-1 ring-slate-200">
            <Camera size={16} /> Tafelbild
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const blob = await compressImage(f)
                setAttachments((a) => [...a, { id: uid(), type: 'image', mime: 'image/jpeg', blob }])
              }}
            />
          </label>
          {attachments.map((a) => (
            <AttachmentView key={a.id} a={a} className="h-16 w-16 rounded-lg object-cover" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500 uppercase">Aufgefallen ({notable.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {notable.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5 text-sm">
                  <Avatar student={s} size={22} /> {s.firstName}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500 uppercase">Heute ohne Eintrag ({unseen.length})</p>
            <p className="text-sm text-slate-600">{unseen.map((s) => s.firstName).join(', ') || 'Alle Kinder dokumentiert 🎉'}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="lg" onClick={done}>
            Stunde abschließen
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
