export interface SpeechOutput {
  speak(text: string, language: string): void;
  stop(): void;
}
export class BrowserSpeechOutput implements SpeechOutput {
  speak(text: string, language: string) {
    this.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    const prefix = language.split("-")[0];
    const voice = speechSynthesis
      .getVoices()
      .find((item) => item.lang.toLowerCase().startsWith(prefix.toLowerCase()));
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  }
  stop() {
    speechSynthesis.cancel();
  }
}
