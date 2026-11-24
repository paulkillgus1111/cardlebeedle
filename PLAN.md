# Lehrer-App: Plan v2 (Grundschule Bayern, Klassenlehrkraft)

Stand: 24.11.2026.
- **v1:** 8 Recherchen zu den beliebtesten Lehrer-Tools.
- **v2:** dazu 3 Recherchen zu Schulmanager Online, den bayerischen Grundschul-Regeln (GrSO, LEG, Übertritt, LehrplanPLUS) und typischen Grundschul-Werkzeugen.

**Rahmen:**
- Klassenlehrkraft an einer Grundschule in Bayern. Alle Fächer, Schwerpunkt Mathe.
- Geräte: iPad (mit Pencil) im Unterricht, Laptop am Schreibtisch.
- Die Schule nutzt **Schulmanager Online**. Was der kann, bauen wir nicht nach.
- Nur für den persönlichen Gebrauch.

---

## 0. Was sich gegenüber v1 ändert

v1 war zu allgemein und teils auf die weiterführende Schule zugeschnitten. In v2 ist es so:

**Raus**, weil Schulmanager es abdeckt oder es in der Grundschule nicht vorkommt:
- Elternnachrichten, Elternbriefe mit Lesebestätigung, Krankmeldungen, Sprechtag-Buchung, Messenger, Umfragen
- offizielles Klassenbuch und Fehlzeiten, Stunden- und Vertretungsplan, Termine für Leistungsnachweise
- 0–15 Punkte, Abitur-Notenschlüssel, Anforderungsbereiche (AFB), Exit-Tickets per QR an Schülerhandys

**Neu**, das Grundschul-Spezifische:
- **Lernentwicklungsgespräch (LEG)** nach bayerischem Muster: Es ersetzt in Jgst. 1–3 das Zwischenzeugnis. Das Kind nimmt teil, am Ende stehen Ziele.
- **Mathe-Diagnose mit Fehleranalyse:** dein Hauptfach und das größte Alleinstellungsmerkmal
- **Lese- und Rechtschreibentwicklung:** Lesepass, Lesegeschwindigkeit, Grundwortschatz Bayern, Fehlerarten
- **Wortgutachten und Zeugnisbemerkungen**, der **Übertritt in Jgst. 4** (Schnitt aus D/M/HSU), Notenschutz und Nachteilsausgleich
- **Wochenplan und Stationenlernen**, Ich-kann-Listen, Portfolio
- **Klassenleben:** Ämterplan, Belohnungssystem, Morgenkreis, Klassenrat
- **Organisation:** Klassenkasse, Ausflüge, Elternabend, Vertretungsmappe
- **Apple Pencil** und **sauberer Druck**, denn Grundschulkinder arbeiten auf Papier

**Grenze zu Schulmanager:**

| Schulmanager (bleibt dort) | Unsere App (alles drumherum) |
|---|---|
| Nachrichten und Briefe an Eltern, Rückmeldungen | **Kontaktlog** pro Kind: *was* wurde *wann* besprochen. Briefe entwerfen, dann in Schulmanager einfügen |
| Krankmeldungen, offizielle Fehlzeiten | höchstens eine Notiz in der Akte, wenn auffällig |
| Sprechtag-Buchung | **Vorbereitung und Protokoll** der Gespräche |
| Klassenbuch, Stundenplan | Import des **Kalenders per iCal-Abo**. Eigene Unterrichtsplanung |
| Notenmodul (falls gebucht): Endnoten | **Arbeits-Notenbuch** mit Proben pro Aufgabe, Fehleranalyse, Rechenweg. Die Endnote überträgst du von Hand |
| Elternbriefe mit Rückmeldung | **Papier-Rücklauf** (Kakaogeld, Zettel, Bücherei) nur da, wo Schulmanager nicht passt |

---

## 1. Module

