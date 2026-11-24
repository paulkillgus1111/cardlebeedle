import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Mic, PenLine, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { alive, db, now, remove, save, uid, type Attachment, type Competency, type Observation, type ObsKind, type Student, type Valence } from '../lib/db'
import { today } from '../lib/insights'
import { KIND_LABEL, LEVEL_LABEL, SUBJECTS_BY_GRADE } from '../lib/seed'
import { AttachmentView, compressImage, SketchPad, useDictation, VoiceRecorder } from './media'
import { toast } from './toast'
import { Avatar, Button, Field, inputCls, Segmented, Sheet } from './ui'

const KINDS: ObsKind[] = ['beobachtung', 'lernstand', 'arbeitsverhalten', 'sozialverhalten', 'staerke', 'foerderbedarf', 'zitat', 'arbeitsprobe', 'vorfall', 'elternkontakt']

export interface CaptureContext {
  classId: string
  gradeLevel: 1 | 2 | 3 | 4
  students: Student[]
  competencies: Competency[]
  studentIds: string[]
  lessonId?: string
  subject?: string
  focusCompetencyIds?: string[]
  edit?: Observation
}

/** Speichert eine Beobachtung (eine pro Auswahl, mehrere Kinder möglich). */
export async function quickSave(o: Omit<Observation, 'id' | 'updatedAt' | 'createdAt' | 'date' | 'tags' | 'attachments'> & Partial<Observation>) {
  const row: Observation = { id: uid(), createdAt: now(), date: today(), tags: [], attachments: [], updatedAt: now(), ...o }
  await save(db.observations, row)
  return row
}

export function QuickCapture({ ctx, onClose }: { ctx: CaptureContext | null; onClose: () => void }) {
  const open = !!ctx
  return (
    <Sheet open={open} onClose={onClose} title={ctx?.edit ? 'Eintrag bearbeiten' : 'Beobachtung'} wide>
      {ctx && <CaptureForm key={ctx.edit?.id ?? ctx.studentIds.join()} ctx={ctx} onClose={onClose} />}
    </Sheet>
  )
}

