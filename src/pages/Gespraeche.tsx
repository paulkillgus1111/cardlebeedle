import clsx from 'clsx'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Loader2, MessagesSquare, Plus, Printer, Quote, SearchX, Smile, Target, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AiButton } from '../components/AiSheets'
import { AttachmentView } from '../components/media'
import { toast } from '../components/toast'
import { Avatar, Badge, Button, Card, Empty, Field, inputCls, PageHeader, Segmented, ValenceDot } from '../components/ui'
import { alive, aliveOne, db, now, save, uid, type Conversation, type Goal, type Observation } from '../lib/db'
import { ai, studentContext } from '../lib/ai'
import { useActiveClass, useClass, useCompetencies, useObservations, useStudents } from '../lib/hooks'
import { latestLevels, today } from '../lib/insights'
import { gradeProfile, KIND_LABEL, LEG_SECTIONS, LEVEL_LABEL } from '../lib/seed'

type ConvType = Conversation['type']
type ConvStatus = Conversation['status']

const TYPES: ConvType[] = ['leg', 'eltern', 'uebertritt', 'kind']
const TYPE_LABEL: Record<ConvType, string> = { leg: 'Lernentwicklungsgespräch', eltern: 'Elterngespräch', uebertritt: 'Übertrittsberatung', kind: 'Gespräch mit Kind' }
const TYPE_SHORT: Record<ConvType, string> = { leg: 'LEG', eltern: 'Eltern', uebertritt: 'Übertritt', kind: 'Kind' }
const TYPE_TONE: Record<ConvType, 'brand' | 'violet' | 'sky' | 'amber'> = { leg: 'brand', eltern: 'violet', uebertritt: 'sky', kind: 'amber' }
const STATUS_LABEL: Record<ConvStatus, string> = { vorbereitung: 'in Vorbereitung', gefuehrt: 'geführt', unterschrieben: 'unterschrieben' }
const STATUS_TONE: Record<ConvStatus, 'amber' | 'sky' | 'green'> = { vorbereitung: 'amber', gefuehrt: 'sky', unterschrieben: 'green' }
const isType = (t: string | null): t is ConvType => !!t && (TYPES as string[]).includes(t)

const ELTERN_SECTIONS = [
  { id: 'anlass', title: 'Anlass', hint: 'Warum findet das Gespräch statt?' },
  { id: 'staerken', title: 'Stärken (zuerst!)', hint: 'Was läuft gut?' },
  { id: 'lernarbeit', title: 'Lern- und Arbeitsverhalten', hint: '' },
  { id: 'sozial', title: 'Sozialverhalten', hint: '' },
  { id: 'leistung', title: 'Leistungsstand', hint: '' },
  { id: 'punkte', title: 'Gesprächspunkte / Fragen an die Eltern', hint: '' },
  { id: 'vereinbarungen', title: 'Vereinbarungen', hint: 'Wer macht was bis wann?' },
]

const fmtDate = (d: string, f = 'd.M.yyyy') => {
  try {
    return format(parseISO(d), f, { locale: de })
  } catch {
    return d
  }
}

const backLink = (
  <Link to="/gespraeche" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
    <ChevronLeft size={16} />
    Gespräche
  </Link>
)

export default function Gespraeche() {
  const { id, studentId } = useParams()
  if (id === 'neu') return studentId ? <NewConversation key={studentId} studentId={studentId} /> : <Navigate to="/gespraeche" replace />
  if (id) return <Editor key={id} id={id} />
  return <Overview />
}

function NotFound({ title, text }: { title: string; text: string }) {
  const nav = useNavigate()
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader title={title} back={backLink} />
      <Card>
        <Empty icon={SearchX}>{text}</Empty>
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => nav('/gespraeche')}>
            Zur Übersicht
          </Button>
        </div>
      </Card>
    </div>
  )
}

/* ───────────────────────────── Übersicht ───────────────────────────── */

type PlanFilter = 'alle' | 'offen' | 'vorbereitung' | 'gefuehrt' | 'unterschrieben'

