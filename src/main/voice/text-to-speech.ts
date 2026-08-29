export interface TTSConfig {
  engine: 'browser' | 'local' | 'cloud';
  voice: string;
  speed: number;
  enabled: boolean;
}

export class TextToSpeech {
  private config: TTSConfig = {
    engine: 'browser',
    voice: 'default',
    speed: 1.0,
    enabled: true
  };

  async speak(text: string, priority: 'low' | 'normal' | 'urgent'): Promise<void> {
    if (!this.config.enabled) return;
    
    console.log(`[TextToSpeech] (${priority}) Speaking: "${text}"`);
    
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.config.speed;
      window.speechSynthesis.speak(utterance);
    }
  }

  async stop(): Promise<void> {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  updateConfig(newConfig: Partial<TTSConfig>) {
    this.config = { ...this.config, ...newConfig };
  }
}
