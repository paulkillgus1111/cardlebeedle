import clsx from 'clsx'
import { format, parseISO } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, FileCheck2, Info, Paperclip, Pencil, Plus, RotateCcw, Trash2, TriangleAlert, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { ai, obsLine, studentEvidenceContext, type CitedSentence } from '../lib/ai'
import { alive, aliveOne, db, save, setMeta, type Competency, type GradeLevel, type Observation, type SchoolClass, type Student } from '../lib/db'
import { AiButton } from './AiSheets'
import { toast } from './toast'
import { Badge, Button, inputCls } from './ui'

export const TERMS = ['Zwischenzeugnis', 'Jahreszeugnis', 'Übertrittszeugnis'] as const

export type ReportArt = 'Wortgutachten' | 'Bemerkungen'

export interface TermProfile {
  term: string
  art: ReportArt
}

/** Zeugnisprofile je Jahrgangsstufe (Bayern): rein verbal in Jgst. 1 und im Zwischenzeugnis Jgst. 2, danach Bemerkungen. */
export function termProfiles(grade: GradeLevel | number): TermProfile[] {
  switch (grade) {
    case 1:
      return [
        { term: 'Zwischenzeugnis', art: 'Wortgutachten' },
        { term: 'Jahreszeugnis', art: 'Wortgutachten' },
      ]
    case 2:
      return [
        { term: 'Zwischenzeugnis', art: 'Wortgutachten' },
        { term: 'Jahreszeugnis', art: 'Bemerkungen' },
      ]
    case 4:
      return [
        { term: 'Zwischenzeugnis', art: 'Bemerkungen' },
        { term: 'Übertrittszeugnis', art: 'Bemerkungen' },
        { term: 'Jahreszeugnis', art: 'Bemerkungen' },
      ]
    default:
      return [
        { term: 'Zwischenzeugnis', art: 'Bemerkungen' },
        { term: 'Jahreszeugnis', art: 'Bemerkungen' },
      ]
  }
}

export const defaultTerm = (grade: number) => (grade === 4 ? 'Übertrittszeugnis' : 'Jahreszeugnis')

export const artFor = (grade: number, term: string): ReportArt => termProfiles(grade).find((p) => p.term === term)?.art ?? (grade === 1 ? 'Wortgutachten' : 'Bemerkungen')

export const reportKey = (cls: SchoolClass, term: string) => `${cls.schoolYear} ${term}`

/* ───────────── Entwurf mit Belegen (lokal gespeichert, bis alle Sätze geprüft sind) ───────────── */

export type SentenceStatus = 'offen' | 'ok' | 'edited' | 'deleted'

export interface DraftSentence {
  text: string
  /** Beobachtungs-IDs als Belege */
  evidence: string[]
  status: SentenceStatus
  /** von der Lehrkraft hinzugefügt (z. B. Notenschutz-Bemerkung) */
  manual?: boolean
}

export interface ReportDraft {
  createdAt: string
  art: ReportArt
  sentences: DraftSentence[]
}

export const draftKey = (studentId: string, key: string) => `reportDraft:${studentId}:${key}`

export async function setDraft(studentId: string, key: string, d: ReportDraft | null) {
  if (d) await setMeta(draftKey(studentId, key), d)
  else await db.meta.delete(draftKey(studentId, key))
}

/** Alle offenen Entwürfe (Schlüssel → Entwurf) für Übersichten. */
export function useDrafts(): Map<string, ReportDraft> {
  return (
    useLiveQuery(async () => {
      const rows = await db.meta.filter((m) => m.key.startsWith('reportDraft:')).toArray()
      return new Map(rows.map((r) => [r.key, r.value as ReportDraft]))
    }) ?? new Map()
  )
}

const splitSentences = (t: string) =>
  t
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"])/)
    .map((s) => s.trim())
    .filter(Boolean)

/** KI-Entwurf mit Belegen je Satz (report2). Förderstatus geht nie an die KI. */
export async function generateDraft(student: Student, cls: SchoolClass, obs: Observation[], comps: Competency[], term: string, du: boolean): Promise<ReportDraft> {
  const goals = alive(await db.goals.where('studentId').equals(student.id).toArray())
  const ctx = studentEvidenceContext(student, cls, obs, comps, goals)
  const art = artFor(cls.gradeLevel, term)
  const res = await ai<{ json?: { sentences?: CitedSentence[] }; text?: string }>('report2', {
    ...ctx.data,
    zeugnis: term,
    art,
    anrede: du ? 'Du (Kind direkt ansprechen)' : 'dritte Person',
  })
  let cited = res.json?.sentences?.filter((s) => s?.text?.trim()) ?? []
  if (!cited.length && res.text) cited = splitSentences(res.text).map((text) => ({ text, evidence: [] }))
  if (!cited.length) throw new Error('Die KI hat keinen Text geliefert. Bitte erneut versuchen.')
  return {
    createdAt: new Date().toISOString(),
    art,
    sentences: cited.map((s) => ({
      text: s.text.trim(),
      evidence: [...new Set((s.evidence ?? []).map((e) => ctx.map.get(e)?.id).filter((x): x is string => !!x))],
      status: 'offen',
    })),
  }
}

