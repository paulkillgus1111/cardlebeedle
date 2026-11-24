import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useSyncExternalStore } from 'react'
import { alive, db, type Competency, type Observation, type SchoolClass, type Student } from './db'
import { bandFor, compareCompetencies } from './seed'

const KEY = 'activeClassId'
const listeners = new Set<() => void>()
function readActive() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setActiveClassId(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* ignorieren */
  }
  listeners.forEach((l) => l())
}

export function useActiveClassId() {
  return useSyncExternalStore(
    useCallback((cb: () => void) => (listeners.add(cb), () => listeners.delete(cb)), []),
    readActive,
  )
}

export function useClasses(): SchoolClass[] | undefined {
  return useLiveQuery(async () => alive(await db.classes.toArray()).sort((a, b) => a.name.localeCompare(b.name)))
}

/** Aktive Klasse (fällt auf die erste zurück). */
export function useActiveClass(): { cls?: SchoolClass; loading: boolean } {
  const id = useActiveClassId()
  const classes = useClasses()
  if (!classes) return { loading: true }
  const found = classes.find((c) => c.id === id)
  if (!found && classes[0] && id !== classes[0].id) queueMicrotask(() => setActiveClassId(classes[0].id))
  return { cls: found ?? classes[0], loading: false }
}

export function useStudents(classId?: string): Student[] {
  return (
    useLiveQuery(
      async () =>
        classId
          ? alive(await db.students.where('classId').equals(classId).toArray()).sort((a, b) => a.firstName.localeCompare(b.firstName))
          : [],
      [classId],
    ) ?? []
  )
}

export function useObservations(classId?: string): Observation[] {
  return (
    useLiveQuery(
      async () =>
        classId ? alive(await db.observations.where('classId').equals(classId).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [],
      [classId],
    ) ?? []
  )
}

/** Kompetenzen passend zur Jahrgangsstufe der Klasse. */
export function useCompetencies(cls?: SchoolClass): Competency[] {
  return (
    useLiveQuery(async () => {
      if (!cls) return []
      const band = bandFor(cls.gradeLevel)
      return alive(await db.competencies.where('band').equals(band).toArray()).sort(compareCompetencies)
    }, [cls?.id, cls?.gradeLevel]) ?? []
  )
}

/** Klasse eines bestimmten Datensatzes (nicht unbedingt die aktive). */
export function useClass(id?: string): SchoolClass | undefined {
  return useLiveQuery(async () => {
    if (!id) return undefined
    const c = await db.classes.get(id)
    return c && !c.deleted ? c : undefined
  }, [id])
}
