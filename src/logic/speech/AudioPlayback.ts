export type Recording = {
  audio: Float32Array;
  sampleRate: number;
};

/** Plays back the most recently captured microphone recording. */
export class AudioPlayback {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;

  async play(recording: Recording) {
    this.source?.stop();
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();

    const buffer = this.context.createBuffer(
      1,
      recording.audio.length,
      recording.sampleRate,
    );
    buffer.copyToChannel(new Float32Array(recording.audio), 0);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.onended = () => {
      if (this.source === source) this.source = undefined;
    };
    this.source = source;
    source.start();
  }

  dispose() {
    this.source?.stop();
    this.source = undefined;
    void this.context?.close();
    this.context = undefined;
  }
}
