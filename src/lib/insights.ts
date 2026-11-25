import { differenceInCalendarDays, parseISO, subDays, formatISO } from 'date-fns'
import type { Competency, Goal, Observation, Student } from './db'

export const today = () => formatISO(new Date(), { representation: 'date' })
export const daysAgo = (n: number) => formatISO(subDays(new Date(), n), { representation: 'date' })
export const daysSince = (iso?: string) => (iso ? Math.max(0, differenceInCalendarDays(new Date(), parseISO(iso))) : Infinity)

export interface StudentStats {
  student: Student
  last?: string
  days: number
  count30: number
  pos30: number
  neg30: number
  /** 0..1 – wie gut ist das Kind aktuell dokumentiert */
  coverage: number
  /** Anzahl abgedeckter Bereiche (Fächer + Verhalten) in 60 Tagen */
  areas: number
}

/** Deckungsgrad: Aktualität (letzter Eintrag) + Breite (Bereiche) + Menge. */
export function studentStats(students: Student[], obs: Observation[]): StudentStats[] {
  const d30 = daysAgo(30)
  const d60 = daysAgo(60)
  return students.map((student) => {
    const mine = obs.filter((o) => o.studentIds.includes(student.id))
    const last = mine.reduce<string | undefined>((m, o) => (!m || o.date > m ? o.date : m), undefined)
    const recent = mine.filter((o) => o.date >= d30)
    const areas = new Set(
      mine.filter((o) => o.date >= d60).map((o) => (o.kind === 'arbeitsverhalten' || o.kind === 'sozialverhalten' ? o.kind : o.subject ?? o.kind)),
    ).size
    const days = daysSince(last)
    const freshness = days === Infinity ? 0 : Math.max(0, 1 - days / 21)
    const breadth = Math.min(1, areas / 4)
    const amount = Math.min(1, recent.length / 6)
    return {
      student,
      last,
      days,
      count30: recent.length,
      pos30: recent.filter((o) => o.valence === 'pos').length,
      neg30: recent.filter((o) => o.valence === 'neg').length,
      coverage: freshness * 0.5 + breadth * 0.3 + amount * 0.2,
      areas,
    }
  })
}

/** Fokus-Kinder: am längsten nicht beobachtet bzw. geringste Abdeckung, offene Ziele bevorzugt. */
export function focusChildren(stats: StudentStats[], goals: Goal[], n = 4) {
  const openGoals = new Set(goals.filter((g) => g.status === 'offen').map((g) => g.studentId))
  return [...stats]
    .sort((a, b) => a.coverage - (openGoals.has(a.student.id) ? 0.1 : 0) - (b.coverage - (openGoals.has(b.student.id) ? 0.1 : 0)))
    .slice(0, n)
}

export interface Signal {
  id: string
  tone: 'warn' | 'info' | 'good'
  text: string
  studentId?: string
  competencyId?: string
}

/** Einfache, nachvollziehbare Regeln – bewusst ohne KI. */
export function signals(students: Student[], obs: Observation[], comps: Competency[], goals: Goal[], subjects: string[] = ['Deutsch', 'Mathematik']): Signal[] {
  const out: Signal[] = []
  const d14 = daysAgo(14)
  const d30 = daysAgo(30)
  const name = (id: string) => students.find((s) => s.id === id)?.firstName

  for (const s of students) {
    const mine = obs.filter((o) => o.studentIds.includes(s.id))
    const neg14 = mine.filter((o) => o.date >= d14 && o.valence === 'neg').length
    if (neg14 >= 3) out.push({ id: `neg-${s.id}`, tone: 'warn', studentId: s.id, text: `${s.firstName}: ${neg14} kritische Einträge in 14 Tagen` })
    const last = mine.reduce<string | undefined>((m, o) => (!m || o.date > m ? o.date : m), undefined)
    const d = daysSince(last)
    if (d >= 14 && d !== Infinity) out.push({ id: `gap-${s.id}`, tone: 'info', studentId: s.id, text: `${s.firstName}: seit ${d} Tagen nicht beobachtet` })
    const behaviour = mine.filter((o) => o.date >= d30 && (o.kind === 'sozialverhalten' || o.kind === 'arbeitsverhalten'))
    if (behaviour.length >= 4 && behaviour.every((o) => o.valence === 'pos'))
      out.push({ id: `pos-${s.id}`, tone: 'good', studentId: s.id, text: `${s.firstName}: im Verhalten seit 30 Tagen nur positiv – Ziel erreicht?` })
  }

  const never = students.filter((s) => !obs.some((o) => o.studentIds.includes(s.id)))
  if (never.length)
    out.push({ id: 'never', tone: 'info', text: never.length === students.length ? 'Noch keine Beobachtungen – starte eine Stunde oder tippe auf „Beobachtung“.' : `Noch nie beobachtet: ${never.map((s) => s.firstName).join(', ')}` })

  // Kompetenzen, bei denen viele Kinder (noch) unsicher sind – jeweils letzter Stand je Kind
  const latest = latestLevels(obs.filter((o) => o.date >= d30))
  for (const c of comps) {
    const levels = students.map((s) => latest.get(`${s.id}:${c.id}`)?.level).filter((l): l is 1 | 2 | 3 | 4 => !!l)
    if (levels.length < 3) continue
    const weak = levels.filter((l) => l <= 2).length
    if (weak >= 2 && weak / levels.length >= 0.3)
      out.push({ id: `comp-${c.id}`, tone: 'warn', competencyId: c.id, text: `${weak} Kinder unsicher: ${c.text}` })
  }

  const due = goals.filter((g) => g.status === 'offen' && g.due && g.due <= today() && name(g.studentId))
  for (const g of due) out.push({ id: `goal-${g.id}`, tone: 'info', studentId: g.studentId, text: `${name(g.studentId)}: Ziel fällig – „${g.text}“` })

  for (const b of balanceIssues(students, obs, subjects)) out.push({ id: `bal-${b.studentId}-${b.text.length}`, tone: 'info', studentId: b.studentId, text: b.text })

  const order = { warn: 0, info: 1, good: 2 }
  return out.sort((a, b) => order[a.tone] - order[b.tone])
}

