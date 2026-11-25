# Cardle Beedle – Vorschlag v4: Beobachtung auf Stand der Forschung + mehrere Klassen

Stand: 25.11.2026. Grundlage sind fünf parallele Recherchen:

1. Forschung zu formativer Beurteilung und Diagnostik
2. Digitale Tools 2025/26
3. Bayerische Vorgaben (ISB, GrSO 2026)
4. UX und Fairness bei der Erfassung im Unterricht
5. Code-Analyse „mehrere Klassen“

Status: Vorschlag, noch kein Code.

---

## Teil A – Mehrere Klassen

### Warum es sich wie „nur eine Klasse“ anfühlt

1. **Bug:** Beim Anlegen einer zweiten Klasse springt die Auswahl sofort auf die erste zurück. Der Hinweis meldet „aktiviert“, aber die nächsten Kinder landen in der alten Klasse. Ursache: Die automatische Korrektur in `useActiveClass` greift, bevor die neue Klasse in der Liste angekommen ist.
2. **Die Klassenwahl ist kaum zu finden:**
   - Sie ist ein unauffälliges Auswahlfeld.
   - Im Unterrichtsmodus ist sie ausgeblendet.
   - „Neue Klasse“ gibt es nur unter *Mehr → Einstellungen → Klassen*.
3. **Funktionale Lücken:**
   - Jede Seite zeigt immer nur eine Klasse. Es gibt keine Übersicht „Heute“ über alle Klassen.
   - Eine Stunde für eine andere Klasse lässt sich nicht starten, ohne vorher umzuschalten.
   - Es gibt keine Rolle *Fachlehrkraft*: LEG und Zeugnis erscheinen auch in Klassen, in denen nur Mathe unterrichtet wird.
   - Es gibt keine Gruppen über Klassen hinweg, z. B. Religion/Ethik, Englisch 3a+3b oder Förderkurs.
   - Es gibt keinen Schuljahreswechsel (2b → 3b mit Verlauf) und kein Archiv. Bisher hilft nur Löschen.
   - Der Klassenwahl-Speicher ist für alle Konten gemeinsam, obwohl jedes Konto eigene Daten hat.

### Lösung

| Baustein | Inhalt |
|---|---|
| **A1 Fix + Klassenwahl neu** (klein) | Den Bug beheben. Die aktive Klasse wird pro Konto gespeichert. Statt Auswahlfeld gibt es einen **Klassen-Chip**, der ein Panel öffnet: alle Klassen und Gruppen mit Farbe, Rolle und Kinderzahl, dazu **„+ Neue Klasse/Gruppe“** und **„Archiv“**. Der Chip ist überall sichtbar, auch im Unterrichtsmodus. |
| **A2 Rolle pro Klasse** (klein) | `Klassenleitung` oder `Fachlehrkraft`. Bei Fachlehrkraft gibt es nur die eigenen Fächer und kein LEG, Zeugnis oder Übertritt, dafür Beobachtung, Raster und Elternkontakt. Eine **Farbe pro Klasse** zieht sich durch die ganze App. |
| **A3 Cockpit „Alle Klassen“** (mittel) | Ein Umschalter im Cockpit für die Sicht über alle Klassen: heutige Stunden, Wiedervorlagen, Fokus-Kinder und Lücken, jeweils mit Klassenfarbe. **„Stunde starten“ für jede Klasse direkt**, ohne vorher umzuschalten. |
| **A4 Stundenplan** (mittel) | Wochenraster mit Tag × Stunde → Klasse/Gruppe + Fach. Das Cockpit zeigt dann „Gleich: Mathe 4a, 3. Std.“ und wählt beim Stundenstart alles vor. Optional Import per iCal. |
| **A5 Gruppen über Klassen** (mittel) | Neue Tabelle `groups` (Name, Fach, Kinder aus mehreren Klassen). Eine Stunde und eine Beobachtung können zu einer Gruppe gehören. Das Kind bleibt dabei in seiner Stammklasse, sein Verlauf bleibt vollständig. |
| **A6 Schuljahreswechsel** (mittel) | Ein Assistent führt durch den Wechsel: „2b → 3b versetzen“, Kinder auswählen, Jahrgangsstufe +1. Die alte Klasse wird **archiviert, nicht gelöscht**, und der Verlauf jedes Kindes läuft über die Jahre weiter (Jgst. 1 → 4). |

---