function CaptureForm({ ctx, onClose }: { ctx: CaptureContext; onClose: () => void }) {
  const templates = useLiveQuery(async () => alive(await db.quickTemplates.orderBy('order').toArray())) ?? []
  const e = ctx.edit
  const [studentIds, setStudentIds] = useState<string[]>(e?.studentIds ?? ctx.studentIds)
  const [kind, setKind] = useState<ObsKind>(e?.kind ?? 'beobachtung')
  const [valence, setValence] = useState<Valence>(e?.valence ?? 'neu')
  const [subject, setSubject] = useState(e?.subject ?? ctx.subject ?? '')
  const [competencyId, setCompetencyId] = useState(e?.competencyId ?? '')
  const [level, setLevel] = useState<0 | 1 | 2 | 3 | 4>(e?.level ?? 0)
  const [text, setText] = useState(e?.text ?? '')
  const [date, setDate] = useState(e?.date ?? today())
  const [followUp, setFollowUp] = useState(e?.followUp ?? '')
  const [shareable, setShareable] = useState(e?.shareable ?? false)
  const [attachments, setAttachments] = useState<Attachment[]>(e?.attachments ?? [])
  const [sketch, setSketch] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const dictation = useDictation((t) => setText((x) => (x ? x + ' ' : '') + t))

  const subjects = SUBJECTS_BY_GRADE[ctx.gradeLevel]
  const comps = useMemo(() => ctx.competencies.filter((c) => !subject || c.subject === subject), [ctx.competencies, subject])
  const focusComps = ctx.competencies.filter((c) => ctx.focusCompetencyIds?.includes(c.id))
  const names = studentIds.map((id) => ctx.students.find((s) => s.id === id)?.firstName).join(', ')

  useEffect(() => {
    if (kind === 'staerke') setValence('pos')
    if (kind === 'vorfall' || kind === 'foerderbedarf') setValence(kind === 'vorfall' ? 'neg' : 'neu')
  }, [kind])

  const base = { classId: ctx.classId, studentIds, lessonId: ctx.lessonId, subject: subject || undefined }

  const oneTap = async (o: Partial<Observation> & { kind: ObsKind; valence: Valence; text: string }) => {
    if (!studentIds.length) return
    const row = await quickSave({ ...base, ...o })
    toast(`Gespeichert für ${names}`, () => remove(db.observations, row.id))
    onClose()
  }

  const submit = async () => {
    if (!studentIds.length) return
    const row: Observation = {
      ...(e ?? { id: uid(), createdAt: now(), tags: [] }),
      ...base,
      lessonId: e?.lessonId ?? ctx.lessonId,
      date,
      kind,
      valence,
      competencyId: competencyId || undefined,
      level: level || undefined,
      text: text.trim(),
      attachments,
      followUp: followUp || undefined,
      shareable,
      updatedAt: now(),
    }
    await save(db.observations, row)
    toast(e ? 'Aktualisiert' : `Gespeichert für ${names}`)
    onClose()
  }

  const addPhoto = async (file?: File) => {
    if (!file) return
    const blob = await compressImage(file)
    setAttachments((a) => [...a, { id: uid(), type: 'image', mime: 'image/jpeg', blob }])
    if (kind === 'beobachtung') setKind('arbeitsprobe')
  }

  if (sketch)
    return (
      <SketchPad
        onCancel={() => setSketch(false)}
        onDone={(blob) => {
          setAttachments((a) => [...a, { id: uid(), type: 'sketch', mime: 'image/png', blob }])
          setSketch(false)
        }}
      />
    )

  return (
    <div className="space-y-5">
      {/* Kinder */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {studentIds.map((id) => {
            const s = ctx.students.find((x) => x.id === id)
            return s ? (
              <span key={id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 py-1 pr-3 pl-1 text-sm font-medium">
                <Avatar student={s} size={26} /> {s.firstName}
              </span>
            ) : null
          })}
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Fertig' : studentIds.length ? 'Kinder ändern' : 'Kinder wählen'}
          </Button>
        </div>
        {showAll && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {ctx.students.map((s) => {
              const on = studentIds.includes(s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => setStudentIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                  className={clsx('flex items-center gap-2 rounded-xl p-2 text-left text-sm ring-1', on ? 'bg-brand-50 ring-brand-500' : 'ring-slate-200')}
                >
                  <Avatar student={s} size={24} /> <span className="truncate">{s.firstName}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {!e && focusComps.length > 0 && (
        <div className="rounded-2xl bg-brand-50 p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-brand-700 uppercase">Beobachtungsschwerpunkt – 1 Tipp genügt</p>
          <div className="space-y-2">
            {focusComps.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-sm">{c.text}</span>
                {([1, 2, 3, 4] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => oneTap({ kind: 'lernstand', valence: l >= 3 ? 'pos' : l === 1 ? 'neg' : 'neu', competencyId: c.id, level: l, subject: c.subject, text: '' })}
                    className={clsx('rounded-lg px-2.5 py-1.5 text-xs font-semibold', ['', 'bg-rose-100 text-rose-800', 'bg-amber-100 text-amber-800', 'bg-lime-100 text-lime-800', 'bg-emerald-100 text-emerald-800'][l])}
                  >
                    {LEVEL_LABEL[l]}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {!e && (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Schnell-Einträge</p>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => oneTap({ kind: t.kind, valence: t.valence, text: t.label })}
                className={clsx(
                  'rounded-full px-3 py-2 text-sm font-medium ring-1',
                  t.valence === 'pos' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : t.valence === 'neg' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-slate-50 text-slate-700 ring-slate-200',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={clsx('rounded-lg px-2.5 py-1.5 text-xs font-medium', kind === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600')}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="relative">
          <textarea
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            rows={3}
            placeholder={kind === 'zitat' ? '„Ich habe erst die Zehner …“' : 'Was hast du beobachtet?'}
            className={inputCls}
            autoFocus={!!e}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={valence}
            onChange={setValence}
            options={[
              { value: 'pos', label: '👍 positiv' },
              { value: 'neu', label: 'neutral' },
              { value: 'neg', label: '⚠︎ Sorge' },
            ]}
          />
          {dictation.supported && (
            <Button variant={dictation.active ? 'danger' : 'secondary'} size="sm" onClick={dictation.toggle}>
              <Mic size={16} /> {dictation.active ? 'Diktat stoppen' : 'Diktieren'}
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fach">
            <select value={subject} onChange={(ev) => (setSubject(ev.target.value), setCompetencyId(''))} className={inputCls}>
              <option value="">– fachübergreifend –</option>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Kompetenz (LehrplanPLUS)">
            <select value={competencyId} onChange={(ev) => setCompetencyId(ev.target.value)} className={inputCls}>
              <option value="">–</option>
              {Object.entries(groupBy(comps, (c) => `${c.subject} · ${c.area}`)).map(([g, cs]) => (
                <optgroup key={g} label={g}>
                  {cs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.text}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>
        {competencyId && (
          <Segmented
            value={level}
            onChange={setLevel}
            options={([0, 1, 2, 3, 4] as const).map((l) => ({ value: l, label: l ? LEVEL_LABEL[l] : 'ohne Stufe' }))}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium ring-1 ring-slate-200">
            <Camera size={16} /> Foto
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(ev) => addPhoto(ev.target.files?.[0])} />
          </label>
          <Button variant="secondary" size="sm" onClick={() => setSketch(true)}>
            <PenLine size={16} /> Skizze
          </Button>
          <VoiceRecorder onDone={(blob, mime) => setAttachments((a) => [...a, { id: uid(), type: 'audio', mime, blob }])} />
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {attachments.map((a) => (
              <div key={a.id} className="relative">
                <AttachmentView a={a} />
                <button onClick={() => setAttachments((x) => x.filter((y) => y.id !== a.id))} className="absolute -top-2 -right-2 rounded-full bg-white p-1 shadow ring-1 ring-slate-200">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Datum">
            <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={inputCls} />
          </Field>
          <Field label="Wiedervorlage">
            <input type="date" value={followUp} onChange={(ev) => setFollowUp(ev.target.value)} className={inputCls} />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={shareable} onChange={(ev) => setShareable(ev.target.checked)} className="size-5 accent-brand-700" />
            Im Gespräch zeigbar
          </label>
        </div>

        <div className="flex gap-2">
          {e && (
            <Button
              variant="ghost"
              className="text-rose-600"
              onClick={async () => {
                await remove(db.observations, e.id)
                toast('Gelöscht')
                onClose()
              }}
            >
              <Trash2 size={16} /> Löschen
            </Button>
          )}
          <span className="flex-1" />
          <Button size="lg" onClick={submit} disabled={!studentIds.length || (!text.trim() && !attachments.length && !level)}>
            Speichern
          </Button>
        </div>
      </div>
    </div>
  )
}

export function groupBy<T>(arr: T[], key: (t: T) => string) {
  return arr.reduce<Record<string, T[]>>((acc, x) => ((acc[key(x)] ??= []).push(x), acc), {})
}