### M1: Klasse und Kinder (Fundament)
- Schuljahr, Halbjahre, Klasse mit Jahrgangsstufe. Die Jahrgangsstufe steuert, welche Funktionen aktiv sind: Jgst. 1/2 verbal, Jgst. 2 ab dem 2. Halbjahr mit Noten, Jgst. 4 mit Übertritt.
- **Fächer der Jahrgangsstufe** sind vorkonfiguriert: D, M, HSU, Englisch (3/4), Kunst, Musik, Sport, Werken und Gestalten, Religion/Ethik. DaZ optional.
- **Kinderprofil:**
  - Foto, Geburtstag, Eltern und Kontakte
  - Abholregelung, Allergien und Medikamente
  - Förderstatus: LRS, Notenschutz/Nachteilsausgleich laut Bescheid, sonderpädagogischer Förderbedarf (MSD), DaZ/Vorkurs
- Klassenliste per CSV importieren oder abtippen. Klasse mitnehmen ins nächste Schuljahr.
- **Sitzplan** als Startbildschirm im Unterricht: Raum-Editor, Gruppentische, Drag & Drop. Ein Tipp auf ein Kind öffnet das Schnellmenü (M2).

### M2: Schülerakte und Entwicklungsverlauf (Pflichtmodul, Kernstück)
**Schnellerfassung** in maximal 2 Taps (Sitzplan → Kind → Vorlage):
- Mehrere Kinder auf einmal möglich
- ✓ / ~ / ✗ oder 👍/👎, kurzer Text
- **Pencil-Notiz bzw. Skizze**
- **Foto einer Schülerarbeit**, Sprachmemo mit Transkription
- Textbausteine für Beobachtungen, die immer wieder vorkommen

**Eintragstypen:**
- Beobachtung
- Lernfortschritt (mit Kompetenz)
- Arbeitsverhalten, Sozialverhalten
- Vorfall (was, wo, wer, Maßnahme, Eltern informiert?)
- Stärke
- Förderbedarf
- Elternkontakt
- Arbeitsprobe

**Zuordnung:**
- Jeder Eintrag hat Fach, Kompetenz aus dem Raster, Wertung (positiv / neutral / Sorge) und Tags.
- Die Kategorien **Sozialverhalten** und **Lern- und Arbeitsverhalten** sind fest angelegt, weil sie wörtlich auf Zeugnis und LEG-Bogen stehen.

**Kompetenzraster nach LehrplanPLUS:**
- Fach → Lernbereich → Kompetenzerwartung, in Doppeljahrgangsstufen (1/2, 3/4).
- Mathe und Deutsch werden mit den vier Lernbereichen vorbefüllt. Den Rest pflegst du selbst; eine Download-Datei des Lehrplans gibt es nicht.
- Stufen: nicht / teilweise / überwiegend / sicher.

**Ansichten:**
1. Timeline pro Kind mit Filtern und Halbjahrs-Trennern
2. Kompetenz-Heatmap: Kind × Kompetenz bzw. Kompetenz × Zeit
3. Trendlinien pro Kompetenz. Die Belege erscheinen als Punkte und lassen sich öffnen
4. Verhaltenstrend pro Woche
5. Vergleich zweier Zeiträume (vorheriges LEG gegen heute)
6. **Abdeckung:** „Wen habe ich seit X Tagen nicht beobachtet?“ Die App schlägt täglich 3–4 Fokus-Kinder vor
7. Förderziele und Vereinbarungen als Board

### M3: Gespräche (LEG, Elterngespräch, Übertritts-Beratung)
**Lernentwicklungsgespräch** nach § 15 Abs. 7 GrSO, Jgst. 1–3:
- Ein **Bogen nach ISB-Muster** mit den Abschnitten Sozialverhalten, Lern- und Arbeitsverhalten, Leistungsstand pro Fach und 1–3 vereinbarten Lernzielen. Die Vorlage ist anpassbar, falls deine Schule einen eigenen Bogen hat.
- **Vorbereitung:**
  - Aus der Akte wird automatisch ein Entwurf pro Abschnitt erzeugt. Dazu Belege (Fotos von Arbeiten), Trend-Minicharts und die Ziele vom letzten Mal mit Status.
  - Dazu eine **Selbsteinschätzung des Kindes:** eine Ich-kann-Liste mit Smileys, auf dem iPad mit dem Kind ausgefüllt oder ausgedruckt.
