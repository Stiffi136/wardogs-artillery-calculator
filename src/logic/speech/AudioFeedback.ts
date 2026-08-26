/** Small non-verbal earcons for speech-command acknowledgement. */
export class AudioFeedback {
  private context?: AudioContext;
  private volume = 1;

  setVolume(volume: number) {
    this.volume = volume;
  }

  private getContext() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  private tone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
  ) {
    if (this.volume <= 0) return;
    const context = this.getContext();
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(volume * this.volume, 0.0001),
      start + 0.012,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  success() {
    if (this.volume <= 0) return;
    const now = this.getContext().currentTime + 0.01;
    this.tone(740, now, 0.09, 0.11);
    this.tone(1040, now + 0.11, 0.12, 0.11);
  }
  incomplete() {
    if (this.volume <= 0) return;
    const now = this.getContext().currentTime + 0.01;
    this.tone(220, now, 0.18, 0.09);
  }
  dispose() {
    void this.context?.close();
    this.context = undefined;
  }
}
