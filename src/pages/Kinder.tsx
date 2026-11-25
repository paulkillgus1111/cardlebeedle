import clsx from 'clsx'
import { format, formatISO, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { de } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ClipboardCheck,
  Eye,
  FileText,
  Anchor,
  ArrowRight,
  Flag,
  GraduationCap,
  HeartHandshake,
  History,
  Inbox,
  Lightbulb,
  MessagesSquare,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Target,
  UserRound,
  UserX,
  Users,
  UsersRound,
} from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AiButton, AskSheet } from '../components/AiSheets'
import { AttachmentView } from '../components/media'
import { QuickCapture, type CaptureContext } from '../components/QuickCapture'
import { artFor, defaultTerm, ReportEditor, termProfiles } from '../components/ReportEditor'
import { ClassDot } from '../components/ClassSwitcher'
import { toast } from '../components/toast'
import { Avatar, Badge, Button, Card, CoverageRing, Empty, Field, inputCls, PageHeader, Segmented, ValenceDot } from '../components/ui'
import { studentContext } from '../lib/ai'
import { alive, aliveOne, db, isGroup, now, save, uid, type Competency, type Goal, type Observation, type ObsKind, type SchoolClass, type Student, type Support, type Valence } from '../lib/db'
import { useActiveClass, useClass, useCompetencies, useObservations, useStudentObservations, useStudents } from '../lib/hooks'
import { agoText, balanceIssues, studentStats, today } from '../lib/insights'
import { BEHAVIOR_ITEMS, FREQUENCY_LABEL, KIND_LABEL, LEVEL_LABEL } from '../lib/seed'

export default function Kinder() {
  const { id } = useParams()
  return id ? <Akte key={id} id={id} /> : <KinderListe />
}

const backLink = (
  <Link to="/kinder" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
    <ChevronLeft size={16} /> Alle Kinder
  </Link>
)

/* ------------------------------------------------------------------ Liste */

type Sort = 'name' | 'coverage'

function KinderListe() {
  const { cls, loading } = useActiveClass()
  const students = useStudents(cls?.id)
  const obs = useObservations(cls?.id)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('name')
  const stats = useMemo(() => studentStats(students, obs), [students, obs])
  const group = isGroup(cls)
  const classById = useClassMap()
  const needle = q.trim().toLowerCase()
  const shown = stats
    .filter((s) => `${s.student.firstName} ${s.student.lastName}`.toLowerCase().includes(needle))
    .sort((a, b) => (sort === 'coverage' ? a.coverage - b.coverage : 0) || a.student.firstName.localeCompare(b.student.firstName, 'de'))

  if (loading) return null

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow={cls?.name} title="Kinder" subtitle={students.length ? `${students.length} Kinder · Ring zeigt, wie gut jedes Kind aktuell dokumentiert ist` : undefined} />

      {!!students.length && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kind suchen" className={clsx(inputCls, 'pl-10')} type="search" />
          </div>
          <Segmented
            value={sort}
            onChange={setSort}
            options={[
              { value: 'name', label: 'A–Z' },
              { value: 'coverage', label: 'Abdeckung niedrig zuerst' },
            ]}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s) => (
          <Link
            key={s.student.id}
            to={`/kinder/${s.student.id}`}
            className="group flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-slate-200/80 transition hover:-translate-y-px hover:ring-slate-300 active:scale-[0.99]"
          >
            <CoverageRing value={s.coverage} size={56}>
              <Avatar student={s.student} size={44} />
            </CoverageRing>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="truncate font-semibold tracking-tight text-slate-900">
                {s.student.firstName} {s.student.lastName}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <Badge tone="slate" className="tabular-nums">
                  {s.count30} in 30 T.
                </Badge>
                {s.pos30 > 0 && (
                  <Badge tone="green" className="tabular-nums">
                    {s.pos30} +
                  </Badge>
                )}
                {s.neg30 > 0 && (
                  <Badge tone="rose" className="tabular-nums">
                    {s.neg30} −
                  </Badge>
                )}
                <SupportBadges s={s.student} />
              </div>
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-400">
                {group && classById.get(s.student.classId) && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                    <ClassDot c={classById.get(s.student.classId)} className="!size-2" /> {classById.get(s.student.classId)!.name}
                  </span>
                )}
                <span className="truncate">{agoText(s.days)}</span>
              </p>
            </div>
          </Link>
        ))}
      </div>

      {!students.length && (
        <Card>
          <Empty icon={Users}>
            {group ? `Die Gruppe ${cls?.name} hat noch keine Mitglieder.` : `Noch keine Kinder in ${cls?.name ?? 'dieser Klasse'}.`}{' '}
            <Link to="/einstellungen" className="font-medium text-brand-700 hover:underline">
              {group ? 'Unter Einstellungen Kinder zuordnen' : 'Unter Einstellungen anlegen'}
            </Link>
          </Empty>
        </Card>
      )}
      {!!students.length && !shown.length && <Empty icon={Search}>Kein Kind passt zu „{q}“.</Empty>}
    </div>
  )
}

