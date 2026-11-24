import clsx from 'clsx'
import { ArrowUp, Check, Copy, Loader2, Mic, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { ai, AiError } from '../lib/ai'
import { db, now, save, uid, type Competency, type ObsKind, type Observation, type SchoolClass, type Student, type Valence } from '../lib/db'
import { today } from '../lib/insights'
import { KIND_LABEL, LEVEL_LABEL } from '../lib/seed'
import { useDictation } from './media'
import { toast } from './toast'
import { Avatar, Button, inputCls, Sheet, ValenceDot } from './ui'

/** Sehr kleines Markdown: Überschriften, Listen, Fett. */
export function Md({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i} className="font-semibold text-slate-900">{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>))
  return (
    <div className="space-y-2 text-[15px] leading-relaxed text-slate-700">
      {text.split('\n').map((l, i) => {
        if (/^#{1,3} /.test(l))
          return (
            <h4 key={i} className="pt-3 text-[15px] font-semibold tracking-tight text-slate-900 first:pt-0">
              {inline(l.replace(/^#+ /, ''))}
            </h4>
          )
        if (/^\s*[-*•] /.test(l))
          return (
            <p key={i} className="flex gap-2.5 pl-1">
              <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-violet-400" />
              <span className="min-w-0">{inline(l.replace(/^\s*[-*•] /, ''))}</span>
            </p>
          )
        const num = l.match(/^\s*(\d+)[.)] (.*)$/)
        if (num)
          return (
            <p key={i} className="flex gap-2.5 pl-1">
              <span className="min-w-[1.25rem] shrink-0 font-semibold text-violet-600 tabular-nums">{num[1]}.</span>
              <span className="min-w-0">{inline(num[2])}</span>
            </p>
          )
        if (!l.trim()) return null
        return <p key={i}>{inline(l)}</p>
      })}
    </div>
  )
}

const aiPrimary = '!from-violet-500 !to-violet-600 !ring-violet-700/40 !shadow-[0_6px_20px_-6px_rgb(109_40_217_/_0.45)] hover:!from-violet-400 hover:!to-violet-600'

export function AiButton({ children, onClick, busy, size = 'sm', variant = 'secondary' }: { children: ReactNode; onClick: () => void; busy?: boolean; size?: 'sm' | 'md' | 'lg'; variant?: 'primary' | 'secondary' }) {
  return (
    <Button size={size} variant={variant} onClick={onClick} disabled={busy} className={variant === 'primary' ? aiPrimary : undefined}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className={variant === 'secondary' ? 'text-violet-600' : ''} />}
      {children}
    </Button>
  )
}

const AiTitle = ({ children }: { children: ReactNode }) => (
  <span className="flex min-w-0 items-center gap-2.5">
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
      <Sparkles size={15} />
    </span>
    <span className="truncate">{children}</span>
  </span>
)

/** Ladezustand: pulsierende Zeilen. */
export function AiSkeleton({ label = 'Claude denkt nach …', lines = 6 }: { label?: string; lines?: number }) {
  const widths = ['w-2/5', 'w-full', 'w-11/12', 'w-4/5', 'w-1/3', 'w-full', 'w-3/4', 'w-5/6']
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-medium text-violet-600">
        <Loader2 size={16} className="animate-spin" /> {label}
      </p>
      <div className="space-y-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={clsx('h-3 animate-pulse rounded-full bg-violet-50', widths[i % widths.length], i === 0 && 'h-3.5')} style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    </div>
  )
}

function AiErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-100">
      <TriangleAlert size={18} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="-my-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 font-medium hover:bg-rose-100">
          <RotateCcw size={14} /> Nochmal
        </button>
      )}
    </div>
  )
}

const errText = (e: unknown) => (e instanceof AiError || e instanceof Error ? e.message : String(e))

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast('Kopiert', undefined, 'success')
  } catch {
    toast('Kopieren nicht möglich', undefined, 'error')
  }
}

