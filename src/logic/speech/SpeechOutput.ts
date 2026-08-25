export interface SpeechOutput { speak(text: string): void; stop(): void }
export class BrowserSpeechOutput implements SpeechOutput {
  speak(text: string) { this.stop(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'de-DE'; const voice = speechSynthesis.getVoices().find(item => item.lang.startsWith('de')); if (voice) utterance.voice = voice; speechSynthesis.speak(utterance) }
  stop() { speechSynthesis.cancel() }
}
