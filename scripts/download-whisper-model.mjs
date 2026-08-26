import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const model = "onnx-community/whisper-base";
const revision = "0dc963c325ab2554e6dcedbb458decbffb4dc5b1";
const targetDirectory = "public/models/onnx-community/whisper-base";
const files = [
  "config.json",
  "generation_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "preprocessor_config.json",
  "onnx/encoder_model.onnx",
  "onnx/decoder_model_merged.onnx",
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "unbekannte Größe";
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

async function download(file) {
  const url = `https://huggingface.co/${model}/resolve/${revision}/${file}`;
  const destination = join(targetDirectory, file);
  const temporaryDestination = `${destination}.part`;

  await mkdir(dirname(destination), { recursive: true });
  await rm(temporaryDestination, { force: true });

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`${file}: HTTP ${response.status} ${response.statusText}`);
  }

  const total = Number(response.headers.get("content-length"));
  let received = 0;
  let lastReported = -1;
  const progress = new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength;
      const percentage = total ? Math.floor((received / total) * 100) : -1;
      if (percentage >= lastReported + 10 || percentage === 100) {
        process.stdout.write(
          `\r  ${file}: ${percentage >= 0 ? `${percentage}%` : formatBytes(received)}`,
        );
        lastReported = percentage;
      }
      controller.enqueue(chunk);
    },
  });

  await pipeline(
    Readable.fromWeb(response.body.pipeThrough(progress)),
    createWriteStream(temporaryDestination),
  );
  await rename(temporaryDestination, destination);
  process.stdout.write(`\r  ${file}: ${formatBytes(received)} fertig\n`);
}

console.log(`Lade ${files.length} Whisper-Dateien nach ${targetDirectory} …`);
for (const file of files) await download(file);
console.log("Whisper-Modell steht für npm run dev bereit.");