- **Gesprächsansicht** am iPad: kindgerecht, zeigt nur Freigegebenes. Live-Notizen, Sicht der Eltern, Sicht des Kindes.
- **Danach:**
  - Dokumentationsbogen als PDF zum Unterschreiben
  - Die Ziele landen im Board und erscheinen beim nächsten LEG mit „erreicht?“
- **Saisonplaner:** Liste aller Kinder mit Termin, Status (vorbereitet / geführt / unterschrieben) und Fortschritt. Die LEG-Zeit liegt vor dem Zwischenzeugnis Mitte Februar.

**Elterngespräch** außerhalb des LEG (Anlass, Konflikt, Förderung):
- Briefing, Gesprächspunkte (beginnen mit einer Stärke, Punkte lassen sich als „nicht ansprechen“ markieren)
- Protokoll, Vereinbarungen mit Wiedervorlage, PDF

**Übertritts-Beratung Jgst. 4:** Siehe M4. Ein eigener Gesprächstyp mit Notenstand, Prognose und Protokoll.

**Kontaktlog:** Jeder Kontakt mit Datum, Kanal (Schulmanager, Telefon, Tür-und-Angel, Gespräch), Thema und Wertung. Filter wie „seit X Wochen kein Kontakt“ oder „bisher nur negative Kontakte“.

### M4: Leistung, Proben, Zeugnis, Übertritt
**Arbeits-Notenbuch:**
- Die Regeln sind konfigurierbar, denn die GrSO legt kein festes Verhältnis zwischen schriftlich und mündlich fest.
- Noten 1–6 mit +/− auf Proben (wird nicht aufs Zeugnis übernommen)
- In Jgst. 1 und Jgst. 2 im 1. Halbjahr **nur verbale Rückmeldung** statt Note. Die App blendet Noten dann aus.
- Kategorien pro Fach: Proben, mündlich, praktisch. Gewichtung und Rundungsregel stellst du ein.

**Probe pro Aufgabe:**
- Aufgaben und Teilaufgaben mit Punkten und Kompetenz, Tastatur-Raster Kind × Aufgabe, halbe Punkte
- **Eigener Notenschlüssel** in Prozent (keine amtliche Vorgabe), als Vorlage speicherbar
- Notenspiegel und Schnitt
- **Fehleranalyse pro Aufgabe bzw. Kompetenz.** Schwache Aufgaben fließen automatisch in die Mathe-Diagnose (M5).
- Rückmeldebogen pro Kind: kindgerecht, mit Smiley, Lob und Tipp. Dient zur Unterschrift der Eltern.
- Nachschreiber, Notenschutz-Vermerk (z. B. Rechtschreibung nicht bewertet)

**Probenzähler:**
- In Jgst. 4 sind es 18 Proben in D/M/HSU bis zum Übertrittszeugnis. Die Verteilung legt die Schule fest.
- Die App zeigt den Stand und die Wochenbelastung.

**Zeugnis:**
- **Jgst. 1 und 2 (verbal):** ein **Wortgutachten-Editor**, gegliedert in Sozialverhalten, Lern- und Arbeitsverhalten und Leistungsstand. Dazu eine Bausteinbank und ein KI-Entwurf aus der Akte (M9).
- **Jgst. 2–4:**
  - Notenvorschlag pro Fach mit sichtbarem Rechenweg. Du kannst die Note überschreiben (pädagogische Gesamtwürdigung).
  - Bemerkungen zum Verhalten
