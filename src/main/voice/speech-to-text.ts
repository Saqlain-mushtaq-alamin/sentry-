export interface STTConfig {
  engine: 'browser' | 'whisper-local' | 'cloud';
  language: string;
  continuous: boolean;
}

export type STTCallback = (text: string, isFinal: boolean) => void;

export class SpeechToText {
  private isListening = false;
  private callbacks: STTCallback[] = [];

  async startListening(config: STTConfig): Promise<void> {
    this.isListening = true;
    console.log(`[SpeechToText] Started listening using engine: ${config.engine}`);
  }

  async stopListening(): Promise<void> {
    this.isListening = false;
    console.log('[SpeechToText] Stopped listening');
  }

  onTranscript(callback: STTCallback): void {
    this.callbacks.push(callback);
  }

  emitTranscript(text: string, isFinal: boolean) {
    if (this.isListening) {
      this.callbacks.forEach(cb => cb(text, isFinal));
    }
  }

  getListeningStatus(): boolean {
    return this.isListening;
  }
}
