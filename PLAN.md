# Lehrer-App: Plan (Alles-in-einem, persönlicher Gebrauch)

Stand: 24.11.2026. Grundlage sind 8 parallele Recherchen zu den beliebtesten Lehrer-Tools: Organizer, Schülerdokumentation, Klassenraum-Tools, Unterrichtsplanung, Noten, Elternkommunikation, KI-Assistenten und Tech-Stack.

## 1. Was wir uns von wem abschauen

| Bereich | Vorbilder | Was wir übernehmen |
|---|---|---|
| Organizer / Notenbuch | TeacherTool, iDoceo, TeacherStudio, Lehrmeister, Bunt | Der **Sitzplan ist der Startbildschirm**: Schüler antippen und Note, Bemerkung oder Fehlzeit erfassen. Dazu flexible Gewichtung und Checklisten (Rücklauf, Hausaufgaben) |
| Schülerdokumentation | Seesaw, ClassDojo, Evidence for Learning, DocuDiary, Förderplaner, Kita-Portfolios | Schnelle Einträge mit Typ, Tags und Medien. Timeline, Kompetenzraster mit Trend, Förderziele, Elterngespräch-Modus |
| Klassenraum | Classroomscreen, Wheel of Names, Bouncy Balls, Flippity | Ein Dashboard mit frei anordenbaren Widgets im Beamer-Modus: Zufallsauswahl, Gruppen, Timer, Lärmampel, Arbeitssymbole |
| Planung | Common Curriculum, Planbook, Teachino, WebUntis | Stoffverteilung, dann Einheit, dann Stunde. **Bump/Verschieben entlang des echten Stundenplans**, Ferien-Import, Übernahme ins nächste Schuljahr |
| Noten | Notenrechner, Schoology, CoGrader, Plickers/Socrative | Notenskalen (1–6 mit Tendenz, 0–15 Punkte, eigene), Klassenarbeit pro Aufgabe, Notenspiegel, Zeugnisnoten-Vorschlag |
| Eltern | SchoolFox, ParentSquare, SchoolCloud | Kontaktlog, Gesprächsprotokolle mit Vereinbarungen und Wiedervorlage, Rücklaufkontrolle, Briefvorlagen, Sprechtag-Planer |
| KI | MagicSchool, fobizz, Brisk, to-teach, Khanmigo | **Mit den eigenen Daten**: Zeugnisbemerkungen, Elterngespräch-Briefing, Elternmails, Differenzierung, Arbeitsblätter |

**Unser Vorteil gegenüber allen:** Die KI-Tools der Konkurrenz kennen die Schüler nicht. Man muss den Kontext jedes Mal neu hineinkopieren. Bei uns liegen Notizen, Noten und Verlauf schon in der App. Die KI kann deshalb echte, personalisierte Entwürfe liefern.

## 2. Module

### M1: Stammdaten
- Schuljahre und Halbjahre, Klassen bzw. Kurse (Fach, Jahrgang), Schüler (Foto, Eltern-Kontakte, Geburtstag, Besonderheiten)
- CSV-Import von Klassenlisten. Versetzen ins neue Schuljahr

### M2: Schülerakte und Entwicklungsverlauf (Pflichtmodul, Kernstück)
**Einträge** mit folgenden Feldern: Schüler (einer oder mehrere), Datum, Typ, Text, Tags, Kompetenzbezug, Bewertung, Wertung (positiv / neutral / Sorge), Anhänge (Foto, Audio, Datei), Quelle (Unterricht, Pause, Gespräch …), optionale Wiedervorlage.

**Eintragstypen:**
- Beobachtung
- Lernfortschritt
- Verhalten (+/−)
- Vorfall (was, wo, wer, Maßnahme, Eltern informiert?)
- Stärke
- Förderbedarf
- Gespräch / Elternkontakt
- Arbeitsprobe (Foto)

**Erfassung**, die in 2 Taps erledigt sein muss:
- Aus Sitzplan oder Klassenliste: Schüler wählen, dann einen Vorlagen-Tag
- Sprachmemo mit Transkription, Foto von Schülerarbeiten, Textbausteine
- Offline-fähig
- **Abdeckungs-Anzeige:** „Wen habe ich seit X Tagen nicht beobachtet?“ Die App schlägt Fokus-Schüler vor

