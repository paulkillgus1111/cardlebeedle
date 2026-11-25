import Dexie, { type Table } from 'dexie'

export type ID = string
export const uid = (): ID => crypto.randomUUID()
export const now = () => new Date().toISOString()

/** Gemeinsame Felder für alles, was synchronisiert wird. */
export interface Base {
  id: ID
  updatedAt: string
  deleted?: 0 | 1
  /** 1 = lokal geändert, noch nicht hochgeladen */
  dirty?: 0 | 1
}

export type GradeLevel = 1 | 2 | 3 | 4

export interface SchoolClass extends Base {
  name: string
  gradeLevel: GradeLevel
  schoolYear: string
  subjects: string[]
  /** 'klasse' (Standard) oder 'gruppe' (z. B. Religion, Förderkurs – Kinder aus mehreren Klassen) */
  kind?: 'klasse' | 'gruppe'
  /** Nur bei Gruppen: Mitglieder (Kinder bleiben in ihrer Stammklasse) */
  memberIds?: ID[]
  /** Farbschlüssel aus CLASS_COLORS */
  color?: string
  archived?: 0 | 1
  /** Bei Versetzung: Klasse des Vorjahres */
  previousClassId?: ID
}

/** Farben für Klassen/Gruppen (Tailwind-Farbnamen). */
export const CLASS_COLORS = ['teal', 'sky', 'violet', 'amber', 'rose', 'lime', 'orange', 'indigo', 'pink', 'emerald'] as const
export type ClassColor = (typeof CLASS_COLORS)[number]

export const isGroup = (c?: Pick<SchoolClass, 'kind'>) => c?.kind === 'gruppe'

export interface Support {
  lrs?: boolean
  notenschutz?: boolean
  nachteilsausgleich?: boolean
  msd?: boolean
  daz?: boolean
  note?: string
}

export interface Student extends Base {
  classId: ID
  firstName: string
  lastName: string
  birthday?: string
  support?: Support
  info?: string
  /** Zeugnistext-Entwürfe, Schlüssel z. B. "2026/27 Jahreszeugnis" */
  reports?: Record<string, string>
  /** Frühere Klassen (bei Versetzung) */
  history?: { classId: ID; schoolYear: string; className: string }[]
}

export interface Competency extends Base {
  subject: string
  area: string
  text: string
  /** Doppeljahrgangsstufe nach LehrplanPLUS */
  band: '1/2' | '3/4'
  builtin?: boolean
  /** Beobachtbare Indikatoren je Stufe 1–4 (nicht · teilweise · überwiegend · sicher) */
  indicators?: [string?, string?, string?, string?]
  /** Ankerbeispiele: Beobachtungs-IDs je Stufe */
  anchors?: Partial<Record<1 | 2 | 3 | 4, ID[]>>
}

export interface Seat {
  studentId: ID
  x: number
  y: number
}

export interface SeatingPlan extends Base {
  classId: ID
  cols: number
  rows: number
  seats: Seat[]
}

export type ReflectionRating = 'gruen' | 'gelb' | 'rot'

export interface Lesson extends Base {
  classId: ID
  date: string // ISO-Datum YYYY-MM-DD
  subject: string
  topic: string
  /** Beobachtungsschwerpunkt (Freitext) */
  focus: string
  focusCompetencyIds: ID[]
  /** Gruppe/Kinder, auf die sich der Schwerpunkt bezieht (leer = alle) */
  focusStudentIds: ID[]
  status: 'laufend' | 'abgeschlossen'
  startedAt: string
  endedAt?: string
  reflection?: {
    rating?: ReflectionRating
    goalReached?: 'ja' | 'teilweise' | 'nein'
    whatWasDone?: string
    note?: string
    nextTime?: string
  }
  attachments?: Attachment[]
}

export type ObsKind =
  | 'beobachtung'
  | 'lernstand'
  | 'arbeitsverhalten'
  | 'sozialverhalten'
  | 'staerke'
  | 'foerderbedarf'
  | 'vorfall'
  | 'zitat'
  | 'arbeitsprobe'
  | 'elternkontakt'
  | 'diagnose'

export type Valence = 'pos' | 'neu' | 'neg'

export interface Attachment {
  id: ID
  type: 'image' | 'audio' | 'sketch'
  mime: string
  /** lokal gespeicherter Inhalt */
  blob?: Blob
  /** Pfad im Supabase-Storage nach Upload */
  remotePath?: string
}

