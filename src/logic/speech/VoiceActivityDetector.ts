export type VadState = "IDLE" | "SPEAKING";
export interface VadOptions {
  speechThreshold?: number;
  silenceDurationMs?: number;
}
export class VoiceActivityDetector {
  private state: VadState = "IDLE";
  private silenceMs = 0;
  private readonly threshold: number;
  private readonly silenceDurationMs: number;
  constructor(options: VadOptions = {}) {
    this.threshold = options.speechThreshold ?? 0.012;
    this.silenceDurationMs = options.silenceDurationMs ?? 1000;
  }
  process(
    audio: Float32Array,
    sampleRate: number,
  ): "speech-start" | "speech-end" | null {
    let sum = 0;
    for (const sample of audio) sum += sample * sample;
    const rms = Math.sqrt(sum / Math.max(audio.length, 1));
    const duration = (audio.length / sampleRate) * 1000;
    if (rms >= this.threshold) {
      this.silenceMs = 0;
      if (this.state === "IDLE") {
        this.state = "SPEAKING";
        return "speech-start";
      }
      return null;
    }
    if (
      this.state === "SPEAKING" &&
      (this.silenceMs += duration) >= this.silenceDurationMs
    ) {
      this.state = "IDLE";
      this.silenceMs = 0;
      return "speech-end";
    }
    return null;
  }
  reset() {
    this.state = "IDLE";
    this.silenceMs = 0;
  }
}
