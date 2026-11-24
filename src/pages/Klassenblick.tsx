import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Card, Empty, Segmented } from '../components/ui'
import { alive, db } from '../lib/db'
import { useActiveClass, useCompetencies, useObservations, useStudents } from '../lib/hooks'
import { daysAgo, latestLevels } from '../lib/insights'
import { LEVEL_LABEL } from '../lib/seed'

const LEVEL_BG = ['bg-slate-50', 'bg-rose-200', 'bg-amber-200', 'bg-lime-200', 'bg-emerald-300']

export default function Klassenblick() {
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const obs = useObservations(cls?.id)
  const comps = useCompetencies(cls)
  const lessons = useLiveQuery(async () => (cls ? alive(await db.lessons.where('classId').equals(cls.id).toArray()) : []), [cls?.id]) ?? []
  const [view, setView] = useState<'kompetenzen' | 'abdeckung' | 'reflexion'>('kompetenzen')
  const [subject, setSubject] = useState('Mathematik')

  const latest = useMemo(() => latestLevels(obs), [obs])
  if (!cls) return null

  const ratedComps = comps.filter((c) => c.subject === subject && students.some((s) => latest.has(`${s.id}:${c.id}`)))
  const subjects = [...new Set(comps.map((c) => c.subject))]

  const areas = ['Sozialverhalten', 'Arbeitsverhalten', ...cls.subjects]
  const d60 = daysAgo(60)
  const recent = obs.filter((o) => o.date >= d60)
  const count = (sid: string, area: string) =>
    recent.filter(
      (o) =>
        o.studentIds.includes(sid) &&
        (area === 'Sozialverhalten' ? o.kind === 'sozialverhalten' : area === 'Arbeitsverhalten' ? o.kind === 'arbeitsverhalten' : o.subject === area),
    ).length

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Klassenblick · {cls.name}</h1>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'kompetenzen', label: 'Kompetenzen' },
            { value: 'abdeckung', label: 'Abdeckung' },
            { value: 'reflexion', label: 'Meine Stunden' },
          ]}
        />
      </div>

      {view === 'kompetenzen' && (
        <>
          <Segmented value={subject} onChange={setSubject} options={subjects.map((s) => ({ value: s, label: s }))} />
          {ratedComps.length ? (
            <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white p-2" />
                    {ratedComps.map((c) => (
                      <th key={c.id} className="h-40 w-12 align-bottom">
                        <div className="mx-auto w-6 [writing-mode:vertical-rl] rotate-180 text-left text-xs font-medium whitespace-nowrap text-slate-600" title={c.text}>
                          {c.text.length > 38 ? c.text.slice(0, 36) + '…' : c.text}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="sticky left-0 z-10 bg-white p-2 pr-4">
                        <Link to={`/kinder/${s.id}`} className="flex items-center gap-2 font-medium whitespace-nowrap">
                          <Avatar student={s} size={26} /> {s.firstName}
                        </Link>
                      </td>
                      {ratedComps.map((c) => {
                        const o = latest.get(`${s.id}:${c.id}`)
                        return (
                          <td key={c.id} className="p-0.5">
                            <div className={clsx('mx-auto size-10 rounded-md', LEVEL_BG[o?.level ?? 0])} title={o ? `${LEVEL_LABEL[o.level!]} (${o.date})` : 'nicht eingeschätzt'} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200">
                    <td className="sticky left-0 bg-white p-2 text-xs text-slate-500">unsicher (≤ teilweise)</td>
                    {ratedComps.map((c) => (
                      <td key={c.id} className="text-center text-xs font-semibold text-rose-600">
                        {students.filter((s) => (latest.get(`${s.id}:${c.id}`)?.level ?? 9) <= 2).length || ''}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <div className="flex flex-wrap gap-3 p-3 text-xs text-slate-500">
                {[1, 2, 3, 4].map((l) => (
                  <span key={l} className="flex items-center gap-1.5">
                    <span className={clsx('size-3 rounded', LEVEL_BG[l])} /> {LEVEL_LABEL[l]}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <Empty>In {subject} wurden noch keine Kompetenzen eingeschätzt.</Empty>
            </Card>
          )}
        </>
      )}

      {view === 'abdeckung' && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs text-slate-400">letzte 60 Tage</th>
                {areas.map((a) => (
                  <th key={a} className="p-2 text-xs font-medium text-slate-600">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="p-2">
                    <Link to={`/kinder/${s.id}`} className="flex items-center gap-2 font-medium whitespace-nowrap">
                      <Avatar student={s} size={26} /> {s.firstName}
                    </Link>
                  </td>
                  {areas.map((a) => {
                    const n = count(s.id, a)
                    return (
                      <td key={a} className="p-1 text-center">
                        <span className={clsx('inline-flex size-9 items-center justify-center rounded-lg text-xs font-semibold', n === 0 ? 'bg-rose-50 text-rose-300' : n < 3 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}>
                          {n}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'reflexion' && (
        <div className="grid gap-4 md:grid-cols-2">
          {[...new Set(lessons.map((l) => l.subject))].map((subj) => {
            const ls = lessons.filter((l) => l.subject === subj && l.status === 'abgeschlossen').sort((a, b) => a.startedAt.localeCompare(b.startedAt))
            return (
              <Card key={subj} title={subj} action={<span className="text-xs text-slate-400">{ls.length} Stunden</span>}>
                <div className="mb-3 flex flex-wrap gap-1">
                  {ls.map((l) => (
                    <Link key={l.id} to={`/unterricht/${l.id}`} title={l.topic} className={clsx('size-4 rounded-full', { gruen: 'bg-emerald-500', gelb: 'bg-amber-400', rot: 'bg-rose-500' }[l.reflection?.rating ?? 'gruen'])} />
                  ))}
                </div>
                <ul className="space-y-1 text-sm text-slate-600">
                  {ls
                    .filter((l) => l.reflection?.note)
                    .slice(-4)
                    .reverse()
                    .map((l) => (
                      <li key={l.id}>
                        <span className="text-slate-400">{l.date.slice(5).split('-').reverse().join('.')} </span>
                        {l.reflection?.note}
                      </li>
                    ))}
                </ul>
              </Card>
            )
          })}
          {!lessons.length && (
            <Card>
              <Empty>Noch keine dokumentierten Stunden.</Empty>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
