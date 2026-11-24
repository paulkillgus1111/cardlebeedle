import clsx from 'clsx'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AttachmentView } from '../components/media'
import { toast } from '../components/toast'
import { Avatar, Button, Card, Empty, Field, inputCls, Segmented, ValenceDot } from '../components/ui'
import { alive, db, now, save, uid, type Conversation, type Goal, type Observation } from '../lib/db'
import { useActiveClass, useCompetencies, useObservations, useStudents } from '../lib/hooks'
import { latestLevels, today } from '../lib/insights'
import { gradeProfile, KIND_LABEL, LEG_SECTIONS, LEVEL_LABEL } from '../lib/seed'

const TYPE_LABEL: Record<Conversation['type'], string> = { leg: 'Lernentwicklungsgespräch', eltern: 'Elterngespräch', uebertritt: 'Übertrittsberatung', kind: 'Gespräch mit Kind' }
const ELTERN_SECTIONS = [
  { id: 'anlass', title: 'Anlass', hint: 'Warum findet das Gespräch statt?' },
  { id: 'staerken', title: 'Stärken (zuerst!)', hint: 'Was läuft gut?' },
  { id: 'lernarbeit', title: 'Lern- und Arbeitsverhalten', hint: '' },
  { id: 'sozial', title: 'Sozialverhalten', hint: '' },
  { id: 'leistung', title: 'Leistungsstand', hint: '' },
  { id: 'punkte', title: 'Gesprächspunkte / Fragen an die Eltern', hint: '' },
  { id: 'vereinbarungen', title: 'Vereinbarungen', hint: 'Wer macht was bis wann?' },
]

export default function Gespraeche() {
  const { id, studentId } = useParams()
  if (id === 'neu' && studentId) return <NewConversation studentId={studentId} />
  if (id) return <Editor id={id} />
  return <Overview />
}

function Overview() {
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const convs = useLiveQuery(async () => (cls ? alive(await db.conversations.where('classId').equals(cls.id).toArray()) : []), [cls?.id]) ?? []
  if (!cls) return null
  const profile = gradeProfile(cls.gradeLevel)
  const season = convs.filter((c) => c.type === 'leg')
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Gespräche</h1>
      {profile.legPossible && (
        <Card title={`LEG-Saisonplaner · Jgst. ${cls.gradeLevel}`} action={<span className="text-xs text-slate-400">{season.filter((c) => c.status !== 'vorbereitung').length}/{students.length} geführt</span>}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((s) => {
              const c = season.filter((x) => x.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date))[0]
              return (
                <Link key={s.id} to={c ? `/gespraeche/${c.id}` : `/gespraeche/neu/${s.id}?type=leg`} className="flex items-center gap-3 rounded-xl p-2 ring-1 ring-slate-200 hover:bg-slate-50">
                  <Avatar student={s} size={32} />
                  <span className="flex-1 font-medium">{s.firstName}</span>
                  <span
                    className={clsx(
                      'rounded-lg px-2 py-1 text-xs font-medium',
                      !c ? 'bg-slate-100 text-slate-500' : c.status === 'vorbereitung' ? 'bg-amber-100 text-amber-800' : c.status === 'gefuehrt' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800',
                    )}
                  >
                    {!c ? 'offen' : { vorbereitung: 'vorbereitet', gefuehrt: 'geführt', unterschrieben: 'unterschrieben' }[c.status]}
                  </span>
                </Link>
              )
            })}
          </div>
        </Card>
      )}
      <Card title="Alle Gespräche">
        <ul className="divide-y divide-slate-100">
          {convs
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((c) => {
              const s = students.find((x) => x.id === c.studentId)
              return (
                <li key={c.id}>
                  <Link to={`/gespraeche/${c.id}`} className="flex items-center gap-3 py-2">
                    {s && <Avatar student={s} size={28} />}
                    <span className="font-medium">{s?.firstName}</span>
                    <span className="text-sm text-slate-500">{TYPE_LABEL[c.type]}</span>
                    <span className="ml-auto text-sm text-slate-400">{format(parseISO(c.date), 'd.M.yyyy')}</span>
                  </Link>
                </li>
              )
            })}
          {!convs.length && <Empty>Noch keine Gespräche. In der Akte eines Kindes „Gespräch vorbereiten“ wählen.</Empty>}
        </ul>
      </Card>
    </div>
  )
}

