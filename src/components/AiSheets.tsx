import clsx from 'clsx'
import { Copy, Loader2, Mic, Sparkles } from 'lucide-react'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { ai, AiError } from '../lib/ai'
import { db, now, save, uid, type Competency, type ObsKind, type Observation, type SchoolClass, type Student, type Valence } from '../lib/db'
import { today } from '../lib/insights'
import { KIND_LABEL, LEVEL_LABEL } from '../lib/seed'
import { useDictation } from './media'
import { toast } from './toast'
import { Avatar, Button, inputCls, Sheet } from './ui'

/** Sehr kleines Markdown: Überschriften, Listen, Fett. */
export function Md({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>))
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text.split('\n').map((l, i) => {
        if (/^#{1,3} /.test(l)) return <h4 key={i} className="pt-2 font-semibold text-slate-800">{inline(l.replace(/^#+ /, ''))}</h4>
        if (/^\s*[-*] /.test(l)) return <p key={i} className="pl-4 -indent-3">• {inline(l.replace(/^\s*[-*] /, ''))}</p>
        if (!l.trim()) return null
        return <p key={i}>{inline(l)}</p>
      })}
    </div>
  )
}

export function AiButton({ children, onClick, busy, size = 'sm', variant = 'secondary' }: { children: ReactNode; onClick: () => void; busy?: boolean; size?: 'sm' | 'md' | 'lg'; variant?: 'primary' | 'secondary' }) {
  return (
    <Button size={size} variant={variant} onClick={onClick} disabled={busy}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className={variant === 'secondary' ? 'text-violet-600' : ''} />}
      {children}
    </Button>
  )
}

