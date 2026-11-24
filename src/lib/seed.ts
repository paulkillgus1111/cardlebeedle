import { db, now, uid, type Competency, type GradeLevel, type QuickTemplate, type ObsKind } from './db'

/** Fächer der bayerischen Grundschule je Jahrgangsstufe (LehrplanPLUS). */
export const SUBJECTS_BY_GRADE: Record<GradeLevel, string[]> = {
  1: ['Deutsch', 'Mathematik', 'HSU', 'Kunst', 'Musik', 'Sport', 'Werken und Gestalten', 'Religion/Ethik'],
  2: ['Deutsch', 'Mathematik', 'HSU', 'Kunst', 'Musik', 'Sport', 'Werken und Gestalten', 'Religion/Ethik'],
  3: ['Deutsch', 'Mathematik', 'HSU', 'Englisch', 'Kunst', 'Musik', 'Sport', 'Werken und Gestalten', 'Religion/Ethik'],
  4: ['Deutsch', 'Mathematik', 'HSU', 'Englisch', 'Kunst', 'Musik', 'Sport', 'Werken und Gestalten', 'Religion/Ethik'],
}

export const bandFor = (g: GradeLevel): '1/2' | '3/4' => (g <= 2 ? '1/2' : '3/4')

/** Was die Jahrgangsstufe für Leistungsrückmeldung/Gespräche bedeutet (konfigurierbar gedacht). */
export function gradeProfile(g: GradeLevel) {
  return {
    legPossible: g <= 3, // LEG ersetzt Zwischenzeugnis in Jgst. 1–3 (§ 15 Abs. 7 GrSO)
    verbalOnly: g === 1, // Jgst. 1: nur verbale Beurteilung
    uebertritt: g === 4,
  }
}

export const KIND_LABEL: Record<ObsKind, string> = {
  beobachtung: 'Beobachtung',
  lernstand: 'Lernstand',
  arbeitsverhalten: 'Lern- & Arbeitsverhalten',
  sozialverhalten: 'Sozialverhalten',
  staerke: 'Stärke',
  foerderbedarf: 'Förderbedarf',
  vorfall: 'Vorfall',
  zitat: 'Zitat / Lerngespräch',
  arbeitsprobe: 'Arbeitsprobe',
  elternkontakt: 'Elternkontakt',
  diagnose: 'Diagnose',
}

export const LEVEL_LABEL = ['', 'nicht', 'teilweise', 'überwiegend', 'sicher'] as const

type Seed = [subject: string, band: '1/2' | '3/4', area: string, items: string[]]

/**
 * Startraster in Anlehnung an LehrplanPLUS Grundschule Bayern (Lernbereiche).
 * Formulierungen sind verkürzt und frei editierbar – kein amtlicher Wortlaut.
 */
const COMPETENCY_SEED: Seed[] = [
  ['Mathematik', '1/2', 'Zahlen und Operationen', [
    'Zahlen bis 20 darstellen, vergleichen und ordnen',
    'Zahlen bis 10 zerlegen (Zahlzerlegung)',
    'Addieren/Subtrahieren im ZR 20 mit Zehnerübergang',
    'Nicht zählend rechnen (Strategien statt Abzählen)',
    'Zahlen bis 100 darstellen und im Stellenwert verstehen',
    'Addieren/Subtrahieren im ZR 100',
    'Verdoppeln und Halbieren',
    'Kernaufgaben des Einmaleins und Umkehraufgaben',
    'Rechenwege beschreiben und vergleichen',
  ]],
  ['Mathematik', '1/2', 'Raum und Form', [
    'Lagebeziehungen beschreiben (links, rechts, über, unter)',
    'Ebene Figuren erkennen und benennen',
    'Muster erkennen und fortsetzen',
    'Achsensymmetrie erkennen',
  ]],
  ['Mathematik', '1/2', 'Größen und Messen', [
    'Mit Geld rechnen (€, ct)',
    'Längen schätzen und messen (cm, m)',
    'Uhrzeit ablesen (volle/halbe Stunde, Minuten)',
    'Einfache Sachaufgaben lösen',
  ]],
  ['Mathematik', '1/2', 'Daten und Zufall', [
    'Daten in Strichlisten und Tabellen erfassen',
    'Ereignisse als sicher, möglich, unmöglich beschreiben',
  ]],
  ['Mathematik', '3/4', 'Zahlen und Operationen', [
    'Zahlen bis 1000 / bis 1 Million im Stellenwertsystem verstehen',
    'Halbschriftlich rechnen (alle Grundrechenarten)',
    'Schriftliche Addition und Subtraktion',
    'Schriftliche Multiplikation',
    'Schriftliche Division',
    'Überschlagen und Ergebnisse prüfen',
    'Rechengesetze und Rechenvorteile nutzen',
  ]],
  ['Mathematik', '3/4', 'Raum und Form', [
    'Körper erkennen und beschreiben (Würfel, Quader …)',
    'Würfelnetze erkennen',
    'Figuren spiegeln und Symmetrien nutzen',
    'Flächeninhalt und Umfang vergleichen',
  ]],
  ['Mathematik', '3/4', 'Größen und Messen', [
    'Längen, Gewichte, Zeit und Hohlmaße umrechnen',
    'Sachaufgaben mit Größen lösen',
    'Maßstab anwenden',
  ]],
  ['Mathematik', '3/4', 'Daten und Zufall', [
    'Diagramme lesen und erstellen',
    'Gewinnchancen vergleichen',
  ]],
  ['Mathematik', '1/2', 'Prozessbezogene Kompetenzen', [
    'Problemlösen', 'Kommunizieren', 'Argumentieren', 'Modellieren', 'Darstellen',
  ]],
  ['Mathematik', '3/4', 'Prozessbezogene Kompetenzen', [
    'Problemlösen', 'Kommunizieren', 'Argumentieren', 'Modellieren', 'Darstellen',
  ]],
  ['Deutsch', '1/2', 'Sprechen und Zuhören', [
    'Verständlich erzählen',
    'Aufmerksam zuhören und nachfragen',
    'Gesprächsregeln einhalten',
  ]],
  ['Deutsch', '1/2', 'Schreiben', [
    'Buchstaben formklar schreiben',
    'Lautgetreu schreiben',
    'Wörter des Grundwortschatzes richtig schreiben',
    'Kurze eigene Texte verfassen',
  ]],
  ['Deutsch', '1/2', 'Lesen – mit Texten und weiteren Medien umgehen', [
    'Laut-Buchstaben-Zuordnung sicher',
    'Silben und Wörter erlesen',
    'Kurze Texte sinnentnehmend lesen',
    'Flüssig vorlesen',
  ]],
  ['Deutsch', '1/2', 'Sprachgebrauch und Sprache untersuchen', [
    'Nomen, Verben, Adjektive unterscheiden',
    'Satzschlusszeichen setzen',
  ]],
  ['Deutsch', '3/4', 'Sprechen und Zuhören', [
    'Vortragen und präsentieren',
    'Gespräche führen und Meinungen begründen',
  ]],
  ['Deutsch', '3/4', 'Schreiben', [
    'Texte planen, schreiben und überarbeiten',
    'Rechtschreibstrategien anwenden',
    'Grundwortschatz sicher schreiben',
    'Im Wörterbuch nachschlagen',
  ]],
  ['Deutsch', '3/4', 'Lesen – mit Texten und weiteren Medien umgehen', [
    'Lesestrategien anwenden',
    'Texte verstehen und Informationen entnehmen',
    'Flüssig und betont lesen',
    'Medien gezielt nutzen',
  ]],
  ['Deutsch', '3/4', 'Sprachgebrauch und Sprache untersuchen', [
    'Wortarten bestimmen',
    'Satzglieder bestimmen',
    'Zeitformen verwenden',
    'Wörtliche Rede zeichensetzen',
  ]],
]

