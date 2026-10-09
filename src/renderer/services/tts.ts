/**
 * Text-to-Speech (TTS) Service
 * Runs in renderer process where window.speechSynthesis is available.
 */

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!voicesPromise) {
    voicesPromise = new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        return resolve([]);
      }
      const v = speechSynthesis.getVoices();
      if (v.length) return resolve(v);
      speechSynthesis.addEventListener('voiceschanged', () => resolve(speechSynthesis.getVoices()), { once: true });
      setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
    });
  }
  return voicesPromise;
}

export async function speak(text: string, rate = 1): Promise<void> {
  if (!('speechSynthesis' in window) || !text || !text.trim()) return;
  speechSynthesis.cancel();
  const voices = await loadVoices();
  const lang = navigator.language.slice(0, 2);
  const voice = voices.find((v) => v.lang.startsWith(lang)) ?? voices[0] ?? null;
  
  // Chromium cuts off long utterances, so speak sentence by sentence
  const chunks = text.match(/[^.!?\n]+[.!?]?/g) ?? [text];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const u = new SpeechSynthesisUtterance(trimmed);
    if (voice) u.voice = voice;
    u.rate = rate;
    speechSynthesis.speak(u);
  }
}

export const stop = (): void => {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
};
