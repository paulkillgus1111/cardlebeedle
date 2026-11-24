import clsx from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, LogOut, RefreshCw, Shuffle, Trash2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from '../components/toast'
import { Avatar, Button, Card, Empty, Field, inputCls, Segmented } from '../components/ui'
import { alive, db, getMeta, now, remove, save, SYNCED_TABLES, uid, type GradeLevel, type ObsKind, type SchoolClass, type SeatingPlan, type Valence } from '../lib/db'
import { setActiveClassId, useActiveClass, useClasses, useStudents } from '../lib/hooks'
import { bandFor, KIND_LABEL, SUBJECTS_BY_GRADE } from '../lib/seed'
import { supabase, sync } from '../lib/sync'

type Tab = 'klasse' | 'kinder' | 'sitzplan' | 'vorlagen' | 'kompetenzen' | 'konto'

export default function Einstellungen() {
  const [tab, setTab] = useState<Tab>('klasse')
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'klasse', label: 'Klassen' },
          { value: 'kinder', label: 'Kinder' },
          { value: 'sitzplan', label: 'Sitzplan' },
          { value: 'vorlagen', label: 'Schnell-Einträge' },
          { value: 'kompetenzen', label: 'Kompetenzen' },
          { value: 'konto', label: 'Konto & Sync' },
        ]}
      />
      {tab === 'klasse' && <Klassen />}
      {tab === 'kinder' && <KinderVerwalten />}
      {tab === 'sitzplan' && <Sitzplan />}
      {tab === 'vorlagen' && <Vorlagen />}
      {tab === 'kompetenzen' && <Kompetenzen />}
      {tab === 'konto' && <Konto />}
    </div>
  )
}

