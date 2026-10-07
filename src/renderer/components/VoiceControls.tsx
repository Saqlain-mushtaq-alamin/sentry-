import React, { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import './VoiceControls.css';

interface VoiceControlsProps {
  onTranscriptReceived?: (transcript: string) => void;
  onListeningStateChange?: (isListening: boolean) => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  onTranscriptReceived,
  onListeningStateChange,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const toggleListening = () => {
    const nextState = !isListening;
    setIsListening(nextState);
    if (onListeningStateChange) onListeningStateChange(nextState);

    if (nextState) {
      setTranscript('Listening… Speak into your microphone');
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            const current = event.resultIndex;
            const text = event.results[current][0].transcript;
            setTranscript(text);
            if (event.results[current].isFinal && onTranscriptReceived) {
              onTranscriptReceived(text);
              setIsListening(false);
            }
          };

          recognition.onerror = (event: any) => {
            console.warn('[VoiceControls] Speech recognition error:', event.error);
            if (event.error === 'network' || event.error === 'not-allowed' || event.error === 'no-speech') {
              setTranscript('Speech input unavailable or permission denied.');
            }
          };

          recognition.start();
        } catch (err) {
          console.error('[VoiceControls] Failed to start speech recognition:', err);
          setTranscript('Speech recognition initialization failed.');
        }
      } else {
        setTranscript('Web Speech API not supported in this environment.');
      }
    } else {
      setTranscript('');
    }
  };

  return (
    <div className="voice-controls" role="region" aria-label="Voice Controls">
      <button
        type="button"
        className={`voice-btn ${isListening ? 'listening' : ''}`}
        onClick={toggleListening}
        title={isListening ? 'Stop voice input' : 'Voice input'}
        aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
      >
        {isListening ? <MicOff size={13} /> : <Mic size={13} />}
      </button>

      {isListening && (
        <div className="voice-transcript-overlay" role="status" aria-live="polite">
          <div className="transcript-box">
            <span className="listening-indicator">Listening…</span>
            <p className="transcript-text">{transcript}</p>
            <div className="controls-row">
              <button onClick={toggleListening} className="voice-action-btn">Stop</button>
              <button onClick={() => { setIsListening(false); setTranscript(''); }} className="voice-action-btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
