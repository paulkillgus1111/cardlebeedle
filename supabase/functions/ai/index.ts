// KI-Assistent des Lehrer-Cockpits (Supabase Edge Function, Deno).
// Der API-Key liegt ausschließlich als Secret ANTHROPIC_API_KEY auf dem Server.
import Anthropic from 'npm:@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
const MODEL = 'claude-opus-5-5'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BASE = `Du unterstützt eine Grundschullehrkraft in Bayern (Klassenlehrkraft, LehrplanPLUS) bei der Dokumentation von Beobachtungen.
Schreibe auf Deutsch, sachlich, wertschätzend und stärkenorientiert. Erfinde nichts: Stütze dich nur auf die gelieferten Daten.
Wenn Daten fehlen, sag das knapp. Du lieferst nur Entwürfe, die Lehrkraft entscheidet.`

type Task = 'structure' | 'weekly' | 'leg' | 'report' | 'ask' | 'foerder'

const PROMPTS: Record<Task, string> = {
  structure: `Die Lehrkraft hat nach der Stunde frei diktiert. Zerlege das Diktat in einzelne Beobachtungen – eine pro Kind und Aussage (mehrere Kinder in einem Eintrag nur, wenn die Aussage für alle gilt).
Ordne Kinder nur über die gelieferte Kinderliste zu (IDs verwenden; Vornamen, Spitznamen, Tippfehler tolerant zuordnen). Kinder, die nicht eindeutig zuordenbar sind, lässt du weg und nennst sie in "unklar".
kind: beobachtung | lernstand | arbeitsverhalten | sozialverhalten | staerke | foerderbedarf | vorfall | zitat.
valence: pos | neu | neg. competencyId nur, wenn die Aussage klar zu einer gelieferten Kompetenz passt; level (1 nicht, 2 teilweise, 3 überwiegend, 4 sicher) nur, wenn das Diktat eine Einschätzung enthält, sonst 0.
text: kurze, neutrale Beobachtung in der dritten Person ohne Namen (z. B. "rechnet beim Zehnerübergang noch zählend").`,
  weekly: `Erstelle einen Wochenrückblick für die Klasse in Markdown (max. ca. 250 Wörter):
## Auffälligkeiten (Muster, gehäufte Sorgen, Fortschritte)
## Kinder, die Aufmerksamkeit brauchen (mit Begründung)
## Ohne Dokumentation diese Woche
## Fokus nächste Woche (3–4 Kinder + konkreter Beobachtungsauftrag)
## Meine Stunden (kurz, aus den Reflexionen)`,
  leg: `Formuliere Entwürfe für den Dokumentationsbogen eines Lernentwicklungsgesprächs (ISB-Muster) bzw. eines Elterngesprächs.
Für jeden angefragten Abschnitt 2–5 Sätze oder Stichpunkte. Stärken zuerst, dann Entwicklungsfelder. Für "ziele": 1–3 kindgerechte Ich-Ziele ("Ich übe …").
Abschnitte, zu denen es keine Belege gibt, mit "Keine Beobachtungen im Zeitraum." füllen.`,
  report: `Formuliere einen Zeugnistext-Entwurf für das Kind.
Jahrgangsstufe 1 und 2 (verbal): zusammenhängendes Wortgutachten mit den Teilen Sozialverhalten, Lern- und Arbeitsverhalten und Leistungsstand in den Fächern (ca. 120–200 Wörter), das Kind wird direkt mit "Du" angesprochen, wenn die Lehrkraft das so wünscht (Feld "anrede"), sonst in der dritten Person.
Jahrgangsstufe 3 und 4: Bemerkungen zum Sozial- sowie Lern- und Arbeitsverhalten (ca. 60–100 Wörter, dritte Person).
Keine Noten nennen. Nur Fließtext, keine Überschriften.`,
  ask: `Beantworte die Frage der Lehrkraft anhand der gelieferten Dokumentation. Kurz und konkret, mit Datumsbezug zu den Belegen. Markdown erlaubt.`,
  foerder: `Schlage konkrete Förderideen vor (Markdown): kurze Diagnose der Schwierigkeit, 4–6 konkrete Übungen/Materialien für die Grundschule (z. B. Material, Spielform, Sprechanlass), Differenzierung für die betroffene Gruppe, woran man Fortschritt erkennt.`,
}

const SCHEMAS: Partial<Record<Task, Record<string, unknown>>> = {
  structure: {
    type: 'object',
    additionalProperties: false,
    required: ['entries', 'unklar'],
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['studentIds', 'kind', 'valence', 'subject', 'competencyId', 'level', 'text'],
          properties: {
            studentIds: { type: 'array', items: { type: 'string' } },
            kind: { type: 'string', enum: ['beobachtung', 'lernstand', 'arbeitsverhalten', 'sozialverhalten', 'staerke', 'foerderbedarf', 'vorfall', 'zitat'] },
            valence: { type: 'string', enum: ['pos', 'neu', 'neg'] },
            subject: { type: 'string' },
            competencyId: { type: 'string' },
            level: { type: 'integer', enum: [0, 1, 2, 3, 4] },
            text: { type: 'string' },
          },
        },
      },
      unklar: { type: 'array', items: { type: 'string' } },
    },
  },
  leg: {
    type: 'object',
    additionalProperties: false,
    required: ['sections'],
    properties: {
      sections: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'text'],
          properties: { id: { type: 'string' }, text: { type: 'string' } },
        },
      },
    },
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    if (!Deno.env.get('ANTHROPIC_API_KEY')) return json({ error: 'ANTHROPIC_API_KEY fehlt in den Supabase-Secrets.' }, 500)
    const { task, data } = (await req.json()) as { task: Task; data: unknown }
    if (!PROMPTS[task]) return json({ error: `Unbekannte Aufgabe: ${task}` }, 400)
    const schema = SCHEMAS[task]

    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: task === 'structure' ? 'low' : 'medium', ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
      system: [{ type: 'text', text: `${BASE}\n\n${PROMPTS[task]}` }],
      messages: [{ role: 'user', content: `Daten (JSON):\n${JSON.stringify(data)}` }],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming)

    if (response.stop_reason === 'refusal') return json({ error: 'Die Anfrage wurde abgelehnt.' }, 422)
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    if (schema) return json({ json: JSON.parse(text) })
    return json({ text })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Zu viele Anfragen – bitte kurz warten.' }, 429)
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'Der Claude-API-Key ist ungültig.' }, 500)
    if (e instanceof Anthropic.APIError) return json({ error: `Claude-API-Fehler ${e.status}: ${e.message}` }, 502)
    return json({ error: (e as Error).message }, 500)
  }
})
