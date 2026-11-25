import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Grid3x3, LayoutGrid, NotebookPen, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AiTextSheet } from '../components/AiSheets'
import { Avatar, Button, Card, Empty, PageHeader, Segmented } from '../components/ui'
import { ai, obsLine } from '../lib/ai'
import { alive, db, isGroup, type Competency, type Lesson, type Observation, type SchoolClass } from '../lib/db'
import { useActiveClass, useCompetencies, useObservations, useStudents } from '../lib/hooks'
import { daysAgo, latestLevels } from '../lib/insights'
import { DEFAULT_LEVEL_HINTS, LEVEL_LABEL } from '../lib/seed'
import { ClassDot } from '../components/ClassSwitcher'

const LEVEL_BG = ['bg-slate-100', 'bg-rose-300', 'bg-amber-300', 'bg-lime-300', 'bg-emerald-400']
const RATING_BG = { gruen: 'bg-emerald-500', gelb: 'bg-amber-400', rot: 'bg-rose-500' } as const
const RATING_LABEL = { gruen: 'lief gut', gelb: 'gemischt', rot: 'schwierig' } as const
const LEVEL_TEXT = ['text-slate-400', 'text-rose-900', 'text-amber-900', 'text-lime-900', 'text-emerald-950']
const shortDate = (d: string) => d.slice(5).split('-').reverse().join('.')

type View = 'kompetenzen' | 'abdeckung' | 'reflexion'

/** Beobachtbarer Indikator einer Stufe (kompetenzeigen, sonst allgemein). */
const indicator = (c: Competency, level?: number) => (level ? c.indicators?.[level - 1]?.trim() || DEFAULT_LEVEL_HINTS[level] : '')

/** Kleines Stammklassen-Kennzeichen in Gruppen. */
function HomeTag({ c }: { c?: SchoolClass }) {
  if (!c) return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-normal text-slate-400">
      <ClassDot c={c} className="!size-2" /> {c.name}
    </span>
  )
}

