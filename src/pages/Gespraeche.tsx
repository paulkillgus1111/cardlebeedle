import clsx from 'clsx'
import { addWeeks, format, formatISO, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Baby, Check, ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Loader2, MessagesSquare, Pencil, Plus, Printer, Quote, SearchX, Smile, Target, Users, Volume2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AiButton } from '../components/AiSheets'
import { AttachmentView, VoiceRecorder } from '../components/media'
import { toast } from '../components/toast'
import { Avatar, Badge, Button, Card, Empty, Field, inputCls, PageHeader, Segmented, ValenceDot } from '../components/ui'
import { alive, aliveOne, db, now, save, uid, type Conversation, type Goal, type Observation } from '../lib/db'
import { ai, studentEvidenceContext, type CitedSentence } from '../lib/ai'
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

/** Kompetenzstufe der Lehrkraft (1–4) auf die Smiley-Skala (1–3) abbilden */
const levelToSmiley = (l: number): 1 | 2 | 3 => (l <= 1 ? 1 : l === 2 ? 2 : 3)

const GOAL_OWNER_LABEL: Record<NonNullable<Goal['owner']>, string> = { kind: 'Kind', eltern: 'Eltern', lehrkraft: 'Lehrkraft' }
const defaultDue = () => formatISO(addWeeks(new Date(), 4), { representation: 'date' })