/** Speichert einen Zeugnistext auf dem aktuellen Stand des Kindes (keine veraltete Kopie). */
export async function saveReport(studentId: string, key: string, text: string) {
  const cur = aliveOne(await db.students.get(studentId))
  if (!cur) throw new Error('Kind nicht gefunden')
  await save(db.students, { ...cur, reports: { ...(cur.reports ?? {}), [key]: text } })
}

const words = (t: string) => t.split(/\s+/).filter(Boolean).length
const joinDraft = (d: ReportDraft) =>
  d.sentences
    .filter((s) => s.status !== 'deleted')
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join(' ')

const notenschutzSentence = (what: string) => `Auf die Bewertung der ${what.trim() || '…'} wurde gemäß Notenschutz verzichtet.`

/**
 * Zeugnistext eines Kindes.
 * - KI-Entwurf als Satzliste mit Belegen; jeder Satz wird übernommen, bearbeitet oder gelöscht.
 *   Erst wenn alle Sätze geprüft sind, kann gespeichert werden.
 * - Der gespeicherte Text bleibt frei bearbeitbar („Text bearbeiten“).
 */
export function ReportEditor({ student, cls, obs, comps, term, du }: { student: Student; cls: SchoolClass; obs: Observation[]; comps: Competency[]; term: string; du: boolean }) {
  const live = useLiveQuery(() => db.students.get(student.id), [student.id]) ?? student
  const key = reportKey(cls, term)
  const dKey = draftKey(student.id, key)
  const draft = useLiveQuery(async () => ((await db.meta.get(dKey))?.value as ReportDraft | undefined) ?? null, [dKey])
  const stored = live.reports?.[key] ?? ''
  const art = artFor(cls.gradeLevel, term)
  const [text, setText] = useState<string | null>(null) // null = kein Freitext-Modus
  const [prev, setPrev] = useState<string | null>(null) // für „Rückgängig“ nach Ersetzen
  const [busy, setBusy] = useState(false)
  const [nsWhat, setNsWhat] = useState('Rechtschreibleistungen')
  const obsById = new Map(obs.map((o) => [o.id, o]))

  const writeDraft = (d: ReportDraft | null) => setDraft(student.id, key, d).catch((e) => toast((e as Error).message))
  const patch = (i: number, p: Partial<DraftSentence>) => draft && writeDraft({ ...draft, sentences: draft.sentences.map((s, j) => (j === i ? { ...s, ...p } : s)) })

  const regenerate = async () => {
    if (draft?.sentences.some((s) => s.status !== 'offen') && !confirm('Der aktuelle Entwurf ist schon teilweise geprüft. Trotzdem neu formulieren?')) return
    if (text !== null && text !== stored && !confirm('Deine ungespeicherten Änderungen gehen verloren. Trotzdem neu formulieren?')) return
    setBusy(true)
    try {
      const d = await generateDraft(live, cls, obs, comps, term, du)
      await setDraft(student.id, key, d)
      setText(null)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const commit = async (value: string) => {
    try {
      const before = stored
      await saveReport(student.id, key, value)
      setPrev(before.trim() && before !== value ? before : null)
      toast('Zeugnistext gespeichert')
      return true
    } catch (e) {
      toast((e as Error).message)
      return false
    }
  }

  const commitDraft = async () => {
    if (!draft) return
    if (await commit(joinDraft(draft))) await setDraft(student.id, key, null)
  }

  const undo = async () => {
    if (prev === null) return
    try {
      await saveReport(student.id, key, prev)
      setPrev(null)
      toast('Vorheriger Text wiederhergestellt')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const appendNotenschutz = () => {
    const s = notenschutzSentence(nsWhat)
    if (draft) writeDraft({ ...draft, sentences: [...draft.sentences, { text: s, evidence: [], status: 'ok', manual: true }] })
    else setText(((text ?? stored).trim() + ' ' + s).trim())
  }

  const current = draft ? joinDraft(draft) : (text ?? stored)
  const hasNotenschutz = /notenschutz/i.test(current)

  const notenschutzBox = live.support?.notenschutz && (
    <div className="space-y-2 rounded-xl bg-sky-50 px-3.5 py-3 text-sm text-sky-900 ring-1 ring-sky-100">
      <p className="flex items-start gap-2 font-medium">
        <Info size={16} className="mt-0.5 shrink-0" /> Notenschutz: Bemerkung im Zeugnis erforderlich (§ 36 Abs. 7 BaySchO)
      </p>
      {hasNotenschutz ? (
        <p className="flex items-center gap-1.5 pl-6 text-xs text-sky-800">
          <Check size={13} /> Bemerkung ist im Text enthalten.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 pl-6">
          <span>Auf die Bewertung der</span>
          <input value={nsWhat} onChange={(e) => setNsWhat(e.target.value)} aria-label="Bewerteter Bereich" className={clsx(inputCls, '!h-9 !w-52 !py-1 text-sm')} />
          <span>wurde gemäß Notenschutz verzichtet.</span>
          <Button size="sm" variant="secondary" onClick={appendNotenschutz} disabled={!nsWhat.trim()}>
            <Plus size={15} /> Anfügen
          </Button>
        </div>
      )}
    </div>
  )

  const undoBanner = prev !== null && !draft && (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800 ring-1 ring-violet-100">
      <span className="flex-1">Gespeichert – der vorherige Text wurde ersetzt.</span>
      <Button size="sm" variant="ghost" onClick={undo}>
        <Undo2 size={15} /> Rückgängig
      </Button>
    </div>
  )

  /* ───── Prüfmodus: Satzliste mit Belegen ───── */
  if (draft) {
    const total = draft.sentences.length
    const reviewed = draft.sentences.filter((s) => s.status !== 'offen').length
    const allDone = reviewed === total
    const kept = draft.sentences.filter((s) => s.status !== 'deleted')
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-800 ring-1 ring-violet-100">
          <span className="flex-1">
            KI-Entwurf ({draft.art}) – bitte jeden Satz prüfen. {stored.trim() ? 'Beim Speichern wird der bisherige Text ersetzt.' : ''}
          </span>
          <Badge tone={allDone ? 'green' : 'amber'} className="tabular-nums">
            {reviewed}/{total} geprüft
          </Badge>
        </div>
        <ol className="space-y-2">
          {draft.sentences.map((s, i) => (
            <SentenceRow
              key={`${draft.createdAt}-${i}`}
              s={s}
              evidence={s.evidence.map((id) => obsById.get(id)).filter((o): o is Observation => !!o)}
              comps={comps}
              onAccept={() => patch(i, { status: s.status === 'ok' ? 'offen' : 'ok' })}
              onDelete={() => patch(i, { status: s.status === 'deleted' ? 'offen' : 'deleted' })}
              onEdit={(t) => patch(i, { text: t, status: 'edited' })}
            />
          ))}
        </ol>
        {notenschutzBox}
        <div className="flex flex-wrap items-center gap-2">
          <AiButton busy={busy} onClick={regenerate}>
            Neu formulieren
          </AiButton>
          <span className="text-xs text-slate-400 tabular-nums">
            {kept.length} Sätze · {words(joinDraft(draft))} Wörter
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => confirm('Entwurf verwerfen?') && writeDraft(null)}>
            <RotateCcw size={15} /> Entwurf verwerfen
          </Button>
          {!allDone && (
            <Button size="sm" variant="ghost" onClick={() => writeDraft({ ...draft, sentences: draft.sentences.map((x) => (x.status === 'offen' && x.evidence.length ? { ...x, status: 'ok' } : x)) })}>
              <Check size={15} /> Alle belegten übernehmen
            </Button>
          )}
          <Button size="sm" disabled={!allDone || !kept.length} onClick={commitDraft} title={allDone ? undefined : 'Erst alle Sätze prüfen'}>
            <FileCheck2 size={15} /> Speichern
          </Button>
        </div>
      </div>
    )
  }

  /* ───── Freitext-Bearbeitung ───── */
  if (text !== null) {
    const dirty = text !== stored
    return (
      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.max(5, Math.ceil(text.length / 90))}
          className={clsx(inputCls, 'leading-relaxed', dirty && 'ring-amber-300')}
          placeholder="Zeugnistext selbst schreiben …"
          autoFocus
        />
        {notenschutzBox}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 tabular-nums">{words(text)} Wörter</span>
          {dirty && <Badge tone="amber">Ungespeichert</Badge>}
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => (!dirty || confirm('Änderungen verwerfen?')) && setText(null)}>
            <X size={15} /> Abbrechen
          </Button>
          <Button size="sm" disabled={!dirty} onClick={async () => (await commit(text)) && setText(null)}>
            <Check size={15} /> Speichern
          </Button>
        </div>
      </div>
    )
  }

  /* ───── Anzeige des gespeicherten Textes ───── */
  return (
    <div className="space-y-3">
      {undoBanner}
      {stored.trim() ? (
        <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-800 ring-1 ring-slate-100">{stored}</p>
      ) : (
        <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-400 ring-1 ring-slate-100">
          Noch kein Text. Lass die KI einen belegten Entwurf ({art}) aus der Akte formulieren oder schreibe selbst.
        </p>
      )}
      {notenschutzBox}
      <div className="flex flex-wrap items-center gap-2">
        <AiButton busy={busy} onClick={regenerate}>
          {stored.trim() ? 'Neu formulieren' : 'Entwurf erzeugen'}
        </AiButton>
        <Button size="sm" variant="secondary" onClick={() => setText(stored)}>
          <Pencil size={15} /> Text bearbeiten
        </Button>
        {stored.trim() && <span className="text-xs text-slate-400 tabular-nums">{words(stored)} Wörter</span>}
      </div>
    </div>
  )
}