function currentSchoolYear() {
  const d = new Date()
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}/${String(y + 1).slice(2)}`
}

function Klassen() {
  const classes = useClasses() ?? []
  const { cls: active } = useActiveClass()
  const [edit, setEdit] = useState<SchoolClass | null>(null)
  const blank = (): SchoolClass => ({ id: uid(), name: '', gradeLevel: 1, schoolYear: currentSchoolYear(), subjects: SUBJECTS_BY_GRADE[1], updatedAt: now() })
  return (
    <div className="space-y-4">
      <Card title="Meine Klassen" action={<Button size="sm" onClick={() => setEdit(blank())}>Neue Klasse</Button>}>
        <ul className="divide-y divide-slate-100">
          {classes.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <span className="flex-1 font-medium">
                {c.name} <span className="font-normal text-slate-500">· Jgst. {c.gradeLevel} · {c.schoolYear}</span>
              </span>
              {active?.id === c.id ? (
                <span className="text-xs font-semibold text-brand-700">aktiv</span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setActiveClassId(c.id)}>
                  Aktivieren
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setEdit(c)}>
                Bearbeiten
              </Button>
            </li>
          ))}
          {!classes.length && <Empty>Noch keine Klasse.</Empty>}
        </ul>
      </Card>
      {edit && (
        <Card title={edit.name ? `Klasse ${edit.name}` : 'Neue Klasse'}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name">
              <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} placeholder="z. B. 2b" autoFocus />
            </Field>
            <Field label="Schuljahr">
              <input value={edit.schoolYear} onChange={(e) => setEdit({ ...edit, schoolYear: e.target.value })} className={inputCls} />
            </Field>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-600">Jahrgangsstufe</span>
              <Segmented
                value={edit.gradeLevel}
                onChange={(g: GradeLevel) => setEdit({ ...edit, gradeLevel: g, subjects: SUBJECTS_BY_GRADE[g] })}
                options={([1, 2, 3, 4] as const).map((g) => ({ value: g, label: String(g) }))}
              />
            </div>
          </div>
          <p className="mt-4 mb-2 text-sm font-medium text-slate-600">Fächer, die ich in dieser Klasse unterrichte</p>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS_BY_GRADE[edit.gradeLevel].map((s) => {
              const on = edit.subjects.includes(s)
              return (
                <button key={s} onClick={() => setEdit({ ...edit, subjects: on ? edit.subjects.filter((x) => x !== s) : [...edit.subjects, s] })} className={clsx('rounded-xl px-3 py-1.5 text-sm', on ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600')}>
                  {s}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">Kompetenzraster: LehrplanPLUS Jgst. {bandFor(edit.gradeLevel)}. Jgst. 1–3: LEG möglich · Jgst. 4: Übertritt.</p>
          <div className="mt-4 flex gap-2">
            {classes.some((c) => c.id === edit.id) && (
              <Button
                variant="ghost"
                className="text-rose-600"
                onClick={async () => {
                  if (!confirm(`Klasse ${edit.name} wirklich löschen?`)) return
                  await remove(db.classes, edit.id)
                  setEdit(null)
                }}
              >
                Löschen
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={!edit.name.trim()}
              onClick={async () => {
                await save(db.classes, { ...edit, name: edit.name.trim() })
                if (!active) setActiveClassId(edit.id)
                setEdit(null)
                toast('Klasse gespeichert')
              }}
            >
              Speichern
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

function KinderVerwalten() {
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const [bulk, setBulk] = useState('')
  if (!cls) return <Empty>Zuerst eine Klasse anlegen.</Empty>
  const add = async () => {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean)
    for (const line of lines) {
      const parts = line.split(/[;,\t]| {1,}/).filter(Boolean)
      const firstName = parts[0]
      const lastName = parts.slice(1).join(' ')
      await save(db.students, { id: uid(), classId: cls.id, firstName, lastName, updatedAt: now() })
    }
    setBulk('')
    toast(`${lines.length} Kind(er) hinzugefügt`)
  }
  return (
    <div className="space-y-4">
      <Card title={`Kinder hinzufügen · ${cls.name}`}>
        <Field label="Ein Kind pro Zeile: Vorname Nachname (auch aus Excel/Schulmanager einfügbar)">
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} className={inputCls} placeholder={'Lena Huber\nTim Maier'} />
        </Field>
        <div className="mt-3 flex justify-end">
          <Button onClick={add} disabled={!bulk.trim()}>
            Hinzufügen
          </Button>
        </div>
      </Card>
      <Card title={`${students.length} Kinder`}>
        <ul className="divide-y divide-slate-100">
          {students.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <Avatar student={s} size={32} />
              <input defaultValue={s.firstName} onBlur={(e) => e.target.value !== s.firstName && save(db.students, { ...s, firstName: e.target.value })} className="w-32 rounded-lg px-2 py-1 hover:bg-slate-50" />
              <input defaultValue={s.lastName} onBlur={(e) => e.target.value !== s.lastName && save(db.students, { ...s, lastName: e.target.value })} className="flex-1 rounded-lg px-2 py-1 hover:bg-slate-50" />
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (confirm(`${s.firstName} entfernen?`)) await remove(db.students, s.id)
                }}
              >
                <Trash2 size={16} />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function Sitzplan() {
  const { cls } = useActiveClass()
  const students = useStudents(cls?.id)
  const stored = useLiveQuery(async () => (cls ? alive(await db.seatingPlans.where('classId').equals(cls.id).toArray())[0] ?? null : null), [cls?.id])
  const [plan, setPlan] = useState<SeatingPlan | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  useEffect(() => {
    if (stored === undefined || !cls) return
    setPlan(stored ?? { id: uid(), classId: cls.id, cols: 6, rows: 4, seats: [], updatedAt: now() })
  }, [stored, cls])
  if (!cls || !plan) return null

  const at = (x: number, y: number) => plan.seats.find((s) => s.x === x && s.y === y)
  const placed = new Set(plan.seats.map((s) => s.studentId))
  const tapCell = (x: number, y: number) => {
    const occ = at(x, y)
    let seats = plan.seats
    if (picked) {
      const from = seats.find((s) => s.studentId === picked)
      seats = seats.filter((s) => s.studentId !== picked && !(s.x === x && s.y === y))
      seats.push({ studentId: picked, x, y })
      if (occ && from && occ.studentId !== picked) seats.push({ studentId: occ.studentId, x: from.x, y: from.y })
      setPicked(null)
    } else if (occ) {
      setPicked(occ.studentId)
      return
    }
    setPlan({ ...plan, seats })
  }
  const shuffle = () => {
    const cells = Array.from({ length: plan.rows * plan.cols }, (_, i) => ({ x: i % plan.cols, y: Math.floor(i / plan.cols) }))
    const kids = [...students].sort(() => Math.random() - 0.5)
    setPlan({ ...plan, seats: kids.slice(0, cells.length).map((s, i) => ({ studentId: s.id, ...cells[i] })) })
  }

  return (
    <Card title={`Sitzplan · ${cls.name}`}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Spalten">
          <input type="number" min={2} max={12} value={plan.cols} onChange={(e) => setPlan({ ...plan, cols: +e.target.value })} className={clsx(inputCls, 'w-20')} />
        </Field>
        <Field label="Reihen">
          <input type="number" min={1} max={10} value={plan.rows} onChange={(e) => setPlan({ ...plan, rows: +e.target.value })} className={clsx(inputCls, 'w-20')} />
        </Field>
        <Button variant="secondary" onClick={shuffle}>
          <Shuffle size={16} /> Zufällig verteilen
        </Button>
        <Button variant="ghost" onClick={() => setPlan({ ...plan, seats: [] })}>
          Leeren
        </Button>
        <span className="flex-1" />
        <Button
          onClick={async () => {
            await save(db.seatingPlans, plan)
            toast('Sitzplan gespeichert')
          }}
        >
          Speichern
        </Button>
      </div>
      <p className="mb-2 text-sm text-slate-500">{picked ? 'Jetzt einen Platz antippen.' : 'Kind antippen, dann Platz antippen. Belegte Plätze tauschen.'} Tafel ist oben.</p>
      <div className="mb-2 rounded-lg bg-slate-800 py-1 text-center text-xs text-white">Tafel</div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${plan.cols}, minmax(60px, 1fr))` }}>
        {Array.from({ length: plan.rows * plan.cols }, (_, i) => {
          const x = i % plan.cols
          const y = Math.floor(i / plan.cols)
          const seat = at(x, y)
          const s = seat && students.find((st) => st.id === seat.studentId)
          return (
            <button key={i} onClick={() => tapCell(x, y)} className={clsx('flex h-20 flex-col items-center justify-center gap-1 rounded-xl text-xs ring-1', s ? 'bg-white ring-slate-200' : 'border border-dashed border-slate-300 bg-slate-50 ring-0', s && picked === s.id && 'ring-2 ring-brand-600')}>
              {s && (
                <>
                  <Avatar student={s} size={30} />
                  {s.firstName}
                </>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-4 mb-2 text-sm font-medium text-slate-600">Noch ohne Platz</p>
      <div className="flex flex-wrap gap-2">
        {students
          .filter((s) => !placed.has(s.id))
          .map((s) => (
            <button key={s.id} onClick={() => setPicked(s.id)} className={clsx('flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm ring-1', picked === s.id ? 'bg-brand-50 ring-brand-600' : 'ring-slate-200')}>
              <Avatar student={s} size={24} /> {s.firstName}
            </button>
          ))}
      </div>
    </Card>
  )
}

function Vorlagen() {
  const list = useLiveQuery(async () => alive(await db.quickTemplates.orderBy('order').toArray())) ?? []
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<ObsKind>('arbeitsverhalten')
  const [valence, setValence] = useState<Valence>('pos')
  return (
    <Card title="Schnell-Einträge (1 Tipp im Unterricht)">
      <ul className="mb-4 divide-y divide-slate-100">
        {list.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
            <span className={clsx('size-2.5 rounded-full', t.valence === 'pos' ? 'bg-emerald-500' : t.valence === 'neg' ? 'bg-rose-500' : 'bg-slate-300')} />
            <span className="flex-1">{t.label}</span>
            <span className="text-slate-400">{KIND_LABEL[t.kind]}</span>
            <Button size="sm" variant="ghost" onClick={() => remove(db.quickTemplates, t.id)}>
              <Trash2 size={16} />
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. rechnet nicht zählend" className={inputCls} />
        <select value={kind} onChange={(e) => setKind(e.target.value as ObsKind)} className={inputCls}>
          {Object.entries(KIND_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <Segmented value={valence} onChange={setValence} options={[{ value: 'pos', label: '👍' }, { value: 'neu', label: '–' }, { value: 'neg', label: '⚠︎' }]} />
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          disabled={!label.trim()}
          onClick={async () => {
            await save(db.quickTemplates, { id: uid(), label: label.trim(), kind, valence, order: list.length, updatedAt: now() })
            setLabel('')
          }}
        >
          Hinzufügen
        </Button>
      </div>
    </Card>
  )
}

function Kompetenzen() {
  const { cls } = useActiveClass()
  const [band, setBand] = useState<'1/2' | '3/4'>(cls ? bandFor(cls.gradeLevel) : '1/2')
  const [subject, setSubject] = useState('Mathematik')
  const comps = useLiveQuery(async () => alive(await db.competencies.where('band').equals(band).toArray()), [band]) ?? []
  const [area, setArea] = useState('')
  const [text, setText] = useState('')
  const shown = comps.filter((c) => c.subject === subject)
  const areas = [...new Set(shown.map((c) => c.area))]
  return (
    <Card title="Kompetenzraster (LehrplanPLUS, editierbar)">
      <div className="mb-3 flex flex-wrap gap-2">
        <Segmented value={band} onChange={setBand} options={[{ value: '1/2', label: 'Jgst. 1/2' }, { value: '3/4', label: 'Jgst. 3/4' }]} />
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          {SUBJECTS_BY_GRADE[4].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      {areas.map((a) => (
        <div key={a} className="mb-3">
          <p className="mb-1 text-xs font-semibold text-slate-400 uppercase">{a}</p>
          <ul>
            {shown
              .filter((c) => c.area === a)
              .map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-1 text-sm">
                  <span className="flex-1">{c.text}</span>
                  <Button size="sm" variant="ghost" onClick={() => remove(db.competencies, c.id)}>
                    <Trash2 size={14} />
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      ))}
      {!shown.length && <Empty>Für {subject} noch keine Kompetenzen – unten anlegen.</Empty>}
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_2fr_auto]">
        <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Lernbereich" list="areas" className={inputCls} />
        <datalist id="areas">
          {areas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Kompetenzerwartung" className={inputCls} />
        <Button
          disabled={!area.trim() || !text.trim()}
          onClick={async () => {
            await save(db.competencies, { id: uid(), subject, band, area: area.trim(), text: text.trim(), updatedAt: now() })
            setText('')
          }}
        >
          Hinzufügen
        </Button>
      </div>
    </Card>
  )
}

function Konto() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [user, setUser] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lastSync = useLiveQuery(() => getMeta<string | null>('lastSync', null))
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user?.email ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user?.email ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const exportJson = async () => {
    const out: Record<string, unknown[]> = {}
    for (const t of SYNCED_TABLES) {
      const rows = await db.table(t).toArray()
      out[t] = rows.map((r) => (r.attachments ? { ...r, attachments: r.attachments.map(({ blob: _b, ...a }: { blob?: Blob }) => (void _b, a)) } : r))
    }
    const blob = new Blob([JSON.stringify({ exportedAt: now(), ...out }, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `cockpit-backup-${now().slice(0, 10)}.json`
    a.click()
  }
  const importJson = async (file?: File) => {
    if (!file) return
    const data = JSON.parse(await file.text())
    for (const t of SYNCED_TABLES) if (Array.isArray(data[t])) await db.table(t).bulkPut(data[t].map((r: object) => ({ ...r, dirty: 1 })))
    toast('Backup importiert')
  }

  return (
    <div className="space-y-4">
      <Card title="Cloud-Sync (Supabase)">
        {user ? (
          <div className="space-y-3">
            <p className="text-sm">
              Angemeldet als <b>{user}</b>. Letzte Synchronisation: {lastSync ? new Date(lastSync).toLocaleString('de-DE') : 'noch nie'}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const r = await sync()
                    toast(`Sync: ${r.pushed} hoch, ${r.pulled} runter`)
                  } catch (e) {
                    toast(`Sync fehlgeschlagen: ${(e as Error).message}`)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <RefreshCw size={16} className={clsx(busy && 'animate-spin')} /> Jetzt synchronisieren
              </Button>
              <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
                <LogOut size={16} /> Abmelden
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Die App funktioniert komplett offline. Mit Anmeldung werden die Daten zusätzlich gesichert und zwischen iPad und Laptop abgeglichen.</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" className={inputCls} />
              <input type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Passwort" className={inputCls} />
              <Button
                disabled={!email || code.length < 6 || busy}
                onClick={async () => {
                  setBusy(true)
                  const { error } = await supabase.auth.signInWithPassword({ email, password: code })
                  setBusy(false)
                  toast(error ? `Anmeldung fehlgeschlagen: ${error.message}` : 'Angemeldet')
                }}
              >
                Anmelden
              </Button>
              <Button
                variant="secondary"
                disabled={!email || code.length < 6 || busy}
                onClick={async () => {
                  setBusy(true)
                  const { data, error } = await supabase.auth.signUp({ email, password: code, options: { emailRedirectTo: location.origin } })
                  setBusy(false)
                  if (error) toast(error.message)
                  else if (!data.session) setSent(true)
                  else toast('Konto angelegt')
                }}
              >
                Konto anlegen
              </Button>
            </div>
            {sent && <p className="text-sm text-amber-700">Bestätigungs-Mail verschickt. Link in der Mail öffnen, danach hier anmelden.</p>}
            <p className="text-xs text-slate-500">Passwort mindestens 6 Zeichen.</p>
          </div>
        )}
      </Card>
      <Card title="Backup">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportJson}>
            <Download size={16} /> Als JSON exportieren
          </Button>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium ring-1 ring-slate-200">
            <Upload size={16} /> JSON importieren
            <input type="file" accept="application/json" className="hidden" onChange={(e) => importJson(e.target.files?.[0])} />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">Fotos und Sprachmemos sind im JSON nicht enthalten (liegen im Cloud-Speicher).</p>
      </Card>
    </div>
  )
}
