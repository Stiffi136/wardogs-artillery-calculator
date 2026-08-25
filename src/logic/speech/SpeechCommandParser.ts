import { parseNumbers } from './NumberParser'
import type { Coordinates } from '../calculator/ArtilleryCalculator'

export type SpeechCommand =
  | { type: 'set-coordinates'; artillery?: Coordinates; target?: Coordinates }
  | { type: 'select-coordinates'; subject: 'artillery' | 'target' }
  | { type: 'coordinates'; coordinates: Coordinates }
  | { type: 'calculate' | 'speak' | 'reset' | 'stop' }
  | { type: 'incomplete'; message: string }
  | { type: 'unknown' }

const artilleryWords = /(artillerie|geschütz|geschuetz|kanone|quelle)/
const targetWords = /(ziel|zielpunkt)/
const actionWords: Array<[RegExp, Extract<SpeechCommand, { type: 'calculate' | 'speak' | 'reset' | 'stop' }>['type']]> = [
  [/\b(zurücksetz(?:en|e)?|zuruecksetz(?:en|e)?|reset(?:te)?|neu(?:start(?:en)?)?)\b/, 'reset'],
  [/\b(stop|stopp(?:en)?|anhalten|abbrechen)\b/, 'stop'],
  [/\b(vorles(?:en|e)?|sprich|ansag(?:en|e)?)\b/, 'speak'],
  [/\b(berechn(?:en|e)?|ergebnis(?:se)?|auswert(?:en|e)?)\b/, 'calculate'],
]
function coordinatesAfter(text: string, matcher: RegExp, until?: RegExp): Coordinates | undefined | 'incomplete' {
  const match = text.match(matcher)
  if (!match || match.index === undefined) return undefined
  const part = text.slice(match.index + match[0].length).split(until ?? /$(?!)/)[0]
  const values = parseNumbers(part)
  if (values.length < 2) return 'incomplete'
  return { x: values[0], y: values[1] }
}

export function parseSpeechCommand(rawText: string): SpeechCommand {
  const text = rawText.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N},.-]+/gu, ' ').trim()
  for (const [matcher, type] of actionWords) if (matcher.test(text)) return { type }
  const artillery = coordinatesAfter(text, artilleryWords, targetWords)
  const target = coordinatesAfter(text, targetWords, artilleryWords)
  if (target === 'incomplete' && parseNumbers(text).length === 0) return { type: 'select-coordinates', subject: 'target' }
  if (artillery === 'incomplete' && parseNumbers(text).length === 0) return { type: 'select-coordinates', subject: 'artillery' }
  if (artillery === 'incomplete') return { type: 'incomplete', message: 'Bitte nenne X- und Y-Koordinate der Artillerie.' }
  if (target === 'incomplete') return { type: 'incomplete', message: 'Bitte nenne X- und Y-Koordinate des Ziels.' }
  if (artillery || target) return { type: 'set-coordinates', artillery, target }
  if (targetWords.test(text)) return { type: 'select-coordinates', subject: 'target' }
  if (artilleryWords.test(text)) return { type: 'select-coordinates', subject: 'artillery' }
  const values = parseNumbers(text)
  if (values.length >= 2) return { type: 'coordinates', coordinates: { x: values[0], y: values[1] } }
  return { type: 'unknown' }
}
