import { parseNumbers } from './NumberParser'
import type { Coordinates } from '../calculator/ArtilleryCalculator'

export type SpeechCommand =
  | { type: 'set-coordinates'; artillery?: Coordinates; target?: Coordinates }
  | { type: 'calculate' | 'speak' | 'reset' | 'stop' }
  | { type: 'incomplete'; message: string }
  | { type: 'unknown' }

const artilleryWords = /(artillerie|geschütz|geschuetz|kanone|quelle)/
const targetWords = /(ziel|zielpunkt)/
function coordinatesAfter(text: string, matcher: RegExp, until?: RegExp): Coordinates | undefined | 'incomplete' {
  const match = text.match(matcher)
  if (!match || match.index === undefined) return undefined
  const part = text.slice(match.index + match[0].length).split(until ?? /$(?!)/)[0]
  const values = parseNumbers(part)
  if (values.length < 2) return 'incomplete'
  return { x: values[0], y: values[1] }
}

export function parseSpeechCommand(rawText: string): SpeechCommand {
  const text = rawText.toLowerCase().replace(/[.!?]/g, ' ')
  if (/\b(zurücksetzen|zuruecksetzen|reset)\b/.test(text)) return { type: 'reset' }
  if (/\b(stop|anhalten)\b/.test(text)) return { type: 'stop' }
  if (/\b(vorlesen|sprich)\b/.test(text)) return { type: 'speak' }
  if (/\b(berechnen|ergebnis)\b/.test(text)) return { type: 'calculate' }
  const artillery = coordinatesAfter(text, artilleryWords, targetWords)
  const target = coordinatesAfter(text, targetWords, artilleryWords)
  if (artillery === 'incomplete') return { type: 'incomplete', message: 'Bitte nenne X- und Y-Koordinate der Artillerie.' }
  if (target === 'incomplete') return { type: 'incomplete', message: 'Bitte nenne X- und Y-Koordinate des Ziels.' }
  if (artillery || target) return { type: 'set-coordinates', artillery, target }
  return { type: 'unknown' }
}