## Teil B – Was die Forschung sagt (Kurzfassung)

- **Formative Beurteilung wirkt, aber schwächer als oft zitiert.** Neuere Meta-Analysen kommen auf g ≈ 0,2–0,3. Die Wirkung entsteht durch den **nächsten Schritt** (Feed-forward), nicht durch mehr Daten (Black & Wiliam; Wisniewski/Zierer/Hattie 2020; Sortwell et al. 2024).
- **Beobachtungsfehler entstehen vor allem beim Deuten, kaum beim Wahrnehmen** (Halo-Effekt, Bestätigungsfehler, laute Kinder werden öfter gesehen). Dagegen helfen:
  - Fakt und Deutung trennen
  - Indikatoren mit Ankerbeispielen
  - geplante, gleichmäßige Abdeckung aller Kinder
  - eine Kompetenz bei allen Kindern einschätzen statt alles bei einem Kind
- **Lernverlaufsdiagnostik** (kurze, wiederholte Proben mit Verlaufskurve) wirkt nur, wenn daraus Entscheidungen folgen, etwa über eine Ziellinie und eine Regel. **Levumi ist kostenlos und wird vom ISB auf lesen.bayern.de angeboten.**
- **Selbsteinschätzung der Kinder** wirkt (g ≈ 0,4–0,6), am stärksten zusammen mit Rückmeldung der Lehrkraft.
- **Mathe:** Wenn ein Kind dauerhaft zählend rechnet, ist das der wichtigste Risikomarker für Rechenschwäche. Diagnostische Interviews (Typ EMBI) zeigen Strategien, die Arbeitsblätter nicht zeigen.
- **Lesen:** Lautleseprotokoll über 1 Minute (Wörter pro Minute und Fehler). Ab etwa 80–100 WpM wird sinnverstehendes Lesen möglich (Material von lesen.bayern.de).
- **KI-Texte sind messbar verzerrt.** Labels wie DaZ, Förderbedarf oder Geschlecht verändern Lob und Kritik (Stanford 2026). **Rund 80 % der KI-Rückmeldungen gehen ungeändert raus**, „Mensch prüft“ allein schützt also nicht. Hilfreich sind Belege pro Satz und eine Prüfung Satz für Satz.
- **Was 2025/26 neu ist:**
  - ein Diktat wird auf mehrere Kinder aufgeteilt (haben wir schon)
  - die KI schlägt die Kompetenz vor, die Lehrkraft bestätigt
  - **jeder KI-Satz zitiert seine Belege** (Toddle)
  - Abdeckungs-Monitoring (Tapestry „Thoroughness“)
- **Bayern 2026:**
  - Neu in § 11 GrSO: **„eine Bewertung von Gruppenleistungen ist unzulässig“**.
  - Mit der neuen Prüfungskultur gewinnt kindgerechtes Feedback an Gewicht.
  - Das LEG ist dokumentiert und ersetzt in Jgst. 1–3 das Zwischenzeugnis (19.02.2027). Ziele sollten SMART formuliert und nachverfolgt werden, weil Kinder sie sonst schnell vergessen.
  - Notenschutz verlangt eine Zeugnisbemerkung (§ 36 Abs. 7 BaySchO), ein Nachteilsausgleich steht dagegen nie im Zeugnis.

---

## Teil C – Vorgeschlagene Funktionen

Aufwand: **S** = klein, **M** = mittel, **L** = groß. ⭐ = Empfehlung für die nächste Runde.

### C1 Beobachtungsqualität und Fairness
1. ⭐ **Fakt vs. Deutung (S).** Jeder Eintrag hat zwei Felder: „Beobachtet“ (was genau passiert ist) und optional „Deutung“. Die KI nutzt nur die Fakten als Belege und markiert Eigenschaftswörter wie „faul“ oder „schwach“.
2. ⭐ **Fokus-Rotation (S).** Pro Stunde schlägt die App 4–6 Fokus-Kinder vor: wer am längsten nicht gesehen wurde, mit offenem Ziel oder passend zum Schwerpunkt. Über 2 Wochen ist jedes Kind einmal dran. Die Vorschläge stehen als Leiste oben im Unterrichtsmodus.
3. ⭐ **Balance-Check (S).** Pro Kind wird geprüft, wie Stärken und Sorgen verteilt sind und welche Bereiche nie beobachtet wurden. Beispiel: „Bei Jonas seit 6 Wochen nur kritische Einträge in Deutsch.“ Der Hinweis erscheint als dezentes Abzeichen und ist nur für dich sichtbar.
4. **Indikatoren und Ankerbeispiele pro Stufe (M).** Langes Drücken auf eine Stufe wie „teilweise“ zeigt, woran man sie erkennt. Eigene Belege lassen sich zum Ankerbeispiel machen.
5. **Kalibrierung (S, optional).** Einmal pro Woche erscheint ein alter, anonymisierter Beleg zum erneuten Einschätzen, damit du deine eigene Konstanz prüfen kannst.

