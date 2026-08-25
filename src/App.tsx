import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { calculateArtillery, type Coordinates, validateCoordinates } from './logic/calculator/ArtilleryCalculator'
import { BrowserSpeechOutput } from './logic/speech/SpeechOutput'
import { AudioFeedback } from './logic/speech/AudioFeedback'
import { parseSpeechCommand } from './logic/speech/SpeechCommandParser'
import { SpeechSession } from './logic/speech/SpeechSession'
import { WhisperEngine } from './logic/speech/WhisperEngine'

type Form = { artilleryX: string; artilleryY: string; targetX: string; targetY: string }
type PendingCoordinates = 'artillery' | 'target' | null
const blank: Form = { artilleryX: '', artilleryY: '', targetX: '', targetY: '' }
const parse = (value: string) => value.trim() === '' ? undefined : Number(value.replace(',', '.'))
const fmt = (value: number, digits = 2) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)

function App() {
  const [form, setForm] = useState<Form>(() => { try { return { ...blank, ...JSON.parse(localStorage.getItem('wardogs-artillery-coordinates') ?? '{}') } } catch { return blank } })
  const [status, setStatus] = useState('🎤 Sprachsteuerung AUS'), [notice, setNotice] = useState<string | null>(null), [speechOn, setSpeechOn] = useState(false), [autoSpeak, setAutoSpeak] = useState(false), [modelLoading, setModelLoading] = useState(false), [pendingCoordinates, setPendingCoordinates] = useState<PendingCoordinates>(null)
  const spokenSolution = useRef<string | null>(null), pendingCoordinatesRef = useRef<PendingCoordinates>(null), feedback = useRef(new AudioFeedback())
  const engine = useRef(new WhisperEngine({ model: 'onnx-community/whisper-base', device: 'webgpu', language: 'german' })), output = useRef(new BrowserSpeechOutput()), session = useRef<SpeechSession | null>(null)
  const solution = useMemo(() => { const artillery: Coordinates = { x: parse(form.artilleryX) ?? NaN, y: parse(form.artilleryY) ?? NaN }, target: Coordinates = { x: parse(form.targetX) ?? NaN, y: parse(form.targetY) ?? NaN }; return validateCoordinates(artillery) || validateCoordinates(target) ? null : calculateArtillery(artillery, target) }, [form])
  useEffect(() => { localStorage.setItem('wardogs-artillery-coordinates', JSON.stringify(form)) }, [form])
  useEffect(() => () => { session.current?.stop(); engine.current.dispose(); output.current.stop(); feedback.current.dispose() }, [])
  const update = (patch: Partial<Form>) => setForm(previous => ({ ...previous, ...patch }))
  const speak = useCallback(() => { if (!solution) { setNotice('Bitte vollständige, gültige Koordinaten eingeben.'); return }; output.current.speak(`Entfernung ${fmt(solution.distanceKilometers)} Kilometer. Richtung ${Math.round(solution.azimuthDegrees)} Grad.`) }, [solution])
  const say = useCallback((message: string) => output.current.speak(message), [])
  useEffect(() => {
    const key = solution ? [solution.artillery.x, solution.artillery.y, solution.target.x, solution.target.y].join(':') : null
    if (autoSpeak && solution && key !== spokenSolution.current) { spokenSolution.current = key; speak() }
    if (!solution) spokenSolution.current = null
  }, [autoSpeak, solution, speak])
  const handleText = useCallback((text: string) => {
    const command = parseSpeechCommand(text)
    const applyCoordinates = (subject: Exclude<PendingCoordinates, null>, coordinates: Coordinates) => {
      const label = subject === 'target' ? 'Ziel' : 'Artillerie'
      update(subject === 'target' ? { targetX: String(coordinates.x), targetY: String(coordinates.y) } : { artilleryX: String(coordinates.x), artilleryY: String(coordinates.y) })
      pendingCoordinatesRef.current = null
      setPendingCoordinates(null)
      setStatus(`✓ ${label} übernommen`)
      feedback.current.success()
      say(`${label}koordinaten verstanden. X ${coordinates.x}, Y ${coordinates.y}.`)
      setNotice(`${label}koordinaten übernommen: X ${coordinates.x}, Y ${coordinates.y}.`)
    }
    if (command.type === 'select-coordinates') {
      const label = command.subject === 'target' ? 'Ziel' : 'Artillerie'
      pendingCoordinatesRef.current = command.subject
      setPendingCoordinates(command.subject)
      setStatus(`✓ ${label} erkannt – Koordinaten erwartet`)
      feedback.current.success()
      say(`Verstanden, warte auf ${label.toLowerCase()}koordinaten.`)
      setNotice(`„${text}“ erkannt. Bitte nenne jetzt X und Y für ${label}.`)
    } else if (command.type === 'coordinates' && pendingCoordinatesRef.current) {
      applyCoordinates(pendingCoordinatesRef.current, command.coordinates)
    } else if (command.type === 'set-coordinates') {
      const patch: Partial<Form> = {}
      if (command.artillery) Object.assign(patch, { artilleryX: String(command.artillery.x), artilleryY: String(command.artillery.y) })
      if (command.target) Object.assign(patch, { targetX: String(command.target.x), targetY: String(command.target.y) })
      update(patch)
      pendingCoordinatesRef.current = null
      setPendingCoordinates(null)
      setStatus('✓ Koordinaten übernommen')
      feedback.current.success()
      say(command.artillery && command.target ? 'Artillerie- und Zielkoordinaten verstanden.' : 'Koordinaten verstanden.')
      setNotice(`Erkannt: „${text}“`)
    } else if (command.type === 'speak') {
      setStatus('✓ Befehl erkannt'); feedback.current.success(); speak()
    } else if (command.type === 'calculate') {
      setStatus('✓ Befehl erkannt'); feedback.current.success(); setNotice(solution ? 'Feuerlösung aktualisiert.' : 'Bitte X und Y für Artillerie und Ziel vollständig eingeben.')
    } else if (command.type === 'reset') {
      setForm(blank); pendingCoordinatesRef.current = null; setPendingCoordinates(null); setStatus('✓ Befehl erkannt'); feedback.current.success(); say('Eingabe zurückgesetzt.')
    } else if (command.type === 'stop') {
      output.current.stop(); setStatus('✓ Befehl erkannt'); feedback.current.success()
    } else {
      if (command.type === 'incomplete') feedback.current.incomplete()
      const expected = pendingCoordinatesRef.current
      const hint = expected ? `Bitte nenne X und Y für ${expected === 'target' ? 'das Ziel' : 'die Artillerie'}.` : command.type === 'incomplete' ? command.message : 'Kein gültiger Befehl erkannt. Nenne zuerst Ziel oder Artillerie – oder beide Koordinaten zusammen.'
      setStatus('⚠️ Nicht verstanden')
      setNotice(hint)
    }
  }, [say, solution, speak])
  const toggleSpeech = async () => { if (speechOn) { session.current?.stop(); session.current = null; setSpeechOn(false); setStatus('🎤 Sprachsteuerung AUS'); return } try { setModelLoading(true); setStatus('🗣️ Lade lokales Whisper-Modell…'); const next = new SpeechSession(engine.current, state => { const expected = pendingCoordinatesRef.current; setStatus(state === 'processing' ? '🗣️ Verarbeite…' : expected ? `⌛ Warte auf ${expected === 'target' ? 'Ziel' : 'Artillerie'}koordinaten` : '🎤 Höre zu…') }, handleText, error => { setStatus('⚠️ Nicht verstanden'); setNotice(error.message) }); session.current = next; await next.start(); setSpeechOn(true); setStatus('🎤 Höre zu…'); setModelLoading(false) } catch (error) { setModelLoading(false); setStatus('⚠️ Sprachsteuerung nicht verfügbar'); setNotice(error instanceof Error ? error.message : 'Das lokale Whisper-Modell konnte nicht gestartet werden. Der Mikrofonzugriff wurde noch nicht angefordert.') } }
  const dialogueHint = pendingCoordinates ? `Warte auf X- und Y-Koordinate für ${pendingCoordinates === 'target' ? 'das Ziel' : 'die Artillerie'}.` : modelLoading ? 'Der erste Modell-Download und die Initialisierung können einige Minuten dauern. Bitte diese Seite geöffnet lassen.' : 'Sage z. B. „Ziel“, dann nur „67 81“. '
  return <main className="app-shell"><header><p className="eyebrow">WARDOGS · FELDRECHNER</p><h1>Artillerie Rechner</h1><p className="subline">Koordinaten rein. Feuerlösung raus.</p></header><section className={`speech-status ${speechOn ? 'active' : ''}`} aria-live="polite"><span>SPRACHSTATUS</span><strong>{status}</strong><p>{dialogueHint}</p></section><section className="coordinate-grid"><Coordinate title="ARTILLERIE" icon="◉" values={[form.artilleryX, form.artilleryY]} onChange={(x, y) => update({ artilleryX: x, artilleryY: y })} /><Coordinate title="ZIEL" icon="✦" values={[form.targetX, form.targetY]} onChange={(x, y) => update({ targetX: x, targetY: y })} /></section><div className="actions"><button className="primary" onClick={() => setNotice(solution ? 'Feuerlösung aktualisiert.' : 'Bitte X und Y für Artillerie und Ziel vollständig eingeben.')}>BERECHNEN <span>→</span></button><button className="secondary" onClick={() => { setForm(blank); pendingCoordinatesRef.current = null; setPendingCoordinates(null); setNotice(null) }}>ZURÜCKSETZEN</button></div><section className="results"><Result name="ENTFERNUNG" value={solution ? `${fmt(solution.distanceKilometers)} km` : '—'} sub={solution ? `${fmt(solution.distanceMeters, 0)} m · ${fmt(solution.distanceUnits)} Einheiten` : 'Koordinaten eingeben'} major /><Result name="RICHTUNG" value={solution ? `${Math.round(solution.azimuthDegrees)}°` : '—'} sub={solution ? compass(solution.azimuthDegrees) : 'Azimut von Norden'} major /><Result name="ΔX / OST" value={solution ? fmt(solution.deltaX) : '—'} /><Result name="ΔY / NORD" value={solution ? fmt(solution.deltaY) : '—'} /></section><section className="voice"><div><p>{modelLoading ? 'Spracherkennung wird vorbereitet…' : '„Artillerie 45 32, Ziel 67 81“'}</p></div><button className={speechOn ? 'voice-active' : ''} onClick={() => void toggleSpeech()}>{speechOn ? '■ STOPPEN' : '🎤 SPRACHSTEUERUNG'}</button><button className={autoSpeak ? "speak auto-speak-active" : "speak"} aria-pressed={autoSpeak} onClick={() => setAutoSpeak(value => !value)}>{autoSpeak ? "🔊 AUTO: AN" : "🔊 AUTO: AUS"}</button><button className="speak" onClick={speak}>🔊 JETZT VORLESEN</button></section><details className="speech-guide"><summary>SPRACHBEFEHLE &amp; ZAHLENFORMATE</summary><div className="speech-guide-content"><p><strong>Schrittweise:</strong> „Ziel“ → „67 81“ oder „Artillerie“ → „45 32“</p><p><strong>Beide Koordinaten:</strong> „Artillerie 45 32, Ziel 67 81“</p><p><strong>Artillerie:</strong> „Artillerie 45 32“, „Geschütz 45 32“, „Kanone 45 32“ oder „Quelle 45 32“</p><p><strong>Ziel:</strong> „Ziel 67 81“</p><p><strong>Aktionen:</strong> „Berechnen“, „Ergebnis“, „Vorlesen“, „Zurücksetzen“, „Reset“ und „Stop“</p><p><strong>Zahlen:</strong> 45 32, „fünfundvierzig zweiunddreißig“ oder Dezimalwerte wie „45 Komma 32“</p><p className="guide-note">Nach „Ziel“ oder „Artillerie“ werden die nächsten zwei Zahlen als X und Y übernommen.</p></div></details>{notice && <p className="notice" role="status">{notice}</p>}<footer>1 Koordinateneinheit = 100 m · 0° Norden, 90° Osten</footer></main>
}
function Coordinate({ title, icon, values, onChange }: { title: string; icon: string; values: [string, string]; onChange: (x: string, y: string) => void }) { return <section className="coordinate-card"><h2><span>{icon}</span>{title}</h2><label>X<input inputMode="decimal" value={values[0]} onChange={event => onChange(event.target.value, values[1])} placeholder="0" /></label><label>Y<input inputMode="decimal" value={values[1]} onChange={event => onChange(values[0], event.target.value)} placeholder="0" /></label></section> }
function Result({ name, value, sub, major = false }: { name: string; value: string; sub?: string; major?: boolean }) { return <div className={`result ${major ? 'main-result' : ''}`}><span>{name}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div> }
function compass(degrees: number) { return ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8] }
export default App
