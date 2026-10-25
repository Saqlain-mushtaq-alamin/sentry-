import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Send, Check } from 'lucide-react';
import './VoiceControls.css';

interface VoiceControlsProps {
  onTranscriptReceived?: (transcript: string) => void;
  onSendCommand?: (command: string) => void;
  onListeningStateChange?: (isListening: boolean) => void;
  autoSendDefault?: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  onTranscriptReceived,
  onSendCommand,
  onListeningStateChange,
  autoSendDefault = false,
}) => {
  const recRef = useRef<MediaRecorder | null>(null);
  const speechRecRef = useRef<any>(null);
  const chunks = useRef<Blob[]>([]);
  const webSpeechResultRef = useRef<string>('');
  
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [liveText, setLiveText] = useState('');
  const [error, setError] = useState('');
  const [autoSend, setAutoSend] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('sentry:voice:autoSend');
      return stored !== null ? stored === 'true' : autoSendDefault;
    } catch {
      return autoSendDefault;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sentry:voice:autoSend', String(autoSend));
    } catch {
      // ignore
    }
  }, [autoSend]);

  const handleFinishTranscript = (text: string, forceSend = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    onTranscriptReceived?.(trimmed);

    if ((forceSend || autoSend) && onSendCommand) {
      onSendCommand(trimmed);
    }
  };

  const start = async () => {
    setError('');
    setLiveText('');
    webSpeechResultRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunks.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      // Try browser SpeechRecognition for live interim results if available
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const sr = new SpeechRecognition();
          sr.continuous = true;
          sr.interimResults = true;
          sr.lang = navigator.language || 'en-US';

          sr.onresult = (event: any) => {
            let interim = '';
            let final = '';
            for (let i = 0; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                final += event.results[i][0].transcript + ' ';
              } else {
                interim += event.results[i][0].transcript;
              }
            }
            const currentText = (final + interim).trim();
            if (currentText) {
              setLiveText(currentText);
              webSpeechResultRef.current = currentText;
            }
          };

          sr.onerror = () => {
            // SpeechRecognition network or recognition error - fallback to Whisper MediaRecorder
            try {
              sr.stop();
            } catch {
              // ignore
            }
          };

          sr.start();
          speechRecRef.current = sr;
        } catch {
          speechRecRef.current = null;
        }
      }

      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (speechRecRef.current) {
          try {
            speechRecRef.current.stop();
          } catch {
            // ignore
          }
          speechRecRef.current = null;
        }

        // If Web Speech API already captured the text, use it directly!
        if (webSpeechResultRef.current && webSpeechResultRef.current.trim()) {
          setStatus('idle');
          onListeningStateChange?.(false);
          handleFinishTranscript(webSpeechResultRef.current);
          return;
        }

        setStatus('transcribing');
        try {
          const actualMime = rec.mimeType || 'audio/webm';
          const blob = new Blob(chunks.current, { type: actualMime });
          const arrayBuffer = await blob.arrayBuffer();

          if (!window.sentry?.voice?.transcribe) {
            throw new Error('Voice transcription service is not ready.');
          }

          const text = await window.sentry.voice.transcribe(arrayBuffer, actualMime);
          if (text && text.trim()) {
            setLiveText(text.trim());
            handleFinishTranscript(text.trim());
          } else {
            setError('No speech detected. Please speak clearly into your microphone.');
          }
        } catch (e: any) {
          const msg = e?.message || 'Transcription failed';
          setError(msg);
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

  const stop = (forceSend = false) => {
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        // ignore
      }
    }

    if (recRef.current && recRef.current.state === 'recording') {
      if (forceSend && webSpeechResultRef.current) {
        // Trigger send immediately with existing speech
        const text = webSpeechResultRef.current;
        recRef.current.onstop = null;
        recRef.current.stop();
        setStatus('idle');
        onListeningStateChange?.(false);
        handleFinishTranscript(text, true);
        return;
      }
      recRef.current.stop();
    }
  };

  const cancel = () => {
    if (speechRecRef.current) {
      try {
        speechRecRef.current.abort();
      } catch {
        // ignore
      }
      speechRecRef.current = null;
    }
    if (recRef.current && recRef.current.state === 'recording') {
      recRef.current.onstop = null;
      recRef.current.stop();
    }
    chunks.current = [];
    webSpeechResultRef.current = '';
    setStatus('idle');
    setLiveText('');
    setError('');
    onListeningStateChange?.(false);
  };

  const isRecording = status === 'recording';
  const isTranscribing = status === 'transcribing';

  return (
    <div className="voice-controls" role="region" aria-label="Voice Command Controls">
      <button
        type="button"
        className={`voice-btn ${isRecording ? 'listening' : ''} ${isTranscribing ? 'transcribing' : ''}`}
        onClick={isRecording ? () => stop() : start}
        disabled={isTranscribing}
        title={isRecording ? 'Stop voice recording' : isTranscribing ? 'Transcribing audio...' : 'Give command via voice'}
        aria-label={isRecording ? 'Stop voice recording' : 'Give command via voice'}
      >
        {isTranscribing ? <Loader2 size={13} className="spin" /> : isRecording ? <MicOff size={13} /> : <Mic size={13} />}
      </button>

      {(isRecording || isTranscribing || error || liveText) && (
        <div className="voice-transcript-overlay" role="status" aria-live="polite">
          <div className="transcript-box">
            <div className="transcript-header">
              <span className="listening-indicator">
                {isTranscribing
                  ? 'Transcribing audio…'
                  : isRecording
                  ? 'Listening… Speak your command'
                  : error
                  ? 'Voice Error'
                  : 'Command recognized'}
              </span>
              {isRecording && (
                <div className="voice-sound-wave" aria-hidden="true">
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                  <span className="wave-bar"></span>
                </div>
              )}
            </div>

            {error ? (
              <p className="transcript-text error-msg">{error}</p>
            ) : liveText ? (
              <p className="transcript-text active-transcript">"{liveText}"</p>
            ) : (
              <p className="transcript-text placeholder-transcript">
                {isTranscribing
                  ? 'Processing with Whisper AI…'
                  : 'Speak a command (e.g., "Search for laptops on eBay", "Summarize this article")'}
              </p>
            )}

            {onSendCommand && (
              <label className="voice-auto-send-toggle">
                <input
                  type="checkbox"
                  checked={autoSend}
                  onChange={(e) => setAutoSend(e.target.checked)}
                />
                <span>Auto-run command when finished speaking</span>
              </label>
            )}

            <div className="controls-row">
              {isRecording ? (
                <>
                  {onSendCommand && (
                    <button
                      type="button"
                      onClick={() => stop(true)}
                      className="voice-action-btn primary"
                      title="Finish and run command immediately"
                    >
                      <Send size={11} /> Run Command
                    </button>
                  )}
                  <button type="button" onClick={() => stop(false)} className="voice-action-btn">
                    Stop
                  </button>
                </>
              ) : liveText && onSendCommand ? (
                <button
                  type="button"
                  onClick={() => {
                    handleFinishTranscript(liveText, true);
                    cancel();
                  }}
                  className="voice-action-btn primary"
                >
                  <Send size={11} /> Run Command
                </button>
              ) : null}
              <button type="button" onClick={cancel} className="voice-action-btn cancel">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