**Kompetenzraster:**
- Hierarchisch aufgebaut: Fach, dann Bereich, dann Kompetenz
- Frei editierbar, z. B. aus Lehrplan oder Zeugnis-Kriterien
- 4-stufige Skala: nicht / teilweise / überwiegend / sicher erreicht

**Ansichten:**
1. Timeline pro Schüler, filterbar nach Typ, Tag, Kompetenz, Wertung und Zeitraum, mit Halbjahrs-Trenner
2. Heatmap: Kompetenzen × Zeiträume
3. Trendlinie pro Kompetenz. Die Belege erscheinen als anklickbare Punkte
4. Verhaltenstrend: positive Einträge gegen Sorgen pro Woche, Häufungen nach Wochentag oder Stunde
5. Vergleich zweier Zeiträume (z. B. Herbst gegen Frühjahr) mit Delta pro Kompetenz
6. Förderziele-Board: Ziel, Maßnahmen, Evaluationstermin, Status

**Elterngespräch-Modus:**
- **Vorbereitung:**
  - Zeitraum wählen. Standard ist „seit dem letzten Gespräch“
  - Die App erzeugt automatisch ein Briefing mit den Abschnitten Stärken, Lernentwicklung pro Fach, Arbeits- und Sozialverhalten, Unterstützungsbedarf
  - Dazu: Notenstand und -trend, die 3–5 wichtigsten Belege (Fotos, Zitate), Mini-Charts und den Status der offenen Vereinbarungen vom letzten Mal
- **Gesprächspunkte:**
  - Sortierbare Checkliste, die mit einer Stärke beginnt
  - Pro Punkt eine Frage an die Eltern
  - Punkte lassen sich als „nicht ansprechen“ markieren
- **Zwei Ansichten:** eine private Lehrer-Ansicht und eine elterntaugliche Präsentationsansicht. Letztere zeigt nur freigegebene Einträge und eignet sich für Tablet oder PDF
- **Während des Gesprächs:**
  - Live-Notizen, ein eigenes Feld für die Sicht der Eltern
  - Neue Vereinbarungen festhalten: wer, was, bis wann, mit Erinnerung
- **Danach:**
  - Ein Protokoll-PDF, auch zum Unterschreiben
  - Das Briefing wird als Snapshot eingefroren
  - Vereinbarungen erscheinen auf dem Dashboard und im nächsten Briefing („erledigt?“)

### M3: Noten
- **Kategorienbaum:** schriftlich / mündlich / sonstige, mit Gewichten (Verhältnis oder %)
- **Berechnungsmodi pro Kategorie:** Schnitt, schlechteste N streichen, letzte Note zählt mehr
- **Notenskalen als Plugins:**
  - 1–6 mit +/− (Abstufung einstellbar: 0,25 oder 0,33; Eingaben wie „2-3“ erlaubt)
  - 0–15 Punkte
  - %-Werte, Symbole (++/+/o/−/−−), Kompetenzstufen
  - Sonderzeichen, die nicht in den Schnitt eingehen: entschuldigt, nachschreiben, Täuschung
- **Klassenarbeit:**
  - Aufgaben und Teilaufgaben mit Punkten, optional mit Anforderungsbereich (AFB) und Kompetenz, dazu der Erwartungshorizont
  - Tastatur-Raster Schüler × Aufgaben mit halben Punkten
  - Notenschlüssel-Vorlagen: linear, IHK, 50 %-Grenze, Abitur
  - Notenspiegel mit Schnitt und Warnung bei mehr als 1/3 Noten 5/6
  - Fehleranalyse pro Aufgabe bzw. Kompetenz
  - Rückmeldebogen-PDF pro Schüler
  - Nachschreiber nachtragen
- **Mündliche Noten:** im Sitzplan antippen und +/o/− oder eine Note vergeben. Modus „Stunde bewerten“. Anzeige „zuletzt bewertet vor X Tagen“
- **Zeugnisnoten-Vorschlag:**
  - Der Rechenweg ist sichtbar, die Rundungsregel konfigurierbar
  - Überschreiben ist möglich, mit Begründung
  - Noten lassen sich festschreiben. Export als CSV bzw. Druckliste
