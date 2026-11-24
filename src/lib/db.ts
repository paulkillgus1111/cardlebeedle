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
}

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
}

export interface Competency extends Base {
  subject: string
  area: string
  text: string
  /** Doppeljahrgangsstufe nach LehrplanPLUS */
  band: '1/2' | '3/4'
  builtin?: boolean
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
  meta!: Table<Meta, string>

  constructor() {
    super('lehrer-cockpit')
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
  }
}

export const db = new CockpitDB()

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
