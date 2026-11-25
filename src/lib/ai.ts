import type { Competency, Goal, Lesson, Observation, SchoolClass, Student } from './db'
import { BEHAVIOR_ITEMS, FREQUENCY_LABEL, KIND_LABEL, LEVEL_LABEL } from './seed'
import { supabase } from './sync'

export type AiTask = 'structure' | 'weekly' | 'leg' | 'report' | 'ask' | 'foerder' | 'suggest' | 'nextstep' | 'leg2' | 'report2'

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
    o.scaleItemId && o.frequency ? `${BEHAVIOR_ITEMS.find((b) => b.id === o.scaleItemId)?.text ?? ''}: ${FREQUENCY_LABEL[o.frequency]}` : '',
    o.groupWork ? 'gruppenarbeit: ja' : '',
    // Nur der beobachtete Fakt – die Deutung (interpretation) wird bewusst NICHT übergeben
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
    // Förderstatus (LRS, DaZ, MSD …) wird bewusst NICHT übergeben – verzerrt nachweislich KI-Texte
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

/** Belege mit kurzen IDs (e1, e2 …) für KI-Texte, die ihre Belege zitieren sollen. */
export function evidenceContext(obs: Observation[], comps: Competency[]) {
  const sorted = [...obs].filter((o) => !o.seenOnly).sort((a, b) => a.date.localeCompare(b.date))
  const map = new Map<string, Observation>()
  const items = sorted.map((o, i) => {
    const id = `e${i + 1}`
    map.set(id, o)
    return { id, beleg: obsLine(o, comps) }
  })
  return { items, map }
}

export interface CitedSentence {
  text: string
  evidence: string[]
}

/** Studenten-Kontext mit Beleg-IDs statt reiner Zeilen (für leg2/report2). */
export function studentEvidenceContext(s: Student, cls: SchoolClass, obs: Observation[], comps: Competency[], goals: Goal[]) {
  const mine = obs.filter((o) => o.studentIds.includes(s.id))
  const ev = evidenceContext(mine, comps)
  return {
    data: {
      kind: s.firstName,
      klasse: cls.name,
      jahrgangsstufe: cls.gradeLevel,
      belege: ev.items,
      ziele: goals.filter((g) => g.studentId === s.id).map((g) => `${g.text} (${g.status})`),
    },
    map: ev.map,
  }
}
