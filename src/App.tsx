import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calculateArtillery,
  WEAPON_IDS,
  type WeaponId,
  type Coordinates,
  validateCoordinates,
} from "./logic/calculator/ArtilleryCalculator";
import { BrowserSpeechOutput } from "./logic/speech/SpeechOutput";
import { AudioFeedback } from "./logic/speech/AudioFeedback";
import { AudioPlayback, type Recording } from "./logic/speech/AudioPlayback";
import { parseSpeechCommand } from "./logic/speech/SpeechCommandParser";
import { SpeechSession } from "./logic/speech/SpeechSession";
import { WhisperEngine } from "./logic/speech/WhisperEngine";
import { languages, translate, type Language } from "./i18n";

type Form = {
  artilleryX: string;
  artilleryY: string;
  targetX: string;
  targetY: string;
};
type PendingCoordinates = "artillery" | "target" | null;
const blank: Form = {
  artilleryX: "",
  artilleryY: "",
  targetX: "",
  targetY: "",
};
const parse = (value: string) =>
  value.trim() === "" ? undefined : Number(value.replace(",", "."));
const fmt = (value: number, locale: string, digits = 2) =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);

function App() {
  const [language, setLanguage] = useState<Language>(() =>
    (localStorage.getItem("wardogs-artillery-language") as Language) in
    languages
      ? (localStorage.getItem("wardogs-artillery-language") as Language)
      : "en",
  );
  const t = translate[language];
  const [weaponId, setWeaponId] = useState<WeaponId>("mortar");
  const [form, setForm] = useState<Form>(() => {
    try {
      return {
        ...blank,
        ...JSON.parse(
          localStorage.getItem("wardogs-artillery-coordinates") ?? "{}",
        ),
      };
    } catch {
      return blank;
    }
  });
  const [status, setStatus] = useState("🎤 Sprachsteuerung AUS"),
    [notice, setNotice] = useState<string | null>(null),
    [speechOn, setSpeechOn] = useState(false),
    [autoSpeak, setAutoSpeak] = useState(false),
    [outputVolume, setOutputVolume] = useState(() => {
      const saved = Number(localStorage.getItem("wardogs-artillery-volume"));
      return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 1;
    }),
    [modelLoading, setModelLoading] = useState(false),
    [modelProgress, setModelProgress] = useState<number | null>(null),
    [pendingCoordinates, setPendingCoordinates] =
      useState<PendingCoordinates>(null),
    [audioLevel, setAudioLevel] = useState(0),
    [vadActive, setVadActive] = useState(false),
    [hasRecording, setHasRecording] = useState(false),
    [lastTranscript, setLastTranscript] = useState<string | null>(null),
    [showTranscript, setShowTranscript] = useState(false);
  const spokenSolution = useRef<string | null>(null),
    outputVolumeRef = useRef(outputVolume),
    pendingCoordinatesRef = useRef<PendingCoordinates>(null),
    feedback = useRef(new AudioFeedback()),
    playback = useRef(new AudioPlayback()),
    lastRecording = useRef<Recording | null>(null);
  outputVolumeRef.current = outputVolume;
  const engine = useRef<WhisperEngine | null>(null),
    output = useRef(new BrowserSpeechOutput()),
    session = useRef<SpeechSession | null>(null);
  const solution = useMemo(() => {
    const artillery: Coordinates = {
        x: parse(form.artilleryX) ?? NaN,
        y: parse(form.artilleryY) ?? NaN,
      },
      target: Coordinates = {
        x: parse(form.targetX) ?? NaN,
        y: parse(form.targetY) ?? NaN,
      };
    return validateCoordinates(artillery) || validateCoordinates(target)
      ? null
      : calculateArtillery(artillery, target, weaponId);
  }, [form, weaponId]);
  // SpeechSession outlives individual renders, so commands must read the latest result via a ref.
  const solutionRef = useRef(solution);
  solutionRef.current = solution;
  useEffect(() => {
    localStorage.setItem("wardogs-artillery-coordinates", JSON.stringify(form));
  }, [form]);
  useEffect(() => {
    localStorage.setItem("wardogs-artillery-language", language);
    document.documentElement.lang = languages[language].locale;
    document.title = t.documentTitle;
  }, [language, t.documentTitle]);
  useEffect(() => {
    localStorage.setItem("wardogs-artillery-volume", String(outputVolume));
    feedback.current.setVolume(outputVolume);
    playback.current.setVolume(outputVolume);
    if (outputVolume <= 0) output.current.stop();
  }, [outputVolume]);
  useEffect(
    () => () => {
      session.current?.stop();
      engine.current?.dispose();
      output.current.stop();
      feedback.current.dispose();
      playback.current.dispose();
    },
    [],
  );
  const update = (patch: Partial<Form>) =>
    setForm((previous) => ({ ...previous, ...patch }));
  const speak = useCallback(() => {
    const currentSolution = solutionRef.current;
    if (!currentSolution) {
      setNotice(t.validCoordinates);
      return;
    }
    const distance = fmt(
      currentSolution.distanceKilometers,
      languages[language].locale,
    );
    const message =
      language === "en"
        ? "Distance " +
          distance +
          " kilometers. Direction " +
          Math.round(currentSolution.azimuthDegrees) +
          " degrees."
        : "Entfernung " +
          distance +
          " Kilometer. Richtung " +
          Math.round(currentSolution.azimuthDegrees) +
          " Grad.";
    output.current.speak(
      message,
      languages[language].locale,
      outputVolumeRef.current,
    );
  }, [language]);
  const say = useCallback(
    (message: string) =>
      output.current.speak(
        message,
        languages[language].locale,
        outputVolumeRef.current,
      ),
    [language],
  );
  useEffect(() => {
    const key = solution
      ? [
          solution.artillery.x,
          solution.artillery.y,
          solution.target.x,
          solution.target.y,
        ].join(":")
      : null;
    if (autoSpeak && solution && key !== spokenSolution.current) {
      spokenSolution.current = key;
      speak();
    }
    if (!solution) spokenSolution.current = null;
  }, [autoSpeak, solution, speak]);
  const handleText = useCallback(
    (text: string) => {
      const command = parseSpeechCommand(text);
      const applyCoordinates = (
        subject: Exclude<PendingCoordinates, null>,
        coordinates: Coordinates,
      ) => {
        const label = subject === "target" ? t.target : t.artillery;
        update(
          subject === "target"
            ? { targetX: String(coordinates.x), targetY: String(coordinates.y) }
            : {
                artilleryX: String(coordinates.x),
                artilleryY: String(coordinates.y),
              },
        );
        pendingCoordinatesRef.current = null;
        setPendingCoordinates(null);
        setStatus(`✓ ${label} übernommen`);
        feedback.current.success();
        say(
          t.ttsSubjectCoordinatesUnderstood(
            label,
            coordinates.x,
            coordinates.y,
          ),
        );
        setNotice(t.coordinatesAccepted(label, coordinates.x, coordinates.y));
      };
      if (command.type === "select-coordinates") {
        const label = command.subject === "target" ? t.target : t.artillery;
        pendingCoordinatesRef.current = command.subject;
        setPendingCoordinates(command.subject);
        setStatus(`✓ ${label} erkannt – Koordinaten erwartet`);
        feedback.current.success();
        say(t.ttsWaitingForCoordinates(label));
        setNotice(t.recognizedCoordinates(text, label));
      } else if (
        command.type === "coordinates" &&
        pendingCoordinatesRef.current
      ) {
        applyCoordinates(pendingCoordinatesRef.current, command.coordinates);
      } else if (command.type === "coordinates") {
        applyCoordinates("target", command.coordinates);
      } else if (command.type === "set-coordinates") {
        const patch: Partial<Form> = {};
        if (command.artillery)
          Object.assign(patch, {
            artilleryX: String(command.artillery.x),
            artilleryY: String(command.artillery.y),
          });
        if (command.target)
          Object.assign(patch, {
            targetX: String(command.target.x),
            targetY: String(command.target.y),
          });
        update(patch);
        pendingCoordinatesRef.current = null;
        setPendingCoordinates(null);
        setStatus("✓ Koordinaten übernommen");
        feedback.current.success();
        say(
          command.artillery && command.target
            ? t.ttsBothCoordinatesUnderstood
            : t.ttsCoordinatesUnderstood,
        );
        setNotice(t.recognized(text));
      } else if (command.type === "speak") {
        setStatus("✓ Befehl erkannt");
        feedback.current.success();
        speak();
      } else if (command.type === "calculate") {
        setStatus("✓ Befehl erkannt");
        feedback.current.success();
        setNotice(
          solutionRef.current ? t.solutionUpdated : t.allCoordinatesRequired,
        );
      } else if (command.type === "reset") {
        setForm(blank);
        pendingCoordinatesRef.current = null;
        setPendingCoordinates(null);
        setStatus("✓ Befehl erkannt");
        feedback.current.success();
        say(t.ttsInputReset);
      } else if (command.type === "stop") {
        output.current.stop();
        setStatus("✓ Befehl erkannt");
        setNotice(t.readingStopped);
        feedback.current.success();
      } else {
        if (command.type === "incomplete") feedback.current.incomplete();
        const expected = pendingCoordinatesRef.current;
        const hint = expected
          ? `Bitte nenne X und Y für ${expected === "target" ? "das Ziel" : "die Artillerie"}.`
          : command.type === "incomplete"
            ? t.incompleteCoordinates(
                command.message.includes("Artillerie") ? t.artillery : t.target,
              )
            : t.noCommand;
        setStatus(t.commandNotUnderstood);
        setNotice(hint);
      }
    },
    [say, speak, language],
  );
  const toggleSpeech = async () => {
    if (speechOn) {
      session.current?.stop();
      session.current = null;
      setSpeechOn(false);
      setStatus("🎤 Sprachsteuerung AUS");
      return;
    }
    try {
      setModelLoading(true);
      setModelProgress(0);
      setStatus("🗣️ Lade lokales Whisper-Modell…");
      const next = new SpeechSession(
        (() => {
          engine.current?.dispose();
          engine.current = new WhisperEngine({
            model: "onnx-community/whisper-base",
            device: "webgpu",
            language: languages[language].whisper,
            onModelProgress: setModelProgress,
          });
          return engine.current;
        })(),
        (state) => {
          const expected = pendingCoordinatesRef.current;
          setStatus(
            state === "processing"
              ? t.processing
              : expected
                ? t.waitingForCoordinates(
                    expected === "target" ? t.target : t.artillery,
                  )
                : "🎤 " + t.listen,
          );
        },
        handleText,
        (error) => {
          setStatus(t.commandNotUnderstood);
          setNotice(error.message);
        },
        (activity) => {
          setAudioLevel(activity.level);
          setVadActive(activity.vadActive);
        },
        (recording) => {
          lastRecording.current = recording;
          setHasRecording(true);
          setLastTranscript(null);
          setShowTranscript(false);
        },
        (recording, text) => {
          if (lastRecording.current === recording) setLastTranscript(text);
        },
      );
      session.current = next;
      await next.start();
      setSpeechOn(true);
      setStatus("🎤 " + t.listen);
      setModelLoading(false);
      setModelProgress(null);
    } catch (error) {
      setModelLoading(false);
      setModelProgress(null);
      setStatus("⚠️ Sprachsteuerung nicht verfügbar");
      setNotice(
        error instanceof Error ? error.message : t.speechUnavailableMessage,
      );
    }
  };
  const dialogueHint = pendingCoordinates
    ? language === "en"
      ? "Waiting for X and Y coordinates."
      : "Warte auf X- und Y-Koordinate."
    : modelLoading
      ? language === "en"
        ? "The initial model download and setup can take a few minutes. Keep this page open."
        : "Der erste Modell-Download und die Initialisierung können einige Minuten dauern. Bitte diese Seite geöffnet lassen."
      : t.speechHint;
  return (
    <main className="app-shell">
      <header>
        <div className="language-picker">
          <label>
            {language === "en" ? "Language" : "Sprache"}
            <select
              value={language}
              onChange={(event) => {
                if (speechOn) session.current?.stop();
                setSpeechOn(false);
                setLanguage(event.target.value as Language);
              }}
            >
              {Object.entries(languages).map(([code, item]) => (
                <option key={code} value={code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="eyebrow">
          WARDOGS · {language === "en" ? "FIELD CALCULATOR" : "FELDRECHNER"}
        </p>
        <div className="title-row">
          <img className="title-icon" src="/favicon.svg" alt="" />
          <h1>{t.title}</h1>
        </div>
        <p className="subline">{t.subline}</p>
      </header>
      <section
        className={`speech-status ${speechOn ? "active" : ""}`}
        aria-live="polite"
      >
        <span>{t.speechStatus}</span>
        <strong>{speechOn || modelLoading ? status : t.speechOff}</strong>
        <p>{dialogueHint}</p>
        {modelLoading && modelProgress !== null && (
          <div className="model-progress" aria-label="Modell-Downloadfortschritt">
            <div className="model-progress-head">
              <span>{language === "en" ? "MODEL DOWNLOAD" : "MODELL-DOWNLOAD"}</span>
              <strong>{modelProgress}%</strong>
            </div>
            <progress value={modelProgress} max="100">
              {modelProgress}%
            </progress>
          </div>
        )}
      </section>
      <section
        className="mic-meter"
        aria-label="Mikrofonpegel und Sprachaktivität"
      >
        <div className="meter-head">
          <span>{t.microphoneLevel}</span>
          <strong className={speechOn && vadActive ? "vad-active" : ""}>
            {speechOn ? (vadActive ? t.vadActive : t.ready) : t.off}
          </strong>
        </div>
        <div className="meter-track" aria-hidden="true">
          <div
            className="meter-fill"
            style={{ width: `${Math.round(audioLevel * 100)}%` }}
          />
        </div>
        <small>
          {speechOn
            ? vadActive
              ? t.speechDetected
              : t.waitingForSpeech
            : t.startSpeechControl}
        </small>
        <button
          className="replay-recording"
          disabled={!hasRecording}
          onClick={() => {
            const recording = lastRecording.current;
            if (recording) {
              setShowTranscript(true);
              void playback.current.play(recording);
            }
          }}
        >
          ▶ {t.replayRecording}
        </button>
        {showTranscript && (
          <p className="replay-transcript" aria-live="polite">
            <strong>{t.transcript}:</strong>{" "}
            {lastTranscript || t.transcriptProcessing}
          </p>
        )}
      </section>
      <section className="weapon-picker">
        <label>
          {t.weapon}
          <select
            value={weaponId}
            onChange={(event) => setWeaponId(event.target.value as WeaponId)}
          >
            {WEAPON_IDS.map((id) => (
              <option key={id} value={id}>
                {id === "mortar" ? t.mortar : t.howitzer}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="coordinate-grid">
        <Coordinate
          title={t.artillery.toUpperCase()}
          icon="◉"
          values={[form.artilleryX, form.artilleryY]}
          onChange={(x, y) => update({ artilleryX: x, artilleryY: y })}
        />
        <Coordinate
          title={t.target.toUpperCase()}
          icon="✦"
          values={[form.targetX, form.targetY]}
          onChange={(x, y) => update({ targetX: x, targetY: y })}
        />
      </section>
      <div className="actions">
        <button
          className="primary"
          onClick={() =>
            setNotice(solution ? t.solutionUpdated : t.allCoordinatesRequired)
          }
        >
          {t.calculate} <span>→</span>
        </button>
        <button
          className="secondary"
          onClick={() => {
            setForm(blank);
            pendingCoordinatesRef.current = null;
            setPendingCoordinates(null);
            setNotice(null);
          }}
        >
          {t.reset}
        </button>
      </div>
      <section className="results">
        <Result
          name={t.distance}
          value={
            solution
              ? fmt(solution.distanceMeters, languages[language].locale) + " m"
              : "—"
          }
          sub={
            solution
              ? fmt(
                  solution.distanceKilometers,
                  languages[language].locale,
                  2,
                ) +
                " km · " +
                fmt(solution.distanceUnits, languages[language].locale) +
                " " +
                t.units
              : t.enterCoordinates
          }
          major
        />
        <Result
          name={t.mil}
          value={
            solution?.elevationSolutions.length
              ? solution.elevationSolutions
                  .map(({ mil }) => fmt(mil, languages[language].locale, 0))
                  .join(" / ") + " mil"
              : "—"
          }
          sub={
            solution?.elevationSolutions.length
              ? solution.elevationSolutions
                  .map(({ arc }) =>
                    arc === "low"
                      ? t.lowArc
                      : arc === "high"
                        ? t.highArc
                        : t.milElevation,
                  )
                  .join(" / ")
              : t.outOfRange
          }
          major
        />
        <Result
          name={t.direction}
          value={
            solution
              ? `${fmt(solution.azimuthDegrees, languages[language].locale, 1)}°`
              : "—"
          }
          sub={
            solution
              ? compass(solution.azimuthDegrees, language)
              : t.azimuthFromNorth
          }
          major
        />
        <Result
          name={t.deltaEast}
          value={
            solution ? fmt(solution.deltaX, languages[language].locale) : "—"
          }
        />
        <Result
          name={t.deltaNorth}
          value={
            solution ? fmt(solution.deltaY, languages[language].locale) : "—"
          }
        />
      </section>
      <section className="voice">
        <button
          className={speechOn ? "voice-active" : ""}
          onClick={() => void toggleSpeech()}
        >
          {speechOn ? t.stop : "🎤 " + t.speech}
        </button>
        <button
          className={autoSpeak ? "speak auto-speak-active" : "speak"}
          aria-pressed={autoSpeak}
          onClick={() => setAutoSpeak((value) => !value)}
        >
          {autoSpeak ? t.autoOn : t.autoOff}
        </button>
        <button className="speak" onClick={speak}>
          🔊 {t.read}
        </button>
      </section>
      <section className="volume-control">
        <label htmlFor="output-volume">
          <span>🔊 {t.outputVolume}</span>
          <strong>{Math.round(outputVolume * 100)}%</strong>
        </label>
        <input
          id="output-volume"
          type="range"
          min="0"
          max="100"
          value={Math.round(outputVolume * 100)}
          onChange={(event) => setOutputVolume(Number(event.target.value) / 100)}
          aria-valuetext={`${Math.round(outputVolume * 100)}%`}
        />
      </section>
      <details className="speech-guide">
        <summary>{t.guide}</summary>
        <div className="speech-guide-content">
          <p>
            <strong>{t.step}</strong> {t.guideStep}
          </p>
          <p>
            <strong>{t.both}</strong> {t.guideBoth}
          </p>
          <p>
            <strong>{t.artilleryGuide}</strong> {t.guideArtillery}
          </p>
          <p>
            <strong>{t.targetGuide}</strong> {t.guideTarget}
          </p>
          <p>
            <strong>{t.actions}</strong> {t.guideActions}
          </p>
          <p>
            <strong>{t.numbers}</strong> {t.guideNumbers}
          </p>
          <p className="guide-note">{t.guideNote}</p>
        </div>
      </details>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <footer>{t.footer}</footer>
    </main>
  );
}
function Coordinate({
  title,
  icon,
  values,
  onChange,
}: {
  title: string;
  icon: string;
  values: [string, string];
  onChange: (x: string, y: string) => void;
}) {
  return (
    <section className="coordinate-card">
      <h2>
        <span>{icon}</span>
        {title}
      </h2>
      <label>
        X
        <input
          inputMode="decimal"
          value={values[0]}
          onChange={(event) => onChange(event.target.value, values[1])}
          placeholder="0"
        />
      </label>
      <label>
        Y
        <input
          inputMode="decimal"
          value={values[1]}
          onChange={(event) => onChange(values[0], event.target.value)}
          placeholder="0"
        />
      </label>
    </section>
  );
}
function Result({
  name,
  value,
  sub,
  major = false,
}: {
  name: string;
  value: string;
  sub?: string;
  major?: boolean;
}) {
  return (
    <div className={`result ${major ? "main-result" : ""}`}>
      <span>{name}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
function compass(degrees: number, language: Language) {
  return (
    language === "en"
      ? ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
      : ["N", "NO", "O", "SO", "S", "SW", "W", "NW"]
  )[Math.round(degrees / 45) % 8];
}
export default App;