- Notenschutz-Vermerke als Hinweis
- Für alle Klassen eine Übersicht „Zeugnisstatus“: Was ist für welches Kind schon fertig?

**Übertritt Jgst. 4:**
- **Übertritts-Cockpit:** aktuelle Note in D/M/HSU, Gesamtschnitt (ungerundet), Ampel gegen die Grenzen Gymnasium ≤ 2,33 und Realschule ≤ 2,66
- „Was-wäre-wenn“ für die nächsten Proben
- Countdown bis zum Übertrittszeugnis Anfang Mai
- Protokolle der Beratungsgespräche, Hinweis auf den Probeunterricht

### M5: Mathe-Diagnose (Hauptfach, Alleinstellungsmerkmal)
**Diagnose-Checks** nach Zahlenraum (ZR 10 / 20 / 100 / 1000 / Million):
- Zählen, Zahlzerlegung, Zehnerübergang, Stellenwert
- Verdoppeln und Halbieren, Kernaufgaben des Einmaleins
- halbschriftliche und schriftliche Verfahren, Sachaufgaben, Größen, Geometrie
- Die Vorlagen orientieren sich an Kinder-Mathe-Diagnose und PIKAS / Mathe sicher können. Eigene Checks kannst du anlegen.

**Fehlerkategorien pro Aufgabe:**
- Zählfehler ±1, Stellenwertfehler, Zahlendreher, Operationswechsel, Übertrag vergessen
- „zählendes Rechnen beobachtet“, Strategie (Notiz)
- Daraus werden **Fehlermuster pro Kind und für die Klasse**. Beispiel: „6 Kinder: Übertrag bei der schriftlichen Subtraktion“

**Blitzrechnen / Einmaleins-Führerschein:**
- Raster Kind × Reihe (bzw. Übung) mit Datum, Zeit und Ergebnis
- Klassen-Heatmap, Führerschein-Urkunde zum Drucken

**Förder- und Fordergruppen:** werden dynamisch aus der Diagnose gebildet, z. B. „Zehnerübergang unsicher“ oder „Knobel-Kinder“. Wochenplan (M7) und Stationen nutzen sie direkt.

**Verlauf:** Jede Diagnose ist datiert. Du siehst die Entwicklung pro Kind und Kompetenz über die Jahre (1 → 4).

### M6: Deutsch – Lesen und Schreiben über die Zeit
**Lesen:**
- **Digitaler Lesepass:** Minuten bzw. Seiten, Häkchen für die Unterschrift der Eltern
- **Lesegeschwindigkeit:** Wörter pro Minute, mit Stoppuhr im Tool, Trendlinie
- Buch-Log, Antolin-Punkte (von Hand abgelesen), Ergebnisse von Stolperwörter-Test oder Lesescreening
- **Lautleseprotokoll** mit Fehlerarten

**Schreiben und Rechtschreibung:**
- **Grundwortschatz Bayern** als Checkliste pro Kind, mit Lernwörter-Kartei
- Diktate bzw. Lernwörter-Checks mit Fehlerzahl und Fehlerquotient
- **Fehlerarten** nach Hamburger Schreibprobe (HSP): lautgetreu, orthografisch, morphematisch, Groß-/Kleinschreibung. Mit Trend.
- Eingabe der Ergebnisse aus HSP oder Oldenburger Fehleranalyse
- Schreibproben (Foto) mit Datum im Portfolio. So lässt sich zum Beispiel „freier Text Klasse 1 gegen Klasse 2“ nebeneinander zeigen.

**Sprechen und Zuhören:** Beobachtungsvorlagen, z. B. zu Erzählkreis und Vortrag

### M7: Unterricht planen und durchführen
**Kalender:**
- Schulmanager-Kalender als **iCal-Abo** (nur lesen)
- Bayerische Ferien sind eingebaut (KM-Ferienordnung bzw. KMK-ICS). Eigene Tage wie Wandertag oder Projektwoche kommen dazu.

