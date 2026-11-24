# Cardle Beedle

Persönliches Cockpit für Unterrichtsbeobachtung und -dokumentation (Grundschule Bayern, Jgst. 1–4). Plan: siehe [PLAN.md](PLAN.md).

## Starten

```bash
npm install
npm run dev
```

Build: `npm run build` (Ausgabe in `dist/`, als PWA auf iPad installierbar: Safari → Teilen → „Zum Home-Bildschirm“).

## Aufbau

- **Local-first:** Alle Daten liegen in IndexedDB (Dexie) und funktionieren offline.
- **Sync:** Bei Anmeldung (Einstellungen → Konto & Sync) werden Datensätze nach Supabase (`public.records`, RLS pro Nutzer) und Anhänge in den privaten Bucket `attachments` synchronisiert.
- **Schema:** `supabase/migrations/`.

| Bereich | Datei |
|---|---|
| Cockpit (Jetzt, Fokus-Kinder, Signale, Abdeckung, Woche) | `src/pages/Cockpit.tsx` |
| Unterrichtsmodus (Sitzplan, Kriterien-Raster, Stundenabschluss) | `src/pages/Unterricht.tsx`, `src/components/LessonSheets.tsx` |
| Schnellerfassung (Vorlagen, Kompetenzstufe, Foto, Skizze, Memo, Diktat) | `src/components/QuickCapture.tsx` |
| Schülerakte (Verlauf, Kompetenzen, Verhalten, Ziele, Profil) | `src/pages/Kinder.tsx` |
| Klassenblick (Heatmap, Abdeckung, Stundenreflexion) | `src/pages/Klassenblick.tsx` |
| Gespräche (LEG nach ISB-Muster, Elterngespräch, Saisonplaner, Druck) | `src/pages/Gespraeche.tsx` |
| Einstellungen (Klassen, Kinder, Sitzplan, Vorlagen, Kompetenzen, Konto) | `src/pages/Einstellungen.tsx` |
