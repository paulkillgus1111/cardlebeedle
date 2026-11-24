import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, RotateCcw, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { ai, studentContext } from '../lib/ai'
import { alive, aliveOne, db, save, type Competency, type Observation, type SchoolClass, type Student } from '../lib/db'
import { AiButton } from './AiSheets'
import { toast } from './toast'
import { Badge, Button, inputCls } from './ui'

export const TERMS = ['Zwischenzeugnis', 'Jahreszeugnis', 'Übertrittszeugnis'] as const

export const reportKey = (cls: SchoolClass, term: string) => `${cls.schoolYear} ${term}`

export async function generateReport(student: Student, cls: SchoolClass, obs: Observation[], comps: Competency[], term: string, du: boolean) {
  const goals = alive(await db.goals.where('studentId').equals(student.id).toArray())
  const res = await ai('report', { ...studentContext(student, cls, obs, comps, goals), zeugnis: term, anrede: du ? 'Du (Kind direkt ansprechen)' : 'dritte Person' })
  return res.text.trim()
}

/** Speichert einen Zeugnistext auf dem aktuellen Stand des Kindes (keine veraltete Kopie). */
export async function saveReport(studentId: string, key: string, text: string) {
  const cur = aliveOne(await db.students.get(studentId))
  if (!cur) throw new Error('Kind nicht gefunden')
  await save(db.students, { ...cur, reports: { ...(cur.reports ?? {}), [key]: text } })
}

const words = (t: string) => t.split(/\s+/).filter(Boolean).length

/**
 * Zeugnistext eines Kindes: KI-Entwurf + Bearbeitung, gespeichert am Kind.
 * Neue Entwürfe landen ungespeichert im Editor – erst „Speichern“ übernimmt sie.
 * Ohne lokale Änderungen zeigt der Editor immer den gespeicherten Stand.
 */
export function ReportEditor({ student, cls, obs, comps, term, du }: { student: Student; cls: SchoolClass; obs: Observation[]; comps: Competency[]; term: string; du: boolean }) {
  const live = useLiveQuery(() => db.students.get(student.id), [student.id]) ?? student
  const key = reportKey(cls, term)
  const stored = live.reports?.[key] ?? ''
  const [text, setText] = useState<string | null>(null)
  const [prev, setPrev] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const value = text ?? stored
  const dirty = text !== null && text !== stored

  const regenerate = async () => {
    if (dirty && !confirm('Deine ungespeicherten Änderungen gehen verloren. Trotzdem neu formulieren?')) return
    setBusy(true)
    try {
      const t = await generateReport(live, cls, obs, comps, term, du)
      setPrev(value)
      setText(t)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const undo = () => {
    if (prev === null) return
    setText(prev === stored ? null : prev)
    setPrev(null)
  }

  const commit = async () => {
    try {
      await saveReport(student.id, key, value)
      setText(null)
      setPrev(null)
      toast('Zeugnistext gespeichert')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      {prev !== null && dirty && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800 ring-1 ring-violet-100">
          <span className="flex-1">Neuer Entwurf – noch nicht gespeichert.</span>
          <Button size="sm" variant="ghost" onClick={undo}>
            <Undo2 size={15} /> Rückgängig
          </Button>
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => setText(e.target.value)}
        rows={Math.max(5, Math.ceil(value.length / 90))}
        className={clsx(inputCls, 'leading-relaxed', dirty && 'ring-amber-300')}
        placeholder="Noch kein Entwurf. Lass die KI einen ersten Text aus der Akte formulieren oder schreibe selbst."
      />
      <div className="flex flex-wrap items-center gap-2">
        <AiButton busy={busy} onClick={regenerate}>
          {value ? 'Neu formulieren' : 'Entwurf erzeugen'}
        </AiButton>
        <span className="text-xs text-slate-400 tabular-nums">{words(value)} Wörter</span>
        {dirty && <Badge tone="amber">Ungespeichert</Badge>}
        <span className="flex-1" />
        {dirty && (
          <Button size="sm" variant="ghost" onClick={() => (setText(null), setPrev(null))}>
            <RotateCcw size={15} /> Verwerfen
          </Button>
        )}
        <Button size="sm" disabled={!dirty} onClick={commit}>
          <Check size={15} /> Speichern
        </Button>
      </div>
    </div>
  )
}
