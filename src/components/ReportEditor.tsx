import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ai, studentContext } from '../lib/ai'
import { alive, db, save, type Competency, type Observation, type SchoolClass, type Student } from '../lib/db'
import { AiButton } from './AiSheets'
import { toast } from './toast'
import { Button, inputCls } from './ui'

export const TERMS = ['Zwischenzeugnis', 'Jahreszeugnis', 'Übertrittszeugnis'] as const

export const reportKey = (cls: SchoolClass, term: string) => `${cls.schoolYear} ${term}`

export async function generateReport(student: Student, cls: SchoolClass, obs: Observation[], comps: Competency[], term: string, du: boolean) {
  const goals = alive(await db.goals.where('studentId').equals(student.id).toArray())
  const res = await ai('report', { ...studentContext(student, cls, obs, comps, goals), zeugnis: term, anrede: du ? 'Du (Kind direkt ansprechen)' : 'dritte Person' })
  return res.text.trim()
}

/** Zeugnistext eines Kindes: KI-Entwurf + Bearbeitung, gespeichert am Kind. */
export function ReportEditor({ student, cls, obs, comps, term, du }: { student: Student; cls: SchoolClass; obs: Observation[]; comps: Competency[]; term: string; du: boolean }) {
  const live = useLiveQuery(() => db.students.get(student.id), [student.id]) ?? student
  const key = reportKey(cls, term)
  const stored = live.reports?.[key] ?? ''
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const value = text ?? stored
  const persist = async (t: string) => {
    const cur = (await db.students.get(student.id)) ?? live
    await save(db.students, { ...cur, reports: { ...(cur.reports ?? {}), [key]: t } })
  }
  return (
    <div className="space-y-2">
      <textarea value={value} onChange={(e) => setText(e.target.value)} rows={Math.max(5, Math.ceil(value.length / 90))} className={inputCls} placeholder="Noch kein Entwurf." />
      <div className="flex flex-wrap items-center gap-2">
        <AiButton
          busy={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const t = await generateReport(live, cls, obs, comps, term, du)
              setText(t)
              await persist(t)
            } catch (e) {
              toast((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          {value ? 'Neu formulieren' : 'Entwurf erzeugen'}
        </AiButton>
        <span className="text-xs text-slate-400">{value.split(/\s+/).filter(Boolean).length} Wörter</span>
        <span className="flex-1" />
        <Button
          size="sm"
          disabled={text === null || text === stored}
          onClick={async () => {
            await persist(value)
            setText(null)
            toast('Zeugnistext gespeichert')
          }}
        >
          Speichern
        </Button>
      </div>
    </div>
  )
}
