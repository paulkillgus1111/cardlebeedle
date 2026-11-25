import clsx from 'clsx'
import { addWeeks, formatISO } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Check, ChevronDown, Info, Lightbulb, Loader2, Mic, PenLine, Sparkles, Target, Trash2, Users, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ai } from '../lib/ai'
import { alive, db, now, remove, save, uid, type Attachment, type Competency, type Goal, type Observation, type ObsKind, type Student, type Valence } from '../lib/db'
import { today } from '../lib/insights'
import { BEHAVIOR_ITEMS, DEFAULT_LEVEL_HINTS, FREQUENCY_LABEL, KIND_LABEL, LEVEL_LABEL, SUBJECTS_BY_GRADE } from '../lib/seed'
import { supabase } from '../lib/sync'
import { AttachmentView, compressImage, SketchPad, useDictation, VoiceRecorder } from './media'
import { toast } from './toast'
import { Avatar, Button, Field, inputCls, Segmented, Sheet, ValenceDot } from './ui'

const KINDS: ObsKind[] = ['beobachtung', 'lernstand', 'arbeitsverhalten', 'sozialverhalten', 'staerke', 'foerderbedarf', 'zitat', 'arbeitsprobe', 'vorfall', 'elternkontakt']
const VALENCES: Valence[] = ['pos', 'neu', 'neg']
const VALENCE_LABEL: Record<Valence, string> = { pos: 'positiv', neu: 'neutral', neg: 'Sorge' }
const OWNER_LABEL = { kind: 'Kind', eltern: 'Eltern', lehrkraft: 'Lehrkraft' } as const
type Owner = keyof typeof OWNER_LABEL
type Lvl = 0 | 1 | 2 | 3 | 4
type Freq = 0 | 1 | 2 | 3 | 4

/** Typische Wertung je Art – wird nur gesetzt, wenn die Art aktiv gewechselt wird. */
const KIND_VALENCE: Partial<Record<ObsKind, Valence>> = { staerke: 'pos', vorfall: 'neg', foerderbedarf: 'neu' }

