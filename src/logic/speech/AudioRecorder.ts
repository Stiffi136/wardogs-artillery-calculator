export class AudioRecorder {
  private context?: AudioContext; private stream?: MediaStream; private source?: MediaStreamAudioSourceNode; private processor?: ScriptProcessorNode
  async start(onAudio: (audio: Float32Array, sampleRate: number) => void): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Mikrofon wird von diesem Browser nicht unterstützt.')
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, autoGainControl: true, echoCancellation: true, noiseSuppression: true } })
    this.context = new AudioContext(); this.source = this.context.createMediaStreamSource(this.stream)
    this.processor = this.context.createScriptProcessor(2048, 1, 1)
    this.processor.onaudioprocess = (event) => onAudio(new Float32Array(event.inputBuffer.getChannelData(0)), this.context!.sampleRate)
    this.source.connect(this.processor); this.processor.connect(this.context.destination)
  }
  stop() { this.processor?.disconnect(); this.source?.disconnect(); this.stream?.getTracks().forEach(track => track.stop()); void this.context?.close(); this.processor = undefined; this.stream = undefined }
}