function NewConversation({ studentId }: { studentId: string }) {
  const nav = useNavigate()
  const { cls } = useActiveClass()
  const student = useLiveQuery(() => db.students.get(studentId), [studentId])
  const preset = new URLSearchParams(location.search).get('type') as Conversation['type'] | null
  const [picked, setType] = useState<Conversation['type'] | null>(preset)
  if (!student || !cls) return null
  const type = picked ?? (gradeProfile(cls.gradeLevel).legPossible ? 'leg' : cls.gradeLevel === 4 ? 'uebertritt' : 'eltern')
  const create = async () => {
    const c: Conversation = { id: uid(), classId: cls.id, studentId, type, date: today(), status: 'vorbereitung', sections: {}, selfAssessment: [], updatedAt: now() }
    await save(db.conversations, c)
    nav(`/gespraeche/${c.id}`, { replace: true })
  }
  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Gespräch mit {student.firstName} vorbereiten</h1>
      <Card>
        <div className="space-y-2">
          {(Object.keys(TYPE_LABEL) as Conversation['type'][]).map((t) => (
            <label key={t} className={clsx('flex items-center gap-3 rounded-xl p-3 ring-1', type === t ? 'bg-brand-50 ring-brand-500' : 'ring-slate-200')}>
              <input type="radio" checked={type === t} onChange={() => setType(t)} className="accent-brand-700" />
              {TYPE_LABEL[t]}
              {t === 'leg' && !gradeProfile(cls.gradeLevel).legPossible && <span className="text-xs text-slate-400">(regulär Jgst. 1–3)</span>}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={create}>Vorbereitung starten</Button>
        </div>
      </Card>
    </div>
  )
}

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

function Editor({ id }: { id: string }) {
  const conv = useLiveQuery(() => db.conversations.get(id), [id])
  const { cls } = useActiveClass()
  const student = useLiveQuery(async () => (conv ? db.students.get(conv.studentId) : undefined), [conv?.studentId])
  const obsAll = useObservations(conv?.classId)
  const comps = useCompetencies(cls)
  const goals = useLiveQuery(async () => (conv ? alive(await db.goals.where('studentId').equals(conv.studentId).toArray()) : []), [conv?.studentId]) ?? []
  const prevConv = useLiveQuery(async () => {
    if (!conv) return undefined
    return alive(await db.conversations.where('studentId').equals(conv.studentId).toArray())
      .filter((c) => c.id !== conv.id && c.date < conv.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
  }, [conv?.id])
  const [draft, setDraft] = useState<Conversation | null>(null)
  const [mode, setMode] = useState<'vorbereitung' | 'gespraech'>('vorbereitung')
  const [since, setSince] = useState('')
  const [newGoal, setNewGoal] = useState('')

  useEffect(() => {
    if (conv && (!draft || draft.id !== conv.id)) setDraft(conv)
  }, [conv, draft])
  useEffect(() => {
    if (prevConv && !since) setSince(prevConv.date)
  }, [prevConv, since])

  const obs = useMemo(() => obsAll.filter((o) => conv && o.studentIds.includes(conv.studentId) && (!since || o.date >= since)), [obsAll, conv, since])
  const latest = useMemo(() => latestLevels(obs), [obs])

  if (!draft || !student || !cls) return null
  const sections = draft.type === 'leg' ? LEG_SECTIONS : ELTERN_SECTIONS
  const set = (patch: Partial<Conversation>) => setDraft({ ...draft, ...patch })
  const setSection = (sid: string, text: string) => set({ sections: { ...draft.sections, [sid]: text } })
  const append = (sid: string, line: string) => setSection(sid, (draft.sections[sid] ? draft.sections[sid] + '\n' : '') + '• ' + line)
  const persist = async (patch: Partial<Conversation> = {}) => {
    await save(db.conversations, { ...draft, ...patch })
    toast('Gespeichert')
  }
  const describe = (o: Observation) => {
    const c = comps.find((x) => x.id === o.competencyId)
    return [c?.text, o.level ? LEVEL_LABEL[o.level] : '', o.text].filter(Boolean).join(' – ')
  }

  // Selbsteinschätzung aus eingeschätzten Kompetenzen vorschlagen
  const suggestSelf = () => {
    const items = comps
      .filter((c) => latest.has(`${student.id}:${c.id}`))
      .slice(0, 8)
      .map((c) => ({ text: `Ich kann: ${c.text}` }))
    const base = [{ text: 'Ich halte mich an die Klassenregeln.' }, { text: 'Ich arbeite konzentriert.' }, { text: 'Ich helfe anderen.' }]
    set({ selfAssessment: [...base, ...items] })
  }

  const openGoals = goals.filter((g) => g.status === 'offen' || g.status === 'teilweise')
  const convGoals = goals.filter((g) => g.conversationId === draft.id)

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link to="/gespraeche" className="text-sm text-slate-500">
          ← Gespräche
        </Link>
        <span className="flex-1" />
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'vorbereitung', label: 'Vorbereitung' },
            { value: 'gespraech', label: 'Gesprächsansicht' },
          ]}
        />
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={16} /> Drucken / PDF
        </Button>
        <Button onClick={() => persist()}>Speichern</Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar student={student} size={56} />
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">
            {TYPE_LABEL[draft.type]} – {student.firstName} {student.lastName}
          </h1>
          <p className="text-sm text-slate-500">
            {cls.name} · Jgst. {cls.gradeLevel} · Schuljahr {cls.schoolYear}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <Field label="Datum">
            <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Status">
            <select value={draft.status} onChange={(e) => set({ status: e.target.value as Conversation['status'] })} className={inputCls}>
              <option value="vorbereitung">in Vorbereitung</option>
              <option value="gefuehrt">geführt</option>
              <option value="unterschrieben">unterschrieben</option>
            </select>
          </Field>
          <Field label="Belege seit">
            <input type="date" value={since} onChange={(e) => setSince(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </div>

      {openGoals.length > 0 && (
        <Card title={prevConv ? `Ziele seit dem letzten Gespräch (${format(parseISO(prevConv.date), 'd.M.yyyy')})` : 'Offene Ziele'}>
          <ul className="space-y-2">
            {openGoals.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3">
                <span className="flex-1">{g.text}</span>
                <Segmented
                  value={g.status}
                  onChange={(status) => save(db.goals, { ...g, status })}
                  options={[
                    { value: 'offen', label: 'noch nicht' },
                    { value: 'teilweise', label: 'teilweise' },
                    { value: 'erreicht', label: 'erreicht' },
                  ]}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="space-y-4">
        {sections.map((sec) => {
          const ev = obs.filter((o) => evidenceFor(sec.id, o) && (mode === 'vorbereitung' || o.shareable))
          return (
            <div key={sec.id} className={clsx('grid gap-4 print:block', mode === 'vorbereitung' && ev.length ? 'lg:grid-cols-[1fr_22rem]' : '')}>
              <Card title={sec.title}>
                {sec.hint && <p className="mb-2 text-xs text-slate-400 print:hidden">{sec.hint}</p>}
                <textarea
                  value={draft.sections[sec.id] ?? ''}
                  onChange={(e) => setSection(sec.id, e.target.value)}
                  rows={Math.max(3, (draft.sections[sec.id] ?? '').split('\n').length + 1)}
                  className={clsx(inputCls, 'print:border-0 print:p-0')}
                />
                {sec.id === 'ziele' && (
                  <div className="mt-3 space-y-2 print:hidden">
                    {convGoals.map((g) => (
                      <p key={g.id} className="text-sm">🎯 {g.text}</p>
                    ))}
                    <div className="flex gap-2">
                      <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Neues Ziel als Ziel in der Akte anlegen" className={inputCls} />
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          if (!newGoal.trim()) return
                          const g: Goal = { id: uid(), studentId: student.id, classId: cls.id, text: newGoal.trim(), kind: draft.type === 'eltern' ? 'vereinbarung' : 'lernziel', status: 'offen', createdAt: now(), updatedAt: now(), conversationId: draft.id }
                          await save(db.goals, g)
                          append('ziele', g.text)
                          setNewGoal('')
                        }}
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
              {mode === 'vorbereitung' && ev.length > 0 && (
                <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-2xl bg-slate-50 p-3 print:hidden">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Belege aus der Akte ({ev.length}) – antippen zum Übernehmen</p>
                  {ev.map((o) => (
                    <button key={o.id} onClick={() => append(sec.id, describe(o))} className="flex w-full items-start gap-2 rounded-lg bg-white p-2 text-left text-xs ring-1 ring-slate-200 hover:ring-brand-500">
                      <ValenceDot v={o.valence} />
                      <span>
                        <span className="text-slate-400">{format(parseISO(o.date), 'd.M.')} {KIND_LABEL[o.kind]} · </span>
                        {describe(o)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {draft.type === 'leg' && (
        <Card title="Selbsteinschätzung des Kindes" action={<Button size="sm" variant="ghost" className="print:hidden" onClick={suggestSelf}>Vorschlag aus Akte</Button>}>
          <ul className="space-y-2">
            {draft.selfAssessment.map((item, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3">
                <input
                  value={item.text}
                  onChange={(e) => set({ selfAssessment: draft.selfAssessment.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                  className={clsx(inputCls, 'flex-1 print:border-0')}
                />
                <div className="flex gap-1">
                  {([1, 2, 3] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => set({ selfAssessment: draft.selfAssessment.map((x, j) => (j === i ? { ...x, value: v } : x)) })}
                      className={clsx('size-11 rounded-full text-2xl', item.value === v ? 'bg-brand-100 ring-2 ring-brand-600' : 'bg-slate-50 grayscale')}
                    >
                      {['', '☹️', '😐', '🙂'][v]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="ghost" className="mt-2 print:hidden" onClick={() => set({ selfAssessment: [...draft.selfAssessment, { text: 'Ich kann …' }] })}>
            <Plus size={14} /> Aussage
          </Button>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={draft.type === 'leg' ? 'Sicht des Kindes' : 'Sicht der Eltern'}>
          <textarea value={(draft.type === 'leg' ? draft.childView : draft.parentsView) ?? ''} onChange={(e) => set(draft.type === 'leg' ? { childView: e.target.value } : { parentsView: e.target.value })} rows={4} className={inputCls} />
        </Card>
        <Card title={draft.type === 'leg' ? 'Sicht der Eltern' : 'Notizen'}>
          <textarea value={(draft.type === 'leg' ? draft.parentsView : draft.notes) ?? ''} onChange={(e) => set(draft.type === 'leg' ? { parentsView: e.target.value } : { notes: e.target.value })} rows={4} className={inputCls} />
        </Card>
      </div>

      {mode === 'gespraech' && obs.some((o) => o.shareable && o.attachments.length) && (
        <Card title="Arbeitsproben">
          <div className="flex flex-wrap gap-3">
            {obs
              .filter((o) => o.shareable)
              .flatMap((o) => o.attachments)
              .map((a) => (
                <AttachmentView key={a.id} a={a} className="h-40 rounded-xl object-cover" />
              ))}
          </div>
        </Card>
      )}

      <div className="hidden grid-cols-3 gap-8 pt-16 text-sm print:grid">
        {['Kind', 'Erziehungsberechtigte', 'Lehrkraft'].map((x) => (
          <div key={x} className="border-t border-slate-400 pt-1">
            {x}
          </div>
        ))}
      </div>
      <p className="hidden text-xs text-slate-400 print:block">Erstellt am {format(new Date(), 'd. MMMM yyyy', { locale: de })} · in Anlehnung an den ISB-Dokumentationsbogen</p>

      <div className="flex justify-end gap-2 print:hidden">
        <Button size="lg" onClick={() => persist()}>
          Speichern
        </Button>
      </div>
    </div>
  )
}
