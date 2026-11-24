import clsx from 'clsx'
import { Check, ChevronLeft, FileText, Square, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AiButton } from '../components/AiSheets'
import { generateReport, reportKey, ReportEditor, saveReport, TERMS } from '../components/ReportEditor'
import { toast } from '../components/toast'
import { Avatar, Badge, Button, Card, Empty, PageHeader, Segmented } from '../components/ui'
import { aliveOne, db, type SchoolClass } from '../lib/db'
import { useActiveClass, useCompetencies, useObservations, useStudents } from '../lib/hooks'

export default function Zeugnis() {
  const { cls, loading } = useActiveClass()
  if (loading) return null
  if (!cls)
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
        <Empty icon={Users}>Noch keine Klasse angelegt. Lege unter Einstellungen eine Klasse an.</Empty>
      </div>
    )
  return <ZeugnisKlasse key={cls.id} cls={cls} />
}

interface Batch {
  done: number
  total: number
  current?: string
}

function ZeugnisKlasse({ cls }: { cls: SchoolClass }) {
  const students = useStudents(cls.id)
  const obs = useObservations(cls.id)
  const comps = useCompetencies(cls)
  const [term, setTerm] = useState<string>(cls.gradeLevel === 4 ? 'Übertrittszeugnis' : 'Jahreszeugnis')
  const [du, setDu] = useState(cls.gradeLevel <= 2)
  const [filter, setFilter] = useState<'alle' | 'fehlend'>('alle')
  const [batch, setBatch] = useState<Batch | null>(null)
  const cancel = useRef(false)
  const key = reportKey(cls, term)
  const missing = students.filter((s) => !s.reports?.[key]?.trim())
  const done = students.length - missing.length
  const shown = filter === 'fehlend' ? missing : students

  const generateAll = async () => {
    const list = [...missing]
    const errors: string[] = []
    cancel.current = false
    setBatch({ done: 0, total: list.length })
    for (const [i, s] of list.entries()) {
      if (cancel.current) break
      setBatch({ done: i, total: list.length, current: s.firstName })
      try {
        const cur = aliveOne(await db.students.get(s.id))
        if (!cur || cur.reports?.[key]?.trim()) continue // gelöscht oder inzwischen geschrieben
        const t = await generateReport(cur, cls, obs, comps, term, du)
        await saveReport(s.id, key, t)
      } catch (e) {
        errors.push(`${s.firstName}: ${(e as Error).message}`)
      }
    }
    setBatch(null)
    if (errors.length) toast(`${errors.length} Entwürfe fehlgeschlagen – ${errors[0]}${errors.length > 1 ? ' …' : ''}`)
    else if (!cancel.current) toast('Alle Entwürfe erzeugt')
  }

  const pct = batch ? (batch.total ? batch.done / batch.total : 1) : students.length ? done / students.length : 0

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        back={
          <Link to="/gespraeche" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ChevronLeft size={16} /> Gespräche
          </Link>
        }
        eyebrow={`${cls.name} · ${cls.schoolYear}`}
        title="Zeugnistexte"
        subtitle={cls.gradeLevel <= 2 ? 'Wortgutachten' : 'Bemerkungen'}
        actions={
          batch ? (
            <Button variant="secondary" onClick={() => (cancel.current = true)}>
              <Square size={14} /> Abbrechen
            </Button>
          ) : missing.length ? (
            <AiButton size="lg" variant="primary" onClick={generateAll}>
              Fehlende Entwürfe erzeugen ({missing.length})
            </AiButton>
          ) : (
            <Button size="lg" variant="secondary" disabled>
              <Check size={16} /> Alle Entwürfe vorhanden
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Fortschritt</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {batch ? `${batch.done}/${batch.total}` : `${done}/${students.length}`}
              <span className="ml-2 text-sm font-normal text-slate-500">{batch ? (batch.current ? `${batch.current} wird formuliert …` : 'startet …') : 'Entwürfe'}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented size="sm" value={term} onChange={setTerm} options={TERMS.map((t) => ({ value: t, label: t }))} />
            <label className="flex min-h-10 items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={du} onChange={(e) => setDu(e.target.checked)} className="size-5 accent-brand-600" /> Mit „Du“ ansprechen
            </label>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={clsx('h-full rounded-full transition-[width] duration-500', batch ? 'bg-violet-500' : 'bg-brand-500')} style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
        <p className="mt-3 text-sm text-slate-500">Entwürfe entstehen aus allen Einträgen der Akte – je besser dokumentiert, desto konkreter. Bitte immer prüfen und anpassen.</p>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'alle', label: `Alle (${students.length})` },
            { value: 'fehlend', label: `Ohne Entwurf (${missing.length})` },
          ]}
        />
      </div>

      <div className="space-y-4">
        {shown.map((s) => {
          const text = s.reports?.[key]?.trim()
          return (
            <Card
              key={s.id}
              title={
                <Link to={`/kinder/${s.id}`} className="flex min-w-0 items-center gap-2.5 hover:text-brand-700">
                  <Avatar student={s} size={30} />
                  <span className="truncate">
                    {s.firstName} {s.lastName}
                  </span>
                </Link>
              }
              action={text ? <Badge tone="green">Entwurf</Badge> : <Badge tone="amber">fehlt</Badge>}
            >
              <ReportEditor key={`${s.id}-${term}`} student={s} cls={cls} obs={obs} comps={comps} term={term} du={du} />
            </Card>
          )
        })}
        {!students.length && <Empty icon={Users}>Noch keine Kinder in dieser Klasse.</Empty>}
        {!!students.length && !shown.length && <Empty icon={FileText}>Alle Kinder haben schon einen Entwurf.</Empty>}
      </div>
    </div>
  )
}