/** Generisches Ergebnis-Panel für Texte der KI. */
export function AiTextSheet({ open, onClose, title, run, deps }: { open: boolean; onClose: () => void; title: string; run: () => Promise<string>; deps: unknown[] }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    setBusy(true)
    setErr('')
    try {
      setText(await run())
    } catch (e) {
      setErr(e instanceof AiError || e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    if (open && !text && !busy) go()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ...deps])
  return (
    <Sheet open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-violet-600" /> {title}</span>} wide>
      {busy && (
        <p className="flex items-center gap-2 py-8 text-slate-500">
          <Loader2 className="animate-spin" size={18} /> Claude denkt nach …
        </p>
      )}
      {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
      {!busy && text && <Md text={text} />}
      <div className="mt-4 flex justify-end gap-2">
        {text && (
          <Button variant="ghost" size="sm" onClick={() => (navigator.clipboard.writeText(text), toast('Kopiert'))}>
            <Copy size={16} /> Kopieren
          </Button>
        )}
        <AiButton busy={busy} onClick={go}>
          Neu erzeugen
        </AiButton>
      </div>
      <p className="mt-2 text-xs text-slate-400">KI-Entwurf – bitte prüfen.</p>
    </Sheet>
  )
}

type Proposal = { studentIds: string[]; kind: ObsKind; valence: Valence; subject: string; competencyId: string; level: number; text: string; keep: boolean }

/** Diktat nach der Stunde → strukturierte Einträge. */
export function DictationSheet({ open, onClose, cls, students, comps, lessonId, subject }: { open: boolean; onClose: () => void; cls: SchoolClass; students: Student[]; comps: Competency[]; lessonId?: string; subject?: string }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<Proposal[] | null>(null)
  const [unclear, setUnclear] = useState<string[]>([])
  const [err, setErr] = useState('')
  const dict = useDictation((t) => setText((x) => (x ? x + ' ' : '') + t))

  const analyse = async () => {
    setBusy(true)
    setErr('')
    try {
      const res = await ai<{ json: { entries: Omit<Proposal, 'keep'>[]; unklar: string[] } }>('structure', {
        diktat: text,
        fach_der_stunde: subject ?? '',
        jahrgangsstufe: cls.gradeLevel,
        kinder: students.map((s) => ({ id: s.id, vorname: s.firstName, nachname: s.lastName })),
        faecher: cls.subjects,
        kompetenzen: comps.map((c) => ({ id: c.id, fach: c.subject, bereich: c.area, text: c.text })),
      })
      const valid = new Set(students.map((s) => s.id))
      setItems(
        res.json.entries
          .map((e) => ({ ...e, studentIds: e.studentIds.filter((id) => valid.has(id)), competencyId: comps.some((c) => c.id === e.competencyId) ? e.competencyId : '', keep: true }))
          .filter((e) => e.studentIds.length),
      )
      setUnclear(res.json.unklar)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const accept = async () => {
    const chosen = (items ?? []).filter((i) => i.keep)
    for (const i of chosen) {
      const o: Observation = {
        id: uid(),
        classId: cls.id,
        studentIds: i.studentIds,
        lessonId,
        date: today(),
        createdAt: now(),
        updatedAt: now(),
        kind: i.kind,
        valence: i.valence,
        subject: i.subject || subject || undefined,
        competencyId: i.competencyId || undefined,
        level: i.level ? (i.level as 1 | 2 | 3 | 4) : undefined,
        text: i.text,
        tags: ['diktat'],
        attachments: [],
      }
      await save(db.observations, o)
    }
    toast(`${chosen.length} Einträge gespeichert`)
    setText('')
    setItems(null)
    onClose()
  }

  const upd = (i: number, patch: Partial<Proposal>) => setItems((xs) => xs!.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  return (
    <Sheet open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-violet-600" /> Diktat → Einträge</span>} wide>
      {!items ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Einfach erzählen, was in der Stunde aufgefallen ist – mehrere Kinder durcheinander ist okay. Claude macht daraus einzelne Einträge, du bestätigst.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className={inputCls} placeholder="Lena hat beim Zehnerübergang wieder an den Fingern gezählt. Tim hat Max super bei der Partnerarbeit geholfen. Anna konnte ihren Rechenweg richtig gut erklären: erst bis zur Zehn, dann den Rest …" autoFocus />
          <div className="flex flex-wrap items-center gap-2">
            {dict.supported && (
              <Button variant={dict.active ? 'danger' : 'secondary'} onClick={dict.toggle}>
                <Mic size={16} /> {dict.active ? 'Stopp' : 'Diktieren'}
              </Button>
            )}
            <span className="text-xs text-slate-400">Tipp: Auf dem iPad geht auch das Mikrofon der Tastatur.</span>
            <span className="flex-1" />
            <AiButton variant="primary" size="md" busy={busy} onClick={analyse}>
              Auswerten
            </AiButton>
          </div>
          {err && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className={clsx('rounded-xl p-3 ring-1', it.keep ? 'ring-slate-200' : 'opacity-40 ring-slate-100')}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input type="checkbox" checked={it.keep} onChange={(e) => upd(i, { keep: e.target.checked })} className="size-5 accent-brand-700" />
                {it.studentIds.map((id) => {
                  const s = students.find((x) => x.id === id)!
                  return (
                    <span key={id} className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <Avatar student={s} size={22} /> {s.firstName}
                    </span>
                  )
                })}
                <select value={it.kind} onChange={(e) => upd(i, { kind: e.target.value as ObsKind })} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
                  {Object.entries(KIND_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
                <select value={it.valence} onChange={(e) => upd(i, { valence: e.target.value as Valence })} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
                  <option value="pos">positiv</option>
                  <option value="neu">neutral</option>
                  <option value="neg">Sorge</option>
                </select>
                {it.subject && <span className="text-xs text-slate-500">{it.subject}</span>}
              </div>
              <input value={it.text} onChange={(e) => upd(i, { text: e.target.value })} className={inputCls} />
              {it.competencyId && (
                <p className="mt-1 text-xs text-slate-500">
                  Kompetenz: {comps.find((c) => c.id === it.competencyId)?.text}
                  {it.level ? ` – ${LEVEL_LABEL[it.level]}` : ''}
                  <button className="ml-2 underline" onClick={() => upd(i, { competencyId: '', level: 0 })}>
                    entfernen
                  </button>
                </p>
              )}
            </div>
          ))}
          {!items.length && <p className="text-sm text-slate-500">Keine zuordenbaren Beobachtungen gefunden.</p>}
          {unclear.length > 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Nicht zugeordnet: {unclear.join(', ')}</p>}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setItems(null)}>
              Zurück zum Text
            </Button>
            <Button size="lg" onClick={accept} disabled={!items.some((i) => i.keep)}>
              {items.filter((i) => i.keep).length} Einträge übernehmen
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

/** Freie Frage an die eigene Dokumentation (Kind oder Klasse). */
export function AskSheet({ open, onClose, data, title = 'Frage an die Dokumentation', placeholder = 'Welche Kinder brauchen gerade in Mathe mehr Unterstützung?' }: { open: boolean; onClose: () => void; data: () => unknown; title?: string; placeholder?: string }) {
  const [q, setQ] = useState('')
  const [a, setA] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ask = async () => {
    if (!q.trim()) return
    setBusy(true)
    setErr('')
    try {
      setA((await ai('ask', { frage: q, daten: data() })).text)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-violet-600" /> {title}</span>} wide>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder={placeholder} className={inputCls} autoFocus />
        <AiButton variant="primary" size="md" busy={busy} onClick={ask}>
          Fragen
        </AiButton>
      </div>
      {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
      {a && (
        <div className="mt-4">
          <Md text={a} />
        </div>
      )}
    </Sheet>
  )
}
