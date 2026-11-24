import type { Competency, Goal, Lesson, Observation, SchoolClass, Student } from './db'
import { KIND_LABEL, LEVEL_LABEL } from './seed'
import { supabase } from './sync'

export type AiTask = 'structure' | 'weekly' | 'leg' | 'report' | 'ask' | 'foerder'

export class AiError extends Error {}

/** Ruft die Edge Function "ai" auf (nur angemeldet möglich). */
export async function ai<T = { text: string }>(task: AiTask, data: unknown): Promise<T> {
  const { data: s } = await supabase.auth.getSession()
  if (!s.session) throw new AiError('Für KI-Funktionen bitte unter Einstellungen → Konto & Sync anmelden.')
  if (!navigator.onLine) throw new AiError('KI braucht eine Internetverbindung.')
  const { data: res, error } = await supabase.functions.invoke('ai', { body: { task, data } })
  if (error) {
    let msg = error.message
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.error) msg = body.error
    } catch {
      /* ignorieren */
    }
    throw new AiError(msg)
  }
  return res as T
}

/** Kompakte, gut lesbare Darstellung einer Beobachtung für den Prompt. */
export function obsLine(o: Observation, comps: Competency[], students?: Student[]) {
  const c = comps.find((x) => x.id === o.competencyId)
  const who = students ? o.studentIds.map((id) => students.find((s) => s.id === id)?.firstName ?? '?').join(', ') + ' | ' : ''
  return [
    o.date,
    who + KIND_LABEL[o.kind],
    o.valence === 'pos' ? 'positiv' : o.valence === 'neg' ? 'Sorge' : 'neutral',
    o.subject ?? '',
    c ? `${c.text}${o.level ? `: ${LEVEL_LABEL[o.level]}` : ''}` : '',
    o.text,
  ]
    .filter(Boolean)
    .join(' | ')
}

export function studentContext(s: Student, cls: SchoolClass, obs: Observation[], comps: Competency[], goals: Goal[]) {
  const mine = obs.filter((o) => o.studentIds.includes(s.id)).sort((a, b) => a.date.localeCompare(b.date))
  return {
    kind: `${s.firstName} ${s.lastName}`,
    klasse: cls.name,
    jahrgangsstufe: cls.gradeLevel,
    foerderstatus: s.support,
    beobachtungen: mine.map((o) => obsLine(o, comps)),
    ziele: goals.filter((g) => g.studentId === s.id).map((g) => `${g.text} (${g.status})`),
  }
}

export function classContext(cls: SchoolClass, students: Student[], obs: Observation[], comps: Competency[], lessons: Lesson[], since: string) {
  const recent = obs.filter((o) => o.date >= since)
  return {
    klasse: cls.name,
    jahrgangsstufe: cls.gradeLevel,
    zeitraum_ab: since,
    kinder: students.map((s) => s.firstName),
    beobachtungen: recent.map((o) => obsLine(o, comps, students)),
    stunden: lessons
      .filter((l) => l.date >= since)
      .map((l) => [l.date, l.subject, l.topic, l.reflection?.rating, l.reflection?.note].filter(Boolean).join(' | ')),
  }
}