/** Letzte Kompetenz-Einschätzung je Kind × Kompetenz. */
export function latestLevels(obs: Observation[]) {
  const map = new Map<string, Observation>()
  for (const o of [...obs].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))) {
    if (!o.competencyId || !o.level) continue
    for (const sid of o.studentIds) map.set(`${sid}:${o.competencyId}`, o)
  }
  return map
}

export const agoText = (days: number) => (days === Infinity ? 'noch nie beobachtet' : days === 0 ? 'heute beobachtet' : days === 1 ? 'gestern beobachtet' : `zuletzt vor ${days} Tagen`)

/* ───────────── Fokus-Rotation & Balance (Fairness) ───────────── */

/**
 * Fokus-Kinder für eine Stunde: wer am längsten nicht beobachtet wurde, offene Ziele,
 * und – falls Schwerpunkt-Kompetenzen gesetzt – wer dort noch keine Einschätzung hat.
 */
export function focusRotation(students: Student[], obs: Observation[], goals: Goal[], focusCompetencyIds: string[] = [], n = 5): Student[] {
  const openGoal = new Set(goals.filter((g) => g.status === 'offen').map((g) => g.studentId))
  const score = (s: Student) => {
    const mine = obs.filter((o) => o.studentIds.includes(s.id) && !o.seenOnly)
    const last = mine.reduce<string | undefined>((m, o) => (!m || o.date > m ? o.date : m), undefined)
    const days = Math.min(60, daysSince(last))
    const missingFocus = focusCompetencyIds.filter((c) => !mine.some((o) => o.competencyId === c)).length
    return days + (openGoal.has(s.id) ? 5 : 0) + missingFocus * 4 - Math.min(10, mine.filter((o) => o.date >= daysAgo(14)).length) * 2
  }
  return [...students].sort((a, b) => score(b) - score(a)).slice(0, n)
}

export interface BalanceIssue {
  studentId: string
  text: string
}

/** Einseitige Dokumentation erkennen (nur für die Lehrkraft sichtbar). */
export function balanceIssues(students: Student[], obs: Observation[], subjects: string[]): BalanceIssue[] {
  const out: BalanceIssue[] = []
  const d42 = daysAgo(42)
  for (const s of students) {
    const mine = obs.filter((o) => o.studentIds.includes(s.id) && o.date >= d42 && !o.seenOnly)
    if (mine.length < 4) continue
    const neg = mine.filter((o) => o.valence === 'neg').length
    const pos = mine.filter((o) => o.valence === 'pos').length
    if (neg >= 3 && pos === 0) out.push({ studentId: s.id, text: `${s.firstName}: seit 6 Wochen nur kritische Einträge – gibt es Stärken?` })
    else if (pos >= 6 && neg === 0 && !mine.some((o) => o.kind === 'foerderbedarf' || o.nextStep)) out.push({ studentId: s.id, text: `${s.firstName}: nur positive Einträge – gibt es nächste Schritte?` })
    const behaviourOnly = mine.every((o) => o.kind === 'arbeitsverhalten' || o.kind === 'sozialverhalten' || o.kind === 'vorfall')
    if (behaviourOnly) out.push({ studentId: s.id, text: `${s.firstName}: nur Verhalten dokumentiert, noch kein Lernstand` })
    const covered = new Set(mine.map((o) => o.subject).filter(Boolean))
    const core = subjects.filter((x) => x === 'Deutsch' || x === 'Mathematik')
    const missing = core.filter((x) => !covered.has(x))
    if (missing.length && mine.length >= 6) out.push({ studentId: s.id, text: `${s.firstName}: seit 6 Wochen nichts in ${missing.join(' und ')}` })
  }
  return out
}