### C2 Erfassung im Unterricht
6. ⭐ **Stundenende-Durchgang, 60 Sekunden (S).** Nach „Beenden“ erscheinen alle Kinder ohne Eintrag als Raster. Ein Tipp bedeutet „gesehen, unauffällig“, ein zweiter fügt eine Notiz hinzu.
7. ⭐ **Erst erfassen, später sortieren (M).** Diktat und Pencil-Notizen landen roh in einem Stapel „Unsortiert“. Am Stundenende schlägt die KI Kind, Kompetenz und Stufe vor, du bestätigst per Wisch.
8. ⭐ **KI schlägt Kompetenz vor (S).** Nach einem Freitext-Eintrag erscheinen 1–3 passende Kompetenzen aus LehrplanPLUS als Chips. Gespeichert wird erst nach Antippen.
9. **Radialmenü (M).** Langes Drücken auf eine Kachel öffnet 3 Schwerpunkt-Kriterien, Mikrofon, Kamera und Stift. Ein Foto wird automatisch dem Kind zugeordnet.

### C3 Diagnose (Mathe und Deutsch)
10. ⭐ **Mathe-Strategie-Tags (S).** Chips wie *zählt alle*, *zählt weiter*, *Finger*, *zerlegt*, *leitet ab*, *automatisiert* und *Stellenwertfehler*. Wird ein Kind über Wochen weiter als zählend markiert, kommt die Warnung **„Zählendes Rechnen hält an“**.
11. **Lautleseprotokoll mit Timer (M).** 1-Minuten-Stoppuhr, Fehler per Tipp aufs Wort zählen, Wörter pro Minute und Genauigkeit werden automatisch berechnet. Dazu eine **Verlaufskurve mit Ziellinie**, z. B. „3× unter der Linie → handeln“. Zusätzlich ein Link zu den kostenlosen Levumi-Tests.
12. **Diagnose-Interview-Modus (M).** Ein eigenes, frei formuliertes Aufgabenset (nicht EMBI-Kopie), pro Aufgabe eine Strategie-Checkliste und Tonaufnahme. Die Ergebnisse fließen ins Raster.
13. **Fehlerkategorien auf Fotos (M).** Fehler mit dem Pencil auf dem Foto markieren und einer Kategorie zuordnen. Mathe: Stellenwert, Übertrag, Operation. Rechtschreibung: lautlich, orthografisch, morphematisch, Groß/Klein. Daraus entsteht ein Fehlerprofil pro Kind.
14. **Schreibproben im Zeitvergleich (S).** Ein Schieberegler stellt z. B. September und Februar nebeneinander, ideal fürs LEG.
15. **Lern- und Arbeitsverhalten mit Häufigkeitsskala (S).** Feste Aussagen wie „beginnt Aufgaben selbstständig“ mit nie / selten / oft / immer. Das ist zuverlässiger als ein Gesamturteil.

