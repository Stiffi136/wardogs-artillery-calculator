export interface SpeechOutput {
  speak(text: string, language: string, volume?: number): void;
  stop(): void;
}
export class BrowserSpeechOutput implements SpeechOutput {
  private requestId = 0;
  speak(text: string, language: string, volume = 1) {
    this.stop();
    if (volume <= 0) return;

    const requestId = this.requestId;
    window.setTimeout(() => {
      if (requestId !== this.requestId) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.volume = volume;
      const prefix = language.split("-")[0];
      const voice = speechSynthesis
        .getVoices()
        .find((item) => item.lang.toLowerCase().startsWith(prefix.toLowerCase()));
      if (voice) utterance.voice = voice;
      speechSynthesis.speak(utterance);
    }, 0);
  }
  stop() {
    this.requestId += 1;
    speechSynthesis.cancel();
  }
}
