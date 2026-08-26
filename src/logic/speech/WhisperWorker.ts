/// <reference lib="webworker" />
import { pipeline } from "@huggingface/transformers";

let recognizer:
  | Awaited<ReturnType<typeof pipeline<"automatic-speech-recognition">>>
  | undefined;
let recognitionLanguage = "de";

async function loadRecognizer(model: string, device: "webgpu" | "wasm") {
  return pipeline("automatic-speech-recognition", model, {
    device,
    // Quantized Whisper decoders currently fail to initialize in some ONNX Runtime Web builds.
    // Use the unquantized graph for both backends to avoid the QDQ/N-bit operator path.
    dtype: "fp32",
  });
}

self.onmessage = async (
  event: MessageEvent<{
    type: "initialize" | "transcribe";
    model?: string;
    device?: "webgpu" | "wasm";
    audio?: Float32Array;
    language?: string;
  }>,
) => {
  try {
    if (event.data.type === "initialize") {
      const model = event.data.model ?? "onnx-community/whisper-base";
      recognitionLanguage = event.data.language ?? "de";
      const canUseWebGpu = event.data.device === "webgpu" && "gpu" in navigator;
      let activeDevice: "webgpu" | "wasm" = canUseWebGpu ? "webgpu" : "wasm";
      try {
        recognizer = await loadRecognizer(model, activeDevice);
      } catch (webGpuError) {
        if (activeDevice !== "webgpu") throw webGpuError;
        activeDevice = "wasm";
        recognizer = await loadRecognizer(model, activeDevice);
      }
      self.postMessage({ type: "ready", device: activeDevice });
    } else if (event.data.audio && recognizer) {
      const result = await recognizer(event.data.audio, {
        language: recognitionLanguage,
        task: "transcribe",
        // Coordinates commonly repeat digits (e.g. "62,43 63,23"). Do not
        // penalize repetitions here, otherwise Whisper can omit a coordinate.
        max_new_tokens: 32,
      });
      self.postMessage({ type: "result", text: result.text.trim() });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Whisper-Inferenz fehlgeschlagen.",
    });
  }
};
