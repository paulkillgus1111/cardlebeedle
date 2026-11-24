import clsx from 'clsx'
import { format, parseISO, startOfWeek, subWeeks, formatISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { MessagesSquare, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AttachmentView } from '../components/media'
import { AiButton, AskSheet } from '../components/AiSheets'
import { QuickCapture, type CaptureContext } from '../components/QuickCapture'
import { ReportEditor, TERMS } from '../components/ReportEditor'
import { Avatar, Button, Card, CoverageRing, Empty, Field, inputCls, Segmented, ValenceDot } from '../components/ui'
import { alive, db, now, save, uid, type Competency, type Goal, type Observation, type ObsKind, type SchoolClass, type Student } from '../lib/db'
import { studentContext } from '../lib/ai'
import { useActiveClass, useCompetencies, useObservations, useStudents } from '../lib/hooks'
import { agoText, studentStats } from '../lib/insights'
import { KIND_LABEL, LEVEL_LABEL } from '../lib/seed'

export default function Kinder() {
  const { id } = useParams()
  return id ? <Akte id={id} /> : <KinderListe />
}

function KinderListe() {
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const obs = useObservations(cls?.id)
  const [q, setQ] = useState('')
  const stats = useMemo(() => studentStats(students, obs), [students, obs])
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold">Kinder</h1>
        <div className="relative">
          <Search size={16} className="absolute top-3 left-3 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen" className={clsx(inputCls, 'pl-9')} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats
          .filter((s) => `${s.student.firstName} ${s.student.lastName}`.toLowerCase().includes(q.toLowerCase()))
          .map((s) => (
            <Link key={s.student.id} to={`/kinder/${s.student.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
              <CoverageRing value={s.coverage} size={52}>
                <Avatar student={s.student} size={40} />
              </CoverageRing>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {s.student.firstName} {s.student.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {s.count30} Einträge/30 T. · <span className="text-emerald-600">{s.pos30}+</span> <span className="text-rose-600">{s.neg30}−</span>
                </p>
              </div>
              <SupportBadges s={s.student} />
            </Link>
          ))}
      </div>
      {!students.length && <Empty>Noch keine Kinder. Unter Einstellungen anlegen.</Empty>}
    </div>
  )
}

export function SupportBadges({ s }: { s: Student }) {
  const b = s.support ?? {}
  const items = [b.lrs && 'LRS', b.notenschutz && 'NS', b.nachteilsausgleich && 'NA', b.msd && 'MSD', b.daz && 'DaZ'].filter(Boolean) as string[]
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((i) => (
        <span key={i} className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
          {i}
        </span>
      ))}
    </span>
  )
}

type Tab = 'verlauf' | 'kompetenzen' | 'verhalten' | 'ziele' | 'zeugnis' | 'profil'

function Akte({ id }: { id: string }) {
  const student = useLiveQuery(() => db.students.get(id), [id])
  const { cls } = useActiveClass()
  const students = useStudents(student?.classId)
  const allObs = useObservations(student?.classId)
  const comps = useCompetencies(cls)
  const [tab, setTab] = useState<Tab>('verlauf')
  const [capture, setCapture] = useState<CaptureContext | null>(null)
  const [asking, setAsking] = useState(false)
  const goals = useLiveQuery(async () => alive(await db.goals.where('studentId').equals(id).toArray()), [id]) ?? []
  if (!student || !cls) return null
  const obs = allObs.filter((o) => o.studentIds.includes(id))
  const stats = studentStats([student], allObs)[0]
  const ctx = (edit?: Observation): CaptureContext => ({ classId: cls.id, gradeLevel: cls.gradeLevel, students, competencies: comps, studentIds: [id], edit })

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <Link to="/kinder" className="text-sm text-slate-500">
        ← Alle Kinder
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <CoverageRing value={stats.coverage} size={72}>
          <Avatar student={student} size={58} />
        </CoverageRing>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">
            {student.firstName} {student.lastName}
          </h1>
          <p className="text-sm text-slate-500">
            {obs.length} Einträge · {agoText(stats.days)}
          </p>
          <SupportBadges s={student} />
        </div>
        <Link to={`/gespraeche/neu/${id}`}>
          <Button variant="secondary">
            <MessagesSquare size={16} /> Gespräch vorbereiten
          </Button>
        </Link>
        <AiButton size="md" onClick={() => setAsking(true)}>
          Frage an die Akte
        </AiButton>
        <Button onClick={() => setCapture(ctx())}>
          <Plus size={16} /> Beobachtung
        </Button>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'verlauf', label: 'Verlauf' },
          { value: 'kompetenzen', label: 'Kompetenzen' },
          { value: 'verhalten', label: 'Verhalten' },
          { value: 'ziele', label: 'Ziele' },
          { value: 'zeugnis', label: 'Zeugnistext' },
          { value: 'profil', label: 'Profil' },
        ]}
      />

      {tab === 'verlauf' && <Timeline obs={obs} comps={comps} onEdit={(o) => setCapture(ctx(o))} />}
      {tab === 'kompetenzen' && <CompetencyProfile obs={obs} comps={comps} />}
      {tab === 'verhalten' && <Behaviour obs={obs} />}
      {tab === 'ziele' && <Goals student={student} comps={comps} />}
      {tab === 'zeugnis' && <ZeugnisTab student={student} cls={cls} obs={allObs} comps={comps} />}
      {tab === 'profil' && <Profile student={student} />}
      <AskSheet
        open={asking}
        onClose={() => setAsking(false)}
        title={`Frage zu ${student.firstName}`}
        placeholder={`Wie hat sich ${student.firstName} in Mathe seit September entwickelt?`}
        data={() => studentContext(student, cls, allObs, comps, goals)}
      />

      <QuickCapture ctx={capture} onClose={() => setCapture(null)} />
    </div>
  )
}

export function Timeline({ obs, comps, onEdit }: { obs: Observation[]; comps: Competency[]; onEdit?: (o: Observation) => void }) {
  const [kind, setKind] = useState<'alle' | ObsKind>('alle')
  const [subject, setSubject] = useState('alle')
  const subjects = [...new Set(obs.map((o) => o.subject).filter(Boolean))] as string[]
  const shown = obs.filter((o) => (kind === 'alle' || o.kind === kind) && (subject === 'alle' || o.subject === subject)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const byMonth = shown.reduce<Record<string, Observation[]>>((acc, o) => ((acc[o.date.slice(0, 7)] ??= []).push(o), acc), {})
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as ObsKind)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="alle">Alle Arten</option>
          {Object.entries(KIND_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="alle">Alle Fächer</option>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      {Object.entries(byMonth).map(([month, list]) => (
        <div key={month}>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">{format(parseISO(month + '-01'), 'MMMM yyyy', { locale: de })}</p>
          <div className="space-y-2 border-l-2 border-slate-200 pl-4">
            {list.map((o) => (
              <button key={o.id} onClick={() => onEdit?.(o)} className="relative block w-full rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200/70">
                <span className="absolute top-4 -left-[23px]">
                  <ValenceDot v={o.valence} />
                </span>
                <p className="text-xs text-slate-400">
                  {format(parseISO(o.date), 'EE d.M.', { locale: de })} · {KIND_LABEL[o.kind]}
                  {o.subject && ` · ${o.subject}`}
                  {o.shareable && ' · 👁 zeigbar'}
                </p>
                {o.competencyId && (
                  <p className="text-sm font-medium text-slate-700">
                    {comps.find((c) => c.id === o.competencyId)?.text}
                    {o.level && <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs">{LEVEL_LABEL[o.level]}</span>}
                  </p>
                )}
                {o.text && <p className={clsx('text-sm whitespace-pre-wrap', o.kind === 'zitat' && 'italic')}>{o.text}</p>}
                {o.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    {o.attachments.map((a) => (
                      <AttachmentView key={a.id} a={a} />
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
      {!shown.length && <Empty>Keine Einträge.</Empty>}
    </div>
  )
}

/** Kleine Verlaufslinie für Stufen 1–4. */
function Spark({ points }: { points: { date: string; level: number }[] }) {
  const w = 140
  const h = 36
  if (!points.length) return <span className="text-xs text-slate-300">–</span>
  const xs = points.map((_, i) => (points.length === 1 ? w / 2 : (i / (points.length - 1)) * (w - 8) + 4))
  const ys = points.map((p) => h - 4 - ((p.level - 1) / 3) * (h - 8))
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')} fill="none" stroke="#0d9488" strokeWidth={2} />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={3} fill="#0d9488">
          <title>
            {format(parseISO(points[i].date), 'd.M.yy')}: {LEVEL_LABEL[points[i].level]}
          </title>
        </circle>
      ))}
    </svg>
  )
}

function CompetencyProfile({ obs, comps }: { obs: Observation[]; comps: Competency[] }) {
  const rated = obs.filter((o) => o.competencyId && o.level)
  const bySubject = comps.reduce<Record<string, Competency[]>>((acc, c) => ((acc[c.subject] ??= []).push(c), acc), {})
  const [onlyRated, setOnlyRated] = useState(true)
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={onlyRated} onChange={(e) => setOnlyRated(e.target.checked)} className="accent-brand-700" /> Nur eingeschätzte Kompetenzen
      </label>
      {Object.entries(bySubject).map(([subject, cs]) => {
        const rows = cs
          .map((c) => ({ c, pts: rated.filter((o) => o.competencyId === c.id).sort((a, b) => a.date.localeCompare(b.date)).map((o) => ({ date: o.date, level: o.level! })) }))
          .filter((r) => !onlyRated || r.pts.length)
        if (!rows.length) return null
        return (
          <Card key={subject} title={subject}>
            <ul className="divide-y divide-slate-100">
              {rows.map(({ c, pts }) => {
                const last = pts[pts.length - 1]
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{c.text}</p>
                      <p className="text-xs text-slate-400">{c.area}</p>
                    </div>
                    <Spark points={pts} />
                    <span className={clsx('w-24 rounded-lg px-2 py-1 text-center text-xs font-semibold', last ? ['', 'bg-rose-100 text-rose-800', 'bg-amber-100 text-amber-800', 'bg-lime-100 text-lime-800', 'bg-emerald-100 text-emerald-800'][last.level] : 'bg-slate-50 text-slate-300')}>
                      {last ? LEVEL_LABEL[last.level] : '–'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        )
      })}
      {!rated.length && onlyRated && <Empty>Noch keine Kompetenz-Einschätzungen. Im Unterricht beim Stundenstart Kompetenzen als Schwerpunkt wählen.</Empty>}
    </div>
  )
}

function Behaviour({ obs }: { obs: Observation[] }) {
  const weeks = Array.from({ length: 12 }, (_, i) => startOfWeek(subWeeks(new Date(), 11 - i), { weekStartsOn: 1 }))
  const rows: { kind: ObsKind; label: string }[] = [
    { kind: 'sozialverhalten', label: 'Sozialverhalten' },
    { kind: 'arbeitsverhalten', label: 'Lern- & Arbeitsverhalten' },
  ]
  return (
    <div className="space-y-4">
      {rows.map(({ kind, label }) => {
        const list = obs.filter((o) => o.kind === kind)
        const data = weeks.map((w, i) => {
          const from = formatISO(w, { representation: 'date' })
          const to = i < weeks.length - 1 ? formatISO(weeks[i + 1], { representation: 'date' }) : '9999'
          const inW = list.filter((o) => o.date >= from && o.date < to)
          return { w, pos: inW.filter((o) => o.valence === 'pos').length, neg: inW.filter((o) => o.valence === 'neg').length }
        })
        const max = Math.max(2, ...data.map((d) => Math.max(d.pos, d.neg)))
        return (
          <Card key={kind} title={label} action={<span className="text-xs text-slate-400">letzte 12 Wochen</span>}>
            <div className="flex h-36 items-center gap-1.5">
              {data.map((d, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center">
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div className="w-3/5 rounded-t bg-emerald-400" style={{ height: `${(d.pos / max) * 100}%` }} title={`${d.pos} positiv`} />
                  </div>
                  <div className="h-px w-full bg-slate-200" />
                  <div className="flex w-full flex-1 items-start justify-center">
                    <div className="w-3/5 rounded-b bg-rose-400" style={{ height: `${(d.neg / max) * 100}%` }} title={`${d.neg} kritisch`} />
                  </div>
                  <span className="text-[10px] text-slate-400">{format(d.w, 'd.M.')}</span>
                </div>
              ))}
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {list.slice(0, 5).map((o) => (
                <li key={o.id} className="flex items-center gap-2">
                  <ValenceDot v={o.valence} /> <span className="text-slate-400">{format(parseISO(o.date), 'd.M.')}</span> {o.text}
                </li>
              ))}
            </ul>
          </Card>
        )
      })}
    </div>
  )
}

function Goals({ student, comps }: { student: Student; comps: Competency[] }) {
  const goals = useLiveQuery(async () => alive(await db.goals.where('studentId').equals(student.id).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [student.id]) ?? []
  const [text, setText] = useState('')
  const [kind, setKind] = useState<Goal['kind']>('lernziel')
  const [due, setDue] = useState('')
  const [competencyId, setCompetencyId] = useState('')
  const add = async () => {
    if (!text.trim()) return
    await save(db.goals, { id: uid(), studentId: student.id, classId: student.classId, text: text.trim(), kind, due: due || undefined, competencyId: competencyId || undefined, status: 'offen', createdAt: now(), updatedAt: now() })
    setText('')
    setDue('')
  }
  return (
    <div className="space-y-4">
      <Card title="Neues Ziel">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ziel (kindgerecht)">
            <input value={text} onChange={(e) => setText(e.target.value)} className={inputCls} placeholder="Ich rechne Aufgaben bis 20 ohne Finger." />
          </Field>
          <Field label="Art">
            <select value={kind} onChange={(e) => setKind(e.target.value as Goal['kind'])} className={inputCls}>
              <option value="lernziel">Lernziel</option>
              <option value="foerderziel">Förderziel</option>
              <option value="vereinbarung">Vereinbarung</option>
            </select>
          </Field>
          <Field label="Kompetenz (optional)">
            <select value={competencyId} onChange={(e) => setCompetencyId(e.target.value)} className={inputCls}>
              <option value="">–</option>
              {comps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.subject}: {c.text}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Überprüfen bis">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={add}>Hinzufügen</Button>
        </div>
      </Card>
      <div className="space-y-2">
        {goals.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{g.text}</p>
              <p className="text-xs text-slate-500">
                {{ lernziel: 'Lernziel', foerderziel: 'Förderziel', vereinbarung: 'Vereinbarung' }[g.kind]} · seit {format(parseISO(g.createdAt), 'd.M.yy')}
                {g.due && ` · bis ${format(parseISO(g.due), 'd.M.yy')}`}
              </p>
            </div>
            <Segmented
              value={g.status}
              onChange={(status) => save(db.goals, { ...g, status })}
              options={[
                { value: 'offen', label: 'offen' },
                { value: 'teilweise', label: 'teilweise' },
                { value: 'erreicht', label: 'erreicht' },
              ]}
            />
          </div>
        ))}
        {!goals.length && <Empty>Noch keine Ziele.</Empty>}
      </div>
    </div>
  )
}

function Profile({ student }: { student: Student }) {
  const [s, setS] = useState(student)
  const sup = s.support ?? {}
  const toggle = (k: keyof NonNullable<Student['support']>) => setS({ ...s, support: { ...sup, [k]: !sup[k] } })
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vorname">
          <input value={s.firstName} onChange={(e) => setS({ ...s, firstName: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Nachname">
          <input value={s.lastName} onChange={(e) => setS({ ...s, lastName: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Geburtstag">
          <input type="date" value={s.birthday ?? ''} onChange={(e) => setS({ ...s, birthday: e.target.value })} className={inputCls} />
        </Field>
      </div>
      <p className="mt-4 mb-2 text-sm font-medium text-slate-600">Förderstatus</p>
      <div className="flex flex-wrap gap-3 text-sm">
        {(
          [
            ['lrs', 'LRS'],
            ['notenschutz', 'Notenschutz'],
            ['nachteilsausgleich', 'Nachteilsausgleich'],
            ['msd', 'Sonderpäd. Förderbedarf (MSD)'],
            ['daz', 'DaZ / Vorkurs'],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2">
            <input type="checkbox" checked={!!sup[k]} onChange={() => toggle(k)} className="size-5 accent-brand-700" /> {l}
          </label>
        ))}
      </div>
      <div className="mt-4">
        <Field label="Wichtige Infos (Allergien, Abholung, Medikamente …)">
          <textarea value={s.info ?? ''} onChange={(e) => setS({ ...s, info: e.target.value })} rows={3} className={inputCls} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => save(db.students, s)}>Speichern</Button>
      </div>
    </Card>
  )
}

function ZeugnisTab({ student, cls, obs, comps }: { student: Student; cls: SchoolClass; obs: Observation[]; comps: Competency[] }) {
  const [term, setTerm] = useState<string>(cls.gradeLevel === 4 ? 'Übertrittszeugnis' : 'Jahreszeugnis')
  const [du, setDu] = useState(cls.gradeLevel <= 2)
  return (
    <Card title={`Zeugnistext · ${cls.gradeLevel <= 2 ? 'Wortgutachten' : 'Bemerkungen'}`}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented value={term} onChange={setTerm} options={TERMS.map((t) => ({ value: t, label: t }))} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={du} onChange={(e) => setDu(e.target.checked)} className="accent-brand-700" /> Kind mit „Du“ ansprechen
        </label>
        <Link to="/zeugnis" className="ml-auto text-sm text-brand-700 underline">
          Alle Kinder der Klasse
        </Link>
      </div>
      <ReportEditor key={term} student={student} cls={cls} obs={obs} comps={comps} term={term} du={du} />
    </Card>
  )
}
