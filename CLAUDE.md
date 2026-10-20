# Hallenplan – Projektregeln für Claude

Website für Handballtrainer und -spieler: Trainingspläne nach Altersstufe, Niveau und taktischer Ausrichtung (Abwehrformation, Angriffsstärken), inklusive handballspezifischem Krafttraining.

## Aufbau
- `index.html` Layout und CSS, lädt `data.js` und `app.js`
- `data.js` Inhalte: STAGES (F-Jugend bis Aktive, DHB-Rahmentrainingskonzeption), LEVELS, DEFENSES, ATTACKS, CATS, EX (Übungen), UNIT_TEMPLATES
- `app.js` Planlogik, Rendering, localStorage
- `scripts/check-data.js` prüft die Inhalte, `tests/` Playwright-Tests
- `npm run build` erzeugt `dist/hallenplan.html` als einzelne Datei (für Artifact oder zum Verschicken)
- Statische Seite ohne Build-Kette. Keine Frameworks oder Abhängigkeiten zur Laufzeit einführen.

## Regeln
- Sprache der Oberfläche und Inhalte: Deutsch. Code-Bezeichner dürfen bleiben, wie sie sind.
- Drei Zielgruppen immer mitdenken: Leistungstrainer, Trainer im Breitensport, Spieler (Handy).
- Fachliche Inhalte nur, wenn sie handballerisch korrekt sind. Unsicheres als Hinweis kennzeichnen, keine erfundenen Quellen.
- Altersgerechtigkeit: Systeme und Krafttraining nur in den Stufen, in denen sie laut DHB-RTK sinnvoll sind; Verbandsvorgaben (z. B. keine flachen Abwehrsysteme in jungen Jahrgängen) beachten.
- Jede neue Übung braucht: id, name, cat, ages, min, spieler, material, ziel, ablauf, coaching, leichter, schwerer und, wo sinnvoll, Varianten je System (def/att).
- Mobil zuerst: bei 390 px Breite kein horizontales Scrollen.

## Arbeitsweise
- Arbeit nur über Branches und Pull Requests, nie direkt auf `main`.
- Vor jedem PR: `npm run check` und `npm test` müssen grün sein.
- PR-Beschreibung mit Vorher/Nachher und Screenshots (Handy und Desktop).
- Fachfragen, die nur ein Trainer beantworten kann, im PR unter „Frage an den Trainer“ sammeln.
- Issue-Labels: `bereit` (darf umgesetzt werden), `rolle:leistung`, `rolle:breite`, `rolle:spieler`, `inhalt`, `fehler`, `praxis` (Feedback aus der Halle, hat Vorrang).

## Veröffentlichung
- Die Website wird noch nicht veröffentlicht. Keinen Pages-, Hosting- oder Deploy-Workflow anlegen, bis Joel das ausdrücklich freigibt.
