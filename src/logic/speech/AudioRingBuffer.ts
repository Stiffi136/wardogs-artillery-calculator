export class AudioRingBuffer {
  private chunks: Float32Array[] = [];
  private length = 0;
  private readonly maximumSamples: number;
  constructor(maximumSamples: number) {
    this.maximumSamples = maximumSamples;
  }
  push(chunk: Float32Array) {
    this.chunks.push(chunk.slice());
    this.length += chunk.length;
    while (this.length > this.maximumSamples && this.chunks.length)
      this.length -= this.chunks.shift()!.length;
  }
  take(): Float32Array {
    const result = new Float32Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
  clear() {
    this.chunks = [];
    this.length = 0;
  }
}