/** Alle Klassen/Gruppen (auch archivierte) nach ID – für Stammklasse und Herkunft von Einträgen. */
function useClassMap() {
  return useLiveQuery(async () => new Map(alive(await db.classes.toArray()).map((c) => [c.id, c])), []) ?? new Map<string, SchoolClass>()
}

/** Alle Kompetenzen (beide Doppeljahrgangsstufen) – für Einträge aus früheren Schuljahren. */
function useAllCompetencies() {
  return useLiveQuery(async () => alive(await db.competencies.toArray()), []) ?? []
}

export function SupportBadges({ s }: { s: Student }) {
  const b = s.support ?? {}
  const items = [b.lrs && 'LRS', b.notenschutz && 'NS', b.nachteilsausgleich && 'NA', b.msd && 'MSD', b.daz && 'DaZ'].filter(Boolean) as string[]
  if (!items.length) return null
  return (
    <>
      {items.map((i) => (
        <Badge key={i} tone="violet">
          {i}
        </Badge>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ Akte */

type Tab = 'verlauf' | 'kompetenzen' | 'verhalten' | 'ziele' | 'zeugnis' | 'profil'

function Akte({ id }: { id: string }) {
  // null = geladen, aber nicht (mehr) vorhanden; undefined = lädt noch
  const student = useLiveQuery(async () => aliveOne(await db.students.get(id)) ?? null, [id])
  const cls = useClass(student?.classId)
  const students = useStudents(student?.classId)
  // Alle Einträge des Kindes – über Klassen, Gruppen und Schuljahre hinweg
  const obs = useStudentObservations(student ? id : undefined)
  const comps = useCompetencies(cls)
  const allComps = useAllCompetencies()
  const classById = useClassMap()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('verlauf')
  const [capture, setCapture] = useState<CaptureContext | null>(null)
  const [asking, setAsking] = useState(false)
  const goals = useLiveQuery(async () => alive(await db.goals.where('studentId').equals(id).toArray()), [id]) ?? []
  const openConversation = useLiveQuery(
    async () =>
      alive(await db.conversations.where('studentId').equals(id).toArray())
        .filter((c) => c.status === 'vorbereitung')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
    [id],
  )

  if (student === null)
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
        {backLink}
        <Card>
          <Empty icon={UserX}>Dieses Kind wurde nicht gefunden – vielleicht wurde es gelöscht oder in eine andere Klasse verschoben.</Empty>
          <div className="flex justify-center pb-2">
            <Button variant="secondary" onClick={() => navigate('/kinder')}>
              Zur Kinderliste
            </Button>
          </div>
        </Card>
      </div>
    )
  if (!student || !cls) return null

  const stats = studentStats([student], obs)[0]
  const balance = balanceIssues([student], obs, cls.subjects).map((b) => b.text.replace(`${student.firstName}: `, ''))
  const history = [...(student.history ?? [])].sort((a, b) => b.schoolYear.localeCompare(a.schoolYear))
  // Kompetenzen des aktuellen Rasters + solche, die in älteren Einträgen vorkommen
  const usedIds = new Set(obs.map((o) => o.competencyId).filter(Boolean))
  const profileComps = [...comps, ...allComps.filter((c) => usedIds.has(c.id) && !comps.some((x) => x.id === c.id))]
  const openGoals = goals.filter((g) => g.status !== 'erreicht' && g.status !== 'verworfen').length
  const ctx = (edit?: Observation): CaptureContext => ({ classId: cls.id, gradeLevel: cls.gradeLevel, subjects: cls.subjects, students, competencies: comps, studentIds: [id], edit })

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      {backLink}

      {/* Kopf */}
      <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-slate-200/80 md:p-6">
        <div className="flex flex-wrap items-center gap-5">
          <CoverageRing value={stats.coverage} size={92}>
            <Avatar student={student} size={76} />
          </CoverageRing>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
              <ClassDot c={cls} /> {cls.name} · {cls.schoolYear}
            </p>
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-slate-900 md:text-[28px]">
              {student.firstName} {student.lastName}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <History size={14} /> {agoText(stats.days)}
              </span>
              <span className="text-slate-300">·</span>
              <span className="tabular-nums">{obs.length} Einträge</span>
              <span className="text-slate-300">·</span>
              <span className="tabular-nums">{stats.count30} in 30 Tagen</span>
            </div>
            <div className="flex flex-wrap gap-1 pt-0.5">
              <SupportBadges s={student} />
            </div>
          </div>
        </div>
        {history.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 inline-flex items-center gap-1 font-medium text-slate-500">
              <GraduationCap size={14} /> Frühere Klassen
            </span>
            {history.map((h) => (
              <span key={`${h.classId}-${h.schoolYear}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700">
                <ClassDot c={classById.get(h.classId) ?? { id: h.classId } as SchoolClass} className="!size-2" />
                {h.className}
                <span className="font-normal text-slate-400 tabular-nums">{h.schoolYear}</span>
              </span>
            ))}
          </div>
        )}
        {balance.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Hinweise zur Ausgewogenheit">
            {balance.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
                <Lightbulb size={13} /> {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Button onClick={() => setCapture(ctx())}>
            <Plus size={16} /> Beobachtung
          </Button>
          <Button variant="secondary" onClick={() => navigate(openConversation ? `/gespraeche/${openConversation.id}` : `/gespraeche/neu/${id}`)}>
            <MessagesSquare size={16} /> {openConversation ? 'Gespräch fortsetzen' : 'Gespräch vorbereiten'}
          </Button>
          <AiButton size="md" onClick={() => setAsking(true)}>
            Frage an die Akte
          </AiButton>
        </div>
      </section>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'verlauf', label: `Verlauf · ${obs.length}` },
          { value: 'kompetenzen', label: 'Kompetenzen' },
          { value: 'verhalten', label: 'Verhalten' },
          { value: 'ziele', label: openGoals ? `Ziele · ${openGoals}` : 'Ziele' },
          { value: 'zeugnis', label: 'Zeugnistext' },
          { value: 'profil', label: 'Profil' },
        ]}
      />

      {tab === 'verlauf' && (
        <Timeline obs={obs} comps={allComps.length ? allComps : comps} classById={classById} homeClassId={student.classId} onEdit={(o) => setCapture(ctx(o))} onAdd={() => setCapture(ctx())} />
      )}
      {tab === 'kompetenzen' && <CompetencyProfile obs={obs.filter((o) => !o.seenOnly)} comps={profileComps} />}
      {tab === 'verhalten' && <Behaviour obs={obs} />}
      {tab === 'ziele' && <Goals student={student} comps={comps} />}
      {tab === 'zeugnis' && <ZeugnisTab student={student} cls={cls} obs={obs} comps={allComps.length ? allComps : comps} />}
      {tab === 'profil' && <Profile key={student.id} student={student} />}

      <AskSheet
        open={asking}
        onClose={() => setAsking(false)}
        title={`Frage zu ${student.firstName}`}
        placeholder={`Wie hat sich ${student.firstName} in Mathe seit September entwickelt?`}
        data={() => studentContext(student, cls, obs.filter((o) => !o.seenOnly), allComps.length ? allComps : comps, goals)}
      />
      <QuickCapture ctx={capture} onClose={() => setCapture(null)} />
    </div>
  )
}

/* ------------------------------------------------------------------ Verlauf */

const VALENCE: Record<Valence, { label: string; tone: 'green' | 'slate' | 'rose' }> = {
  pos: { label: 'positiv', tone: 'green' },
  neu: { label: 'neutral', tone: 'slate' },
  neg: { label: 'kritisch', tone: 'rose' },
}

const selectCls = clsx(inputCls, '!w-auto py-2 pr-8 text-sm')

/** Markiert/entfernt eine Beobachtung als Ankerbeispiel ihrer Kompetenz auf der eingeschätzten Stufe. */
async function toggleAnchor(o: Observation) {
  if (!o.competencyId || !o.level) return
  const cur = aliveOne(await db.competencies.get(o.competencyId))
  if (!cur) return toast('Kompetenz nicht mehr vorhanden')
  const anchors = { ...(cur.anchors ?? {}) }
  const list = anchors[o.level] ?? []
  const on = list.includes(o.id)
  anchors[o.level] = on ? list.filter((x) => x !== o.id) : [...list, o.id]
  await save(db.competencies, { ...cur, anchors })
  toast(on ? 'Ankerbeispiel entfernt' : `Als Ankerbeispiel für „${LEVEL_LABEL[o.level]}“ markiert`)
}

export function Timeline({
  obs,
  comps,
  onEdit,
  onAdd,
  classById,
  homeClassId,
}: {
  obs: Observation[]
  comps: Competency[]
  onEdit?: (o: Observation) => void
  onAdd?: () => void
  classById?: Map<string, SchoolClass>
  homeClassId?: string
}) {
  const [kind, setKind] = useState<'alle' | ObsKind>('alle')
  const [subject, setSubject] = useState('alle')
  const [showSeen, setShowSeen] = useState(false)
  const [menu, setMenu] = useState<string | null>(null)
  const subjects = [...new Set(obs.map((o) => o.subject).filter(Boolean))] as string[]
  const kinds = [...new Set(obs.map((o) => o.kind))]
  const seenCount = obs.filter((o) => o.seenOnly).length
  const shown = obs
    .filter((o) => (showSeen || !o.seenOnly) && (kind === 'alle' || o.kind === kind) && (subject === 'alle' || o.subject === subject))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const byMonth = shown.reduce<Record<string, Observation[]>>((acc, o) => ((acc[o.date.slice(0, 7)] ??= []).push(o), acc), {})
  const compById = useMemo(() => new Map(comps.map((c) => [c.id, c])), [comps])

  if (!obs.length)
    return (
      <Card>
        <Empty icon={History}>Noch keine Einträge. Halte die erste Beobachtung fest – kurz reicht.</Empty>
        {onAdd && (
          <div className="flex justify-center pb-2">
            <Button onClick={onAdd}>
              <Plus size={16} /> Beobachtung
            </Button>
          </div>
        )}
      </Card>
    )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as ObsKind)} className={selectCls} aria-label="Art">
          <option value="alle">Alle Arten</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        {subjects.length > 0 && (
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectCls} aria-label="Fach">
            <option value="alle">Alle Fächer</option>
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
        {seenCount > 0 && (
          <label className="flex min-h-10 items-center gap-2 px-1 text-sm text-slate-600">
            <input type="checkbox" checked={showSeen} onChange={(e) => setShowSeen(e.target.checked)} className="size-5 accent-brand-600" />
            auch „gesehen“ anzeigen <span className="text-slate-400 tabular-nums">({seenCount})</span>
          </label>
        )}
      </div>

      {Object.entries(byMonth).map(([month, list]) => (
        <section key={month}>
          <p className="mb-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            {format(parseISO(month + '-01'), 'MMMM yyyy', { locale: de })} · <span className="tabular-nums">{list.length}</span>
          </p>
          <ol className="relative space-y-3 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:rounded-full before:bg-slate-200">
            {list.map((o) => {
              const comp = o.competencyId ? compById.get(o.competencyId) : undefined
              const open = () => onEdit?.(o)
              const origin = homeClassId && o.classId !== homeClassId ? classById?.get(o.classId) : undefined
              const scaleItem = o.scaleItemId ? BEHAVIOR_ITEMS.find((b) => b.id === o.scaleItemId) : undefined
              const isAnchor = !!(comp && o.level && comp.anchors?.[o.level]?.includes(o.id))
              const canAnchor = !!(comp && o.level)
              if (o.seenOnly)
                return (
                  <li key={o.id} className="relative">
                    <span className="absolute top-2.5 -left-6 flex size-4 items-center justify-center rounded-full bg-white">
                      <span className="size-2 rounded-full bg-slate-300" />
                    </span>
                    <p className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-400 ring-1 ring-slate-100">
                      <Eye size={13} /> {format(parseISO(o.date), 'EEE, d. MMM', { locale: de })} · gesehen, unauffällig{o.subject ? ` · ${o.subject}` : ''}
                    </p>
                  </li>
                )
              return (
                <li key={o.id} className="relative">
                  <span className="absolute top-5 -left-6 flex size-4 items-center justify-center rounded-full bg-white ring-2 ring-white">
                    <ValenceDot v={o.valence} />
                  </span>
                  <div
                    role={onEdit ? 'button' : undefined}
                    tabIndex={onEdit ? 0 : undefined}
                    onClick={open}
                    onKeyDown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), open())}
                    className={clsx(
                      'relative rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-slate-200/80 transition',
                      onEdit && 'cursor-pointer hover:ring-slate-300 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
                      o.unsorted && '!ring-amber-200',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5 pr-9 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{format(parseISO(o.date), 'EEEE, d. MMM', { locale: de })}</span>
                      {o.unsorted && (
                        <Badge tone="amber">
                          <Inbox size={11} /> unsortiert
                        </Badge>
                      )}
                      <Badge tone="brand">{KIND_LABEL[o.kind] ?? o.kind}</Badge>
                      <Badge tone={VALENCE[o.valence].tone}>{VALENCE[o.valence].label}</Badge>
                      {o.subject && <Badge tone="sky">{o.subject}</Badge>}
                      {o.groupWork && (
                        <Badge tone="slate">
                          <UsersRound size={11} /> Gruppenarbeit · nicht notenrelevant
                        </Badge>
                      )}
                      {origin && (
                        <Badge tone="slate">
                          <ClassDot c={origin} className="!size-2" /> {origin.name}
                        </Badge>
                      )}
                      {isAnchor && (
                        <Badge tone="violet">
                          <Anchor size={11} /> Ankerbeispiel
                        </Badge>
                      )}
                      {o.shareable && (
                        <Badge tone="slate">
                          <Eye size={11} /> zeigbar
                        </Badge>
                      )}
                    </div>
                    {canAnchor && (
                      <div className="absolute top-2.5 right-2.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setMenu(menu === o.id ? null : o.id)}
                          aria-label="Weitere Aktionen"
                          aria-expanded={menu === o.id}
                          className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {menu === o.id && (
                          <>
                            <button type="button" aria-label="Menü schließen" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(null)} />
                            <div className="absolute top-10 right-0 z-40 w-72 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setMenu(null)
                                  toggleAnchor(o).catch((e) => toast((e as Error).message))
                                }}
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Anchor size={15} className="shrink-0 text-violet-600" />
                                {isAnchor ? `Ankerbeispiel für Stufe ${o.level} entfernen` : `Als Ankerbeispiel für Stufe ${o.level} markieren`}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {o.competencyId && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                        {comp ? comp.text : <span className="font-normal text-slate-400 italic">Kompetenz nicht mehr vorhanden</span>}
                        {o.level && <LevelChip level={o.level} />}
                      </p>
                    )}
                    {scaleItem && o.frequency && (
                      <p className="mt-2 text-sm text-slate-800">
                        {scaleItem.text}: <span className="font-semibold">{FREQUENCY_LABEL[o.frequency]}</span>
                      </p>
                    )}
                    {o.text && <p className={clsx('mt-1.5 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-700', o.kind === 'zitat' && 'italic')}>{o.text}</p>}
                    {!o.text && !o.competencyId && !scaleItem && !o.attachments.length && <p className="mt-1.5 text-sm text-slate-400 italic">Ohne Text</p>}
                    {o.interpretation && (
                      <p className="mt-2 border-l-2 border-slate-200 pl-3 text-sm text-slate-500 italic">
                        <span className="font-medium not-italic">Deutung:</span> {o.interpretation}
                      </p>
                    )}
                    {o.nextStep && (
                      <p className="mt-2 flex items-start gap-1.5 text-sm text-brand-800">
                        <ArrowRight size={15} className="mt-0.5 shrink-0" />
                        <span>
                          <span className="font-medium">Nächster Schritt:</span> {o.nextStep}
                        </span>
                      </p>
                    )}
                    {o.attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        {o.attachments.map((a) => (
                          <AttachmentView key={a.id} a={a} owner={{ table: 'observations', id: o.id }} />
                        ))}
                      </div>
                    )}
                    {o.followUp && (
                      <p className={clsx('mt-2 inline-flex items-center gap-1 text-xs', o.followUp <= today() ? 'text-amber-700' : 'text-slate-400')}>
                        <CalendarClock size={13} /> Wiedervorlage {format(parseISO(o.followUp), 'd.M.yy')}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
      {!shown.length && <Empty icon={Search}>Keine Einträge für diesen Filter.</Empty>}
    </div>
  )
}

/* ------------------------------------------------------------------ Kompetenzen */

const LEVEL_TONE = ['bg-slate-100 text-slate-400', 'bg-rose-50 text-rose-800 ring-rose-100', 'bg-amber-50 text-amber-800 ring-amber-100', 'bg-lime-50 text-lime-800 ring-lime-100', 'bg-emerald-50 text-emerald-800 ring-emerald-100']

function LevelChip({ level, wide }: { level?: number; wide?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-semibold ring-1 ring-transparent ring-inset', LEVEL_TONE[level ?? 0], wide && 'w-24 py-1')}>
      {level ? LEVEL_LABEL[level] : '–'}
    </span>
  )
}

/** Kleine Verlaufslinie für Stufen 1–4. */
function Spark({ points, labels = LEVEL_LABEL }: { points: { date: string; level: number }[]; labels?: readonly string[] }) {
  const w = 120
  const h = 32
  if (!points.length) return <span className="inline-block w-[120px] text-center text-xs text-slate-300">–</span>
  const xs = points.map((_, i) => (points.length === 1 ? w / 2 : (i / (points.length - 1)) * (w - 8) + 4))
  const ys = points.map((p) => h - 4 - ((p.level - 1) / 3) * (h - 8))
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible text-brand-600" aria-hidden>
      {[1, 2, 3, 4].map((l) => {
        const y = h - 4 - ((l - 1) / 3) * (h - 8)
        return <line key={l} x1={0} x2={w} y1={y} y2={y} stroke="var(--color-slate-100)" strokeWidth={1} />
      })}
      <polyline points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 3.5 : 2.5} fill="currentColor">
          <title>
            {format(parseISO(points[i].date), 'd.M.yy')}: {labels[points[i].level]}
          </title>
        </circle>
      ))}
    </svg>
  )
}

function CompetencyProfile({ obs, comps }: { obs: Observation[]; comps: Competency[] }) {
  const rated = obs.filter((o) => o.competencyId && o.level)
  const bySubject = comps.reduce<Record<string, Competency[]>>((acc, c) => ((acc[c.subject] ??= []).push(c), acc), {})
  const [mode, setMode] = useState<'rated' | 'all'>('rated')
  const knownIds = new Set(comps.map((c) => c.id))
  const orphaned = rated.filter((o) => !knownIds.has(o.competencyId!)).length
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'rated', label: 'Eingeschätzt' },
            { value: 'all', label: 'Alle Kompetenzen' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {[1, 2, 3, 4].map((l) => (
            <LevelChip key={l} level={l} />
          ))}
        </div>
      </div>
      {Object.entries(bySubject).map(([subject, cs]) => {
        const rows = cs
          .map((c) => ({
            c,
            pts: rated
              .filter((o) => o.competencyId === c.id)
              .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
              .map((o) => ({ date: o.date, level: o.level! })),
          }))
          .filter((r) => mode === 'all' || r.pts.length)
        if (!rows.length) return null
        return (
          <Card key={subject} title={subject} icon={BookOpen} action={<span className="text-xs text-slate-400 tabular-nums">{rows.filter((r) => r.pts.length).length} eingeschätzt</span>}>
            <ul className="-my-2 divide-y divide-slate-100">
              {rows.map(({ c, pts }) => {
                const last = pts[pts.length - 1]
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="text-sm text-slate-800">{c.text}</p>
                      <p className="text-xs text-slate-400">
                        {c.area}
                        {last && ` · zuletzt ${format(parseISO(last.date), 'd.M.yy')}`}
                      </p>
                    </div>
                    <Spark points={pts} />
                    <LevelChip level={last?.level} wide />
                  </li>
                )
              })}
            </ul>
          </Card>
        )
      })}
      {!rated.length && mode === 'rated' && (
        <Card>
          <Empty icon={BookOpen}>Noch keine Kompetenz-Einschätzungen. Wähle beim Stundenstart Kompetenzen als Schwerpunkt, dann kannst du sie mit einem Tipp einschätzen.</Empty>
        </Card>
      )}
      {orphaned > 0 && <p className="text-xs text-slate-400">{orphaned} Einschätzungen gehören zu Kompetenzen, die nicht mehr im Raster sind.</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ Verhalten */

function Behaviour({ obs: all }: { obs: Observation[] }) {
  const obs = all.filter((o) => !o.seenOnly)
  const weeks = Array.from({ length: 12 }, (_, i) => startOfWeek(subWeeks(new Date(), 11 - i), { weekStartsOn: 1 }))
  const rows: { kind: ObsKind; label: string; icon: typeof HeartHandshake }[] = [
    { kind: 'sozialverhalten', label: 'Sozialverhalten', icon: HeartHandshake },
    { kind: 'arbeitsverhalten', label: 'Lern- & Arbeitsverhalten', icon: ClipboardCheck },
  ]
  const since = formatISO(weeks[0], { representation: 'date' })
  const scaled = obs.filter((o) => o.scaleItemId && o.frequency).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const scaleRows = BEHAVIOR_ITEMS.map((item) => ({ item, pts: scaled.filter((o) => o.scaleItemId === item.id).map((o) => ({ date: o.date, level: o.frequency! })) })).filter((r) => r.pts.length)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {scaleRows.length > 0 && (
        <Card title="Verhaltensskala" icon={ClipboardCheck} className="lg:col-span-2" action={<span className="text-xs text-slate-400">nie · selten · oft · immer</span>}>
          <ul className="-my-2 divide-y divide-slate-100">
            {scaleRows.map(({ item, pts }) => {
              const last = pts[pts.length - 1]
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-sm text-slate-800">{item.text}</p>
                    <p className="text-xs text-slate-400">
                      {item.area === 'sozialverhalten' ? 'Sozialverhalten' : 'Arbeitsverhalten'} · {pts.length}× eingeschätzt · zuletzt {format(parseISO(last.date), 'd.M.yy')}
                    </p>
                  </div>
                  <Spark points={pts} labels={FREQUENCY_LABEL} />
                  <span className={clsx('inline-flex w-24 items-center justify-center rounded-lg py-1 text-xs font-semibold ring-1 ring-transparent ring-inset', LEVEL_TONE[last.level])}>
                    {FREQUENCY_LABEL[last.level]}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      {rows.map(({ kind, label, icon }) => {
        const list = obs.filter((o) => o.kind === kind).sort((a, b) => b.date.localeCompare(a.date))
        const data = weeks.map((w, i) => {
          const from = formatISO(w, { representation: 'date' })
          const to = i < weeks.length - 1 ? formatISO(weeks[i + 1], { representation: 'date' }) : '9999'
          const inW = list.filter((o) => o.date >= from && o.date < to)
          return { w, pos: inW.filter((o) => o.valence === 'pos').length, neg: inW.filter((o) => o.valence === 'neg').length }
        })
        const max = Math.max(2, ...data.map((d) => Math.max(d.pos, d.neg)))
        const recent = list.filter((o) => o.date >= since)
        const pos = recent.filter((o) => o.valence === 'pos').length
        const neg = recent.filter((o) => o.valence === 'neg').length
        return (
          <Card key={kind} title={label} icon={icon} action={<span className="text-xs text-slate-400">letzte 12 Wochen</span>}>
            <div className="mb-4 flex gap-2">
              <Badge tone="green" className="tabular-nums">
                {pos} positiv
              </Badge>
              <Badge tone="rose" className="tabular-nums">
                {neg} kritisch
              </Badge>
            </div>
            <div className="flex h-36 items-center gap-1">
              {data.map((d, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center">
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div className="w-3/5 max-w-4 rounded-t-md bg-emerald-400" style={{ height: `${(d.pos / max) * 100}%` }} title={`${d.pos} positiv`} />
                  </div>
                  <div className="h-px w-full bg-slate-200" />
                  <div className="flex w-full flex-1 items-start justify-center">
                    <div className="w-3/5 max-w-4 rounded-b-md bg-rose-400" style={{ height: `${(d.neg / max) * 100}%` }} title={`${d.neg} kritisch`} />
                  </div>
                  <span className={clsx('mt-1 text-[10px] text-slate-400 tabular-nums', i % 2 && 'max-sm:invisible')}>{format(d.w, 'd.M.')}</span>
                </div>
              ))}
            </div>
            {list.length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
                {list.slice(0, 5).map((o) => (
                  <li key={o.id} className="flex items-start gap-2.5">
                    <span className="mt-1.5">
                      <ValenceDot v={o.valence} />
                    </span>
                    <span className="w-10 shrink-0 text-slate-400 tabular-nums">{format(parseISO(o.date), 'd.M.')}</span>
                    <span className="min-w-0 text-slate-700">{o.text || <span className="text-slate-400 italic">ohne Text</span>}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-400">Noch keine Einträge zu {label}.</p>
            )}
          </Card>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ Ziele */

const GOAL_KIND: Record<Goal['kind'], { label: string; tone: 'brand' | 'violet' | 'sky' }> = {
  lernziel: { label: 'Lernziel', tone: 'brand' },
  foerderziel: { label: 'Förderziel', tone: 'violet' },
  vereinbarung: { label: 'Vereinbarung', tone: 'sky' },
}

function Goals({ student, comps }: { student: Student; comps: Competency[] }) {
  const goals =
    useLiveQuery(async () => alive(await db.goals.where('studentId').equals(student.id).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [student.id]) ?? []
  const [text, setText] = useState('')
  const [kind, setKind] = useState<Goal['kind']>('lernziel')
  const [due, setDue] = useState('')
  const [competencyId, setCompetencyId] = useState('')
  const compById = new Map(comps.map((c) => [c.id, c]))
  const add = async () => {
    if (!text.trim()) return
    await save(db.goals, {
      id: uid(),
      studentId: student.id,
      classId: student.classId,
      text: text.trim(),
      kind,
      due: due || undefined,
      competencyId: competencyId || undefined,
      status: 'offen',
      createdAt: now(),
      updatedAt: now(),
    })
    setText('')
    setDue('')
    setCompetencyId('')
  }
  const setStatus = async (g: Goal, status: Goal['status']) => {
    const cur = aliveOne(await db.goals.get(g.id))
    if (cur) await save(db.goals, { ...cur, status })
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card title="Neues Ziel" icon={Flag} className="self-start">
        <div className="space-y-3">
          <Field label="Ziel (kindgerecht formuliert)">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} className={inputCls} placeholder="Ich rechne Aufgaben bis 20 ohne Finger." />
          </Field>
          <Field label="Art">
            <Segmented
              value={kind}
              onChange={setKind}
              options={(Object.keys(GOAL_KIND) as Goal['kind'][]).map((k) => ({ value: k, label: GOAL_KIND[k].label }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="flex justify-end pt-1">
            <Button onClick={add} disabled={!text.trim()}>
              <Plus size={16} /> Ziel hinzufügen
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {goals.map((g) => {
          const overdue = g.status !== 'erreicht' && g.due && g.due < today()
          const comp = g.competencyId ? compById.get(g.competencyId) : undefined
          return (
            <div key={g.id} className={clsx('rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-slate-200/80', g.status === 'erreicht' && 'opacity-75')}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={GOAL_KIND[g.kind].tone}>{GOAL_KIND[g.kind].label}</Badge>
                {g.due && (
                  <Badge tone={overdue ? 'amber' : 'slate'}>
                    <CalendarClock size={11} /> bis {format(parseISO(g.due), 'd.M.yy')}
                  </Badge>
                )}
                {g.status === 'verworfen' && <Badge tone="slate">verworfen</Badge>}
                <span className="ml-auto text-xs text-slate-400">seit {format(parseISO(g.createdAt), 'd.M.yy')}</span>
              </div>
              <p className={clsx('mt-2 text-[15px] font-medium text-slate-900', g.status === 'erreicht' && 'line-through decoration-slate-300')}>{g.text}</p>
              {comp && <p className="mt-0.5 text-xs text-slate-500">{comp.subject}: {comp.text}</p>}
              <div className="mt-3">
                <Segmented
                  size="sm"
                  value={g.status}
                  onChange={(status) => setStatus(g, status)}
                  options={[
                    { value: 'offen', label: 'offen' },
                    { value: 'teilweise', label: 'teilweise' },
                    { value: 'erreicht', label: 'erreicht' },
                  ]}
                />
              </div>
            </div>
          )
        })}
        {!goals.length && (
          <Card>
            <Empty icon={Target}>Noch keine Ziele. Ein kleines, überprüfbares Ziel hilft beim nächsten Gespräch.</Empty>
          </Card>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Profil */

type SupportFlag = Exclude<keyof Support, 'note'>
type Draft = Partial<Pick<Student, 'firstName' | 'lastName' | 'birthday' | 'info'>> & { support?: Partial<Support> }

const SUPPORT_OPTIONS: [SupportFlag, string][] = [
  ['lrs', 'LRS'],
  ['notenschutz', 'Notenschutz'],
  ['nachteilsausgleich', 'Nachteilsausgleich'],
  ['msd', 'Sonderpäd. Förderbedarf (MSD)'],
  ['daz', 'DaZ / Vorkurs'],
]

/** Bearbeitet nur geänderte Felder; der Rest kommt immer live aus der Datenbank. */
function Profile({ student }: { student: Student }) {
  const [draft, setDraft] = useState<Draft>({})
  const [busy, setBusy] = useState(false)
  const val = (k: 'firstName' | 'lastName' | 'birthday' | 'info') => draft[k] ?? student[k] ?? ''
  const sup: Support = { ...student.support, ...draft.support }
  const set = (patch: Draft) => setDraft((d) => ({ ...d, ...patch, support: patch.support ? { ...d.support, ...patch.support } : d.support }))
  const dirty = Object.keys(draft).some((k) => (k === 'support' ? Object.keys(draft.support ?? {}).length > 0 : true))

  const submit = async () => {
    setBusy(true)
    try {
      const cur = aliveOne(await db.students.get(student.id))
      if (!cur) throw new Error('Kind nicht gefunden')
      const { support, ...fields } = draft
      const firstName = (fields.firstName ?? cur.firstName).trim()
      if (!firstName) throw new Error('Vorname darf nicht leer sein')
      await save(db.students, { ...cur, ...fields, firstName, lastName: (fields.lastName ?? cur.lastName).trim(), birthday: (fields.birthday ?? cur.birthday) || undefined, support: support ? { ...cur.support, ...support } : cur.support })
      setDraft({})
      toast('Profil gespeichert')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Stammdaten" icon={UserRound}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vorname">
              <input value={val('firstName')} onChange={(e) => set({ firstName: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Nachname">
              <input value={val('lastName')} onChange={(e) => set({ lastName: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Geburtstag">
              <input type="date" value={val('birthday')} onChange={(e) => set({ birthday: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Wichtige Infos" hint="Allergien, Abholung, Medikamente …">
              <textarea value={val('info')} onChange={(e) => set({ info: e.target.value })} rows={4} className={inputCls} />
            </Field>
          </div>
        </Card>

        <Card title="Förderstatus" icon={ShieldCheck}>
          <div className="flex flex-wrap gap-2">
            {SUPPORT_OPTIONS.map(([k, l]) => {
              const on = !!sup[k]
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ support: { [k]: !on } })}
                  className={clsx(
                    'min-h-10 rounded-xl px-3.5 text-sm font-medium ring-1 transition ring-inset',
                    on ? 'bg-violet-50 text-violet-800 ring-violet-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  {l}
                </button>
              )
            })}
          </div>
          <div className="mt-4">
            <Field label="Notiz zum Förderstatus" hint="z. B. Gutachten vom …, vereinbarte Maßnahmen">
              <textarea value={sup.note ?? ''} onChange={(e) => set({ support: { note: e.target.value } })} rows={3} className={inputCls} />
            </Field>
          </div>
        </Card>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {dirty && <span className="mr-auto text-sm text-amber-700">Ungespeicherte Änderungen</span>}
        {dirty && (
          <Button variant="ghost" onClick={() => setDraft({})}>
            Verwerfen
          </Button>
        )}
        <Button onClick={submit} disabled={!dirty || busy}>
          Speichern
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Zeugnis */

function ZeugnisTab({ student, cls, obs, comps }: { student: Student; cls: SchoolClass; obs: Observation[]; comps: Competency[] }) {
  const [term, setTerm] = useState<string>(defaultTerm(cls.gradeLevel))
  const [du, setDu] = useState(cls.gradeLevel <= 2)
  const art = artFor(cls.gradeLevel, term)
  return (
    <Card
      title={`Zeugnistext · ${art}`}
      icon={FileText}
      action={
        <Link to="/zeugnis" className="text-sm font-medium text-brand-700 hover:underline">
          Ganze Klasse
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented size="sm" value={term} onChange={setTerm} options={termProfiles(cls.gradeLevel).map((p) => ({ value: p.term, label: p.term }))} />
        <Badge tone={art === 'Wortgutachten' ? 'violet' : 'sky'}>{art}</Badge>
        <label className="flex min-h-10 items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={du} onChange={(e) => setDu(e.target.checked)} className="size-5 accent-brand-600" /> Mit „Du“ ansprechen
        </label>
      </div>
      <ReportEditor key={term} student={student} cls={cls} obs={obs} comps={comps} term={term} du={du} />
    </Card>
  )
}
