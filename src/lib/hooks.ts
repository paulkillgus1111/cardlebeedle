import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { alive, db, getMeta, isGroup, setMeta, type Competency, type Observation, type SchoolClass, type Student, type TimetableSlot } from './db'
import { bandFor, compareCompetencies } from './seed'

/* ───────────── Aktive Klasse/Gruppe (pro Konto in der lokalen DB) ───────────── */

const ACTIVE_KEY = 'activeClassId'

export async function setActiveClassId(id: string) {
  await setMeta(ACTIVE_KEY, id)
}

export function useActiveClassId(): string | null | undefined {
  return useLiveQuery(() => getMeta<string | null>(ACTIVE_KEY, null))
}

const byName = (a: SchoolClass, b: SchoolClass) => (isGroup(a) === isGroup(b) ? a.name.localeCompare(b.name, 'de', { numeric: true }) : isGroup(a) ? 1 : -1)

/** Alle aktiven (nicht archivierten) Klassen und Gruppen – Klassen zuerst. */
export function useClasses(): SchoolClass[] | undefined {
  return useLiveQuery(async () => alive(await db.classes.toArray()).filter((c) => !c.archived).sort(byName))
}

export function useArchivedClasses(): SchoolClass[] {
  return useLiveQuery(async () => alive(await db.classes.toArray()).filter((c) => c.archived).sort(byName)) ?? []
}

/** Aktive Klasse oder Gruppe (fällt ohne zu schreiben auf die erste zurück). */
export function useActiveClass(): { cls?: SchoolClass; loading: boolean } {
  const id = useActiveClassId()
  const classes = useClasses()
  if (!classes || id === undefined) return { loading: true }
  return { cls: classes.find((c) => c.id === id) ?? classes[0], loading: false }
}

/** Klasse/Gruppe eines bestimmten Datensatzes (nicht unbedingt die aktive). */
export function useClass(id?: string): SchoolClass | undefined {
  return useLiveQuery(async () => {
    if (!id) return undefined
    const c = await db.classes.get(id)
    return c && !c.deleted ? c : undefined
  }, [id])
}

/* ───────────── Kinder & Beobachtungen eines Kontexts (Klasse ODER Gruppe) ───────────── */

/** Kinder einer Klasse bzw. Mitglieder einer Gruppe. */
export async function contextStudents(contextId?: string): Promise<Student[]> {
  if (!contextId) return []
  const ctx = await db.classes.get(contextId)
  const rows = isGroup(ctx) ? ((await db.students.bulkGet(ctx?.memberIds ?? [])).filter(Boolean) as Student[]) : await db.students.where('classId').equals(contextId).toArray()
  return alive(rows).sort((a, b) => a.firstName.localeCompare(b.firstName, 'de'))
}

export function useStudents(contextId?: string): Student[] {
  return useLiveQuery(() => contextStudents(contextId), [contextId]) ?? []
}

/** Alle Beobachtungen der Kinder dieses Kontexts – unabhängig davon, in welcher Klasse/Gruppe sie entstanden. */
export function useObservations(contextId?: string): Observation[] {
  return (
    useLiveQuery(async () => {
      if (!contextId) return []
      const ids = (await contextStudents(contextId)).map((s) => s.id)
      if (!ids.length) return []
      const rows = await db.observations.where('studentIds').anyOf(ids).distinct().toArray()
      return alive(rows).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }, [contextId]) ?? []
  )
}

/** Alle Beobachtungen eines Kindes (über alle Klassen, Gruppen und Schuljahre). */
export function useStudentObservations(studentId?: string): Observation[] {
  return (
    useLiveQuery(async () => {
      if (!studentId) return []
      return alive(await db.observations.where('studentIds').equals(studentId).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }, [studentId]) ?? []
  )
}

/** Kompetenzen passend zur Jahrgangsstufe (bei Gruppen: nur deren Fach). */
export function useCompetencies(cls?: SchoolClass): Competency[] {
  return (
    useLiveQuery(async () => {
      if (!cls) return []
      const band = bandFor(cls.gradeLevel)
      const all = alive(await db.competencies.where('band').equals(band).toArray()).sort(compareCompetencies)
      return isGroup(cls) && cls.subjects.length ? all.filter((c) => cls.subjects.includes(c.subject)) : all
    }, [cls?.id, cls?.gradeLevel, cls?.subjects?.join()]) ?? []
  )
}

/* ───────────── Stundenplan ───────────── */

export interface PeriodTime {
  period: number
  start: string // "08:00"
  end: string
}

/** Übliche Zeiten an bayerischen Grundschulen – in den Einstellungen änderbar. */
export const DEFAULT_PERIODS: PeriodTime[] = [
  { period: 1, start: '08:00', end: '08:45' },
  { period: 2, start: '08:45', end: '09:30' },
  { period: 3, start: '09:50', end: '10:35' },
  { period: 4, start: '10:35', end: '11:20' },
  { period: 5, start: '11:30', end: '12:15' },
  { period: 6, start: '12:15', end: '13:00' },
]

export function usePeriods(): PeriodTime[] {
  return useLiveQuery(() => getMeta<PeriodTime[]>('periodTimes', DEFAULT_PERIODS)) ?? DEFAULT_PERIODS
}

export async function setPeriods(p: PeriodTime[]) {
  await setMeta('periodTimes', p)
}

export function useTimetable(): TimetableSlot[] {
  return useLiveQuery(async () => alive(await db.timetable.toArray()).sort((a, b) => a.weekday - b.weekday || a.period - b.period)) ?? []
}

/** Minütlich aktualisierte Uhrzeit. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export interface SlotNow {
  slot: TimetableSlot
  time?: PeriodTime
  state: 'jetzt' | 'gleich' | 'spaeter' | 'vorbei'
}

/** Heutige Stundenplan-Einträge mit Zustand relativ zu „jetzt“ (Pausen: nächste Stunde gilt als „gleich“). */
export function todaysSlots(slots: TimetableSlot[], periods: PeriodTime[], now: Date): SlotNow[] {
  const wd = now.getDay() // 0 So … 6 Sa
  if (wd === 0 || wd === 6) return []
  const mins = now.getHours() * 60 + now.getMinutes()
  let nextMarked = false
  return slots
    .filter((s) => s.weekday === wd)
    .sort((a, b) => a.period - b.period)
    .map((slot) => {
      const time = periods.find((p) => p.period === slot.period)
      let state: SlotNow['state'] = 'spaeter'
      if (time) {
        if (mins >= toMin(time.start) && mins < toMin(time.end)) state = 'jetzt'
        else if (mins >= toMin(time.end)) state = 'vorbei'
        else if (!nextMarked && toMin(time.start) - mins <= 30) state = 'gleich'
      }
      if (state === 'gleich' || state === 'jetzt') nextMarked = true
      return { slot, time, state }
    })
}
