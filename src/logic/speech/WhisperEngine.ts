export interface SpeechEngine {
  initialize(): Promise<void>;
  transcribe(audio: Float32Array, sampleRate: number): Promise<string>;
  dispose(): void;
}
export interface WhisperOptions {
  model?: string;
  device?: "webgpu" | "wasm";
  language?: string;
  onModelProgress?: (progress: number) => void;
}
function resample(
  audio: Float32Array,
  sourceRate: number,
  targetRate = 16000,
): Float32Array {
  if (sourceRate === targetRate) return audio;
  const result = new Float32Array(
    Math.round((audio.length * targetRate) / sourceRate),
  );
  const ratio = sourceRate / targetRate;
  for (let index = 0; index < result.length; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, audio.length - 1);
    result[index] =
      audio[left] + (audio[right] - audio[left]) * (position - left);
  }
  return result;
}
export class WhisperEngine implements SpeechEngine {
  private worker?: Worker;
  private ready?: Promise<void>;
  private pending?: {
    resolve: (value: string) => void;
    reject: (reason: Error) => void;
  };
  private readonly options: WhisperOptions;
  constructor(options: WhisperOptions = {}) {
    this.options = options;
  }
  initialize(): Promise<void> {
    if (this.ready) return this.ready;
    this.worker = new Worker(new URL("./WhisperWorker.ts", import.meta.url), {
      type: "module",
    });
    this.ready = new Promise((resolve, reject) => {
      this.worker!.onmessage = (
        event: MessageEvent<{
          type: string;
          text?: string;
          message?: string;
          progress?: number;
        }>,
      ) => {
        if (event.data.type === "ready") resolve();
        else if (event.data.type === "model-progress") {
          this.options.onModelProgress?.(event.data.progress ?? 0);
        }
        else if (event.data.type === "result") {
          this.pending?.resolve(event.data.text ?? "");
          this.pending = undefined;
        } else if (event.data.type === "error") {
          const error = new Error(event.data.message);
          this.pending?.reject(error);
          this.pending = undefined;
          this.ready = undefined;
          reject(error);
        }
      };
      this.worker!.postMessage({
        type: "initialize",
        model: this.options.model ?? "onnx-community/whisper-base",
        device: this.options.device ?? "webgpu",
        language: this.options.language ?? "de",
      });
    });
    return this.ready;
  }
  async transcribe(audio: Float32Array, sampleRate: number): Promise<string> {
    await this.initialize();
    if (this.pending) throw new Error("Spracherkennung läuft bereits.");
    const pcm = resample(audio, sampleRate);
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      this.worker!.postMessage({ type: "transcribe", audio: pcm }, [
        pcm.buffer,
      ]);
    });
  }
  dispose() {
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = undefined;
    this.pending = undefined;
  }
}
