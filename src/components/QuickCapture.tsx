import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Check, ChevronDown, Mic, PenLine, Target, Trash2, X, Zap } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { alive, db, now, remove, save, uid, type Attachment, type Competency, type Observation, type ObsKind, type Student, type Valence } from '../lib/db'
import { today } from '../lib/insights'
import { KIND_LABEL, LEVEL_LABEL, SUBJECTS_BY_GRADE } from '../lib/seed'
import { AttachmentView, compressImage, SketchPad, useDictation, VoiceRecorder } from './media'
import { toast } from './toast'
import { Avatar, Button, Field, inputCls, Segmented, Sheet, ValenceDot } from './ui'

const KINDS: ObsKind[] = ['beobachtung', 'lernstand', 'arbeitsverhalten', 'sozialverhalten', 'staerke', 'foerderbedarf', 'zitat', 'arbeitsprobe', 'vorfall', 'elternkontakt']

/** Typische Wertung je Art – wird nur gesetzt, wenn die Art aktiv gewechselt wird. */
const KIND_VALENCE: Partial<Record<ObsKind, Valence>> = { staerke: 'pos', vorfall: 'neg', foerderbedarf: 'neu' }

const LEVEL_TONE = ['', 'bg-rose-50 text-rose-800 ring-rose-200 hover:bg-rose-100', 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100', 'bg-lime-100/60 text-lime-800 ring-lime-200 hover:bg-lime-100', 'bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100']

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

function Section({ label, icon, hint, children }: { label: string; icon?: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        {icon && <span className="text-slate-400">{icon}</span>}
        <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{label}</p>
        {hint && <span className="ml-auto text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function CaptureForm({ ctx, onClose }: { ctx: CaptureContext; onClose: () => void }) {
  const templatesQ = useLiveQuery(async () => alive(await db.quickTemplates.orderBy('order').toArray()))
  const templates = templatesQ ?? []
  const e = ctx.edit
  const [studentIds, setStudentIds] = useState<string[]>(e?.studentIds ?? ctx.studentIds)
  const [kind, setKind] = useState<ObsKind>(e?.kind ?? 'beobachtung')
  const [valence, setValence] = useState<Valence>(e?.valence ?? 'neu')
  const [subject, setSubject] = useState(e?.subject ?? ctx.subject ?? '')
  const [competencyId, setCompetencyId] = useState(e?.competencyId ?? '')
  const [level, setLevel] = useState<0 | 1 | 2 | 3 | 4>(e?.competencyId ? (e?.level ?? 0) : 0)
  const [text, setText] = useState(e?.text ?? '')
  const [date, setDate] = useState(e?.date ?? today())
  const [followUp, setFollowUp] = useState(e?.followUp ?? '')
  const [shareable, setShareable] = useState(e?.shareable ?? false)
  const [attachments, setAttachments] = useState<Attachment[]>(e?.attachments ?? [])
  const [sketch, setSketch] = useState(false)
  const [showAll, setShowAll] = useState(!(e?.studentIds ?? ctx.studentIds).length)
  const [detail, setDetail] = useState<boolean | null>(e ? true : null)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const dictation = useDictation((t) => setText((x) => (x ? x + ' ' : '') + t))

  const subjects = SUBJECTS_BY_GRADE[ctx.gradeLevel]
  const comps = useMemo(() => ctx.competencies.filter((c) => !subject || c.subject === subject), [ctx.competencies, subject])
  const focusComps = ctx.competencies.filter((c) => ctx.focusCompetencyIds?.includes(c.id))
  const selected = studentIds.map((id) => ctx.students.find((s) => s.id === id)).filter((s): s is Student => !!s)
  const names = selected.length > 3 ? `${selected.length} Kinder` : selected.map((s) => s.firstName).join(', ')
  const noKids = !studentIds.length
  const hasQuick = !e && (focusComps.length > 0 || templates.length > 0)
  const detailOpen = detail ?? (!e && templatesQ !== undefined && !hasQuick)

  const base = { classId: ctx.classId, studentIds, lessonId: ctx.lessonId, subject: subject || undefined }

  const oneTap = async (o: Partial<Observation> & { kind: ObsKind; valence: Valence; text: string }) => {
    if (noKids || busy) return
    setBusy(true)
    try {
      const row = await quickSave({ ...base, ...o })
      toast(`Gespeichert für ${names}`, () => remove(db.observations, row.id), 'success')
      onClose()
    } catch (err) {
      toast(`Speichern fehlgeschlagen: ${(err as Error).message}`, undefined, 'error')
      setBusy(false)
    }
  }

  const canSave = !noKids && !recording && !busy && (!!text.trim() || attachments.length > 0 || (!!competencyId && level > 0))

  const submit = async () => {
    if (!canSave) return
    setBusy(true)
    const row: Observation = {
      ...(e ?? { id: uid(), createdAt: now(), tags: [] }),
      ...base,
      lessonId: e?.lessonId ?? ctx.lessonId,
      date,
      kind,
      valence,
      competencyId: competencyId || undefined,
      level: competencyId && level ? level : undefined,
      text: text.trim(),
      attachments,
      followUp: followUp || undefined,
      shareable,
      updatedAt: now(),
    }
    try {
      await save(db.observations, row)
      toast(e ? 'Aktualisiert' : `Gespeichert für ${names}`, undefined, 'success')
      onClose()
    } catch (err) {
      toast(`Speichern fehlgeschlagen: ${(err as Error).message}`, undefined, 'error')
      setBusy(false)
    }
  }

  const addPhotos = async (files: File[]) => {
    for (const file of files) {
      try {
        const blob = await compressImage(file)
        setAttachments((a) => [...a, { id: uid(), type: 'image', mime: 'image/jpeg', blob }])
        setKind((k) => (k === 'beobachtung' ? 'arbeitsprobe' : k))
      } catch {
        toast('Foto konnte nicht gelesen werden', undefined, 'error')
      }
    }
  }

  const chooseKind = (k: ObsKind) => {
    if (k === kind) return
    setKind(k)
    const v = KIND_VALENCE[k]
    if (v) setValence(v)
  }

  const toggleKid = (id: string) => setStudentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

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

  const kidHint = noKids ? <span className="font-medium text-amber-800">Erst Kind wählen</span> : undefined

  return (
    <div className="space-y-6">
      {/* Kinder */}
      <Section label="Kinder" hint={selected.length > 1 ? <span className="tabular-nums">{selected.length} ausgewählt</span> : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((s) => (
            <span key={s.id} className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-100 pr-1 pl-1 text-sm font-medium text-slate-800">
              <Avatar student={s} size={30} />
              {s.firstName}
              <button onClick={() => toggleKid(s.id)} className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label={`${s.firstName} entfernen`}>
                <X size={14} />
              </button>
            </span>
          ))}
          {noKids && !showAll && <span className="text-sm text-slate-400">Noch kein Kind ausgewählt</span>}
          <Button variant={showAll ? 'soft' : 'ghost'} size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? (
              <>
                <Check size={15} /> Fertig
              </>
            ) : noKids ? (
              'Kinder wählen'
            ) : (
              'Ändern'
            )}
          </Button>
        </div>
        {showAll && (
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-100 sm:grid-cols-4 md:grid-cols-5">
            {ctx.students.map((s) => {
              const on = studentIds.includes(s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => toggleKid(s.id)}
                  aria-pressed={on}
                  className={clsx(
                    'flex min-h-11 items-center gap-2 rounded-xl p-1.5 pr-2 text-left text-sm ring-1 transition',
                    on ? 'bg-brand-50 font-medium text-brand-700 ring-brand-500' : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300',
                  )}
                >
                  <Avatar student={s} size={28} />
                  <span className="min-w-0 flex-1 truncate">{s.firstName}</span>
                  {on && <Check size={14} className="shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </Section>

      {/* Schwerpunkt */}
      {!e && focusComps.length > 0 && (
        <Section label="Schwerpunkt" icon={<Target size={13} />} hint={kidHint ?? '1 Tipp genügt'}>
          <div className="divide-y divide-brand-100 rounded-2xl bg-brand-50 ring-1 ring-brand-100">
            {focusComps.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:gap-4">
                <p className="min-w-0 flex-1 text-sm leading-snug text-slate-800">{c.text}</p>
                <div className="grid grid-cols-4 gap-1.5 md:w-[26rem] md:shrink-0">
                  {([1, 2, 3, 4] as const).map((l) => (
                    <button
                      key={l}
                      disabled={noKids || busy}
                      title={noKids ? 'Erst Kind wählen' : undefined}
                      onClick={() => oneTap({ kind: 'lernstand', valence: l >= 3 ? 'pos' : l === 1 ? 'neg' : 'neu', competencyId: c.id, level: l, subject: c.subject, text: '' })}
                      className={clsx('h-11 rounded-xl px-1 text-[13px] font-semibold ring-1 transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40', LEVEL_TONE[l])}
                    >
                      {LEVEL_LABEL[l]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Schnell-Einträge */}
      {!e && templates.length > 0 && (
        <Section label="Schnell-Einträge" icon={<Zap size={13} />} hint={kidHint}>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                disabled={noKids || busy}
                title={noKids ? 'Erst Kind wählen' : undefined}
                onClick={() => oneTap({ kind: t.kind, valence: t.valence, text: t.label })}
                className={clsx(
                  'inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium shadow-[var(--shadow-card)] ring-1 transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
                  t.valence === 'pos' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100' : t.valence === 'neg' ? 'bg-rose-50 text-rose-800 ring-rose-200 hover:bg-rose-100' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
                )}
              >
                <ValenceDot v={t.valence} />
                {t.label}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Ausführlich */}
      <section className={clsx(hasQuick && 'border-t border-slate-100 pt-4')}>
        {!e && (
          <button onClick={() => setDetail(!detailOpen)} className="flex min-h-10 w-full items-center gap-2 text-left" aria-expanded={detailOpen}>
            <PenLine size={13} className="text-slate-400" />
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Ausführlich</span>
            <span className="text-xs text-slate-400">Text, Foto, Kompetenz …</span>
            <ChevronDown size={18} className={clsx('ml-auto text-slate-400 transition-transform', detailOpen && 'rotate-180')} />
          </button>
        )}

        {detailOpen && (
          <div className={clsx('space-y-5', !e && 'mt-3')}>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
              {KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => chooseKind(k)}
                  aria-pressed={kind === k}
                  className={clsx(
                    'h-9 shrink-0 rounded-full px-3 text-[13px] font-medium whitespace-nowrap ring-1 transition',
                    kind === k ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>

            <div className="relative">
              <textarea
                value={text}
                onChange={(ev) => setText(ev.target.value)}
                rows={4}
                placeholder={kind === 'zitat' ? '„Ich habe erst die Zehner …“' : 'Was hast du beobachtet?'}
                className={clsx(inputCls, 'min-h-28 resize-y', dictation.supported && 'pb-12')}
                autoFocus={!!e}
              />
              {dictation.supported && (
                <div className="absolute right-2 bottom-2">
                  <Button variant={dictation.active ? 'danger' : 'soft'} size="sm" onClick={dictation.toggle}>
                    <Mic size={15} className={clsx(dictation.active && 'animate-pulse')} /> {dictation.active ? 'Stopp' : 'Diktieren'}
                  </Button>
                </div>
              )}
            </div>

            <Segmented
              value={valence}
              onChange={setValence}
              options={[
                { value: 'pos', label: <span className="inline-flex items-center gap-1.5"><ValenceDot v="pos" /> positiv</span> },
                { value: 'neu', label: <span className="inline-flex items-center gap-1.5"><ValenceDot v="neu" /> neutral</span> },
                { value: 'neg', label: <span className="inline-flex items-center gap-1.5"><ValenceDot v="neg" /> Sorge</span> },
              ]}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fach">
                <select
                  value={subject}
                  onChange={(ev) => {
                    setSubject(ev.target.value)
                    setCompetencyId('')
                    setLevel(0)
                  }}
                  className={inputCls}
                >
                  <option value="">– fachübergreifend –</option>
                  {subjects.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Kompetenz (LehrplanPLUS)">
                <select
                  value={competencyId}
                  onChange={(ev) => {
                    setCompetencyId(ev.target.value)
                    if (!ev.target.value) setLevel(0)
                  }}
                  className={inputCls}
                >
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
              <div className="space-y-1.5">
                <p className="text-[13px] font-medium text-slate-600">Stufe</p>
                <Segmented value={level} onChange={setLevel} options={([0, 1, 2, 3, 4] as const).map((l) => ({ value: l, label: l ? LEVEL_LABEL[l] : 'ohne' }))} />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 text-[13px] font-medium text-slate-800 shadow-[var(--shadow-card)] ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.97]">
                  <Camera size={16} /> Foto
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(ev) => {
                      const files = Array.from(ev.target.files ?? [])
                      ev.target.value = ''
                      if (files.length) addPhotos(files)
                    }}
                  />
                </label>
                <Button variant="secondary" size="sm" disabled={recording} onClick={() => setSketch(true)}>
                  <PenLine size={16} /> Skizze
                </Button>
                <VoiceRecorder onRecordingChange={setRecording} onDone={(blob, mime) => setAttachments((a) => [...a, { id: uid(), type: 'audio', mime, blob }])} />
              </div>
              {attachments.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  {attachments.map((a) => (
                    <div key={a.id} className={clsx('relative', a.type === 'audio' && 'w-full max-w-xs')}>
                      <AttachmentView a={a} owner={e ? { table: 'observations', id: e.id } : undefined} />
                      <button
                        onClick={() => setAttachments((x) => x.filter((y) => y.id !== a.id))}
                        className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-200 hover:text-rose-600"
                        aria-label="Anhang entfernen"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Datum">
                <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={inputCls} />
              </Field>
              <Field label="Wiedervorlage">
                <input type="date" value={followUp} onChange={(ev) => setFollowUp(ev.target.value)} className={inputCls} />
              </Field>
              <label className="flex min-h-11 items-center gap-3 self-end rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 ring-1 ring-slate-100">
                <input type="checkbox" checked={shareable} onChange={(ev) => setShareable(ev.target.checked)} className="size-5 accent-brand-700" />
                Im Gespräch zeigbar
              </label>
            </div>
          </div>
        )}
      </section>

      {detailOpen && (
        <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 flex items-center gap-2 border-t border-slate-100 bg-white/90 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6">
          {e && (
            <Button
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await remove(db.observations, e.id)
                toast('Gelöscht')
                onClose()
              }}
            >
              <Trash2 size={16} /> Löschen
            </Button>
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
            {recording ? 'Memo läuft – erst stoppen' : noKids ? 'Erst Kind wählen' : !canSave && !busy ? 'Text, Anhang oder Stufe ergänzen' : ''}
          </span>
          <Button size="lg" onClick={submit} disabled={!canSave}>
            <Check size={18} /> Speichern
          </Button>
        </div>
      )}
    </div>
  )
}

export function groupBy<T>(arr: T[], key: (t: T) => string) {
  return arr.reduce<Record<string, T[]>>((acc, x) => ((acc[key(x)] ??= []).push(x), acc), {})
}