- **Rubrics:** Kriterien × Stufen mit Kommentarbank
- **Formative Checks:** Exit-Ticket und Umfrage. Sie zählen nur für die Note, wenn man sie ausdrücklich übernimmt
- **Statistiken:** Notenverlauf pro Schüler, Verteilung in der Klasse, Kompetenz-Heatmap, Risiko-Flag (Prognose 5/6 oder fallender Trend)
- Alle Regeln liegen in der Konfiguration, nicht im Code (Bundesland, Schule, Fach)

### M4: Unterrichtsplanung und Klassenbuch
- **Schuljahr:**
  - Ferien und Feiertage des Bundeslands per iCal-Import
  - Tage ohne Unterricht: Wandertag, Projektwoche, Konferenz
- **Stundenplan:** mit A/B-Wochen. Optional Import aus Untis bzw. per iCal. Die einzelnen Stunden werden daraus erzeugt
- **Drei Ebenen:**
  - Stoffverteilungsplan: Einheiten mit geplanter Stundenzahl und Lehrplanbezug
  - Einheit
  - Stunde: Ziel, Verlaufsplan (Phase / Zeit / Sozialform / Medien), Material
- **Bump/Verschieben:**
  - Fällt eine Stunde aus, rutscht alles entlang des echten Stundenplans nach hinten
  - Dabei wird nie etwas gelöscht. Was überläuft, landet in einer Puffer-Liste
  - Anzeige „Einheit X liegt 3 Stunden hinter Plan“
- **Wiederverwendung:**
  - Vorlagen für Stunden und Einheiten
  - Materialbibliothek mit Tags
  - Kurs ins nächste Jahr übernehmen: Die Reihenfolge bleibt, die Termine werden neu berechnet. Die Notizen „so lief es tatsächlich“ bleiben erhalten
- **Persönliches Klassenbuch pro Stunde:**
  - Unterrichtsstoff (mit 1 Tap aus der Planung)
  - Hausaufgaben mit Fälligkeit und Kontrolle, wer sie hat
  - Anwesenheit (anwesend / fehlt / verspätet / entschuldigt)
  - Notizen
- Kalender mit Tag-, Wochen-, Monats- und Jahresansicht
- Aufgaben/To-dos mit Fälligkeit. Natürliche Eingabe wie „Freitag Zettel 7b einsammeln“

### M5: Klassenraum-Tools (Beamer-Modus)
- **Muss:**
  - Zufallsauswahl (Rad und Schnellauswahl, ohne Wiederholung, Abwesende automatisch ausgeschlossen)
  - Gruppengenerator (nach Anzahl oder Größe, nie/immer zusammen, nach Leistung mischen, per Drag nachkorrigieren)
  - Timer und visueller Timer (+1 min), Uhr
  - Lärmampel (Empfindlichkeitsregler, Bälle-Metapher)
  - Ampel und Arbeitssymbole (Flüsterarbeit, Partnerarbeit, Stillarbeit …)
- **Sitzplan:**
  - Raum-Editor, Schüler per Drag & Drop platzieren
  - Mischen mit Regeln (vorne sitzen, auseinandersetzen)
  - Druck bzw. PDF
  - Dient zugleich als Tipp-Oberfläche für Anwesenheit, Mitarbeit und Notizen
- **Dashboard:** Widgets frei anordnen und in der Größe ändern, Vollbild. Gespeicherte Presets pro Routine („Stundenbeginn“, „Gruppenarbeit“)
- **Soll:**
  - Punkte für Klasse oder Teams (ClassDojo-light)
  - Textanzeige, Zeichnen, Bild/Embed
  - Würfel, Scoreboard
  - Tastaturkürzel
- **Kann:**
  - Umfrage bzw. Exit-Ticket per QR-Code am Schülerhandy
  - Handy als Fernbedienung für den Beamer
  - Quiz-Show und Karteikarten