**Eigener Stundenplan:** Stunden pro Fach. Daraus entstehen die geplanten Stunden.

**Jahres- und Sequenzplanung:**
- Einheiten pro Fach mit Bezug zum LehrplanPLUS und geplanter Stundenzahl
- Eine Abdeckungs-Ansicht zeigt, welche Kompetenzerwartungen schon dran waren
- **Verschieben bei Ausfall:** Alle folgenden Stunden rutschen nach hinten, nichts wird gelöscht

**Stundenplanung:**
- Ziel, Verlauf (Phase / Zeit / Sozialform / Material), Differenzierung (Förder / Basis / Forder)
- Materialbibliothek mit Tags: Arbeitsblätter, Bildkarten, Links, Fotos vom Tafelbild

**Wochenplan bzw. Lernplan:**
- Pflicht- und Wahlaufgaben, Sternchen-Niveaus, pro Kind oder Gruppe
- Ausdruck als PDF fürs Kind, Abhak-Übersicht für dich

**Stationenlernen:**
- Laufzettel als PDF
- Live-Raster Kind × Station auf dem iPad

**Ich-kann-Listen** pro Einheit: kindgerechte Formulierungen, Selbsteinschätzung mit Smileys. Sie fließen ins LEG und ins Portfolio.

**Hausaufgaben-Kontrolle:**
- Tipp-Raster täglich: gemacht / fehlt / vergessen, dazu vergessenes Material
- Nach X Mal kommt der Hinweis „Elternkontakt?“

**Persönliches Stundenprotokoll:** Was lief wirklich? Ideen fürs nächste Jahr. Ist nicht das offizielle Klassenbuch.

**Übernahme ins nächste Jahr:** Die Reihenfolge der Einheiten bleibt, die Termine werden neu berechnet.

### M8: Klassenleben und Organisation
**Im Klassenzimmer (Beamer bzw. Tafel-Modus):**
- Zufallsauswahl ohne Wiederholung (Abwesende ausgeschlossen), Gruppengenerator mit Regeln
- Timer und visueller Timer, Lärmampel, Arbeitssymbole (Flüstern, Partner, Still)
- **Morgenkreis bzw. Tagesplan** mit Bildkarten, Datum, Wetter, Geburtstagskind, Reihenfolge im Erzählkreis
- Widget-Dashboard mit Presets wie „Morgenkreis“, „Freiarbeit“, „Stationen“

**Ämterplan:** Dienste rotieren automatisch wöchentlich. Anzeige am Beamer, Ausdruck möglich.

**Belohnungssystem:**
- Klassenziel (Murmelglas oder Punkte)
- Individuelle Verstärkerpläne für einzelne Kinder, gekoppelt an die Akte

**Klassenrat:** Themenliste („Briefkasten“), Beschlüsse, Nachverfolgung beim nächsten Termin

**Organisation:**
- **Klassenkasse:** Kakaogeld, Kopiergeld, Ausflugsgeld. Wer hat bezahlt, Saldo, Belege als Foto
- **Rücklauf auf Papier:** Liste pro Zettel mit Häkchen, nur wo Schulmanager nicht genutzt wird
- **Ausflug bzw. Wandertag:** Checkliste, Kosten, Begleitpersonen, Notfallnummern, Allergien. Als Vorlage wiederverwendbar
- **Elternabend:** Tagesordnung, Wahl des Elternbeirats, Materialliste, Protokoll
- **Materiallisten:** pro Kind (Füller fehlt) und pro Einheit (Einkauf)
- **Geburtstage:** Erinnerung, Ritual
- **Vertretungsmappe** mit einem Klick als PDF: Klassenliste mit Fotos, Sitzplan, Ämter, Rituale, Allergien und Medikamente, Abholregeln, Förderkinder, aktueller Wochenplan
- **To-dos** mit natürlicher Eingabe, z. B. „Freitag Kakaogeld einsammeln“