### C4 Nutzen: Feedback, LEG, Zeugnis
16. ⭐ **„Nächster Schritt“ pro Beobachtung (S).** Nach einer Einschätzung schlägt die KI kurze Förderschritte vor. Sie landen beim Kind als Ziel bzw. Wiedervorlage. Das ist der eigentliche Wirkmechanismus.
17. ⭐ **Belege pro Satz bei KI-Texten (M).** Jeder Satz in LEG- und Zeugnis-Entwürfen trägt kleine Belegmarken, z. B. „4 Beobachtungen“. Sätze ohne Beleg werden orange markiert. **Export erst, wenn alle Sätze geprüft sind** (Zähler „6/6 geprüft“). Dazu eine Prüfung auf allgemeine Floskeln.
18. ⭐ **Kind-Modus für die Selbsteinschätzung (M).** Das iPad geht ans Kind: große Smileys, Vorlesefunktion, eine Sprachnotiz „Darauf bin ich stolz“. Die Einschätzung des Kindes steht neben deiner, Abweichungen werden markiert.
19. **SMART-Ziele mit Erinnerung (S).** 1–3 Ziele pro Kind, jeweils mit Verantwortlichem (Kind, Eltern, Lehrkraft), Strategie und Prüftermin. Nach dem LEG erinnert die App automatisch daran.
20. **Zeugnisprofile je Jahrgangsstufe (S):**
    - Jgst. 1 und das Zwischenzeugnis in Jgst. 2 sind rein verbal.
    - Ab dem Jahreszeugnis in Jgst. 2 kommen Noten und die zwei Verhaltensbemerkungen dazu.
    - Bei Notenschutz wird die Bemerkung automatisch eingefügt, ein Nachteilsausgleich erscheint nie im Zeugnis.
    - Neu nach GrSO 2026: Einträge aus Gruppenarbeit werden als „nicht notenrelevant“ markiert.
21. **Lernstände eintragen (S):** VERA-3, OA-2 (Orientierungsarbeit Deutsch Jgst. 2), ISB-Lernstandserhebungen und Levumi als eigene Einträge pro Kind, verknüpft mit Kompetenz und Zielen.

### C5 KI sicherer machen
22. ⭐ **Keine Förderstatus-Labels an die KI (S).** DaZ, LRS, Förderbedarf und Geschlecht werden nicht mitgeschickt, weil sie nachweislich die Texte verzerren. Optional werden Namen durch „Kind A“ ersetzt und danach zurückgetauscht.
23. **Eigener Stil (M).** Gute Zeugnistexte aus dem Vorjahr dienen als Stilvorlage für die KI.

---

## Teil D – Empfohlene Reihenfolge

| Runde | Inhalt | Warum jetzt |
|---|---|---|
| **1 (sofort)** | A1 Fix + Klassen-Chip, A2 Rolle/Farbe, C1-2 Fokus-Rotation, C1-3 Balance-Check, C2-6 Stundenende-Durchgang, C3-10 Mathe-Strategie-Tags, C4-16 Nächster Schritt, C5-22 Labels weg | Behebt dein Klassenproblem, alles klein, großer Effekt auf die Qualität |
| **2 (vor dem LEG im Januar)** | A3 Cockpit „Alle Klassen“, C4-17 Belege pro Satz + Prüfpflicht, C4-18 Kind-Modus, C4-19 SMART-Ziele, C1-1 Fakt/Deutung, C2-8 Kompetenz-Vorschlag | Die LEG-Saison beginnt im Januar, Zwischenzeugnis am 19.02.2027 |
| **3** | A4 Stundenplan, A5 Gruppen, C2-7 Unsortiert-Stapel, C3-11 Lautleseprotokoll, C3-14 Schreibproben-Vergleich, C4-20 Zeugnisprofile, C4-21 Lernstände | Für den Alltag als Fachlehrkraft und für die Diagnostik |
| **4** | A6 Schuljahreswechsel, C3-12/13 Interview und Fehlerkategorien, C1-4 Anker, C2-9 Radialmenü, C1-5 Kalibrierung, C5-23 Stil | Bis spätestens Sommer 2027 |

---

## Offene Fragen an dich
1. In welchen Klassen bist du **Klassenleitung**, in welchen **Fachlehrkraft**? Unterrichtest du **Gruppen über Klassen** hinweg, z. B. Religion oder Förderkurs?
2. Soll ein **Stundenplan** gepflegt werden (dann wählt die App beim Stundenstart automatisch vor), oder lieber ohne?
3. **Namen an die KI** wie bisher, oder Pseudonymisierung („Kind A“) einschalten? Empfehlung: Förderstatus-Labels in jedem Fall weglassen.
4. Nutzt du **Levumi, VERA-3 oder die ISB-Lernstandserhebungen**? Davon hängt C4-21 ab.
5. Ist **Runde 1** so in Ordnung, oder willst du die Reihenfolge ändern?

*Hinweis: Die genauen Änderungen der GrSO zum 01.08.2026 (außer der Gruppenleistungs-Regel) und ob VERA-3 in Bayern Pflicht ist, ließen sich nicht vollständig prüfen, weil isb.bayern.de und verkuendung-bayern.de in dieser Umgebung gesperrt sind. Solche Regeln werden in der App als Einstellung gebaut, nicht fest einprogrammiert.*