export interface Observation extends Base {
  classId: ID
  studentIds: ID[]
  lessonId?: ID
  date: string // ISO-Datum
  createdAt: string
  kind: ObsKind
  valence: Valence
  subject?: string
  competencyId?: ID
  /** 1 nicht · 2 teilweise · 3 überwiegend · 4 sicher */
  level?: 1 | 2 | 3 | 4
  text: string
  tags: string[]
  /** Für Elterngespräch/LEG zeigbar */
  shareable?: boolean
  attachments: Attachment[]
  followUp?: string // ISO-Datum Wiedervorlage
  /** Optionale Deutung – getrennt vom beobachteten Fakt (text). Wird NICHT als Beleg an die KI gegeben. */
  interpretation?: string
  /** Nächster Schritt / Förderidee (Feed-forward) */
  nextStep?: string
  /** In Gruppenarbeit entstanden → nicht notenrelevant (§ 11 Abs. 1 GrSO, ab 01.08.2026) */
  groupWork?: boolean
  /** Roh erfasst (Diktat/Skizze), noch nicht einsortiert */
  unsorted?: boolean
  /** Verhaltensskala: Item-ID aus BEHAVIOR_ITEMS + Häufigkeit 1 nie · 2 selten · 3 oft · 4 immer */
  scaleItemId?: string
  frequency?: 1 | 2 | 3 | 4
  /** „Gesehen, unauffällig“ aus dem Stundenende-Durchgang */
  seenOnly?: boolean
}

export interface Goal extends Base {
  studentId: ID
  classId: ID
  text: string
  kind: 'lernziel' | 'foerderziel' | 'vereinbarung'
  competencyId?: ID
  due?: string
  status: 'offen' | 'erreicht' | 'teilweise' | 'verworfen'
  createdAt: string
  /** z. B. LEG/Elterngespräch, aus dem das Ziel stammt */
  conversationId?: ID
  /** SMART: wer ist verantwortlich, wie wird geübt */
  owner?: 'kind' | 'eltern' | 'lehrkraft'
  strategy?: string
  /** Aus welcher Beobachtung (Nächster Schritt) entstanden */
  sourceObservationId?: ID
}

export interface QuickTemplate extends Base {
  label: string
  kind: ObsKind
  valence: Valence
  subject?: string
  order: number
}

export interface Conversation extends Base {
  classId: ID
  studentId: ID
  type: 'leg' | 'eltern' | 'uebertritt' | 'kind'
  date: string
  status: 'vorbereitung' | 'gefuehrt' | 'unterschrieben'
  /** Abschnitte des Bogens, Schlüssel = Abschnitts-ID */
  sections: Record<string, string>
  /** Selbsteinschätzung des Kindes: Aussage → 1..3 (☹ 😐 🙂) */
  selfAssessment: { text: string; value?: 1 | 2 | 3 }[]
  participants?: string
  parentsView?: string
  childView?: string
  notes?: string
}

/** Stundenplan-Eintrag: Wochentag × Stunde → Klasse/Gruppe + Fach */
export interface TimetableSlot extends Base {
  weekday: 1 | 2 | 3 | 4 | 5
  period: number
  classId: ID
  subject: string
  room?: string
}

export interface Meta {
  key: string
  value: unknown
}

export class CockpitDB extends Dexie {
  classes!: Table<SchoolClass, ID>
  students!: Table<Student, ID>
  competencies!: Table<Competency, ID>
  seatingPlans!: Table<SeatingPlan, ID>
  lessons!: Table<Lesson, ID>
  observations!: Table<Observation, ID>
  goals!: Table<Goal, ID>
  quickTemplates!: Table<QuickTemplate, ID>
  conversations!: Table<Conversation, ID>
  timetable!: Table<TimetableSlot, ID>
  meta!: Table<Meta, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      classes: 'id, updatedAt, dirty',
      students: 'id, classId, updatedAt, dirty',
      competencies: 'id, subject, band, updatedAt, dirty',
      seatingPlans: 'id, classId, updatedAt, dirty',
      lessons: 'id, classId, date, status, updatedAt, dirty',
      observations: 'id, classId, *studentIds, lessonId, date, kind, competencyId, updatedAt, dirty',
      goals: 'id, studentId, classId, status, updatedAt, dirty',
      quickTemplates: 'id, order, updatedAt, dirty',
      conversations: 'id, studentId, classId, type, date, updatedAt, dirty',
      meta: 'key',
    })
    this.version(2).stores({
      classes: 'id, kind, archived, updatedAt, dirty',
      timetable: 'id, classId, weekday, updatedAt, dirty',
    })
  }
}

/** Lokale Datenbank des angemeldeten Kontos (wird nach dem Login gesetzt). */
export let db = new CockpitDB('cardle-beedle-guest')