const LEVEL_TONE = ['', 'bg-rose-50 text-rose-800 ring-rose-200 hover:bg-rose-100', 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100', 'bg-lime-100/60 text-lime-800 ring-lime-200 hover:bg-lime-100', 'bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100']

const OBS_PLACEHOLDER = 'Nur, was zu sehen/hören war – z. B. „Rechnet 34+28: legt erst die Zehner, zählt Einer an den Fingern.“ · „Meldet sich im Sitzkreis 3×.“ · „Fragt zweimal nach, bevor er beginnt.“'

export interface CaptureContext {
  classId: string
  gradeLevel: 1 | 2 | 3 | 4
  students: Student[]
  competencies: Competency[]
  studentIds: string[]
  lessonId?: string
  subject?: string
  /** Fächer der Klasse/Gruppe (Fallback: SUBJECTS_BY_GRADE) */
  subjects?: string[]
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

/** Indikator-Text je Stufe: eigene Indikatoren der Kompetenz, sonst allgemeiner Hinweis. */
export const levelHint = (c: Competency | undefined, l: 1 | 2 | 3 | 4) => c?.indicators?.[l - 1]?.trim() || DEFAULT_LEVEL_HINTS[l]

/** Lange drücken → Hinweis statt Klick. */
function useLongPress() {
  const timer = useRef<number | undefined>(undefined)
  const fired = useRef(false)
  const stop = () => window.clearTimeout(timer.current)
  return (onLong: () => void, onTap: () => void) => ({
    onPointerDown: () => {
      fired.current = false
      stop()
      timer.current = window.setTimeout(() => {
        fired.current = true
        onLong()
      }, 500)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (ev: { preventDefault: () => void }) => ev.preventDefault(),
    onClick: () => {
      if (fired.current) {
        fired.current = false
        return
      }
      onTap()
    },
  })
}

/** Stufenhinweise + Ankerbeispiele einer Kompetenz. */
function LevelHints({ comp, highlight, onClose }: { comp: Competency; highlight?: Lvl; onClose?: () => void }) {
  const [openAnchor, setOpenAnchor] = useState<Lvl>(0)
  const anchorIds = openAnchor ? (comp.anchors?.[openAnchor as 1 | 2 | 3 | 4] ?? []) : []
  const anchors = useLiveQuery(async () => (anchorIds.length ? alive((await db.observations.bulkGet(anchorIds)).filter((o): o is Observation => !!o)) : []), [anchorIds.join()])
  return (
    <div className="space-y-1 rounded-xl bg-white p-2 text-[13px] ring-1 ring-slate-200">
      <div className="flex items-center gap-2 px-1">
        <Info size={13} className="text-slate-400" />
        <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Woran erkenne ich die Stufe?</span>
        {onClose && (
          <button onClick={onClose} className="ml-auto flex size-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Hinweise schließen">
            <X size={14} />
          </button>
        )}
      </div>
      {([1, 2, 3, 4] as const).map((l) => {
        const n = comp.anchors?.[l]?.length ?? 0
        return (
          <div key={l} className={clsx('rounded-lg px-2 py-1.5', highlight === l && 'bg-slate-50 ring-1 ring-slate-200')}>
            <p className="leading-snug text-slate-700">
              <span className={clsx('mr-1.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1', LEVEL_TONE[l])}>{LEVEL_LABEL[l]}</span>
              {levelHint(comp, l)}
            </p>
            {n > 0 && (
              <button onClick={() => setOpenAnchor((x) => (x === l ? 0 : l))} className="mt-1 text-xs font-medium text-brand-700 hover:underline">
                {openAnchor === l ? 'Ankerbeispiel ausblenden' : `Ankerbeispiel ansehen${n > 1 ? ` (${n})` : ''}`}
              </button>
            )}
            {openAnchor === l && (
              <ul className="mt-1 space-y-1 border-l-2 border-slate-200 pl-2 text-xs text-slate-600">
                {anchors === undefined ? <li>…</li> : anchors.length ? anchors.map((o) => <li key={o.id}>„{o.text || '(ohne Text)'}“</li>) : <li>Beispiel nicht mehr vorhanden</li>}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface Suggestion {
  competencyIds: string[]
  kind?: ObsKind
  valence?: Valence
  level: Lvl
  traitWords: string[]
}

const strArr = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string' && !!v.trim()) : [])

function CaptureForm({ ctx, onClose }: { ctx: CaptureContext; onClose: () => void }) {
  const templatesQ = useLiveQuery(async () => alive(await db.quickTemplates.orderBy('order').toArray()))
  const templates = templatesQ ?? []
  const e = ctx.edit
  const [studentIds, setStudentIds] = useState<string[]>(e?.studentIds ?? ctx.studentIds)
  const [kind, setKind] = useState<ObsKind>(e?.kind ?? 'beobachtung')
  const [valence, setValenceRaw] = useState<Valence>(e?.valence ?? 'neu')
  const valenceTouched = useRef(!!e)
  const [subject, setSubject] = useState(e?.subject ?? ctx.subject ?? '')
  const [competencyId, setCompetencyId] = useState(e?.competencyId ?? '')
  const [level, setLevel] = useState<Lvl>(e?.competencyId ? (e?.level ?? 0) : 0)
  const [text, setText] = useState(e?.text ?? '')
  const [interpretation, setInterpretation] = useState(e?.interpretation ?? '')
  const [showInterp, setShowInterp] = useState(!!e?.interpretation)
  const [date, setDate] = useState(e?.date ?? today())
  const [followUp, setFollowUp] = useState(e?.followUp ?? '')
  const [shareable, setShareable] = useState(e?.shareable ?? false)
  const [groupWork, setGroupWork] = useState(e?.groupWork ?? false)
  const [scaleItemId, setScaleItemId] = useState(e?.scaleItemId ?? '')
  const [frequency, setFrequency] = useState<Freq>(e?.frequency ?? 0)
  const autoText = useRef('')
  const [nextStep, setNextStep] = useState(e?.nextStep ?? '')
  const [nextSugg, setNextSugg] = useState<string[]>([])
  const [nextBusy, setNextBusy] = useState(false)
  const [nextErr, setNextErr] = useState('')
  const [asGoal, setAsGoal] = useState(false)
  const [goalOwner, setGoalOwner] = useState<Owner>('kind')
  const [goalDue, setGoalDue] = useState(() => formatISO(addWeeks(new Date(), 3), { representation: 'date' }))
  const [attachments, setAttachments] = useState<Attachment[]>(e?.attachments ?? [])
  const [sketch, setSketch] = useState(false)
  const [showAll, setShowAll] = useState(!(e?.studentIds ?? ctx.studentIds).length)
  const [detail, setDetail] = useState<boolean | null>(e ? true : null)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [focusHint, setFocusHint] = useState<{ id: string; level?: Lvl } | null>(null)
  const [showLevelHints, setShowLevelHints] = useState(false)
  const longPress = useLongPress()
  const dictation = useDictation((t) => setText((x) => (x ? x + ' ' : '') + t))

  const setValence = (v: Valence) => {
    valenceTouched.current = true
    setValenceRaw(v)
  }

  const baseSubjects = ctx.subjects?.length ? ctx.subjects : SUBJECTS_BY_GRADE[ctx.gradeLevel]
  const subjects = !subject || baseSubjects.includes(subject) ? baseSubjects : [...baseSubjects, subject]
  const comps = useMemo(() => ctx.competencies.filter((c) => !subject || c.subject === subject), [ctx.competencies, subject])
  const comp = ctx.competencies.find((c) => c.id === competencyId)
  const focusComps = ctx.competencies.filter((c) => ctx.focusCompetencyIds?.includes(c.id))
  const selected = studentIds.map((id) => ctx.students.find((s) => s.id === id)).filter((s): s is Student => !!s)
  const names = selected.length > 3 ? `${selected.length} Kinder` : selected.map((s) => s.firstName).join(', ')
  const noKids = !studentIds.length
  const hasQuick = !e && (focusComps.length > 0 || templates.length > 0)
  const detailOpen = detail ?? (!e && templatesQ !== undefined && !hasQuick)
  const scaleArea = kind === 'arbeitsverhalten' || kind === 'sozialverhalten' ? kind : null
  const scaleItems = scaleArea ? BEHAVIOR_ITEMS.filter((b) => b.area === scaleArea) : []
  const hasScale = !!scaleArea && !!scaleItemId && frequency > 0

  const base = { classId: ctx.classId, studentIds, lessonId: ctx.lessonId, subject: subject || undefined }

  // ---- KI-Vorschlag (Kompetenz/Art/Wertung/Stufe) ----
  const [aiReady, setAiReady] = useState(false)
  const [sugg, setSugg] = useState<Suggestion | null>(null)
  const [suggBusy, setSuggBusy] = useState(false)
  const [suggHint, setSuggHint] = useState('')
  const lastSuggested = useRef((e?.text ?? '').trim())
  const reqId = useRef(0)
  const words = text.trim().split(/\s+/).filter(Boolean).length

  useEffect(() => {
    let off = false
    supabase.auth
      .getSession()
      .then(({ data }) => !off && setAiReady(!!data.session))
      .catch(() => {})
    return () => {
      off = true
    }
  }, [])

  const runSuggest = async (manual: boolean) => {
    const t = text.trim()
    if (words < 4) {
      if (manual) setSuggHint('Erst ein paar Worte mehr schreiben')
      return
    }
    if (!navigator.onLine || !aiReady) {
      if (manual) setSuggHint(!navigator.onLine ? 'Offline – kein Vorschlag möglich' : 'Für KI-Vorschläge unter Einstellungen anmelden')
      return
    }
    lastSuggested.current = t
    const my = ++reqId.current
    setSuggBusy(true)
    setSuggHint('')
    try {
      const pool = subject ? ctx.competencies.filter((c) => c.subject === subject) : ctx.competencies
      const res = await ai<{ json?: Record<string, unknown> }>('suggest', {
        text: t,
        jahrgangsstufe: ctx.gradeLevel,
        fach: subject || undefined,
        kompetenzen: pool.map((c) => ({ id: c.id, fach: c.subject, bereich: c.area, text: c.text })),
      })
      if (my !== reqId.current) return
      const j = res?.json ?? {}
      const valid = new Set(ctx.competencies.map((c) => c.id))
      const lv = Math.round(Number(j.level))
      const next: Suggestion = {
        competencyIds: [...new Set(strArr(j.competencyIds).filter((id) => valid.has(id)))].slice(0, 3),
        kind: typeof j.kind === 'string' && j.kind in KIND_LABEL ? (j.kind as ObsKind) : undefined,
        valence: VALENCES.includes(j.valence as Valence) ? (j.valence as Valence) : undefined,
        level: Number.isFinite(lv) ? (Math.min(4, Math.max(0, lv)) as Lvl) : 0,
        traitWords: strArr(j.traitWords).slice(0, 3),
      }
      setSugg(next)
      if (!next.competencyIds.length && !next.kind && !next.valence && !next.traitWords.length && manual) setSuggHint('Kein passender Vorschlag')
    } catch {
      if (my === reqId.current) setSuggHint('KI-Vorschlag gerade nicht verfügbar')
    } finally {
      if (my === reqId.current) setSuggBusy(false)
    }
  }
  const runSuggestRef = useRef(runSuggest)
  runSuggestRef.current = runSuggest

  useEffect(() => {
    if (!detailOpen || !aiReady) return
    const t = text.trim()
    if (words < 4 || t === lastSuggested.current || t === autoText.current) return
    const h = window.setTimeout(() => runSuggestRef.current(false), 1200)
    return () => window.clearTimeout(h)
  }, [text, words, detailOpen, aiReady])

  const applyComp = (c: Competency) => {
    setSubject(c.subject)
    setCompetencyId(c.id)
    if (sugg?.level) setLevel(sugg.level)
  }
  const applyAll = () => {
    if (!sugg) return
    const c = ctx.competencies.find((x) => x.id === sugg.competencyIds[0])
    if (sugg.kind) setKind(sugg.kind)
    if (sugg.valence) setValence(sugg.valence)
    if (c) applyComp(c)
    setSugg(null)
  }
  const suggComps = (sugg?.competencyIds ?? []).map((id) => ctx.competencies.find((c) => c.id === id)).filter((c): c is Competency => !!c)
  const suggUseful = !!sugg && (suggComps.length > 0 || (!!sugg.kind && sugg.kind !== kind) || (!!sugg.valence && sugg.valence !== valence))

  // ---- Nächster Schritt ----
  const showNext = (!!competencyId && level > 0) || kind === 'foerderbedarf' || (valence === 'neg' && !!text.trim()) || !!nextStep.trim()
  const fetchNext = async () => {
    if (nextBusy) return
    setNextBusy(true)
    setNextErr('')
    try {
      const res = await ai<{ json?: { steps?: unknown } }>('nextstep', {
        beobachtung: text.trim(),
        kompetenz: comp?.text,
        stufe: comp && level ? LEVEL_LABEL[level] : undefined,
        jahrgangsstufe: ctx.gradeLevel,
      })
      const steps = strArr(res?.json?.steps).slice(0, 4)
      setNextSugg(steps)
      if (!steps.length) setNextErr('Keine Vorschläge erhalten')
    } catch (err) {
      setNextErr((err as Error).message || 'KI nicht verfügbar')
    } finally {
      setNextBusy(false)
    }
  }

  // ---- Verhaltensskala ----
  const pickScale = (itemId: string, f: Freq) => {
    const item = BEHAVIOR_ITEMS.find((b) => b.id === itemId)
    if (!item) return
    if (itemId === scaleItemId && f === frequency) {
      setScaleItemId('')
      setFrequency(0)
      if (text.trim() === autoText.current) setText('')
      autoText.current = ''
      return
    }
    setScaleItemId(itemId)
    setFrequency(f)
    if (!text.trim() || text.trim() === autoText.current) {
      const t = `${item.text}: ${FREQUENCY_LABEL[f]}`
      autoText.current = t
      setText(t)
    }
    if (!valenceTouched.current) setValenceRaw(f <= 2 ? 'neg' : f === 3 ? 'neu' : 'pos')
  }

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

  const canSave = !noKids && !recording && !busy && (!!text.trim() || attachments.length > 0 || (!!competencyId && level > 0) || hasScale)
  const goalText = nextStep.trim()
  const makeGoal = asGoal && !!goalText && showNext

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
      interpretation: interpretation.trim() || undefined,
      nextStep: (showNext && goalText) || undefined,
      groupWork: groupWork || undefined,
      scaleItemId: hasScale ? scaleItemId : undefined,
      frequency: hasScale ? (frequency as 1 | 2 | 3 | 4) : undefined,
      attachments,
      followUp: followUp || undefined,
      shareable,
      updatedAt: now(),
    }
    try {
      await save(db.observations, row)
      if (makeGoal) {
        for (const sid of studentIds) {
          const s = await db.students.get(sid)
          const goal: Goal = {
            id: uid(),
            studentId: sid,
            classId: s?.classId ?? ctx.classId,
            text: goalText,
            kind: 'lernziel',
            competencyId: competencyId || undefined,
            owner: goalOwner,
            due: goalDue || undefined,
            status: 'offen',
            createdAt: now(),
            updatedAt: now(),
            sourceObservationId: row.id,
          }
          await save(db.goals, goal)
        }
      }
      toast(`${e ? 'Aktualisiert' : `Gespeichert für ${names}`}${makeGoal ? ' · Ziel angelegt' : ''}`, undefined, 'success')
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
    if (v) setValenceRaw(v)
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
        <Section label="Schwerpunkt" icon={<Target size={13} />} hint={kidHint ?? '1 Tipp genügt · lange drücken = Hinweis'}>
          <div className="divide-y divide-brand-100 rounded-2xl bg-brand-50 ring-1 ring-brand-100">
            {focusComps.map((c) => (
              <div key={c.id} className="space-y-2 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-1">
                    <p className="min-w-0 flex-1 text-sm leading-snug text-slate-800">{c.text}</p>
                    <button
                      onClick={() => setFocusHint((h) => (h?.id === c.id ? null : { id: c.id }))}
                      className={clsx('-my-1 flex size-8 shrink-0 items-center justify-center rounded-full transition', focusHint?.id === c.id ? 'bg-white text-brand-700' : 'text-slate-400 hover:bg-white/70 hover:text-slate-700')}
                      aria-label="Stufenhinweise"
                      aria-expanded={focusHint?.id === c.id}
                    >
                      <Info size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 md:w-[26rem] md:shrink-0">
                    {([1, 2, 3, 4] as const).map((l) => (
                      <button
                        key={l}
                        disabled={busy}
                        aria-disabled={noKids}
                        title={noKids ? 'Erst Kind wählen' : levelHint(c, l)}
                        {...longPress(
                          () => setFocusHint({ id: c.id, level: l }),
                          () => {
                            if (noKids) {
                              setShowAll(true)
                              return
                            }
                            oneTap({ kind: 'lernstand', valence: l >= 3 ? 'pos' : l === 1 ? 'neg' : 'neu', competencyId: c.id, level: l, subject: c.subject, text: '' })
                          },
                        )}
                        className={clsx('h-11 touch-manipulation rounded-xl px-1 text-[13px] font-semibold ring-1 transition select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40', LEVEL_TONE[l], noKids && 'opacity-40')}
                      >
                        {LEVEL_LABEL[l]}
                      </button>
                    ))}
                  </div>
                </div>
                {focusHint?.id === c.id && <LevelHints comp={c} highlight={focusHint.level} onClose={() => setFocusHint(null)} />}
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

            {/* Verhaltensskala */}
            {scaleArea && (
              <div className="space-y-1.5 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-100">
                <p className="px-1 text-[13px] font-medium text-slate-600">
                  Wie oft? <span className="font-normal text-slate-400">optional · ein Merkmal antippen</span>
                </p>
                {scaleItems.map((b) => (
                  <div key={b.id} className={clsx('flex flex-col gap-1.5 rounded-xl bg-white px-3 py-2 ring-1 sm:flex-row sm:items-center sm:gap-3', scaleItemId === b.id ? 'ring-slate-300' : 'ring-slate-100')}>
                    <span className="min-w-0 flex-1 text-sm leading-snug text-slate-700">{b.text}</span>
                    <Segmented<Freq>
                      size="sm"
                      value={scaleItemId === b.id ? frequency : 0}
                      onChange={(f) => pickScale(b.id, f)}
                      options={([1, 2, 3, 4] as const).map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Beobachtet (Fakt) */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <p className="text-[13px] font-medium text-slate-600">Beobachtet (was genau?)</p>
                <span className="ml-auto text-xs text-slate-400">nur das zählt als Beleg</span>
              </div>
              <div className="relative">
                <textarea
                  value={text}
                  onChange={(ev) => setText(ev.target.value)}
                  rows={4}
                  placeholder={kind === 'zitat' ? '„Ich habe erst die Zehner …“' : OBS_PLACEHOLDER}
                  className={clsx(inputCls, 'min-h-28 resize-y pb-12')}
                  autoFocus={!!e}
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
                  {words >= 4 && (
                    <Button variant="secondary" size="sm" onClick={() => runSuggest(true)} disabled={suggBusy}>
                      {suggBusy ? <Loader2 size={15} className="animate-spin text-violet-600" /> : <Sparkles size={15} className="text-violet-600" />} Vorschlag
                    </Button>
                  )}
                  {dictation.supported && (
                    <Button variant={dictation.active ? 'danger' : 'soft'} size="sm" onClick={dictation.toggle}>
                      <Mic size={15} className={clsx(dictation.active && 'animate-pulse')} /> {dictation.active ? 'Stopp' : 'Diktieren'}
                    </Button>
                  )}
                </div>
              </div>

              {sugg && sugg.traitWords.length > 0 && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] leading-snug text-amber-900 ring-1 ring-amber-200">
                  <Lightbulb size={15} className="mt-0.5 shrink-0" />
                  <span>
                    {sugg.traitWords.map((w) => `„${w}“`).join(', ')} {sugg.traitWords.length > 1 ? 'sind Deutungen' : 'ist eine Deutung'} – was genau war zu sehen?
                  </span>
                </p>
              )}

              {suggUseful && sugg && (
                <div className="space-y-2 rounded-xl bg-violet-50 p-2.5 ring-1 ring-violet-200">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-violet-600" />
                    <span className="text-xs font-semibold text-violet-800">Vorschlag – antippen zum Übernehmen</span>
                    <button onClick={applyAll} className="ml-auto rounded-full px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                      Alles übernehmen
                    </button>
                    <button onClick={() => setSugg(null)} className="flex size-7 items-center justify-center rounded-full text-violet-400 hover:bg-violet-100 hover:text-violet-700" aria-label="Vorschlag verwerfen">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggComps.map((c) => {
                      const on = competencyId === c.id
                      return (
                        <button
                          key={c.id}
                          onClick={() => applyComp(c)}
                          className={clsx('inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-left text-[13px] ring-1 transition', on ? 'bg-violet-600 text-white ring-violet-600' : 'bg-white text-violet-900 ring-violet-200 hover:bg-violet-100')}
                        >
                          {on && <Check size={13} className="shrink-0" />}
                          <span className="truncate">
                            <span className="opacity-70">{c.subject} · </span>
                            {c.text}
                          </span>
                          {sugg.level > 0 && <span className="shrink-0 font-semibold">· {LEVEL_LABEL[sugg.level]}</span>}
                        </button>
                      )
                    })}
                    {sugg.kind && sugg.kind !== kind && (
                      <button onClick={() => chooseKind(sugg.kind!)} className="inline-flex min-h-9 items-center rounded-full bg-white px-3 text-[13px] text-violet-900 ring-1 ring-violet-200 hover:bg-violet-100">
                        Art: {KIND_LABEL[sugg.kind]}
                      </button>
                    )}
                    {sugg.valence && sugg.valence !== valence && (
                      <button onClick={() => setValence(sugg.valence!)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] text-violet-900 ring-1 ring-violet-200 hover:bg-violet-100">
                        <ValenceDot v={sugg.valence} /> {VALENCE_LABEL[sugg.valence]}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {suggHint && <p className="text-xs text-slate-400">{suggHint}</p>}

              {/* Deutung */}
              {showInterp ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[13px] font-medium text-slate-600">Deutung (optional)</p>
                    <span className="text-xs text-slate-400">eigene Notiz, kein Beleg</span>
                    {!interpretation.trim() && (
                      <button onClick={() => setShowInterp(false)} className="ml-auto text-xs text-slate-400 hover:text-slate-700">
                        ausblenden
                      </button>
                    )}
                  </div>
                  <textarea value={interpretation} onChange={(ev) => setInterpretation(ev.target.value)} rows={2} placeholder="z. B. „Wirkt unsicher beim Zehnerübergang – vielleicht fehlt die Mengenvorstellung.“" className={clsx(inputCls, 'resize-y')} />
                </div>
              ) : (
                <button onClick={() => setShowInterp(true)} className="text-xs font-medium text-slate-500 hover:text-slate-800">
                  + Deutung (optional)
                </button>
              )}
            </div>

            <Segmented
              value={valence}
              onChange={setValence}
              options={VALENCES.map((v) => ({ value: v, label: <span className="inline-flex items-center gap-1.5"><ValenceDot v={v} /> {VALENCE_LABEL[v]}</span> }))}
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
            {comp && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <p className="text-[13px] font-medium text-slate-600">Stufe</p>
                  <button
                    onClick={() => setShowLevelHints((v) => !v)}
                    className={clsx('flex size-7 items-center justify-center rounded-full transition', showLevelHints ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700')}
                    aria-label="Stufenhinweise"
                    aria-expanded={showLevelHints}
                  >
                    <Info size={15} />
                  </button>
                </div>
                <Segmented value={level} onChange={setLevel} options={([0, 1, 2, 3, 4] as const).map((l) => ({ value: l, label: l ? LEVEL_LABEL[l] : 'ohne' }))} />
                {showLevelHints ? <LevelHints comp={comp} highlight={level} /> : level > 0 && <p className="text-xs text-slate-500">{levelHint(comp, level as 1 | 2 | 3 | 4)}</p>}
              </div>
            )}

            {/* Nächster Schritt */}
            {showNext && (
              <div className="space-y-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-slate-600">Nächster Schritt</p>
                  <span className="text-xs text-slate-400">optional</span>
                  <div className="ml-auto">
                    <Button variant="secondary" size="sm" onClick={fetchNext} disabled={nextBusy}>
                      {nextBusy ? <Loader2 size={15} className="animate-spin text-violet-600" /> : <Sparkles size={15} className="text-violet-600" />} Vorschläge
                    </Button>
                  </div>
                </div>
                {nextSugg.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {nextSugg.map((s) => (
                      <button
                        key={s}
                        onClick={() => setNextStep(s)}
                        className={clsx('min-h-9 rounded-full px-3 py-1 text-left text-[13px] ring-1 transition', nextStep === s ? 'bg-violet-600 text-white ring-violet-600' : 'bg-violet-50 text-violet-900 ring-violet-200 hover:bg-violet-100')}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {nextErr && <p className="text-xs text-slate-400">{nextErr}</p>}
                <input value={nextStep} onChange={(ev) => setNextStep(ev.target.value)} placeholder="z. B. Zehnerübergang mit Rechenschiffchen üben" className={inputCls} />
                {goalText && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex min-h-10 items-center gap-2.5 text-sm text-slate-700">
                      <input type="checkbox" checked={asGoal} onChange={(ev) => setAsGoal(ev.target.checked)} className="size-5 accent-brand-700" />
                      als Ziel übernehmen
                    </label>
                    {asGoal && (
                      <>
                        <select value={goalOwner} onChange={(ev) => setGoalOwner(ev.target.value as Owner)} className={clsx(inputCls, '!w-auto')} aria-label="Wer ist dran?">
                          {(Object.keys(OWNER_LABEL) as Owner[]).map((o) => (
                            <option key={o} value={o}>
                              {OWNER_LABEL[o]}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          Prüfen am
                          <input type="date" value={goalDue} onChange={(ev) => setGoalDue(ev.target.value)} className={clsx(inputCls, '!w-auto')} />
                        </label>
                      </>
                    )}
                  </div>
                )}
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

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Datum">
                <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={inputCls} />
              </Field>
              <Field label="Wiedervorlage">
                <input type="date" value={followUp} onChange={(ev) => setFollowUp(ev.target.value)} className={inputCls} />
              </Field>
              <label className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 ring-1 ring-slate-100">
                <input type="checkbox" checked={shareable} onChange={(ev) => setShareable(ev.target.checked)} className="size-5 accent-brand-700" />
                Im Gespräch zeigbar
              </label>
              <label title="nicht notenrelevant (§ 11 GrSO)" className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 ring-1 ring-slate-100">
                <input type="checkbox" checked={groupWork} onChange={(ev) => setGroupWork(ev.target.checked)} className="size-5 accent-brand-700" />
                <Users size={15} className="text-slate-400" />
                <span className="min-w-0">
                  Gruppenarbeit <span className="block text-xs text-slate-400">nicht notenrelevant (§ 11 GrSO)</span>
                </span>
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
            {recording ? 'Memo läuft – erst stoppen' : noKids ? 'Erst Kind wählen' : !canSave && !busy ? 'Text, Anhang oder Stufe ergänzen' : makeGoal ? `+ Ziel für ${names}` : ''}
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