### M9: KI-Assistent (Claude, mit den Daten aus der App)
Die Reihenfolge entspricht dem Nutzen:
1. **Wortgutachten und Zeugnisbemerkungen** (Jgst. 1/2 verbal, Bemerkungen zum Verhalten) aus Akte, Kompetenzständen und Ich-kann-Listen. Für die ganze Klasse auf einmal, im Ton einstellbar.
2. **LEG-Vorbereitung:** ein Entwurf für den Dokumentationsbogen und kindgerechte Zielvorschläge
3. **Briefing zum Elterngespräch** und, aus Stichpunkten, das Protokoll
4. **Förderideen aus Mathe-Fehlermustern**, z. B. „Was hilft bei Übertragsfehlern?“, mit Material-Vorschlägen
5. **Differenzierung:** Arbeitsblatt in 3 Niveaus, Text in einfacher Sprache, DaZ-Hilfen
6. **Texte zum Einfügen in Schulmanager:** Elternbrief, Einladung zum Elternabend, Info zum Ausflug
7. Entwurf für Wochenplan bzw. Stationen zu einer Einheit
8. **Klassen-Snapshot:** wer braucht gerade Aufmerksamkeit (Trend, Abdeckung, offene Ziele)
9. Allgemeiner Chat mit Zugriff auf die eigenen Daten

Die KI schreibt nur Entwürfe, die du immer bearbeitest, und vergibt nie selbst Noten.

### M10: Dashboard „Heute“
- Stunden mit Planung, Fokus-Kinder zum Beobachten, fällige Wiedervorlagen und To-dos
- Geburtstage, offene Rückläufe bzw. Zahlungen
- LEG- bzw. Zeugnis-Fortschritt in der Saison, Übertritts-Countdown

### Querschnitt
- **iPad-first:** große Tipp-Flächen, Pencil-Eingabe, Querformat, Split View, offline im Klassenzimmer
- **Druck bzw. PDF** sauber für Wochenplan, Lesepass, Laufzettel, Ämterplan, Urkunden, LEG-Bogen, Vertretungsmappe
- Globale Suche, JSON-Backup, CSV-Export, Papierkorb

---

## 2. Tech-Stack (unverändert)

- **Frontend:** Vite + React 19 + TypeScript + TanStack Router als PWA, die man auf dem iPad installiert
- **UI:** shadcn/ui (Tailwind v4)
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions). Die Verbindung richtest du ein.
- **Offline:** PowerSync
- **KI:** Claude API über eine Edge Function
- **Bibliotheken:**
  - Recharts für Charts
  - @react-pdf/renderer für PDFs
  - Tiptap für Texteditoren
  - perfect-freehand für die Pencil-Skizzen
  - dnd-kit für den Sitzplan
  - Schedule-X für den Kalender
  - ical.js für das Schulmanager-Abo und die Ferien
- **Hosting:** Vercel

## 3. Datenmodell (Auszug, neu bzw. geändert)
- **Stamm:** `school_years`, `terms`, `classes` (mit `grade_level`), `subjects`, `students`, `student_support` (LRS, Notenschutz, MSD, DaZ), `guardians`
- **Akte:** `entries`, `entry_students`, `tags`, `competencies` (LehrplanPLUS-Baum), `competency_ratings`, `goals`, `attachments` (inkl. Pencil-Skizzen)
- **Gespräche:** `conversations` (Typ: LEG, Elterngespräch, Übertritt), `conversation_sections`, `agreements`, `self_assessments`, `contacts_log`
- **Leistung:**
  - `grade_settings`, `assessments` (Probe, mündlich, praktisch), `assessment_tasks`, `task_scores`, `task_errors`
  - `grading_keys`, `report_texts` (Wortgutachten bzw. Bemerkungen), `final_grade_proposals`