### M6: Eltern
- **Kontaktlog:**
  - Datum, Schüler, Person, Kanal, Initiative, Thema
  - Filter wie „seit X Wochen kein Kontakt“ oder „bisher nur negative Kontakte“
- **Gesprächsprotokolle:** Teil von M2. Vereinbarungen mit Wiedervorlage
- **Rücklaufkontrolle:**
  - Liste pro Zettel bzw. Geldbetrag mit Häkchen (1 Tap)
  - Liste der Fehlenden, daraus automatisch ein Erinnerungsbrief
- **Brief- und Mailvorlagen:**
  - Platzhalter wie {Vorname}, {Klasse}, {Anrede_Eltern} …
  - Serienbrief als PDF oder als mailto-Entwurf
  - Jeder Versand erzeugt automatisch einen Eintrag im Kontaktlog
- **Elternsprechtag-Planer:**
  - Slots, Pausen, Prioritätenliste
  - Persönlicher Ablaufplan
  - Notizen aus einem Slot fließen direkt ins Protokoll

### M7: KI-Assistent (Claude API, mit den eigenen Daten)
Rangfolge nach Nutzen:
1. **Zeugnisbemerkungen:** aus Noten, Einträgen und den Einschätzungen zu Arbeits- und Sozialverhalten. Für die ganze Klasse auf einmal, Ton und Länge wählbar
2. **Elterngespräch:** Briefing vorher. Danach werden aus Stichpunkten ein Protokoll und To-dos
3. **Elternbriefe und -mails** mit Schülerdaten (Lob, Leistungsabfall, fehlende Hausaufgaben)
4. **Klassen-Snapshot:** „Wie läuft es in der 7b?“ Risiko-Schüler und wer lange nicht beobachtet wurde
5. Differenzierung bzw. Textvereinfachung von Material. Das Ergebnis wird in der Bibliothek gespeichert und mit dem Original verknüpft
6. Arbeitsblatt und Quiz zum Stundenthema
7. Feedback-Entwurf zu Schülertexten anhand einer Rubric
8. Entwurf eines Förderplans aus dem Beobachtungsverlauf
9. Stoffverteilungsplan-Entwurf: aus Themen, Stundenzahl und Kalender
10. Allgemeiner Chat mit Zugriff auf die App-Daten

Für alle KI-Funktionen gilt: Die KI schreibt nur Entwürfe, die man immer bearbeiten kann, und benotet nie selbst. Jede Ausgabe ist mit ihren Quelldaten verknüpft.

### M8: Dashboard (Startseite)
- **Heute:** Stunden laut Stundenplan mit der geplanten Stunde
- Offene Vereinbarungen und Wiedervorlagen, fällige To-dos, offene Rückläufe
- Korrektur-Rückstand
- Hinweise „lange nicht beobachtet“ und „lange nicht mündlich bewertet“
- Geburtstage

### Querschnitt
- Globale Suche über alle Bereiche
- Export: PDF (Schülerakte, Protokolle, Notenspiegel), CSV/Excel, ein komplettes JSON-Backup
- Papierkorb und Änderungshistorie bei Noten
- Läuft auf Laptop, iPad und Handy. Offline im Klassenzimmer

## 3. Tech-Stack

| Ebene | Wahl |
|---|---|
| Frontend | Vite + React 19 + TypeScript + TanStack Router (reine SPA, als PWA installierbar) |
| UI | shadcn/ui (Tailwind v4 + Radix), lucide-react, sonner |
| Backend | Supabase (Postgres, Auth mit E-Mail-Code, Storage, Edge Functions). Ist schon in `.mcp.json` konfiguriert |
| Offline/Sync | PowerSync (Supabase-Connector). Last-write-wins reicht, da es nur einen Nutzer gibt |
| KI | Claude API über eine Supabase Edge Function. Der Key bleibt auf dem Server, Antworten werden gestreamt |
| Bibliotheken | Recharts (Charts), @react-pdf/renderer (PDF), Tiptap (Rich Text), Schedule-X (Kalender), dnd-kit (Sitzplan/Drag), react-hook-form + Zod, date-fns |
| Medien | Privater Storage-Bucket. Fotos werden auf dem Gerät komprimiert, Audio per MediaRecorder (AAC). Offline-Upload-Queue |
| Hosting | Vercel (statische App) |

