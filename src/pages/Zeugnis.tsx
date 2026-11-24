import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AiButton } from '../components/AiSheets'
import { generateReport, reportKey, ReportEditor, TERMS } from '../components/ReportEditor'
import { toast } from '../components/toast'
import { Avatar, Card, Segmented } from '../components/ui'
import { db, save } from '../lib/db'
import { useActiveClass, useCompetencies, useObservations, useStudents } from '../lib/hooks'

export default function Zeugnis() {
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const obs = useObservations(cls?.id)
  const comps = useCompetencies(cls)
  const [term, setTerm] = useState<string>(cls?.gradeLevel === 4 ? 'Übertrittszeugnis' : 'Jahreszeugnis')
  const [du, setDu] = useState((cls?.gradeLevel ?? 1) <= 2)
  const [progress, setProgress] = useState<string | null>(null)
  if (!cls) return null
  const key = reportKey(cls, term)
  const missing = students.filter((s) => !s.reports?.[key])

  const generateAll = async () => {
    let n = 0
    for (const s of missing) {
      setProgress(`${++n}/${missing.length}: ${s.firstName}`)
      try {
        const t = await generateReport(s, cls, obs, comps, term, du)
        const cur = (await db.students.get(s.id)) ?? s
        await save(db.students, { ...cur, reports: { ...(cur.reports ?? {}), [key]: t } })
      } catch (e) {
        toast(`${s.firstName}: ${(e as Error).message}`)
        break
      }
    }
    setProgress(null)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <Link to="/gespraeche" className="text-sm text-slate-500">
        ← Gespräche
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold">
          Zeugnistexte · {cls.name} <span className="text-base font-normal text-slate-500">{cls.gradeLevel <= 2 ? 'Wortgutachten' : 'Bemerkungen'}</span>
        </h1>
        <AiButton size="lg" variant="primary" busy={!!progress} onClick={generateAll}>
          {progress ?? `Fehlende Entwürfe erzeugen (${missing.length})`}
        </AiButton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={term} onChange={setTerm} options={TERMS.map((t) => ({ value: t, label: t }))} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={du} onChange={(e) => setDu(e.target.checked)} className="accent-brand-700" /> Kind mit „Du“ ansprechen
        </label>
      </div>
      <p className="text-sm text-slate-500">Entwürfe entstehen aus allen Einträgen der Akte. Je besser dokumentiert, desto konkreter der Text. Bitte immer prüfen und anpassen.</p>
      {students.map((s) => (
        <Card
          key={s.id}
          title={
            <Link to={`/kinder/${s.id}`} className="flex items-center gap-2 normal-case">
              <Avatar student={s} size={26} /> <span className="text-slate-800">{s.firstName} {s.lastName}</span>
            </Link>
          }
        >
          <ReportEditor key={`${s.id}-${term}-${s.reports?.[key]?.length ?? 0}`} student={s} cls={cls} obs={obs} comps={comps} term={term} du={du} />
        </Card>
      ))}
    </div>
  )
}