/** KI-Satz, der vor der Übernahme geprüft werden muss (nur im Komponenten-State) */
type AiSentence = CitedSentence & { key: string; state: 'offen' | 'uebernommen' | 'verworfen'; editing?: string }
type AiDraft = { sections: Record<string, AiSentence[]>; map: Map<string, Observation> }

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
  const [newOwner, setNewOwner] = useState<NonNullable<Goal['owner']>>('kind')
  const [newStrategy, setNewStrategy] = useState('')
  const [newDue, setNewDue] = useState(defaultDue)
  const [drafting, setDrafting] = useState(false)
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null)
  const [openChip, setOpenChip] = useState<string | null>(null)
  const [kidMode, setKidMode] = useState(false)
  const pendingRef = useRef(0)
  const pendingCount = aiDraft ? Object.values(aiDraft.sections).flat().filter((x) => x.state === 'offen').length : 0
  pendingRef.current = pendingCount

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
      // Ungeprüfte KI-Sätze liegen nur im State → beim Verlassen warnen
      if (!dirtyRef.current && !pendingRef.current) return
      if (dirtyRef.current) void flush()
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
  // Für den Vergleich Kind ↔ Lehrkraft: jeweils die zuletzt eingeschätzte Stufe (unabhängig von „Belege seit“)
  const latestAll = useMemo(() => latestLevels(obsAll.filter((o) => conv && o.studentIds.includes(conv.studentId) && !o.seenOnly)), [obsAll, conv])

  // Kind-Modus: Seite darunter nicht scrollen
  useEffect(() => {
    if (!kidMode) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [kidMode])

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
      // Belege mit IDs (e1, e2 …); „gesehen, unauffällig“ schließt der Helper aus
      const ctx = studentEvidenceContext(student, cls, obs, comps, goals)
      const res = await ai<{ json: { sections: { id: string; sentences: CitedSentence[] }[] } }>('leg2', {
        ...ctx.data,
        gespraech: TYPE_LABEL[cur.type],
        abschnitte: sections.map((s) => ({ id: s.id, titel: s.title, hinweis: s.hint })),
      })
      let count = 0
      setAiDraft((prev) => {
        // Bereits geprüfte Sätze verwerfen wir aus der Liste, offene bleiben erhalten
        const next: Record<string, AiSentence[]> = {}
        if (prev) for (const [k, v] of Object.entries(prev.sections)) next[k] = v.filter((x) => x.state === 'offen')
        for (const sec of res.json?.sections ?? []) {
          if (!sections.some((s) => s.id === sec.id)) continue
          const add = (sec.sentences ?? [])
            .filter((x) => x?.text?.trim())
            .map((x) => ({ key: uid(), text: x.text.trim(), evidence: (x.evidence ?? []).filter((e) => ctx.map.has(e)), state: 'offen' as const }))
          count += add.length
          next[sec.id] = [...(next[sec.id] ?? []), ...add]
        }
        // Zuordnung der Beleg-IDs: neue Belege gewinnen (alte offene Sätze verweisen evtl. auf alte IDs)
        const map = new Map(prev?.map ?? [])
        for (const [k, v] of ctx.map) map.set(k, v)
        return { sections: next, map }
      })
      toast(`${count} Sätze entworfen – bitte jeden Satz prüfen`)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setDrafting(false)
    }
  }

  const updateSentence = (sid: string, key: string, patch: Partial<AiSentence>) =>
    setAiDraft((d) => (d ? { ...d, sections: { ...d.sections, [sid]: (d.sections[sid] ?? []).map((x) => (x.key === key ? { ...x, ...patch } : x)) } } : d))
  const acceptSentence = (sid: string, s: AiSentence, text = s.text) => {
    const t = text.trim()
    if (!t) return
    apply((d) => {
      const cur = d.sections[sid] ?? ''
      return { ...d, sections: { ...d.sections, [sid]: (cur.trim() ? cur.replace(/\s+$/, '') + '\n' : '') + t } }
    })
    updateSentence(sid, s.key, { state: 'uebernommen', text: t, editing: undefined })
  }

  const addGoal = async () => {
    const text = newGoal.trim()
    if (!text) return
    const strategy = newStrategy.trim()
    const g: Goal = {
      id: uid(),
      studentId: student.id,
      classId: cls.id,
      text,
      kind: draft.type === 'eltern' ? 'vereinbarung' : 'lernziel',
      status: 'offen',
      createdAt: now(),
      updatedAt: now(),
      conversationId: draft.id,
      owner: newOwner,
      ...(strategy ? { strategy } : {}),
      ...(newDue ? { due: newDue } : {}),
    }
    setNewGoal('')
    setNewStrategy('')
    setNewDue(defaultDue())
    await save(db.goals, g)
    const meta = [GOAL_OWNER_LABEL[newOwner], strategy && `so üben wir: ${strategy}`, newDue && `überprüfen bis ${fmtDate(newDue)}`].filter(Boolean).join(' · ')
    const line = `${text} (${meta})`
    apply((d) => appendLine(d, 'ziele', line), true)
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

  const aiTotal = aiDraft ? Object.values(aiDraft.sections).flat().length : 0
  const blockReason = `Noch ${pendingCount === 1 ? '1 ungeprüfter KI-Satz' : `${pendingCount} ungeprüfte KI-Sätze`}: bitte übernehmen, bearbeiten oder verwerfen – erst dann kann das Gespräch als geführt/unterschrieben markiert oder gedruckt werden.`

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

  const goalMeta = (g: Goal, review = false) => {
    const overdue = !!g.due && g.due < today() && g.status !== 'erreicht' && g.status !== 'verworfen'
    if (!g.owner && !g.strategy && !g.due) return null
    return (
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-normal text-slate-500">
        {g.owner && <span>Wer: {GOAL_OWNER_LABEL[g.owner]}</span>}
        {g.strategy && <span>· So üben wir: {g.strategy}</span>}
        {g.due && (
          <span className={clsx(overdue && 'rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200')}>
            {review || overdue ? 'Überprüfen bis' : '· bis'} {fmtDate(g.due)}
            {overdue && ' – überfällig'}
          </span>
        )}
      </span>
    )
  }

  const aiReview = (sid: string) => {
    const list = aiDraft?.sections[sid]
    if (!list?.length || present) return null
    const done = list.filter((x) => x.state !== 'offen').length
    return (
      <div className="mb-3 rounded-xl bg-violet-50/60 p-3 ring-1 ring-violet-200 print:hidden">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-wider text-violet-700 uppercase">KI-Entwurf – Satz für Satz prüfen</p>
          <span className={clsx('text-xs font-medium tabular-nums', done === list.length ? 'text-emerald-700' : 'text-violet-700')}>
            {done}/{list.length} geprüft
          </span>
        </div>
        <ul className="space-y-2">
          {list.map((x) => {
            const ev = x.evidence.filter((e) => aiDraft!.map.has(e))
            const decided = x.state !== 'offen'
            return (
              <li key={x.key} className={clsx('rounded-lg bg-white p-2.5 ring-1 ring-slate-200', decided && 'opacity-55')}>
                {x.editing !== undefined ? (
                  <textarea
                    autoFocus
                    value={x.editing}
                    onChange={(e) => updateSentence(sid, x.key, { editing: e.target.value })}
                    rows={Math.max(2, Math.ceil(x.editing.length / 60))}
                    className={clsx(inputCls, 'resize-y !text-sm')}
                  />
                ) : (
                  <p
                    className={clsx(
                      'text-sm leading-relaxed text-slate-800',
                      x.state === 'verworfen' && 'line-through',
                      !ev.length && 'underline decoration-amber-400 decoration-wavy decoration-2 underline-offset-4',
                    )}
                  >
                    {x.text}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {ev.length ? (
                    ev.map((e) => {
                      const o = aiDraft!.map.get(e)!
                      const chipId = `${x.key}:${e}`
                      return (
                        <span key={e} className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenChip(openChip === chipId ? null : chipId)}
                            className={clsx('inline-flex min-h-[28px] items-center gap-1 rounded-full px-2 text-[11px] font-medium ring-1 transition', openChip === chipId ? 'bg-violet-600 text-[#fff] ring-violet-600' : 'bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100')}
                          >
                            <Quote size={10} /> {fmtDate(o.date, 'd.M.')}
                          </button>
                          {openChip === chipId && (
                            <span className="absolute top-full left-0 z-30 mt-1 block w-72 max-w-[80vw] rounded-xl bg-white p-3 text-left text-xs leading-snug shadow-lg ring-1 ring-slate-200">
                              <span className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                                <span>
                                  {fmtDate(o.date)} · {KIND_LABEL[o.kind]}
                                  {o.subject ? ` · ${o.subject}` : ''}
                                </span>
                                <button type="button" onClick={() => setOpenChip(null)} aria-label="Schließen" className="rounded p-0.5 hover:bg-slate-100">
                                  <X size={12} />
                                </button>
                              </span>
                              <span className="flex items-start gap-2 text-slate-700">
                                <span className="mt-1">
                                  <ValenceDot v={o.valence} />
                                </span>
                                <span>{describe(o)}</span>
                              </span>
                            </span>
                          )}
                        </span>
                      )
                    })
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                      <AlertTriangle size={11} /> ohne Beleg
                    </span>
                  )}
                  <span className="flex-1" />
                  {x.state === 'offen' ? (
                    x.editing !== undefined ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => updateSentence(sid, x.key, { editing: undefined })}>
                          Abbrechen
                        </Button>
                        <Button size="sm" onClick={() => acceptSentence(sid, x, x.editing)} disabled={!x.editing.trim()}>
                          <Check size={14} /> übernehmen
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => acceptSentence(sid, x)} aria-label="Satz übernehmen">
                          <Check size={14} /> übernehmen
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateSentence(sid, x.key, { editing: x.text })} aria-label="Satz bearbeiten">
                          <Pencil size={14} /> <span className="hidden sm:inline">bearbeiten</span>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateSentence(sid, x.key, { state: 'verworfen' })} aria-label="Satz verwerfen">
                          <X size={14} /> <span className="hidden sm:inline">verwerfen</span>
                        </Button>
                      </>
                    )
                  ) : (
                    <span className={clsx('text-xs font-medium', x.state === 'uebernommen' ? 'text-emerald-700' : 'text-slate-400')}>
                      {x.state === 'uebernommen' ? '✓ übernommen' : 'verworfen'}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
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
              {goalMeta(g, true)}
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
        {aiReview(sec.id)}
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
                  <li key={g.id} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <Target size={14} className="mt-0.5 shrink-0 text-brand-600" />
                    <span className="min-w-0 flex-1">
                      {g.text} <span className="text-xs text-slate-400">· in der Akte</span>
                      {goalMeta(g)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
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
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-slate-600">Wer?</span>
                  <Segmented
                    size="sm"
                    value={newOwner}
                    onChange={setNewOwner}
                    options={(['kind', 'eltern', 'lehrkraft'] as const).map((o) => ({ value: o, label: GOAL_OWNER_LABEL[o] }))}
                  />
                </div>
                <div className="w-40">
                  <Field label="Überprüfen bis">
                    <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className={clsx(inputCls, '!py-2 !text-sm')} />
                  </Field>
                </div>
              </div>
              <Field label="Wie üben wir?">
                <input value={newStrategy} onChange={(e) => setNewStrategy(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void addGoal()} placeholder="z. B. jeden Abend 10 Minuten mit Mama lesen" className={inputCls} />
              </Field>
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

  // Aussagen, die aus einer Kompetenz stammen („Ich kann: …“) → zuletzt eingeschätzte Stufe der Lehrkraft
  const teacherFor = (text: string) => {
    const t = text.trim().toLowerCase()
    const c = comps.find((x) => `ich kann: ${x.text}`.toLowerCase() === t)
    const o = c && latestAll.get(`${student.id}:${c.id}`)
    return o?.level ? { level: o.level, smiley: levelToSmiley(o.level) } : null
  }
  const mismatches = draft.selfAssessment.filter((x) => {
    const t = teacherFor(x.text)
    return t && x.value && t.smiley !== x.value
  }).length

  const selfCard = draft.type === 'leg' && (
    <Card
      title="Selbsteinschätzung des Kindes"
      icon={Smile}
      className="print:break-inside-avoid print:p-0 print:shadow-none print:ring-0"
      action={
        !present && (
          <span className="flex flex-wrap items-center gap-1 print:hidden">
            <Button size="sm" variant="ghost" onClick={suggestSelf}>
              Vorschlag aus Akte
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setKidMode(true)}>
              <Baby size={14} /> Kind-Modus
            </Button>
          </span>
        )
      }
    >
      {draft.selfAssessment.length === 0 && <p className="mb-2 text-sm text-slate-400 print:hidden">Noch keine Aussagen. „Vorschlag aus Akte“ füllt typische Ich-kann-Sätze ein – im „Kind-Modus“ schätzt sich das Kind selbst ein.</p>}
      {mismatches > 0 && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200 print:hidden">
          <AlertTriangle size={13} /> {mismatches === 1 ? '1 Aussage weicht' : `${mismatches} Aussagen weichen`} von Ihrer letzten Einschätzung ab – guter Gesprächsanlass.
        </p>
      )}
      <ul className="space-y-3">
        {draft.selfAssessment.map((item, i) => {
          const t = teacherFor(item.text)
          const off = !!t && !!item.value && t.smiley !== item.value
          return (
          <li key={i} className={clsx('rounded-xl bg-slate-50 p-2 pl-3 print:bg-transparent print:p-0', off && 'ring-2 ring-amber-300 print:ring-0')}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 print:flex-row print:items-center">
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
          </div>
          {t && (
            <p className={clsx('mt-1 flex flex-wrap items-center gap-1.5 pb-1 text-xs', off ? 'font-medium text-amber-800' : 'text-slate-500')}>
              <span>Kind: {item.value ? `${SMILEYS[item.value]} ${SMILEY_LABEL[item.value]}` : '–'}</span>
              <span className="text-slate-300">·</span>
              <span>
                Lehrkraft (zuletzt): {SMILEYS[t.smiley]} {LEVEL_LABEL[t.level]}
              </span>
              {off && <Badge tone="amber">abweichend</Badge>}
            </p>
          )}
          </li>
          )
        })}
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
      {kidMode && (
        <KidMode
          name={student.firstName}
          items={draft.selfAssessment}
          onRate={(i, v) => apply((d) => ({ ...d, selfAssessment: d.selfAssessment.map((x, j) => (j === i ? { ...x, value: v } : x)) }))}
          onProudText={(t) => apply((d) => ({ ...d, childView: (d.childView?.trim() ? d.childView.replace(/\s+$/, '') + '\n' : '') + `Darauf bin ich stolz: ${t}` }), true)}
          onProudAudio={async (blob, mime) => {
            const o: Observation = {
              id: uid(),
              classId: draft.classId,
              studentIds: [student.id],
              date: today(),
              createdAt: now(),
              updatedAt: now(),
              kind: 'zitat',
              valence: 'pos',
              text: 'Darauf bin ich stolz (Sprachnotiz)',
              tags: [],
              shareable: true,
              attachments: [{ id: uid(), type: 'audio', mime, blob }],
            }
            await save(db.observations, o)
          }}
          onExit={() => {
            setKidMode(false)
            void flush()
          }}
        />
      )}
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
        <Button variant="secondary" onClick={() => (pendingCount > 0 ? toast(blockReason) : window.print())} disabled={pendingCount > 0} title={pendingCount > 0 ? blockReason : undefined} aria-label="Drucken oder als PDF sichern">
          <Printer size={16} /> <span className="hidden sm:inline">Drucken</span>
        </Button>
      </div>
      {pendingCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 px-4 py-2.5 text-sm text-violet-800 ring-1 ring-violet-200 print:hidden">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="flex-1">{blockReason}</span>
          <span className="font-medium tabular-nums">
            {aiTotal - pendingCount}/{aiTotal} geprüft
          </span>
        </div>
      )}

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
              <select
                value={draft.status}
                onChange={(e) => {
                  const st = e.target.value as ConvStatus
                  if (st !== 'vorbereitung' && pendingCount > 0) return toast(blockReason)
                  set({ status: st })
                }}
                className={inputCls}
              >
                <option value="vorbereitung">in Vorbereitung</option>
                <option value="gefuehrt" disabled={pendingCount > 0 && draft.status !== 'gefuehrt'}>
                  geführt
                </option>
                <option value="unterschrieben" disabled={pendingCount > 0 && draft.status !== 'unterschrieben'}>
                  unterschrieben
                </option>
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
        <Button
          onClick={() => {
            if (pendingCount > 0 && !window.confirm(`${pendingCount} KI-Sätze sind noch ungeprüft und gehen beim Verlassen verloren. Trotzdem verlassen?`)) return
            void saveNow().then(() => nav('/gespraeche'))
          }}
        >
          Fertig
        </Button>
      </div>
    </div>
  )
}

/* ───────────────────────────── Kind-Modus ───────────────────────────── */

const HOLD_MS = 1500

function speak(text: string) {
  try {
    const synth = window.speechSynthesis
    if (!synth) return toast('Vorlesen wird auf diesem Gerät nicht unterstützt')
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/^Ich kann:\s*/i, 'Ich kann '))
    u.lang = 'de-DE'
    u.rate = 0.9
    const v = synth.getVoices().find((x) => x.lang?.toLowerCase().startsWith('de'))
    if (v) u.voice = v
    synth.speak(u)
  } catch {
    toast('Vorlesen nicht möglich')
  }
}

/** Vollbild-Ansicht für die Selbsteinschätzung durch das Kind – ohne Daten der Lehrkraft. */
function KidMode({
  name,
  items,
  onRate,
  onProudText,
  onProudAudio,
  onExit,
}: {
  name: string
  items: Conversation['selfAssessment']
  onRate: (i: number, v: 1 | 2 | 3) => void
  onProudText: (t: string) => void
  onProudAudio: (blob: Blob, mime: string) => Promise<void>
  onExit: () => void
}) {
  // Schritte: 0..n-1 Aussagen, n = „Darauf bin ich stolz“, n+1 = Danke
  const n = items.length
  const [step, setStep] = useState(0)
  const [proud, setProud] = useState('')
  const [audios, setAudios] = useState(0)
  const [recording, setRecording] = useState(false)
  const [holding, setHolding] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current)
      if (advance.current) clearTimeout(advance.current)
      window.speechSynthesis?.cancel()
    },
    [],
  )

  // Esc & Co. sollen das Kind nicht hinauswerfen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const startHold = () => {
    setHolding(true)
    holdTimer.current = setTimeout(() => {
      setHolding(false)
      onExit()
    }, HOLD_MS)
  }
  const stopHold = () => {
    setHolding(false)
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  const go = (to: number) => {
    window.speechSynthesis?.cancel()
    setStep(Math.max(0, Math.min(n + 1, to)))
  }

  const rate = (v: 1 | 2 | 3) => {
    onRate(step, v)
    if (advance.current) clearTimeout(advance.current)
    advance.current = setTimeout(() => go(step + 1), 550)
  }

  const finishProud = () => {
    const t = proud.trim()
    if (t) onProudText(t)
    setProud('')
    go(n + 1)
  }

  const item = step < n ? items[step] : null
  const colors = ['', 'bg-rose-100 ring-rose-300', 'bg-amber-100 ring-amber-300', 'bg-emerald-100 ring-emerald-300']

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-gradient-to-b from-sky-100 via-amber-50 to-pink-100 text-slate-900 select-none print:hidden" role="dialog" aria-modal="true" aria-label="Kind-Modus">
      {/* Beenden nur mit langem Drücken */}
      <div className="flex items-center justify-between gap-3 p-4">
        <p className="text-2xl font-bold tracking-tight text-sky-900">Hallo {name}! 👋</p>
        <button
          type="button"
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onContextMenu={(e) => e.preventDefault()}
          className="relative overflow-hidden rounded-full bg-white/60 px-4 py-2 text-xs font-medium text-slate-400 ring-1 ring-slate-200 [-webkit-touch-callout:none]"
          aria-label="Gedrückt halten zum Beenden"
        >
          <span className="absolute inset-y-0 left-0 bg-slate-300/70" style={{ width: holding ? '100%' : '0%', transition: holding ? `width ${HOLD_MS}ms linear` : 'none' }} />
          <span className="relative">Gedrückt halten zum Beenden</span>
        </button>
      </div>

      {/* Fortschritt */}
      <div className="flex flex-wrap justify-center gap-2 px-4" aria-hidden>
        {Array.from({ length: n + 1 }, (_, i) => (
          <span key={i} className={clsx('size-4 rounded-full transition', i === step ? 'scale-125 bg-sky-600' : i < step || (i < n && items[i]?.value) ? 'bg-sky-400' : 'bg-white ring-2 ring-sky-200')} />
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-6 py-8 text-center">
        {item ? (
          <>
            <div className="flex items-start gap-4">
              <p className="text-4xl leading-tight font-bold md:text-5xl">{item.text.replace(/^Ich kann:\s*/i, 'Ich kann ')}</p>
            </div>
            <button type="button" onClick={() => speak(item.text)} className="inline-flex min-h-16 items-center gap-3 rounded-full bg-white px-8 text-2xl font-semibold text-sky-800 shadow-md ring-2 ring-sky-200 active:scale-95">
              <Volume2 size={32} /> Vorlesen
            </button>
            <div className="flex flex-wrap justify-center gap-6" role="radiogroup" aria-label={item.text}>
              {([1, 2, 3] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={item.value === v}
                  aria-label={SMILEY_LABEL[v]}
                  onClick={() => rate(v)}
                  className={clsx(
                    'flex size-28 flex-col items-center justify-center rounded-3xl text-7xl ring-4 transition active:scale-90 md:size-32',
                    item.value === v ? `${colors[v]} scale-110 shadow-xl` : 'bg-white/80 ring-white',
                  )}
                >
                  {SMILEYS[v]}
                </button>
              ))}
            </div>
            <div className="flex w-full justify-between">
              <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="inline-flex min-h-16 items-center gap-2 rounded-full px-6 text-xl font-semibold text-sky-800 disabled:opacity-0">
                <ChevronLeft size={32} /> zurück
              </button>
              <button type="button" onClick={() => go(step + 1)} className="inline-flex min-h-16 items-center gap-2 rounded-full bg-sky-600 px-8 text-xl font-semibold text-[#fff] shadow-md active:scale-95">
                weiter <ChevronRight size={32} />
              </button>
            </div>
          </>
        ) : step === n ? (
          <>
            <p className="text-5xl font-bold">Darauf bin ich stolz ⭐</p>
            <button type="button" onClick={() => speak('Darauf bin ich stolz. Erzähl mir davon!')} className="inline-flex min-h-16 items-center gap-3 rounded-full bg-white px-8 text-2xl font-semibold text-sky-800 shadow-md ring-2 ring-sky-200 active:scale-95">
              <Volume2 size={32} /> Vorlesen
            </button>
            <div className="flex flex-col items-center gap-3 [&_button]:min-h-20 [&_button]:rounded-full [&_button]:px-10 [&_button]:text-2xl [&_svg]:size-8">
              <VoiceRecorder
                onRecordingChange={setRecording}
                onDone={(blob, mime) =>
                  void onProudAudio(blob, mime)
                    .then(() => setAudios((a) => a + 1))
                    .catch((e) => toast('Aufnahme nicht gespeichert: ' + (e as Error).message))
                }
              />
              {audios > 0 && <p className="text-xl font-semibold text-emerald-700">✓ {audios === 1 ? 'Sprachnachricht gespeichert' : `${audios} Sprachnachrichten gespeichert`}</p>}
            </div>
            <textarea
              value={proud}
              onChange={(e) => setProud(e.target.value)}
              rows={3}
              placeholder="… oder hier schreiben"
              className="w-full rounded-3xl bg-white p-5 text-3xl leading-snug shadow-inner ring-2 ring-sky-200 outline-none select-text focus:ring-sky-500"
            />
            <div className="flex w-full justify-between">
              <button type="button" onClick={() => go(step - 1)} disabled={n === 0} className="inline-flex min-h-16 items-center gap-2 rounded-full px-6 text-xl font-semibold text-sky-800 disabled:opacity-0">
                <ChevronLeft size={32} /> zurück
              </button>
              <button type="button" onClick={finishProud} disabled={recording} className="inline-flex min-h-16 items-center gap-2 rounded-full bg-emerald-600 px-8 text-xl font-semibold text-[#fff] shadow-md active:scale-95 disabled:opacity-50">
                <Check size={32} /> fertig
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-8xl">🎉</p>
            <p className="text-5xl font-bold">Danke, {name}!</p>
            <p className="text-2xl text-slate-600">Super gemacht. Gib das iPad jetzt zurück.</p>
            <button type="button" onClick={() => go(n)} className="inline-flex min-h-16 items-center gap-2 rounded-full px-6 text-xl font-semibold text-sky-800">
              <ChevronLeft size={32} /> zurück
            </button>
          </>
        )}
      </div>
    </div>
  )
}