function Overview() {
  const nav = useNavigate()
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const convsRaw = useLiveQuery(async () => (cls ? alive(await db.conversations.where('classId').equals(cls.id).toArray()) : []), [cls?.id]) ?? []
  const [filter, setFilter] = useState<PlanFilter>('alle')
  const convs = useMemo(() => {
    const ids = new Set(students.map((s) => s.id))
    return convsRaw.filter((c) => ids.has(c.studentId)).sort((a, b) => b.date.localeCompare(a.date))
  }, [convsRaw, students])
  if (!cls) return null
  const profile = gradeProfile(cls.gradeLevel)
  const plan = students.map((s) => ({ s, c: convs.find((x) => x.studentId === s.id && x.type === 'leg') }))
  const stateOf = (c?: Conversation): Exclude<PlanFilter, 'alle'> => (c ? c.status : 'offen')
  const done = plan.filter((p) => p.c && p.c.status !== 'vorbereitung').length
  const pct = students.length ? Math.round((done / students.length) * 100) : 0
  const counts = plan.reduce<Record<string, number>>((m, p) => ((m[stateOf(p.c)] = (m[stateOf(p.c)] ?? 0) + 1), m), {})
  const shown = plan.filter((p) => filter === 'alle' || stateOf(p.c) === filter)
  const byId = new Map(students.map((s) => [s.id, s]))

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow={cls.name}
        title="Gespräche"
        subtitle="Lernentwicklungs-, Eltern- und Beratungsgespräche vorbereiten und dokumentieren."
        actions={
          <Button variant="secondary" onClick={() => nav('/zeugnis')}>
            <FileText size={16} /> Zeugnistexte
          </Button>
        }
      />

      {profile.legPossible && students.length > 0 && (
        <Card title={`LEG-Saisonplaner · Jgst. ${cls.gradeLevel}`} icon={Users}>
          <div className="mb-5 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-slate-500">
                <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{done}</span>
                <span className="tabular-nums"> / {students.length}</span> Gespräche geführt
              </p>
              <span className="text-sm font-medium text-slate-500 tabular-nums">{pct} %</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="mb-4">
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={(['alle', 'offen', 'vorbereitung', 'gefuehrt', 'unterschrieben'] as PlanFilter[]).map((f) => ({
                value: f,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    {f === 'alle' ? 'Alle' : f === 'offen' ? 'Offen' : f === 'vorbereitung' ? 'Vorbereitet' : f === 'gefuehrt' ? 'Geführt' : 'Unterschrieben'}
                    <span className="text-slate-400 tabular-nums">{f === 'alle' ? students.length : (counts[f] ?? 0)}</span>
                  </span>
                ),
              }))}
            />
          </div>
          {shown.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map(({ s, c }) => {
                const st = stateOf(c)
                return (
                  <Link
                    key={s.id}
                    to={c ? `/gespraeche/${c.id}` : `/gespraeche/neu/${s.id}?type=leg`}
                    className="group flex min-h-[52px] items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-slate-300"
                  >
                    <Avatar student={s} size={34} />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                      {s.firstName} <span className="text-slate-400">{s.lastName}</span>
                    </span>
                    {st === 'offen' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                        <Plus size={14} /> vorbereiten
                      </span>
                    ) : (
                      <Badge tone={STATUS_TONE[st]}>{st === 'vorbereitung' ? 'vorbereitet' : STATUS_LABEL[st]}</Badge>
                    )}
                  </Link>
                )
              })}
            </div>
          ) : (
            <Empty>Keine Kinder in dieser Auswahl.</Empty>
          )}
        </Card>
      )}

      <Card title="Alle Gespräche" icon={MessagesSquare} padded={false} action={<span className="text-xs text-slate-400 tabular-nums">{convs.length}</span>} className="pb-2">
        {convs.length ? (
          <ul className="divide-y divide-slate-100 px-2">
            {convs.map((c) => {
              const s = byId.get(c.studentId)!
              return (
                <li key={c.id}>
                  <Link to={`/gespraeche/${c.id}`} className="flex min-h-[56px] items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50">
                    <Avatar student={s} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {s.firstName} {s.lastName}
                      </p>
                      <p className="truncate text-xs text-slate-500">{TYPE_LABEL[c.type]}</p>
                    </div>
                    <Badge tone={TYPE_TONE[c.type]} className="hidden sm:inline-flex">
                      {TYPE_SHORT[c.type]}
                    </Badge>
                    <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    <span className="hidden w-20 text-right text-sm text-slate-400 tabular-nums sm:block">{fmtDate(c.date)}</span>
                    <ChevronRight size={16} className="shrink-0 text-slate-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="px-5 pb-4">
            <Empty icon={MessagesSquare}>Noch keine Gespräche. In der Akte eines Kindes „Gespräch vorbereiten“ wählen{profile.legPossible ? ' oder oben im Saisonplaner ein Kind antippen' : ''}.</Empty>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ─────────────────────────── Neues Gespräch ─────────────────────────── */

function NewConversation({ studentId }: { studentId: string }) {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const student = useLiveQuery(async () => aliveOne(await db.students.get(studentId)) ?? null, [studentId])
  const cls = useClass(student?.classId)
  const presetRaw = params.get('type')
  const [picked, setType] = useState<ConvType | null>(isType(presetRaw) ? presetRaw : null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  if (student === null) return <NotFound title="Kind nicht gefunden" text="Dieses Kind gibt es nicht mehr – vielleicht wurde es gelöscht." />
  if (!student || !cls) return null
  const profile = gradeProfile(cls.gradeLevel)
  const type: ConvType = picked ?? (profile.legPossible ? 'leg' : cls.gradeLevel === 4 ? 'uebertritt' : 'eltern')
  const create = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const existing = alive(await db.conversations.where('studentId').equals(studentId).toArray())
        .filter((c) => c.type === type && c.status === 'vorbereitung')
        .sort((a, b) => b.date.localeCompare(a.date))[0]
      if (existing) {
        toast('Vorbereitung bereits angelegt – wird geöffnet')
        nav(`/gespraeche/${existing.id}`, { replace: true })
        return
      }
      const c: Conversation = { id: uid(), classId: cls.id, studentId, type, date: today(), status: 'vorbereitung', sections: {}, selfAssessment: [], updatedAt: now() }
      await save(db.conversations, c)
      nav(`/gespraeche/${c.id}`, { replace: true })
    } catch (e) {
      busyRef.current = false
      setBusy(false)
      toast((e as Error).message)
    }
  }
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader back={backLink} eyebrow={`${cls.name} · Jgst. ${cls.gradeLevel}`} title={`Gespräch mit ${student.firstName} vorbereiten`} subtitle="Welche Art von Gespräch steht an?" />
      <Card>
        <div className="space-y-2" role="radiogroup">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={clsx('flex min-h-[52px] w-full items-center gap-3 rounded-xl px-4 py-3 text-left ring-1 transition', type === t ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-white ring-slate-200 hover:bg-slate-50')}
            >
              <span className={clsx('flex size-5 shrink-0 items-center justify-center rounded-full ring-2', type === t ? 'bg-brand-600 ring-brand-600' : 'ring-slate-300')}>{type === t && <Check size={12} className="text-[#fff]" strokeWidth={3} />}</span>
              <span className="flex-1 font-medium text-slate-800">{TYPE_LABEL[t]}</span>
              {t === 'leg' && !profile.legPossible && <span className="text-xs text-slate-400">regulär Jgst. 1–3</span>}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Button size="lg" onClick={create} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            Vorbereitung starten
          </Button>
        </div>
      </Card>
    </div>
  )
}

/* ───────────────────────────── Editor ───────────────────────────── */

/** Welche Beobachtungen passen zu welchem Abschnitt? */
function evidenceFor(section: string, o: Observation) {
  switch (section) {
    case 'sozial':
      return o.kind === 'sozialverhalten' || (o.kind === 'vorfall' && !o.subject)
    case 'lernarbeit':
      return o.kind === 'arbeitsverhalten'
    case 'deutsch':
      return o.subject === 'Deutsch'
    case 'mathe':
      return o.subject === 'Mathematik'
    case 'weitere':
      return !!o.subject && o.subject !== 'Deutsch' && o.subject !== 'Mathematik'
    case 'staerken':
      return o.kind === 'staerke' || o.valence === 'pos'
    case 'leistung':
      return !!o.subject && (o.kind === 'lernstand' || o.kind === 'diagnose' || o.kind === 'arbeitsprobe' || o.kind === 'beobachtung')
    case 'unterstuetzung':
      return o.kind === 'foerderbedarf'
    default:
      return false
  }
}

const appendLine = (d: Conversation, sid: string, line: string): Conversation => ({
  ...d,
  sections: { ...d.sections, [sid]: (d.sections[sid]?.trim() ? d.sections[sid].replace(/\s+$/, '') + '\n' : '') + '• ' + line },
})

const SMILEYS = ['', '☹️', '😐', '🙂'] as const
const SMILEY_LABEL = ['', 'fällt mir schwer', 'geht so', 'kann ich gut']

function Editor({ id }: { id: string }) {
  const nav = useNavigate()
  const conv = useLiveQuery(async () => aliveOne(await db.conversations.get(id)) ?? null, [id])
  const student = useLiveQuery(async () => (conv ? (aliveOne(await db.students.get(conv.studentId)) ?? null) : undefined), [conv?.studentId])
  const cls = useClass(conv?.classId)
  const obsAll = useObservations(conv?.classId)
  const comps = useCompetencies(cls)
  const goals = useLiveQuery(async () => (conv ? alive(await db.goals.where('studentId').equals(conv.studentId).toArray()) : []), [conv?.studentId]) ?? []
  const prevConv = useLiveQuery(async () => {
    if (!conv) return undefined
    return (
      alive(await db.conversations.where('studentId').equals(conv.studentId).toArray())
        .filter((c) => c.id !== conv.id && c.type === conv.type && c.status !== 'vorbereitung' && c.date < conv.date)
        .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    )
  }, [conv?.id, conv?.studentId, conv?.type, conv?.date])

  const [draft, setDraft] = useState<Conversation | null>(null)
  const draftRef = useRef<Conversation | null>(null)
  const dirtyRef = useRef(false)
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving'>('saved')
  const [mode, setMode] = useState<'vorbereitung' | 'gespraech'>('vorbereitung')
  const [since, setSince] = useState('')
  const sinceFor = useRef<string | null>(null)
  const [focus, setFocus] = useState('')
  const [newGoal, setNewGoal] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [touched, setTouched] = useState<Set<string>>(() => new Set())

  // Entwurf einmal pro Gespräch aus der Datenbank übernehmen
  useEffect(() => {
    if (conv && (!draftRef.current || draftRef.current.id !== conv.id)) {
      draftRef.current = conv
      setDraft(conv)
    }
  }, [conv])

  // „Belege seit“: Vorgabe genau einmal pro Gespräch setzen, danach frei änderbar (auch leer)
  useEffect(() => {
    if (!conv || prevConv === undefined || sinceFor.current === conv.id) return
    sinceFor.current = conv.id
    setSince(prevConv?.date ?? '')
  }, [conv, prevConv])

  const flush = useCallback(async () => {
    const d = draftRef.current
    if (!dirtyRef.current || !d) return
    dirtyRef.current = false
    setSaveState('saving')
    try {
      await save(db.conversations, d)
      setSaveState(dirtyRef.current ? 'dirty' : 'saved')
    } catch (e) {
      dirtyRef.current = true
      setSaveState('dirty')
      toast('Speichern fehlgeschlagen: ' + (e as Error).message)
    }
  }, [])

  const apply = useCallback(
    (fn: (d: Conversation) => Conversation, immediate = false) => {
      const cur = draftRef.current
      if (!cur) return
      const next = fn(cur)
      draftRef.current = next
      dirtyRef.current = true
      setDraft(next)
      setSaveState('dirty')
      if (immediate) void flush()
    },
    [flush],
  )

  // Automatisch speichern: 1,5 s nach der letzten Änderung
  useEffect(() => {
    if (saveState !== 'dirty') return
    const t = setTimeout(() => void flush(), 1500)
    return () => clearTimeout(t)
  }, [draft, saveState, flush])

  // Beim Verlassen, Schließen oder App-Wechsel (iPad) sofort sichern
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      void flush()
      e.preventDefault()
    }
    const onHide = () => document.visibilityState === 'hidden' && void flush()
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('visibilitychange', onHide)
      void flush()
    }
  }, [flush])

  const obs = useMemo(() => obsAll.filter((o) => conv && o.studentIds.includes(conv.studentId) && (!since || o.date >= since)), [obsAll, conv, since])
  const latest = useMemo(() => latestLevels(obs), [obs])

  if (conv === null) return <NotFound title="Gespräch nicht gefunden" text="Dieses Gespräch gibt es nicht mehr – vielleicht wurde es gelöscht." />
  if (student === null) return <NotFound title="Kind nicht gefunden" text="Das Kind zu diesem Gespräch wurde gelöscht." />
  if (!draft || !student || !cls) return null

  const present = mode === 'gespraech'
  const sections = draft.type === 'leg' ? LEG_SECTIONS : ELTERN_SECTIONS
  const focused = sections.find((s) => s.id === focus) ?? sections[0]
  const set = (patch: Partial<Conversation>) => apply((d) => ({ ...d, ...patch }))
  const setSection = (sid: string, text: string) => apply((d) => ({ ...d, sections: { ...d.sections, [sid]: text } }))
  const append = (sid: string, line: string) => apply((d) => appendLine(d, sid, line))
  const describe = (o: Observation) => {
    const c = comps.find((x) => x.id === o.competencyId)
    return [c?.text, o.level ? LEVEL_LABEL[o.level] : '', o.text].filter(Boolean).join(' – ')
  }
  const evidence = (sid: string) => obs.filter((o) => evidenceFor(sid, o) && (!present || o.shareable))

  const reviewGoals = goals.filter(
    (g) => g.conversationId !== draft.id && g.status !== 'verworfen' && (g.status === 'offen' || g.status === 'teilweise' || touched.has(g.id) || (!!prevConv && g.conversationId === prevConv.id)),
  )
  const convGoals = goals.filter((g) => g.conversationId === draft.id)
  const photos = obs.filter((o) => o.shareable).flatMap((o) => o.attachments.filter((a) => a.type !== 'audio').map((a) => ({ ...a, obsId: o.id })))

  const saveNow = async () => {
    dirtyRef.current = true
    await flush()
    toast('Gespeichert')
  }

  const draftAll = async () => {
    setDrafting(true)
    try {
      const cur = draftRef.current ?? draft
      const res = await ai<{ json: { sections: { id: string; text: string }[] } }>('leg', {
        gespraech: TYPE_LABEL[cur.type],
        abschnitte: sections.map((s) => ({ id: s.id, titel: s.title, hinweis: s.hint })),
        ...studentContext(student, cls, obs, comps, goals),
        selbsteinschaetzung: cur.selfAssessment,
        ziele_letztes_gespraech: reviewGoals.map((g) => `${g.text} (${g.status})`),
      })
      let filled = 0
      apply((d) => {
        const next = { ...d.sections }
        for (const sec of res.json.sections) {
          if (!sections.some((s) => s.id === sec.id)) continue
          next[sec.id] = next[sec.id]?.trim() ? `${next[sec.id]}\n\n— KI-Entwurf —\n${sec.text}` : sec.text
          filled++
        }
        return { ...d, sections: next }
      }, true)
      toast(`${filled} Abschnitte entworfen – bitte prüfen`)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setDrafting(false)
    }
  }

  const addGoal = async () => {
    const text = newGoal.trim()
    if (!text) return
    const g: Goal = { id: uid(), studentId: student.id, classId: cls.id, text, kind: draft.type === 'eltern' ? 'vereinbarung' : 'lernziel', status: 'offen', createdAt: now(), updatedAt: now(), conversationId: draft.id }
    setNewGoal('')
    await save(db.goals, g)
    apply((d) => appendLine(d, 'ziele', text), true)
  }

  // Selbsteinschätzung aus eingeschätzten Kompetenzen vorschlagen
  const suggestSelf = () => {
    const items = comps
      .filter((c) => latest.has(`${student.id}:${c.id}`))
      .slice(0, 8)
      .map((c) => ({ text: `Ich kann: ${c.text}` }))
    const base = [{ text: 'Ich halte mich an die Klassenregeln.' }, { text: 'Ich arbeite konzentriert.' }, { text: 'Ich helfe anderen.' }]
    apply((d) => {
      const have = new Set(d.selfAssessment.map((x) => x.text.trim().toLowerCase()))
      const add = [...base, ...items].filter((x) => !have.has(x.text.trim().toLowerCase()))
      if (!add.length) toast('Alle Vorschläge sind schon enthalten')
      else toast(`${add.length} Aussagen ergänzt`)
      return add.length ? { ...d, selfAssessment: [...d.selfAssessment, ...add] } : d
    })
  }

  const saveIndicator = (
    <span className={clsx('inline-flex h-10 items-center gap-1.5 px-1 text-[13px] font-medium', saveState === 'saved' ? 'text-emerald-600' : 'text-slate-400')} aria-live="polite">
      {saveState === 'saved' ? (
        <>
          <Check size={15} strokeWidth={2.5} /> Gespeichert
        </>
      ) : (
        <>
          <Loader2 size={15} className="animate-spin" /> Speichert…
        </>
      )}
    </span>
  )

  const evidenceList = (sid: string, compact = false) => {
    const ev = evidence(sid)
    if (!ev.length) return <p className="py-4 text-center text-sm text-slate-400">{since ? 'Keine passenden Belege in diesem Zeitraum.' : 'Keine passenden Belege in der Akte.'}</p>
    return (
      <ul className={clsx('space-y-1.5', compact && 'max-h-72 overflow-y-auto')}>
        {ev.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => append(sid, describe(o))}
              className="group flex min-h-[44px] w-full items-start gap-2.5 rounded-xl bg-white p-2.5 text-left text-[13px] leading-snug ring-1 ring-slate-200 transition hover:ring-brand-500 active:scale-[0.99]"
            >
              <span className="mt-1.5">
                <ValenceDot v={o.valence} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="mb-0.5 block text-[11px] text-slate-400">
                  {fmtDate(o.date, 'd.M.')} · {KIND_LABEL[o.kind]}
                  {o.subject ? ` · ${o.subject}` : ''}
                  {o.shareable ? ' · zeigbar' : ''}
                </span>
                <span className="text-slate-700">{describe(o)}</span>
              </span>
              <Plus size={15} className="mt-0.5 shrink-0 text-slate-300 group-hover:text-brand-600" />
            </button>
          </li>
        ))}
      </ul>
    )
  }

  const goalReview = reviewGoals.length > 0 && (
    <Card title={prevConv ? `Ziele seit dem letzten Gespräch (${fmtDate(prevConv.date)})` : 'Offene Ziele'} icon={Target}>
      <ul className="divide-y divide-slate-100">
        {reviewGoals.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className={clsx('min-w-0 flex-1', present ? 'text-lg' : 'text-[15px]', g.status === 'erreicht' ? 'text-slate-500' : 'text-slate-800')}>
              {g.status === 'erreicht' && <Check size={16} className="mr-1.5 inline text-emerald-600" strokeWidth={2.5} />}
              {g.text}
            </span>
            <span className="print:hidden">
              <Segmented
                size="sm"
                value={g.status}
                onChange={(status) => {
                  setTouched((t) => new Set(t).add(g.id))
                  void save(db.goals, { ...g, status })
                }}
                options={[
                  { value: 'offen', label: 'noch nicht' },
                  { value: 'teilweise', label: 'teilweise' },
                  { value: 'erreicht', label: 'erreicht' },
                ]}
              />
            </span>
            <span className="hidden text-sm text-slate-600 print:inline">{{ offen: 'noch nicht', teilweise: 'teilweise', erreicht: 'erreicht', verworfen: 'verworfen' }[g.status]}</span>
          </li>
        ))}
      </ul>
    </Card>
  )

  const sectionCards = sections.map((sec) => {
    const text = draft.sections[sec.id] ?? ''
    const evCount = evidence(sec.id).length
    const isFocus = !present && focused.id === sec.id
    return (
      <section
        key={sec.id}
        onFocusCapture={() => setFocus(sec.id)}
        className={clsx(
          'min-w-0 rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 transition print:break-inside-avoid print:p-0 print:shadow-none print:ring-0',
          isFocus ? 'ring-brand-300' : 'ring-slate-200/80',
        )}
      >
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={clsx('font-semibold tracking-tight text-slate-900', present ? 'text-xl' : 'text-[15px]')}>{sec.title}</h2>
            {sec.hint && !present && <p className="mt-0.5 text-xs text-slate-400 print:hidden">{sec.hint}</p>}
          </div>
          {!present && evCount > 0 && (
            <button type="button" onClick={() => setFocus(sec.id)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 print:hidden">
              <Quote size={12} className="mr-1 inline" />
              {evCount} Belege
            </button>
          )}
        </header>
        <textarea
          value={text}
          onChange={(e) => setSection(sec.id, e.target.value)}
          rows={Math.max(present ? 2 : 3, text.split('\n').length + 1)}
          placeholder={present ? '' : 'Stichpunkte oder Text …'}
          className={clsx(inputCls, 'resize-y print:hidden', present && '!text-lg leading-relaxed')}
        />
        <div className="hidden text-[11pt] leading-relaxed whitespace-pre-wrap print:block">{text || '—'}</div>

        {sec.id === 'ziele' && (
          <div className="mt-3 space-y-2 print:hidden">
            {convGoals.length > 0 && (
              <ul className="space-y-1">
                {convGoals.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <Target size={14} className="text-brand-600" /> {g.text}
                    <span className="text-xs text-slate-400">· in der Akte</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addGoal()}
                placeholder="Neues Ziel – wird auch in der Akte angelegt"
                className={inputCls}
              />
              <Button variant="secondary" onClick={() => void addGoal()} aria-label="Ziel anlegen" disabled={!newGoal.trim()}>
                <Plus size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Belege auf schmalen Bildschirmen direkt unter dem Abschnitt */}
        {isFocus && evCount > 0 && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3 lg:hidden print:hidden">
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Belege – antippen zum Übernehmen</p>
            {evidenceList(sec.id, true)}
          </div>
        )}

        {present && evCount > 0 && (
          <ul className="mt-4 space-y-2 print:hidden">
            {evidence(sec.id).map((o) => (
              <li key={o.id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 text-base leading-relaxed text-slate-700">
                <span className="mt-2.5">
                  <ValenceDot v={o.valence} />
                </span>
                <span>{describe(o)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  })

  const selfCard = draft.type === 'leg' && (
    <Card
      title="Selbsteinschätzung des Kindes"
      icon={Smile}
      className="print:break-inside-avoid print:p-0 print:shadow-none print:ring-0"
      action={
        !present && (
          <Button size="sm" variant="ghost" className="print:hidden" onClick={suggestSelf}>
            Vorschlag aus Akte
          </Button>
        )
      }
    >
      {draft.selfAssessment.length === 0 && <p className="mb-2 text-sm text-slate-400 print:hidden">Noch keine Aussagen. „Vorschlag aus Akte“ füllt typische Ich-kann-Sätze ein.</p>}
      <ul className="space-y-3">
        {draft.selfAssessment.map((item, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-2 pl-3 sm:flex-row sm:items-center sm:gap-3 print:flex-row print:items-center print:bg-transparent print:p-0">
            <textarea
              value={item.text}
              rows={Math.max(1, Math.ceil(item.text.length / 34))}
              onChange={(e) => set({ selfAssessment: draft.selfAssessment.map((x, j) => (j === i ? { ...x, text: e.target.value.replace(/\n/g, ' ') } : x)) })}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              className={clsx(
                'w-full min-w-0 flex-1 resize-none bg-transparent py-2 leading-snug font-medium break-words text-slate-800 outline-none [field-sizing:content] print:hidden',
                present ? 'text-xl' : 'text-[15px]',
              )}
              style={{ minHeight: '2.5rem' }}
            />
            <span className="hidden flex-1 print:block">{item.text}</span>
            <div className="flex shrink-0 gap-2 self-end sm:self-auto" role="radiogroup" aria-label={item.text}>
              {([1, 2, 3] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={item.value === v}
                  aria-label={SMILEY_LABEL[v]}
                  title={SMILEY_LABEL[v]}
                  onClick={() => set({ selfAssessment: draft.selfAssessment.map((x, j) => (j === i ? { ...x, value: x.value === v ? undefined : v } : x)) })}
                  className={clsx(
                    'flex items-center justify-center rounded-full transition active:scale-95',
                    present ? 'size-16 text-4xl' : 'size-12 text-3xl',
                    item.value === v ? 'bg-white shadow-md ring-2 ring-brand-500' : 'opacity-40 grayscale hover:opacity-70 print:hidden',
                  )}
                >
                  {SMILEYS[v]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {!present && (
        <Button size="sm" variant="ghost" className="mt-3 print:hidden" onClick={() => set({ selfAssessment: [...draft.selfAssessment, { text: 'Ich kann …' }] })}>
          <Plus size={14} /> Aussage
        </Button>
      )}
    </Card>
  )

  const viewField = (title: string, value: string | undefined, onChange: (v: string) => void) => (
    <Card title={title} className="print:break-inside-avoid print:p-0 print:shadow-none print:ring-0">
      <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={Math.max(4, (value ?? '').split('\n').length + 1)} className={clsx(inputCls, 'resize-y print:hidden', present && '!text-lg leading-relaxed')} />
      <div className="hidden text-[11pt] leading-relaxed whitespace-pre-wrap print:block">{value || '—'}</div>
    </Card>
  )

  const views = (
    <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
      {draft.type === 'leg'
        ? viewField('Sicht des Kindes', draft.childView, (v) => set({ childView: v }))
        : viewField('Sicht der Eltern', draft.parentsView, (v) => set({ parentsView: v }))}
      {draft.type === 'leg' ? viewField('Sicht der Eltern', draft.parentsView, (v) => set({ parentsView: v })) : viewField('Notizen', draft.notes, (v) => set({ notes: v }))}
    </div>
  )

  return (
    <div className={clsx('mx-auto space-y-6 px-4 py-6 md:px-8 md:py-8 print:max-w-none print:space-y-5 print:p-0', present ? 'max-w-4xl' : 'max-w-7xl')}>
      {/* Werkzeugleiste */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {backLink}
        <span className="flex-1" />
        {saveIndicator}
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'vorbereitung', label: 'Vorbereitung' },
            { value: 'gespraech', label: 'Gesprächsansicht' },
          ]}
        />
        {!present && (
          <AiButton size="md" busy={drafting} onClick={draftAll}>
            KI-Entwurf
          </AiButton>
        )}
        <Button variant="secondary" onClick={() => window.print()} aria-label="Drucken oder als PDF sichern">
          <Printer size={16} /> <span className="hidden sm:inline">Drucken</span>
        </Button>
      </div>

      {/* Kopf */}
      <div className={clsx('flex flex-wrap items-center gap-4', present && 'rounded-3xl bg-gradient-to-br from-brand-50 to-white p-6 ring-1 ring-brand-100 print:bg-none print:p-0 print:ring-0')}>
        <span className="print:hidden">
          <Avatar student={student} size={present ? 72 : 56} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[13px] font-medium text-slate-500">{TYPE_LABEL[draft.type]}</p>
          <h1 className={clsx('leading-tight font-semibold tracking-tight text-slate-900', present ? 'text-3xl md:text-4xl' : 'text-[26px] md:text-[28px]')}>
            {student.firstName} {student.lastName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {cls.name} · Jgst. {cls.gradeLevel} · Schuljahr {cls.schoolYear}
            <span className="hidden print:inline"> · Gespräch am {fmtDate(draft.date, 'd. MMMM yyyy')}</span>
          </p>
        </div>
        {present && <Badge tone={STATUS_TONE[draft.status]} className="print:hidden">{fmtDate(draft.date, 'd. MMMM yyyy')}</Badge>}
      </div>

      {!present && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/60 print:hidden">
          <div className="w-40">
            <Field label="Datum">
              <input type="date" value={draft.date} onChange={(e) => e.target.value && set({ date: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="w-48">
            <Field label="Status">
              <select value={draft.status} onChange={(e) => set({ status: e.target.value as ConvStatus })} className={inputCls}>
                <option value="vorbereitung">in Vorbereitung</option>
                <option value="gefuehrt">geführt</option>
                <option value="unterschrieben">unterschrieben</option>
              </select>
            </Field>
          </div>
          <div className="min-w-[12rem] flex-1">
            <Field label="Teilnehmende">
              <input value={draft.participants ?? ''} onChange={(e) => set({ participants: e.target.value })} placeholder="z. B. Kind, Mutter, Lehrkraft" className={inputCls} />
            </Field>
          </div>
        </div>
      )}
      {draft.participants && <p className="hidden text-sm print:block">Teilnehmende: {draft.participants}</p>}

      {present ? (
        <div className="space-y-5">
          {goalReview}
          {sectionCards}
          {selfCard}
          {photos.length > 0 && (
            <Card title="Arbeitsproben" icon={ImageIcon} className="print:hidden">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((a) => (
                  <AttachmentView key={a.id} a={a} owner={{ table: 'observations', id: a.obsId }} className="aspect-[4/3] w-full rounded-2xl object-cover ring-1 ring-slate-200" />
                ))}
              </div>
            </Card>
          )}
          {views}
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] print:block">
          <div className="space-y-4 print:space-y-5">
            {goalReview}
            {sectionCards}
            {selfCard}
            {views}
          </div>
          <aside className="hidden lg:sticky lg:top-4 lg:block print:hidden">
            <div className="flex max-h-[calc(100dvh-2rem)] flex-col rounded-2xl bg-slate-50 ring-1 ring-slate-200/70">
              <div className="space-y-3 border-b border-slate-200/70 p-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Belege aus der Akte</p>
                  <p className="mt-0.5 font-semibold tracking-tight text-slate-900">{focused.title}</p>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label="Belege seit">
                      <input type="date" value={since} onChange={(e) => setSince(e.target.value)} className={clsx(inputCls, '!py-2 !text-sm')} />
                    </Field>
                  </div>
                  {since && (
                    <Button size="sm" variant="ghost" onClick={() => setSince('')}>
                      Alle
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-400">Antippen übernimmt den Beleg als Stichpunkt.</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">{evidenceList(focused.id)}</div>
            </div>
          </aside>
          {/* „Belege seit“ auch auf schmalen Bildschirmen erreichbar */}
          <div className="flex items-end gap-2 lg:hidden print:hidden">
            <div className="w-48">
              <Field label="Belege seit">
                <input type="date" value={since} onChange={(e) => setSince(e.target.value)} className={inputCls} />
              </Field>
            </div>
            {since && (
              <Button variant="ghost" onClick={() => setSince('')}>
                Alle Belege
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Druck: Unterschriften */}
      <div className="hidden grid-cols-3 gap-8 pt-16 text-sm print:grid">
        {['Kind', 'Erziehungsberechtigte', 'Lehrkraft'].map((x) => (
          <div key={x} className="border-t border-slate-400 pt-1">
            {x}
          </div>
        ))}
      </div>
      <p className="hidden text-xs text-slate-400 print:block">
        {TYPE_LABEL[draft.type]} vom {fmtDate(draft.date, 'd. MMMM yyyy')} · erstellt am {format(new Date(), 'd. MMMM yyyy', { locale: de })} · in Anlehnung an den ISB-Dokumentationsbogen
      </p>

      <div className="flex items-center justify-end gap-3 print:hidden">
        {saveIndicator}
        <Button variant="secondary" onClick={() => void saveNow()}>
          Jetzt speichern
        </Button>
        <Button onClick={() => void saveNow().then(() => nav('/gespraeche'))}>Fertig</Button>
      </div>
    </div>
  )
}