const QUICK_SEED: [string, ObsKind, 'pos' | 'neu' | 'neg'][] = [
  ['arbeitet konzentriert', 'arbeitsverhalten', 'pos'],
  ['arbeitet selbstständig', 'arbeitsverhalten', 'pos'],
  ['meldet sich aktiv', 'arbeitsverhalten', 'pos'],
  ['hilft anderen', 'sozialverhalten', 'pos'],
  ['tolle Idee / Strategie', 'staerke', 'pos'],
  ['braucht Unterstützung', 'foerderbedarf', 'neu'],
  ['abgelenkt', 'arbeitsverhalten', 'neg'],
  ['Material fehlt', 'arbeitsverhalten', 'neg'],
  ['Hausaufgabe fehlt', 'arbeitsverhalten', 'neg'],
  ['stört / Regel nicht beachtet', 'sozialverhalten', 'neg'],
  ['Konflikt', 'vorfall', 'neg'],
]

/** Abschnitte des LEG-Dokumentationsbogens in Anlehnung an das ISB-Muster. */
export const LEG_SECTIONS: { id: string; title: string; hint: string }[] = [
  { id: 'sozial', title: 'Sozialverhalten', hint: 'Umgang mit anderen, Regeln, Konflikte, Hilfsbereitschaft' },
  { id: 'lernarbeit', title: 'Lern- und Arbeitsverhalten', hint: 'Konzentration, Selbstständigkeit, Sorgfalt, Ausdauer, Arbeitstempo' },
  { id: 'deutsch', title: 'Leistungsstand Deutsch', hint: 'Sprechen, Lesen, Schreiben, Rechtschreibung' },
  { id: 'mathe', title: 'Leistungsstand Mathematik', hint: 'Zahlen und Operationen, Raum und Form, Größen, Daten' },
  { id: 'weitere', title: 'Weitere Fächer', hint: 'HSU, Englisch, Musik, Kunst, Sport …' },
  { id: 'ziele', title: 'Vereinbarte Ziele (1–3)', hint: 'Kindgerecht formuliert: „Ich übe …“' },
  { id: 'unterstuetzung', title: 'So unterstützen wir', hint: 'Was tun Kind, Eltern, Lehrkraft?' },
]

export async function ensureSeed() {
  const seeded = await db.meta.get('seeded-v1')
  if (seeded) return
  const t = now()
  const comps: Competency[] = []
  for (const [subject, band, area, items] of COMPETENCY_SEED) {
    for (const text of items) {
      comps.push({ id: uid(), subject, band, area, text, builtin: true, updatedAt: t, dirty: 1 })
    }
  }
  const quick: QuickTemplate[] = QUICK_SEED.map(([label, kind, valence], i) => ({
    id: uid(), label, kind, valence, order: i, updatedAt: t, dirty: 1,
  }))
  await db.transaction('rw', db.competencies, db.quickTemplates, db.meta, async () => {
    await db.competencies.bulkPut(comps)
    await db.quickTemplates.bulkPut(quick)
    await db.meta.put({ key: 'seeded-v1', value: t })
  })
}
