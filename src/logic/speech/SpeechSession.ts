import { AudioRecorder } from "./AudioRecorder";
import { AudioRingBuffer } from "./AudioRingBuffer";
import type { Recording } from "./AudioPlayback";
import { VoiceActivityDetector } from "./VoiceActivityDetector";
import type { SpeechEngine } from "./WhisperEngine";
export interface SpeechActivity {
  level: number;
  vadActive: boolean;
}
export class SpeechSession {
  private readonly recorder = new AudioRecorder();
  private readonly vad = new VoiceActivityDetector();
  private ring?: AudioRingBuffer;
  private utterance: Float32Array[] = [];
  private speaking = false;
  private readonly engine: SpeechEngine;
  private readonly onStatus: (status: "listening" | "processing") => void;
  private readonly onText: (text: string) => void;
  private readonly onError: (error: Error) => void;
  private readonly onActivity?: (activity: SpeechActivity) => void;
  private readonly onRecording?: (recording: Recording) => void;
  private readonly onTranscript?: (recording: Recording, text: string) => void;
  constructor(
    engine: SpeechEngine,
    onStatus: (status: "listening" | "processing") => void,
    onText: (text: string) => void,
    onError: (error: Error) => void,
    onActivity?: (activity: SpeechActivity) => void,
    onRecording?: (recording: Recording) => void,
    onTranscript?: (recording: Recording, text: string) => void,
  ) {
    this.engine = engine;
    this.onStatus = onStatus;
    this.onText = onText;
    this.onError = onError;
    this.onActivity = onActivity;
    this.onRecording = onRecording;
    this.onTranscript = onTranscript;
  }
  async start() {
    await this.engine.initialize();
    await this.recorder.start((audio, sampleRate) =>
      this.receive(audio, sampleRate),
    );
  }
  private receive(audio: Float32Array, sampleRate: number) {
    let sum = 0;
    for (const sample of audio) sum += sample * sample;
    const level = Math.min(
      1,
      Math.sqrt(sum / Math.max(audio.length, 1)) / 0.08,
    );
    this.ring ??= new AudioRingBuffer(Math.round(sampleRate * 0.75));
    this.ring.push(audio);
    const signal = this.vad.process(audio, sampleRate);
    if (signal === "speech-start") {
      this.speaking = true;
      this.utterance = [this.ring.take()];
      this.onStatus("listening");
    } else if (this.speaking) this.utterance.push(audio);
    if (signal === "speech-end") {
      this.speaking = false;
      const length = this.utterance.reduce(
          (total, chunk) => total + chunk.length,
          0,
        ),
        joined = new Float32Array(length);
      let offset = 0;
      for (const chunk of this.utterance) {
        joined.set(chunk, offset);
        offset += chunk.length;
      }
      this.utterance = [];
      const recording = { audio: joined, sampleRate };
      this.onRecording?.(recording);
      this.onStatus("processing");
      void this.engine
        .transcribe(joined, sampleRate)
        .then((text) => {
          this.onTranscript?.(recording, text);
          this.onText(text);
        })
        .catch(this.onError)
        .finally(() => this.onStatus("listening"));
    }
    this.onActivity?.({ level, vadActive: this.speaking });
  }
  stop() {
    this.recorder.stop();
    this.vad.reset();
    this.speaking = false;
    this.utterance = [];
    this.onActivity?.({ level: 0, vadActive: false });
  }
}
