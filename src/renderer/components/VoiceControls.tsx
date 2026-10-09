import React, { useState, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import './VoiceControls.css';

interface VoiceControlsProps {
  onTranscriptReceived?: (transcript: string) => void;
  onListeningStateChange?: (isListening: boolean) => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  onTranscriptReceived,
  onListeningStateChange,
}) => {
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [error, setError] = useState('');

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunks.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setStatus('transcribing');
        try {
          const actualMime = rec.mimeType || 'audio/webm';
          const blob = new Blob(chunks.current, { type: actualMime });
          const arrayBuffer = await blob.arrayBuffer();
          if (!window.sentry?.voice?.transcribe) {
            throw new Error('Voice transcription is not available.');
          }
          const text = await window.sentry.voice.transcribe(arrayBuffer, actualMime);
          if (text && text.trim()) {
            onTranscriptReceived?.(text.trim());
          }
        } catch (e: any) {
          setError(e.message || 'Transcription failed');
        } finally {
          setStatus('idle');
          onListeningStateChange?.(false);
        }
      };

      rec.start();
      recRef.current = rec;
      setStatus('recording');
      onListeningStateChange?.(true);
    } catch {
      setError('Microphone unavailable or permission denied.');
      setStatus('idle');
      onListeningStateChange?.(false);
    }
  };

  const stop = () => {
    if (recRef.current && recRef.current.state === 'recording') {
      recRef.current.stop();
    }
  };

  const cancel = () => {
    if (recRef.current && recRef.current.state === 'recording') {
      recRef.current.onstop = null; // don't process transcript
      recRef.current.stop();
    }
    chunks.current = [];
    setStatus('idle');
    setError('');
    onListeningStateChange?.(false);
  };

  const isRecording = status === 'recording';
  const isTranscribing = status === 'transcribing';

  return (
    <div className="voice-controls" role="region" aria-label="Voice Controls">
      <button
        type="button"
        className={`voice-btn ${isRecording ? 'listening' : ''} ${isTranscribing ? 'transcribing' : ''}`}
        onClick={isRecording ? stop : start}
        disabled={isTranscribing}
        title={isRecording ? 'Stop voice input' : isTranscribing ? 'Transcribing...' : 'Voice input'}
        aria-label={isRecording ? 'Stop voice input' : 'Start voice input'}
      >
        {isTranscribing ? <Loader2 size={13} className="spin" /> : isRecording ? <MicOff size={13} /> : <Mic size={13} />}
      </button>

      {(isRecording || isTranscribing || error) && (
        <div className="voice-transcript-overlay" role="status" aria-live="polite">
          <div className="transcript-box">
            <span className="listening-indicator">
              {isTranscribing ? 'Transcribing audio…' : isRecording ? 'Listening… Speak into your microphone' : 'Voice Input'}
            </span>
            {error ? (
              <p className="transcript-text" style={{ color: 'var(--danger)' }}>{error}</p>
            ) : (
              <p className="transcript-text">
                {isTranscribing ? 'Processing speech with Whisper API…' : 'Recording in progress… Click Stop when finished.'}
              </p>
            )}
            <div className="controls-row">
              {isRecording && (
                <button onClick={stop} className="voice-action-btn">Stop</button>
              )}
              <button onClick={cancel} className="voice-action-btn">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
