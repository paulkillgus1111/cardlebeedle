import type { ClassColor, SchoolClass } from './db'
import { CLASS_COLORS } from './db'

/** Statische Tailwind-Klassen je Klassenfarbe (müssen ausgeschrieben sein). */
const MAP: Record<ClassColor, { dot: string; soft: string; ring: string; text: string }> = {
  teal: { dot: 'bg-teal-500', soft: 'bg-teal-500/12 text-teal-700', ring: 'ring-teal-500/40', text: 'text-teal-600' },
  sky: { dot: 'bg-sky-500', soft: 'bg-sky-500/12 text-sky-700', ring: 'ring-sky-500/40', text: 'text-sky-600' },
  violet: { dot: 'bg-violet-500', soft: 'bg-violet-500/12 text-violet-700', ring: 'ring-violet-500/40', text: 'text-violet-600' },
  amber: { dot: 'bg-amber-500', soft: 'bg-amber-500/14 text-amber-700', ring: 'ring-amber-500/40', text: 'text-amber-600' },
  rose: { dot: 'bg-rose-500', soft: 'bg-rose-500/12 text-rose-700', ring: 'ring-rose-500/40', text: 'text-rose-600' },
  lime: { dot: 'bg-lime-500', soft: 'bg-lime-500/14 text-lime-700', ring: 'ring-lime-500/40', text: 'text-lime-600' },
  orange: { dot: 'bg-orange-500', soft: 'bg-orange-500/12 text-orange-700', ring: 'ring-orange-500/40', text: 'text-orange-600' },
  indigo: { dot: 'bg-indigo-500', soft: 'bg-indigo-500/12 text-indigo-700', ring: 'ring-indigo-500/40', text: 'text-indigo-600' },
  pink: { dot: 'bg-pink-500', soft: 'bg-pink-500/12 text-pink-700', ring: 'ring-pink-500/40', text: 'text-pink-600' },
  emerald: { dot: 'bg-emerald-500', soft: 'bg-emerald-500/12 text-emerald-700', ring: 'ring-emerald-500/40', text: 'text-emerald-600' },
}

/** Farbe einer Klasse/Gruppe – ohne gespeicherte Farbe stabil aus der ID abgeleitet. */
export function classColor(c?: Pick<SchoolClass, 'id' | 'color'>) {
  if (!c) return MAP.teal
  const key = (c.color as ClassColor) in MAP ? (c.color as ClassColor) : CLASS_COLORS[[...c.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % CLASS_COLORS.length]
  return MAP[key]
}

export { CLASS_COLORS }