/** Generisches Ergebnis-Panel für Texte der KI. */
export function AiTextSheet({ open, onClose, title, run, deps }: { open: boolean; onClose: () => void; title: string; run: () => Promise<string>; deps: unknown[] }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const reqId = useRef(0)
  const doneKey = useRef<string | null>(null)
  const key = JSON.stringify(deps)

  const go = async () => {
    const id = ++reqId.current
    setBusy(true)
    setErr('')
    try {
      const t = await run()
      if (id !== reqId.current) return
      setText(t)
      doneKey.current = key
    } catch (e) {
      if (id === reqId.current) setErr(errText(e))
    } finally {
      if (id === reqId.current) setBusy(false)
    }
  }
  useEffect(() => {
    if (open && doneKey.current !== key) {
      setText('')
      go()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key])
  useEffect(() => () => void reqId.current++, [])

  return (
    <Sheet open={open} onClose={onClose} title={<AiTitle>{title}</AiTitle>} wide>
      {busy && <AiSkeleton />}
      {!busy && err && <AiErrorBox message={err} onRetry={go} />}
      {!busy && text && (
        <article className="rounded-2xl bg-slate-50/60 p-4 ring-1 ring-slate-100 sm:p-5">
          <Md text={text} />
        </article>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs text-slate-400">KI-Entwurf – bitte prüfen.</p>
        {text && !busy && (
          <Button variant="ghost" size="sm" onClick={() => copy(text)}>
            <Copy size={16} /> Kopieren
          </Button>
        )}
        <AiButton busy={busy} onClick={go}>
          Neu erzeugen
        </AiButton>
      </div>
    </Sheet>
  )
}

type Proposal = { studentIds: string[]; kind: ObsKind; valence: Valence; subject: string; competencyId: string; level: number; text: string; keep: boolean }

const VALENCES: Valence[] = ['pos', 'neu', 'neg']
const VALENCE_LABEL: Record<Valence, string> = { pos: 'positiv', neu: 'neutral', neg: 'Sorge' }
const clampLevel = (n: unknown) => {
  const x = Math.round(Number(n))
  return Number.isFinite(x) ? Math.min(4, Math.max(0, x)) : 0
}

/** Diktat nach der Stunde → strukturierte Einträge. */
export function DictationSheet({ open, onClose, cls, students, comps, lessonId, subject }: { open: boolean; onClose: () => void; cls: SchoolClass; students: Student[]; comps: Competency[]; lessonId?: string; subject?: string }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<Proposal[] | null>(null)
  const [unclear, setUnclear] = useState<string[]>([])
  const [err, setErr] = useState('')
  const dict = useDictation((t) => setText((x) => (x ? x + ' ' : '') + t))

  const analyse = async () => {
    if (busy || !text.trim()) return
    setBusy(true)
    setErr('')
    try {
      const res = await ai<{ json?: { entries?: unknown; unklar?: unknown } }>('structure', {
        diktat: text,
        fach_der_stunde: subject ?? '',
        jahrgangsstufe: cls.gradeLevel,
        kinder: students.map((s) => ({ id: s.id, vorname: s.firstName, nachname: s.lastName })),
        faecher: cls.subjects,
        kompetenzen: comps.map((c) => ({ id: c.id, fach: c.subject, bereich: c.area, text: c.text })),
      })
      const valid = new Set(students.map((s) => s.id))
      const raw = Array.isArray(res?.json?.entries) ? (res.json.entries as Record<string, unknown>[]) : []
      const parsed: Proposal[] = raw
        .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
        .map((e) => {
          const ids = Array.isArray(e.studentIds) ? [...new Set((e.studentIds as unknown[]).filter((id): id is string => typeof id === 'string' && valid.has(id)))] : []
          const kind = typeof e.kind === 'string' && e.kind in KIND_LABEL ? (e.kind as ObsKind) : 'beobachtung'
          const valence = VALENCES.includes(e.valence as Valence) ? (e.valence as Valence) : 'neu'
          const competencyId = typeof e.competencyId === 'string' && comps.some((c) => c.id === e.competencyId) ? e.competencyId : ''
          return {
            studentIds: ids,
            kind,
            valence,
            subject: typeof e.subject === 'string' ? e.subject : '',
            competencyId,
            level: competencyId ? clampLevel(e.level) : 0,
            text: typeof e.text === 'string' ? e.text.trim() : '',
            keep: true,
          }
        })
        .filter((e) => e.studentIds.length && (e.text || e.level))
      setItems(parsed)
      setUnclear(Array.isArray(res?.json?.unklar) ? (res.json.unklar as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()) : [])
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const accept = async () => {
    if (saving) return
    const chosen = (items ?? []).filter((i) => i.keep)
    if (!chosen.length) return
    setSaving(true)
    let done = 0
    try {
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
          level: i.competencyId && i.level ? (i.level as 1 | 2 | 3 | 4) : undefined,
          text: i.text,
          tags: ['diktat'],
          attachments: [],
        }
        await save(db.observations, o)
        done++
      }
      toast(`${done} ${done === 1 ? 'Eintrag' : 'Einträge'} gespeichert`, undefined, 'success')
      setText('')
      setItems(null)
      onClose()
    } catch (e) {
      // bereits gespeicherte nicht doppelt anbieten
      setItems((xs) => xs && xs.filter((x) => !x.keep || chosen.indexOf(x) >= done))
      toast(`Speichern fehlgeschlagen (${done} gespeichert): ${errText(e)}`, undefined, 'error')
    } finally {
      setSaving(false)
    }
  }

  const upd = (i: number, patch: Partial<Proposal>) => setItems((xs) => xs!.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const keepCount = items?.filter((i) => i.keep).length ?? 0
  const selCls = 'h-8 rounded-lg border-0 bg-white px-2 text-xs font-medium text-slate-700 ring-1 ring-slate-200 outline-none ring-inset focus:ring-2 focus:ring-violet-500'

  return (
    <Sheet open={open} onClose={onClose} title={<AiTitle>Diktat → Einträge</AiTitle>} wide>
      {!items ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">Einfach erzählen, was in der Stunde aufgefallen ist – mehrere Kinder durcheinander ist okay. Claude macht daraus einzelne Einträge, du bestätigst.</p>
          {busy ? (
            <div className="rounded-2xl bg-slate-50/60 p-4 ring-1 ring-slate-100">
              <AiSkeleton label="Claude ordnet die Beobachtungen zu …" lines={4} />
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              className={clsx(inputCls, 'focus:ring-violet-500')}
              placeholder="Lena hat beim Zehnerübergang wieder an den Fingern gezählt. Tim hat Max super bei der Partnerarbeit geholfen. Anna konnte ihren Rechenweg richtig gut erklären: erst bis zur Zehn, dann den Rest …"
              autoFocus
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {dict.supported && (
              <Button variant={dict.active ? 'danger' : 'secondary'} onClick={dict.toggle} disabled={busy}>
                <Mic size={16} className={clsx(dict.active && 'animate-pulse')} /> {dict.active ? 'Stopp' : 'Diktieren'}
              </Button>
            )}
            <span className="hidden text-xs text-slate-400 sm:inline">Tipp: Auf dem iPad geht auch das Mikrofon der Tastatur.</span>
            <span className="flex-1" />
            <Button size="md" onClick={analyse} disabled={busy || !text.trim()} className={aiPrimary}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Auswerten
            </Button>
          </div>
          {err && <AiErrorBox message={err} onRetry={analyse} />}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-800 tabular-nums">{items.length}</span> {items.length === 1 ? 'Vorschlag' : 'Vorschläge'} – Häkchen entfernen, was nicht passt.
          </p>
          <div className="space-y-2.5">
            {items.map((it, i) => (
              <div key={i} className={clsx('rounded-2xl p-3.5 ring-1 transition', it.keep ? 'bg-white shadow-[var(--shadow-card)] ring-slate-200' : 'bg-slate-50 opacity-50 ring-slate-100')}>
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => upd(i, { keep: !it.keep })}
                    aria-pressed={it.keep}
                    aria-label={it.keep ? 'Nicht übernehmen' : 'Übernehmen'}
                    className={clsx('flex size-7 items-center justify-center rounded-lg ring-1 transition', it.keep ? 'bg-violet-600 text-[#fff] ring-violet-600' : 'bg-white text-transparent ring-slate-300')}
                  >
                    <Check size={15} strokeWidth={3} />
                  </button>
                  {it.studentIds.map((id) => {
                    const s = students.find((x) => x.id === id)
                    if (!s) return null
                    return (
                      <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pr-2.5 pl-0.5 text-sm font-medium text-slate-800">
                        <Avatar student={s} size={22} /> {s.firstName}
                      </span>
                    )
                  })}
                  <span className="flex-1" />
                  <ValenceDot v={it.valence} />
                  <select value={it.valence} onChange={(e) => upd(i, { valence: e.target.value as Valence })} className={selCls} aria-label="Wertung">
                    {VALENCES.map((v) => (
                      <option key={v} value={v}>
                        {VALENCE_LABEL[v]}
                      </option>
                    ))}
                  </select>
                  <select value={it.kind} onChange={(e) => upd(i, { kind: e.target.value as ObsKind })} className={selCls} aria-label="Art">
                    {Object.entries(KIND_LABEL).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <input value={it.text} onChange={(e) => upd(i, { text: e.target.value })} className={clsx(inputCls, 'focus:ring-violet-500')} />
                {(it.subject || it.competencyId) && (
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    {it.subject && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{it.subject}</span>}
                    {it.competencyId && (
                      <>
                        <span className="min-w-0">
                          {comps.find((c) => c.id === it.competencyId)?.text}
                          {it.level ? <b className="font-semibold text-slate-700"> – {LEVEL_LABEL[it.level]}</b> : null}
                        </span>
                        <button className="font-medium text-slate-400 underline-offset-2 hover:text-slate-700 hover:underline" onClick={() => upd(i, { competencyId: '', level: 0 })}>
                          entfernen
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
          {!items.length && <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">Keine zuordenbaren Beobachtungen gefunden. Namen deutlich nennen hilft.</p>}
          {unclear.length > 0 && (
            <div className="flex gap-2.5 rounded-2xl bg-amber-50 p-3.5 text-sm text-amber-800 ring-1 ring-amber-100">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <p>
                <span className="font-medium">Nicht zugeordnet:</span> {unclear.join(' · ')}
              </p>
            </div>
          )}
          <div className="sticky -bottom-5 -mx-5 -mb-5 flex items-center justify-between gap-2 border-t border-slate-100 bg-white/90 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6">
            <Button variant="ghost" onClick={() => setItems(null)} disabled={saving}>
              Zurück zum Text
            </Button>
            <Button size="lg" onClick={accept} disabled={!keepCount || saving} className={aiPrimary}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              <span className="tabular-nums">{keepCount}</span> {keepCount === 1 ? 'Eintrag' : 'Einträge'} übernehmen
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
  const [asked, setAsked] = useState('')
  const [a, setA] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const busyRef = useRef(false)
  const ask = async () => {
    const frage = q.trim()
    if (!frage || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setErr('')
    setAsked(frage)
    setA('')
    try {
      setA((await ai('ask', { frage, daten: data() })).text)
    } catch (e) {
      setErr(errText(e))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={<AiTitle>{title}</AiTitle>} wide>
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault()
          ask()
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.nativeEvent.isComposing || busy)) e.preventDefault()
          }}
          placeholder={placeholder}
          className={clsx(inputCls, 'h-12 pr-14 focus:ring-violet-500')}
          enterKeyHint="send"
          autoFocus
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          aria-label="Fragen"
          className="absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-lg bg-violet-600 text-[#fff] transition hover:bg-violet-500 active:scale-95 disabled:opacity-40"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.4} />}
        </button>
      </form>

      {!asked && !busy && <p className="mt-3 text-xs text-slate-400">Claude antwortet nur auf Basis deiner Einträge.</p>}

      {(asked || busy) && (
        <div className="mt-5 space-y-4">
          {asked && (
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-violet-50 px-4 py-2.5 text-sm text-violet-800">{asked}</p>
          )}
          {busy && <AiSkeleton lines={4} />}
          {!busy && err && <AiErrorBox message={err} onRetry={ask} />}
          {!busy && a && (
            <article className="rounded-2xl bg-slate-50/60 p-4 ring-1 ring-slate-100 sm:p-5">
              <Md text={a} />
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-400">KI-Antwort – bitte prüfen.</p>
                <Button variant="ghost" size="sm" onClick={() => copy(a)}>
                  <Copy size={15} /> Kopieren
                </Button>
              </div>
            </article>
          )}
        </div>
      )}
    </Sheet>
  )
}