const LEGACY_DB = 'lehrer-cockpit'

/** Öffnet die eigene lokale Datenbank für ein Konto – jedes Konto hat getrennte Daten auf dem Gerät. */
export async function openUserDb(userId: string) {
  const key = `dbName:${userId}`
  let name: string | null = null
  try {
    name = localStorage.getItem(key)
  } catch {
    /* ignorieren */
  }
  if (!name) {
    name = `cardle-beedle-${userId}`
    // Daten aus der Zeit vor dem Login übernimmt das erste Konto, das sich anmeldet
    try {
      if (!localStorage.getItem('legacyDbClaimedBy') && (await Dexie.exists(LEGACY_DB))) {
        name = LEGACY_DB
        localStorage.setItem('legacyDbClaimedBy', userId)
      }
      localStorage.setItem(key, name)
    } catch {
      /* ignorieren */
    }
  }
  if (db.name !== name || !db.isOpen()) {
    if (db.isOpen()) db.close()
    db = new CockpitDB(name)
    await db.open()
  }
  return db
}

export const SYNCED_TABLES = [
  'classes',
  'students',
  'competencies',
  'seatingPlans',
  'lessons',
  'observations',
  'goals',
  'quickTemplates',
  'conversations',
  'timetable',
] as const
export type SyncedTable = (typeof SYNCED_TABLES)[number]

/** Speichert einen Datensatz und markiert ihn für die Synchronisation. */
export async function save<T extends Base>(table: Table<T, ID>, row: T): Promise<T> {
  const next = { ...row, updatedAt: now(), dirty: 1 as const }
  await table.put(next)
  return next
}

/** Weiches Löschen, damit es auch auf anderen Geräten verschwindet. */
export async function remove<T extends Base>(table: Table<T, ID>, id: ID) {
  const row = await table.get(id)
  if (!row) return
  await table.put({ ...row, deleted: 1, updatedAt: now(), dirty: 1 })
}

export const alive = <T extends Base>(rows: T[]) => rows.filter((r) => !r.deleted)

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const m = await db.meta.get(key)
  return (m?.value as T) ?? fallback
}
export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}

/** Klasse inkl. aller abhängigen Daten weich löschen. */
export async function removeClass(classId: ID) {
  const t = now()
  const tables = [db.students, db.observations, db.lessons, db.goals, db.conversations, db.seatingPlans] as Table<Base & { classId: ID }, ID>[]
  await db.transaction('rw', [db.classes, ...tables], async () => {
    for (const table of tables) {
      const rows = await table.where('classId').equals(classId).toArray()
      await table.bulkPut(rows.filter((r) => !r.deleted).map((r) => ({ ...r, deleted: 1 as const, dirty: 1 as const, updatedAt: t })))
    }
    const c = await db.classes.get(classId)
    if (c) await db.classes.put({ ...c, deleted: 1, dirty: 1, updatedAt: t })
  })
}

/** Kind inkl. seiner Ziele/Gespräche löschen; aus Beobachtungen mit mehreren Kindern nur austragen. */
export async function removeStudent(studentId: ID) {
  const t = now()
  await db.transaction('rw', [db.students, db.observations, db.goals, db.conversations, db.seatingPlans], async () => {
    for (const table of [db.goals, db.conversations] as Table<Base & { studentId: ID }, ID>[]) {
      const rows = await table.where('studentId').equals(studentId).toArray()
      await table.bulkPut(rows.filter((r) => !r.deleted).map((r) => ({ ...r, deleted: 1 as const, dirty: 1 as const, updatedAt: t })))
    }
    const obs = await db.observations.where('studentIds').equals(studentId).toArray()
    await db.observations.bulkPut(
      obs
        .filter((o) => !o.deleted)
        .map((o) => {
          const rest = o.studentIds.filter((x) => x !== studentId)
          return rest.length ? { ...o, studentIds: rest, dirty: 1 as const, updatedAt: t } : { ...o, deleted: 1 as const, dirty: 1 as const, updatedAt: t }
        }),
    )
    const plans = await db.seatingPlans.toArray()
    for (const p of plans) if (p.seats.some((s) => s.studentId === studentId)) await db.seatingPlans.put({ ...p, seats: p.seats.filter((s) => s.studentId !== studentId), dirty: 1, updatedAt: t })
    const s = await db.students.get(studentId)
    if (s) await db.students.put({ ...s, deleted: 1, dirty: 1, updatedAt: t })
  })
}

/** Datensatz nur liefern, wenn nicht gelöscht. */
export const aliveOne = <T extends Base>(row: T | undefined) => (row && !row.deleted ? row : undefined)