Da die App nur für den persönlichen Gebrauch ist, entfallen Pseudonymisierung und Lösch-Workflows. Trotzdem gibt es einen Login (nur ich), RLS auf allen Tabellen und Backups.

## 4. Datenmodell (Supabase)
Jede Tabelle hat die Spalten `id`, `user_id`, `created_at`, `updated_at` und `deleted_at`.

- **Stamm:** `school_years`, `terms`, `classes`, `students`, `class_enrollments`, `guardians`
- **Doku:** `entries`, `entry_students`, `tags`, `entry_tags`, `competencies`, `competency_ratings`, `goals`, `goal_measures`, `conferences`, `agreements`, `attachments`
- **Noten:** `grade_scales`, `grade_categories`, `assessments`, `assessment_tasks`, `task_scores`, `grades`, `grading_keys`, `rubrics`, `final_grades`
- **Planung:** `timetable_slots`, `calendar_days` (Ferien/Ausfall), `units`, `lessons`, `lesson_log`, `homework`, `homework_checks`, `attendance`, `materials`, `templates`, `todos`
- **Klassenraum:** `rooms`, `seating_plans`, `seat_assignments`, `widget_presets`, `points`
- **Eltern:** `contacts_log`, `checklists`, `checklist_items`, `letter_templates`, `conference_days`, `conference_slots`
- **KI:** `ai_runs` (Prompt, Ausgabe, Quellreferenzen), `settings`

## 5. Umsetzung in Phasen

| Phase | Inhalt | Ergebnis |
|---|---|---|
| **0 Setup** | Repo-Gerüst, Supabase-Projekt (EU), Auth, PowerSync, PWA, Design-System, CI/Deploy | Leere App, installierbar, Login funktioniert |
| **1 Fundament** | M1 Stammdaten, Stundenplan, Sitzplan (Editor und Tipp-Oberfläche), Anwesenheit | Tagesgeschäft im Unterricht |
| **2 Schülerakte** ⭐ | M2 komplett: Schnellerfassung, Medien, Timeline, Kompetenzen, Trends, Förderziele, Elterngespräch-Modus + PDF | Das Pflichtmodul ist fertig |
| **3 Noten** | M3: Skalen, Kategorien, mündlich, Klassenarbeit, Notenspiegel, Zeugnisvorschlag. Noten fließen ins Elterngespräch-Briefing ein | Ersetzt das Notenbuch |
| **4 Planung** | M4: Ferien, Einheiten, Stunden, Bump, Klassenbuch, Hausaufgaben, Material, To-dos, M8 Dashboard | Ersetzt den Lehrerkalender |
| **5 Klassenraum** | M5: Widgets, Beamer-Dashboard, Presets | Ersetzt Classroomscreen |
| **6 Eltern** | M6: Kontaktlog, Rücklauf, Vorlagen, Sprechtag | Komplette Elternarbeit |
| **7 KI** | M7 in der Rangfolge oben, beginnend mit Zeugnisbemerkungen und Elterngespräch-Briefing | Der eigentliche Vorsprung |
| **8 Feinschliff** | Suche, Exporte, Backup, Untis-Import, Tastaturkürzel, Performance auf dem iPad | |

Phase 2 kommt bewusst vor den Noten, weil die Schülerakte das Pflichtmodul ist. Die Notendaten werden danach in das schon vorhandene Briefing eingehängt.

## 6. Offene Fragen an dich
1. Welches Bundesland, welche Schulform und welche Fächer? Davon hängen Notenskalen, Rundung, Ferien und Kompetenzraster ab.
2. Auf welchen Geräten arbeitest du hauptsächlich im Unterricht: iPad, Laptop oder Handy?
3. Nutzt die Schule WebUntis o. ä.? Dann lohnt sich der Import des Stundenplans.
4. Wie viele Klassen bzw. Schüler ungefähr?
5. Sollen wir mit Phase 0 + 1 + 2 direkt loslegen?