- **Mathe:** `diagnostic_templates`, `diagnostic_items`, `diagnostic_results`, `error_categories`, `fluency_results` (Blitzrechnen bzw. Einmaleins)
- **Deutsch:** `reading_logs`, `reading_fluency`, `books`, `word_lists` (Grundwortschatz), `word_mastery`, `spelling_tests`, `spelling_errors`
- **Planung:** `calendar_feeds`, `calendar_days`, `timetable_slots`, `units`, `lessons`, `materials`, `weekly_plans`, `weekly_plan_items`, `stations`, `station_progress`, `can_do_lists`, `homework_checks`, `todos`
- **Klassenleben:** `rooms`, `seating_plans`, `seat_assignments`, `duties`, `duty_rotations`, `reward_systems`, `reward_events`, `class_council_items`, `widget_presets`
- **Organisation:** `cash_ledger`, `checklists`, `checklist_items`, `trips`, `parent_evenings`
- **KI:** `ai_runs`, `settings`

## 4. Reihenfolge (angepasst an das Schuljahr)

Heute ist der 24.11.2026. Die **LEG-Saison beginnt im Januar**, das Zwischenzeugnis kommt Mitte Februar 2027. Deshalb kommen Akte und LEG zuerst.

| Phase | Inhalt | Ziel |
|---|---|---|
| **0 Setup** | Gerüst, Supabase, Login, PWA, Offline, Design | Installierbar auf iPad und Laptop |
| **1 Fundament** | M1 (Klasse, Kinder, Fächer, Sitzplan), Schnellerfassung, Kalender-Abo und Ferien | Erste Beobachtungen, sofort |
| **2 Akte und LEG** ⭐ | M2 komplett, M3 (LEG-Bogen, Ich-kann-Selbsteinschätzung, PDF, Saisonplaner, Kontaktlog) | **Rechtzeitig fertig für die LEG-Zeit im Januar** |
| **3 Mathe** | M5 Diagnose und Fehleranalyse, M4 Proben pro Aufgabe, Notenbuch | Hauptfach |
| **4 Zeugnis und Übertritt** | Wortgutachten-Editor, Notenvorschlag, Übertritts-Cockpit, KI-Zeugnistexte (M9.1–3) | Vor Übertrittszeugnis (Mai) und Jahreszeugnis (Juli) |
| **5 Deutsch** | M6 Lesen und Rechtschreibung | |
| **6 Unterricht** | M7 Planung, Wochenplan, Stationen, Material, Hausaufgaben | |
| **7 Klassenleben und Orga** | M8 komplett, M10 Dashboard | |
| **8 KI und Feinschliff** | übrige Punkte aus M9, Suche, Exporte, Druck-Feinschliff | |

## 5. Unsicher, vor dem Bauen prüfen
- **Die GrSO wurde zum 01.08.2026 geändert** (GVBl. 2026 S. 425, neue Zeugnismuster). Was genau neu ist, ließ sich hier nicht abrufen. Alle Regeln landen deshalb als **Einstellungen** in der App, nicht fest im Code.
- **Noch nicht geklärt:**
  - Gibt es in Jgst. 2 Noten erst ab dem 2. Halbjahr?
  - Wie verteilen sich die 18 Proben in Jgst. 4?
  - Darf das Jahreszeugnis in Jgst. 1 und 3 durch ein LEG ersetzt werden?
- Ob Schulmanager Klassenlisten oder Noten exportieren kann, ist nicht dokumentiert. Bitte in deinem Account schauen. Sonst importieren wir per CSV bzw. tippen ab.

## 6. Fragen an dich
1. **Welche Jahrgangsstufe hast du gerade?** Davon hängt ab, ob LEG oder Übertritt zuerst kommt.
2. Führt deine Schule LEGs statt Zwischenzeugnis? Gibt es einen eigenen Schul-Bogen?
3. Welche Schulmanager-Module nutzt ihr: Noten, Klassenbuch, Elternbriefe?
4. Arbeitest du mit Apple Pencil?
5. Wie viele Kinder hat die Klasse ungefähr? Bist du auch Fachlehrkraft in anderen Klassen?