export default function Klassenblick() {
  const nav = useNavigate()
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const obs = useObservations(cls?.id)
  const comps = useCompetencies(cls)
  const lessons = useLiveQuery(async () => (cls ? alive(await db.lessons.where('classId').equals(cls.id).toArray()) : []), [cls?.id]) ?? []
  const classById = useLiveQuery(async () => new Map(alive(await db.classes.toArray()).map((c) => [c.id, c])), []) ?? new Map<string, SchoolClass>()
  const [view, setView] = useState<View>('kompetenzen')
  const [subjectPick, setSubject] = useState('Mathematik')
  const [cell, setCell] = useState<{ sid: string; cid: string } | null>(null)

  const latest = useMemo(() => latestLevels(obs), [obs])
  const [foerder, setFoerder] = useState<{ comp: string; subject: string; kinder: string[] } | null>(null)
  if (!cls) return null

  const subjects = [...new Set(comps.map((c) => c.subject))]
  const subject = subjects.includes(subjectPick) ? subjectPick : (subjects[0] ?? subjectPick)
  const ratedComps = comps.filter((c) => c.subject === subject && students.some((s) => latest.has(`${s.id}:${c.id}`)))
  // Wenige Kompetenzen: waagrechte Spaltentitel und breite Felder, damit die Tabelle die Karte füllt
  const wide = ratedComps.length <= 6

  const areas = ['Sozialverhalten', 'Arbeitsverhalten', ...cls.subjects]
  const d60 = daysAgo(60)
  // „Gesehen, unauffällig“ zählt nicht als Beleg
  const recent = obs.filter((o) => o.date >= d60 && !o.seenOnly)
  const group = isGroup(cls)
  const inArea = (o: Observation, area: string) => (area === 'Sozialverhalten' ? o.kind === 'sozialverhalten' : area === 'Arbeitsverhalten' ? o.kind === 'arbeitsverhalten' : o.subject === area)
  const count = (sid: string, area: string) => recent.filter((o) => o.studentIds.includes(sid) && inArea(o, area)).length

  const selStudent = cell && students.find((s) => s.id === cell.sid)
  const selComp = cell && comps.find((c) => c.id === cell.cid)
  const selObs = cell ? latest.get(`${cell.sid}:${cell.cid}`) : undefined

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow={group ? `${cls.name} · Gruppe` : cls.name}
        title="Klassenblick"
        subtitle={view === 'kompetenzen' ? 'Letzte Einschätzung je Kind und Kompetenz.' : view === 'abdeckung' ? 'Wie viele Beobachtungen gibt es je Bereich (letzte 60 Tage)?' : 'Rückblick auf die eigenen Stunden.'}
        actions={
          <Segmented
            value={view}
            onChange={(v) => {
              setView(v)
              setCell(null)
            }}
            options={[
              { value: 'kompetenzen', label: 'Kompetenzen' },
              { value: 'abdeckung', label: 'Abdeckung' },
              { value: 'reflexion', label: 'Meine Stunden' },
            ]}
          />
        }
      />

      {foerder && (
        <AiTextSheet
          open
          onClose={() => setFoerder(null)}
          title={`Förderideen: ${foerder.comp}`}
          deps={[foerder.comp]}
          run={async () => {
            const comp = comps.find((c) => c.text === foerder.comp)
            const beobachtungen = obs
              .filter((o) => o.competencyId === comp?.id || (o.subject === foerder.subject && o.valence === 'neg'))
              .slice(0, 60)
              .map((o) => obsLine(o, comps, students))
            return (await ai('foerder', { jahrgangsstufe: cls.gradeLevel, fach: foerder.subject, kompetenz: foerder.comp, betroffene_kinder: foerder.kinder, beobachtungen })).text
          }}
        />
      )}

      {view === 'kompetenzen' && (
        <div className="space-y-4">
          {subjects.length > 1 && (
            <Segmented
              size="sm"
              value={subject}
              onChange={(s) => {
                setSubject(s)
                setCell(null)
              }}
              options={subjects.map((s) => ({ value: s, label: s }))}
            />
          )}
          {ratedComps.length && students.length ? (
            <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-slate-200/80">
              {/* Detail zur angetippten Zelle */}
              <div className="flex min-h-[56px] items-center gap-3 border-b border-slate-100 px-4 py-2.5">
                {selStudent && selComp ? (
                  <>
                    <Avatar student={selStudent} size={30} />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-medium text-slate-900">
                        {selStudent.firstName} · <span className="font-normal text-slate-600">{selComp.text}</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className={clsx('size-2.5 rounded-sm', LEVEL_BG[selObs?.level ?? 0])} />
                        {selObs?.level ? `${LEVEL_LABEL[selObs.level]} · eingeschätzt am ${shortDate(selObs.date)}` : 'kein Beleg'}
                        {selObs?.text ? ` · „${selObs.text}“` : ''}
                      </p>
                      {selObs?.level && <p className="truncate text-xs text-slate-400 italic">Indikator: {indicator(selComp, selObs.level)}</p>}
                    </div>
                    <Link to={`/kinder/${selStudent.id}`} className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50">
                      Zur Akte
                    </Link>
                    <button onClick={() => setCell(null)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100" aria-label="Auswahl aufheben">
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Feld antippen für Details.</p>
                )}
              </div>

              <div className="max-h-[70dvh] overflow-auto overscroll-contain">
                <table className={clsx('border-separate border-spacing-0 text-sm', wide && 'w-full table-fixed')}>
                  <thead>
                    <tr>
                      <th className={clsx('sticky top-0 left-0 z-30 bg-white p-2', wide ? 'w-40 sm:w-48' : 'min-w-[9.5rem]')} />
                      {ratedComps.map((c) => (
                        <th
                          key={c.id}
                          className={clsx('sticky top-0 z-20 bg-white px-1 pb-2 align-bottom', wide ? 'w-28 min-w-[6.5rem] pt-3' : 'h-44 w-12', cell?.cid === c.id && 'bg-brand-50')}
                          title={c.text}
                        >
                          {wide ? (
                            <div className="line-clamp-3 px-1 text-left text-xs leading-snug font-medium text-slate-600">{c.text}</div>
                          ) : (
                            <div className="mx-auto w-6 rotate-180 text-left text-xs font-medium whitespace-nowrap text-slate-600 [writing-mode:vertical-rl]">
                              {c.text.length > 40 ? c.text.slice(0, 38) + '…' : c.text}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td className={clsx('sticky left-0 z-10 border-t border-slate-100 bg-white py-1 pr-3 pl-3', cell?.sid === s.id && 'bg-brand-50')}>
                          <Link to={`/kinder/${s.id}`} className="flex items-center gap-2 font-medium whitespace-nowrap text-slate-800 hover:text-brand-700">
                            <Avatar student={s} size={26} /> {s.firstName}
                            {group && <HomeTag c={classById.get(s.classId)} />}
                          </Link>
                        </td>
                        {ratedComps.map((c) => {
                          const o = latest.get(`${s.id}:${c.id}`)
                          const active = cell?.sid === s.id && cell?.cid === c.id
                          const cross = cell && (cell.sid === s.id || cell.cid === c.id)
                          return (
                            <td key={c.id} className={clsx('border-t border-slate-100 p-[3px]', cross && !active && 'bg-brand-50/60')}>
                              <button
                                type="button"
                                onClick={() => setCell({ sid: s.id, cid: c.id })}
                                onMouseEnter={() => setCell({ sid: s.id, cid: c.id })}
                                title={`${s.firstName}: ${o?.level ? `${LEVEL_LABEL[o.level]} (${shortDate(o.date)}) – ${indicator(c, o.level)}` : 'kein Beleg'}`}
                                aria-label={`${s.firstName}, ${c.text}: ${o?.level ? LEVEL_LABEL[o.level] : 'kein Beleg'}`}
                                className={clsx(
                                  'mx-auto flex h-10 items-center justify-center rounded-lg text-[11px] font-semibold transition',
                                  wide ? 'w-full' : 'w-10',
                                  LEVEL_BG[o?.level ?? 0],
                                  LEVEL_TEXT[o?.level ?? 0],
                                  active ? 'ring-2 ring-slate-900 ring-offset-1' : 'hover:brightness-95',
                                )}
                              >
                                {o?.level ? (wide ? LEVEL_LABEL[o.level] : o.level) : '–'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    <tr>
                      <td className="sticky left-0 z-10 border-t-2 border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                        unsicher <span className="text-slate-400">(≤ teilweise)</span>
                      </td>
                      {ratedComps.map((c) => {
                        const weak = students.filter((s) => (latest.get(`${s.id}:${c.id}`)?.level ?? 9) <= 2)
                        return (
                          <td key={c.id} className="border-t-2 border-slate-200 p-0.5 text-center">
                            {weak.length > 0 && (
                              <button
                                onClick={() => setFoerder({ comp: c.text, subject: c.subject, kinder: weak.map((s) => s.firstName) })}
                                className="inline-flex h-10 min-w-10 items-center justify-center gap-0.5 rounded-lg text-xs font-semibold text-rose-600 tabular-nums hover:bg-violet-50"
                                title="Förderideen (KI)"
                              >
                                {weak.length}
                                <Sparkles size={12} className="text-violet-500" />
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                {[1, 2, 3, 4].map((l) => (
                  <span key={l} className="flex items-center gap-1.5">
                    <span className={clsx('flex size-5 items-center justify-center rounded text-[10px] font-semibold', LEVEL_BG[l], LEVEL_TEXT[l])}>{l}</span> {LEVEL_LABEL[l]}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className={clsx('flex size-5 items-center justify-center rounded text-[10px] font-semibold', LEVEL_BG[0], LEVEL_TEXT[0])}>–</span> kein Beleg (nicht „schwach“)
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <Sparkles size={12} className="text-violet-500" /> Förderideen per KI
                </span>
              </div>
            </div>
          ) : (
            <Card>
              <Empty icon={Grid3x3}>
                {students.length ? `In ${subject} wurden noch keine Kompetenzen eingeschätzt. Einschätzungen entstehen beim Beobachten im Unterricht oder in der Akte eines Kindes.` : 'Noch keine Kinder in dieser Klasse.'}
              </Empty>
              <div className="flex flex-wrap justify-center gap-2">
                {students.length ? (
                  <>
                    <Button onClick={() => nav('/unterricht')}>Stunde starten</Button>
                    <Button variant="secondary" onClick={() => nav('/kinder')}>
                      Zu den Kindern
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => nav('/kinder')}>Kinder anlegen</Button>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {view === 'abdeckung' &&
        (students.length ? (
          <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-slate-200/80">
            <div className="max-h-[70dvh] overflow-auto overscroll-contain">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-30 bg-white px-3 py-3 text-left text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Kind</th>
                    {areas.map((a) => (
                      <th key={a} className="sticky top-0 z-20 bg-white px-1.5 py-3 text-xs font-medium whitespace-nowrap text-slate-600">
                        {a}
                      </th>
                    ))}
                    <th className="sticky top-0 z-20 bg-white px-3 py-3 text-xs font-medium text-slate-400">Σ</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const ns = areas.map((a) => count(s.id, a))
                    const gaps = ns.filter((n) => n === 0).length
                    return (
                      <tr key={s.id}>
                        <td className="sticky left-0 z-10 border-t border-slate-100 bg-white px-3 py-1">
                          <Link to={`/kinder/${s.id}`} className="flex items-center gap-2 font-medium whitespace-nowrap text-slate-800 hover:text-brand-700">
                            <Avatar student={s} size={26} /> {s.firstName}
                            {group && <HomeTag c={classById.get(s.classId)} />}
                            {gaps > 0 && <span className="text-[11px] font-normal text-slate-400 tabular-nums">{gaps}× kein Beleg</span>}
                          </Link>
                        </td>
                        {ns.map((n, i) => (
                          <td key={areas[i]} className="border-t border-slate-100 p-1 text-center">
                            <span
                              title={`${s.firstName} · ${areas[i]}: ${n ? `${n} Beobachtung${n === 1 ? '' : 'en'}` : 'kein Beleg'}`}
                              className={clsx(
                                'inline-flex size-10 items-center justify-center rounded-lg text-xs font-semibold tabular-nums',
                                n === 0 ? 'bg-slate-50 text-[10px] font-medium text-slate-400 ring-1 ring-slate-200 ring-inset' : n < 3 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800',
                              )}
                            >
                              {n || '–'}
                            </span>
                          </td>
                        ))}
                        <td className="border-t border-slate-100 px-3 text-center text-xs font-medium text-slate-500 tabular-nums">{ns.reduce((a, b) => a + b, 0)}</td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td className="sticky left-0 z-10 border-t-2 border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">ohne Beleg</td>
                    {areas.map((a) => {
                      const missing = students.filter((s) => count(s.id, a) === 0).length
                      return (
                        <td key={a} className={clsx('border-t-2 border-slate-200 py-2 text-center text-xs font-semibold tabular-nums', missing ? 'text-slate-600' : 'text-emerald-600')}>
                          {missing || '✓'}
                        </td>
                      )
                    })}
                    <td className="border-t-2 border-slate-200" />
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="size-3.5 rounded bg-slate-50 ring-1 ring-slate-200 ring-inset" /> kein Beleg
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3.5 rounded bg-amber-100" /> 1–2
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3.5 rounded bg-emerald-100" /> 3 und mehr
              </span>
              <span className="ml-auto">letzte 60 Tage · ohne „gesehen“</span>
            </div>
          </div>
        ) : (
          <Card>
            <Empty icon={LayoutGrid}>Noch keine Kinder in dieser Klasse.</Empty>
            <div className="flex justify-center">
              <Button onClick={() => nav('/kinder')}>Kinder anlegen</Button>
            </div>
          </Card>
        ))}

      {view === 'reflexion' && <Reflexion lessons={lessons} />}
    </div>
  )
}

function Reflexion({ lessons }: { lessons: Lesson[] }) {
  const nav = useNavigate()
  const done = lessons.filter((l) => l.status === 'abgeschlossen')
  const subjects = [...new Set(done.map((l) => l.subject))].sort((a, b) => a.localeCompare(b))
  if (!subjects.length)
    return (
      <Card>
        <Empty icon={BookOpen}>Noch keine abgeschlossenen Stunden. Nach jeder Stunde eine kurze Reflexion festhalten – hier entsteht dann der Rückblick.</Empty>
        <div className="flex justify-center">
          <Button onClick={() => nav('/unterricht')}>Zum Unterricht</Button>
        </div>
      </Card>
    )
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {subjects.map((subj) => {
        const ls = done.filter((l) => l.subject === subj).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        const tally = { gruen: 0, gelb: 0, rot: 0 }
        ls.forEach((l) => l.reflection?.rating && tally[l.reflection.rating]++)
        const rated = tally.gruen + tally.gelb + tally.rot
        const notes = ls
          .filter((l) => l.reflection?.note)
          .slice(-4)
          .reverse()
        return (
          <Card key={subj} title={subj} icon={BookOpen} action={<span className="text-xs text-slate-400 tabular-nums">{ls.length} Stunden</span>}>
            {rated > 0 && (
              <div className="mb-4 space-y-2">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                  {(['gruen', 'gelb', 'rot'] as const).map((r) => tally[r] > 0 && <div key={r} className={RATING_BG[r]} style={{ width: `${(tally[r] / rated) * 100}%` }} />)}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  {(['gruen', 'gelb', 'rot'] as const).map((r) => (
                    <span key={r} className="flex items-center gap-1.5">
                      <span className={clsx('size-2.5 rounded-full', RATING_BG[r])} />
                      <span className="tabular-nums">{tally[r]}</span> {RATING_LABEL[r]}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {ls.map((l) => (
                <Link
                  key={l.id}
                  to={`/unterricht/${l.id}`}
                  title={`${shortDate(l.date)}${l.topic ? ` · ${l.topic}` : ''}`}
                  aria-label={`Stunde vom ${shortDate(l.date)}${l.topic ? `: ${l.topic}` : ''}`}
                  className={clsx('size-5 rounded-full ring-2 ring-white transition hover:scale-125', l.reflection?.rating ? RATING_BG[l.reflection.rating] : 'bg-slate-200')}
                />
              ))}
            </div>
            {notes.length ? (
              <ul className="space-y-2">
                {notes.map((l) => (
                  <li key={l.id}>
                    <Link to={`/unterricht/${l.id}`} className="flex gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100">
                      <span className={clsx('mt-1.5 size-2 shrink-0 rounded-full', l.reflection?.rating ? RATING_BG[l.reflection.rating] : 'bg-slate-300')} />
                      <span className="min-w-0">
                        <span className="block text-[11px] text-slate-400 tabular-nums">
                          {shortDate(l.date)}
                          {l.topic ? ` · ${l.topic}` : ''}
                        </span>
                        {l.reflection?.note}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <NotebookPen size={14} /> Noch keine Notizen zu diesen Stunden.
              </p>
            )}
          </Card>
        )
      })}
    </div>
  )
}
