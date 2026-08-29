import React, { useState } from 'react';
import './VoiceControls.css';

interface VoiceControlsProps {
  onTranscriptReceived?: (transcript: string) => void;
  onListeningStateChange?: (isListening: boolean) => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  onTranscriptReceived,
  onListeningStateChange
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
              setTranscript('Speech API limited in Electron environment. Type or use simulated voice command below:');
            }
          };

          recognition.onend = () => {
            // If ended without final result, keep transcript or reset
          };

          recognition.start();
        } catch (err) {
          console.error('[VoiceControls] Failed to start speech recognition:', err);
          setTranscript('Speech API unavailable. Enter voice transcript manually below:');
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
        className={`voice-btn ${isListening ? 'listening' : ''}`}
        onClick={toggleListening}
        aria-label={isListening ? "Stop voice input" : "Start voice input"}
        aria-pressed={isListening}
      >
        🎤
      </button>

      {isListening && (
        <div className="voice-transcript-overlay" role="status" aria-live="polite">
          <div className="transcript-box">
            <span className="listening-indicator">🎤 Listening...</span>
            <p className="transcript-text">{transcript}</p>
            <div className="preset-voice-chips">
              <span className="preset-label">Test Voice Samples:</span>
              <button onClick={() => {
                const sample = "Find the cheapest flight from New York to London";
                setTranscript(sample);
                if (onTranscriptReceived) onTranscriptReceived(sample);
                setIsListening(false);
              }}>✈ Flight search</button>
              <button onClick={() => {
                const sample = "Compare prices on Amazon and eBay";
                setTranscript(sample);
                if (onTranscriptReceived) onTranscriptReceived(sample);
                setIsListening(false);
              }}>🔍 Price comparison</button>
            </div>
            <div className="controls-row">
              <button onClick={toggleListening} aria-label="Stop listening">Stop</button>
              <button onClick={() => { setIsListening(false); setTranscript(''); }} aria-label="Cancel voice input">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
