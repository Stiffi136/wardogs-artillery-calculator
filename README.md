# WARDOGS Artillery Calculator

Browserbasierter Koordinatenrechner für WARDOGS. Er berechnet Entfernung, Differenzen und Azimut vollständig lokal im Browser.

## Start

```bash
npm install
npm run dev
npm run build
```

Für die Sprachsteuerung wird ein moderner Browser mit Mikrofonzugriff benötigt. Beim ersten Start lädt der Browser `onnx-community/whisper-base`; danach verwendet die Anwendung den lokalen Browser-Cache. WebGPU wird bevorzugt, andernfalls nutzt Transformers.js WASM/CPU. Es gibt keinen Whisper-Server und keine dauerhaft gespeicherten Audiodaten.

## Bedienung

Die Eingabefelder sind der zuverlässige Hauptweg: vollständige Koordinaten aktualisieren das Ergebnis sofort. Die zuletzt verwendeten Koordinaten werden ohne personenbezogene Daten in `localStorage` gespeichert.

Sprachbefehle:

- `Artillerie 45 32, Ziel 67 81`
- `Geschütz 45 32 Ziel 67 81`
- `Artillerie 45 32`
- `Ziel 67 81`
- `Berechnen`, `Ergebnis`, `Vorlesen`, `Zurücksetzen`, `Stop`

Zahlwörter wie `fünfundvierzig` sowie Dezimalwerte mit `Komma` werden verarbeitet. Unvollständige Ziel- oder Artilleriekoordinaten werden nicht übernommen.

## Architektur

- `logic/calculator`: Validierung, zentrale Kartenkonfiguration und Azimut-/Entfernungsberechnung.
- `logic/speech`: Mikrofonaufnahme, RMS-VAD mit 500-ms-Pre-Roll, Speech-Session, Whisper-Web-Worker, Parser und Sprachausgabe.
- `App.tsx`: responsive Bedienoberfläche und UI-Zustand.

Eine Koordinateneinheit entspricht zentral konfiguriert 100 Metern. Der Azimut verwendet `atan2(deltaX, deltaY)`: 0° = Norden, 90° = Osten. Bei identischen Koordinaten wird 0° angezeigt.

## Bekannte Einschränkungen

Das initiale Whisper-Modell ist relativ groß und benötigt je nach Gerät Zeit zum Herunterladen. Die RMS-basierte Sprachaktivitätserkennung ist ein bewusst einfaches MVP und kann später durch Silero VAD ersetzt werden. Der Browser muss Web Worker, Web Audio und Speech Synthesis unterstützen.