function SentenceRow({
  s,
  evidence,
  comps,
  onAccept,
  onDelete,
  onEdit,
}: {
  s: DraftSentence
  evidence: Observation[]
  comps: Competency[]
  onAccept: () => void
  onDelete: () => void
  onEdit: (t: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [showEv, setShowEv] = useState(false)
  const noEvidence = !evidence.length && !s.manual
  const forbidden = /nachteilsausgleich/i.test(s.text)
  const deleted = s.status === 'deleted'
  const iconBtn = 'flex size-9 items-center justify-center rounded-lg transition'

  return (
    <li
      className={clsx(
        'rounded-xl bg-white p-3 ring-1 transition',
        s.status === 'offen' ? 'ring-slate-200' : deleted ? 'bg-slate-50 ring-slate-100' : 'ring-emerald-200',
      )}
    >
      {editing !== null ? (
        <div className="space-y-2">
          <textarea value={editing} onChange={(e) => setEditing(e.target.value)} rows={Math.max(2, Math.ceil(editing.length / 80))} className={clsx(inputCls, 'leading-relaxed')} autoFocus />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Abbrechen
            </Button>
            <Button
              size="sm"
              disabled={!editing.trim()}
              onClick={() => {
                onEdit(editing.trim())
                setEditing(null)
              }}
            >
              <Check size={15} /> Übernehmen
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          <p
            className={clsx(
              'min-w-0 flex-1 basis-60 text-[15px] leading-relaxed text-slate-800',
              deleted && 'text-slate-400 line-through',
              !deleted && noEvidence && 'underline decoration-amber-400 decoration-2 underline-offset-4',
            )}
          >
            {s.text}
          </p>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onAccept}
              disabled={deleted}
              aria-pressed={s.status === 'ok'}
              title="Übernehmen"
              aria-label="Satz übernehmen"
              className={clsx(iconBtn, s.status === 'ok' || s.status === 'edited' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-700', deleted && 'opacity-40')}
            >
              <Check size={17} />
            </button>
            <button type="button" onClick={() => setEditing(s.text)} disabled={deleted} title="Bearbeiten" aria-label="Satz bearbeiten" className={clsx(iconBtn, 'text-slate-400 hover:bg-slate-100 hover:text-slate-700', deleted && 'opacity-40')}>
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-pressed={deleted}
              title={deleted ? 'Wiederherstellen' : 'Löschen'}
              aria-label={deleted ? 'Satz wiederherstellen' : 'Satz löschen'}
              className={clsx(iconBtn, deleted ? 'bg-rose-100 text-rose-700' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-700')}
            >
              {deleted ? <Undo2 size={16} /> : <Trash2 size={16} />}
            </button>
          </div>
        </div>
      )}
      {editing === null && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {evidence.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowEv((v) => !v)}
              aria-expanded={showEv}
              className="inline-flex min-h-7 items-center gap-1 rounded-md bg-sky-50 px-2 font-semibold text-sky-800 hover:bg-sky-100"
            >
              <Paperclip size={12} /> {evidence.length} {evidence.length === 1 ? 'Beleg' : 'Belege'}
            </button>
          ) : s.manual ? (
            <Badge tone="slate">selbst eingefügt</Badge>
          ) : (
            <Badge tone="amber">
              <TriangleAlert size={11} /> ohne Beleg
            </Badge>
          )}
          {s.status === 'edited' && <Badge tone="green">bearbeitet</Badge>}
          {s.status === 'ok' && <Badge tone="green">übernommen</Badge>}
          {deleted && <Badge tone="rose">gelöscht</Badge>}
          {forbidden && !deleted && (
            <Badge tone="rose">
              <TriangleAlert size={11} /> Nachteilsausgleich gehört nie ins Zeugnis
            </Badge>
          )}
        </div>
      )}
      {showEv && evidence.length > 0 && editing === null && (
        <ul className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 ring-1 ring-slate-100">
          {evidence.map((o) => (
            <li key={o.id} className="flex gap-2">
              <span className="w-14 shrink-0 font-medium text-slate-500 tabular-nums">{format(parseISO(o.date), 'd.M.yy')}</span>
              <span className="min-w-0">{obsLine(o, comps).split(' | ').slice(1).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
