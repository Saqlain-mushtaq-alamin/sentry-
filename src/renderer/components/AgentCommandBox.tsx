import React, { useState, useRef, useEffect } from 'react';
import { TaskState } from '../../shared/types';
import { VoiceControls } from './VoiceControls';
import './AgentCommandBox.css';

export interface AgentResultData {
  instruction: string;
  summary: string;
  timestamp: number;
}

interface AgentCommandBoxProps {
  onSendTask: (instruction: string) => void;
  onPause: () => void;
  onStop: () => void;
  onResume: () => void;
  taskState: TaskState;
  currentStep?: number;
  totalSteps?: number;
  lastMessage?: string;
  lastResult?: AgentResultData | null;
  onClearResult?: () => void;
  onSaveRecipe?: (instruction: string) => void;
  lastInstruction?: string;
  onExpandedChange?: (expanded: boolean) => void;
}

const STATE_LABELS: Record<TaskState, string> = {
  [TaskState.IDLE]: '● Ready',
  [TaskState.PLANNING]: '⟳ Planning…',
  [TaskState.AWAITING_CONFIRMATION]: '⚠ Awaiting approval',
  [TaskState.EXECUTING]: '▶ Executing',
  [TaskState.PAUSED]: '⏸ Paused',
  [TaskState.COMPLETED]: '✓ Done',
  [TaskState.FAILED]: '✗ Failed',
};

const STATE_COLORS: Record<TaskState, string> = {
  [TaskState.IDLE]: '#6ee7b7',
  [TaskState.PLANNING]: '#93c5fd',
  [TaskState.AWAITING_CONFIRMATION]: '#fbbf24',
  [TaskState.EXECUTING]: '#60a5fa',
  [TaskState.PAUSED]: '#d1d5db',
  [TaskState.COMPLETED]: '#34d399',
  [TaskState.FAILED]: '#f87171',
};

export const AgentCommandBox: React.FC<AgentCommandBoxProps> = ({
  onSendTask, onPause, onStop, onResume, onSaveRecipe, onExpandedChange,
  taskState, currentStep, totalSteps, lastMessage, lastResult, onClearResult, lastInstruction
}) => {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleCopyResult = () => {
    if (!lastResult?.summary) return;
    navigator.clipboard.writeText(lastResult.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeak = () => {
    if (!lastResult?.summary) return;
    if (isSpeaking) {
      window.sentry?.agent?.stopSpeech?.();
      setIsSpeaking(false);
    } else {
      window.sentry?.agent?.speak?.(lastResult.summary);
      setIsSpeaking(true);
    }
  };

  const isActive = [TaskState.PLANNING, TaskState.EXECUTING, TaskState.AWAITING_CONFIRMATION].includes(taskState);
  const isPaused = taskState === TaskState.PAUSED;
  const isIdle   = taskState === TaskState.IDLE || taskState === TaskState.COMPLETED || taskState === TaskState.FAILED;

  // Notify parent on expanded state change
  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  // IPC listener for shortcut toggle (from main process / WebContentsView)
  useEffect(() => {
    const unsubToggle = window.sentry?.agent?.onToggleCommandBox?.(() => {
      setExpanded((prev) => {
        const next = !prev;
        if (next) {
          setTimeout(() => inputRef.current?.focus(), 60);
        }
        return next;
      });
    });

    const unsubPause = window.sentry?.agent?.onShortcutPauseResume?.(() => {
      if (isActive) onPause();
      else if (isPaused) onResume();
    });

    const unsubStop = window.sentry?.agent?.onShortcutStop?.(() => {
      if (isActive || isPaused) onStop();
    });

    return () => {
      if (unsubToggle) unsubToggle();
      if (unsubPause) unsubPause();
      if (unsubStop) unsubStop();
    };
  }, [isActive, isPaused, onPause, onResume, onStop]);

  // Local window keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ' || e.key === 'Space')) {
        e.preventDefault();
        setExpanded((prev) => {
          const next = !prev;
          if (next) {
            setTimeout(() => inputRef.current?.focus(), 60);
          }
          return next;
        });
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        if (isActive) onPause();
        else if (isPaused) onResume();
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        if (isActive || isPaused) onStop();
      } else if (e.key === 'Escape' && expanded) {
        e.preventDefault();
        setExpanded(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, isPaused, onPause, onResume, onStop, expanded]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !isIdle) return;
    onSendTask(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const statusColor = STATE_COLORS[taskState];
  const statusLabel = STATE_LABELS[taskState];

  return (
    <div 
      className={`agent-command-box ${expanded ? 'expanded' : 'collapsed'}`}
      role="region"
      aria-label="Agent Command Center"
    >
      {/* ── Status bar (always visible) ─────────────────────────────── */}
      <div 
        className="agent-statusbar" 
        onClick={() => {
          setExpanded((e) => {
            const next = !e;
            if (next) {
              setTimeout(() => inputRef.current?.focus(), 60);
            }
            return next;
          });
        }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Agent Status: ${statusLabel}. Click to toggle panel.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setExpanded(!expanded);
          }
        }}
      >
        <span className="agent-indicator" style={{ background: statusColor }} />
        <span className="agent-status-label">
          {lastResult ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <span style={{ color: '#34d399', fontWeight: 600 }}>✓ AI Output:</span>
              <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lastResult.summary}
              </span>
            </span>
          ) : (
            <>
              {statusLabel} — <span style={{ color: '#94a3b8', fontWeight: 400 }}>Press Ctrl+Shift+Space for AI agent</span>
            </>
          )}
        </span>
        {isActive && currentStep !== undefined && (
          <span className="agent-step-counter" aria-live="polite">
            Step {currentStep}{totalSteps ? `/${totalSteps}` : ''}
          </span>
        )}
        <span className="agent-toggle">{expanded ? '▼ Close' : '▲ Open'}</span>
      </div>

      {/* ── Expanded panel ───────────────────────────────────────────── */}
      {expanded && (
        <div className="agent-panel">
          {/* Output / Result Card */}
          {lastResult && (
            <div className="agent-result-card">
              <div className="agent-result-header">
                <div className="agent-result-title">
                  <span className="agent-result-badge">🤖 AI Response</span>
                  <span className="agent-result-query" title={lastResult.instruction}>
                    "{lastResult.instruction}"
                  </span>
                </div>
                <div className="agent-result-actions">
                  <button 
                    className="agent-action-pill"
                    onClick={handleCopyResult}
                    title="Copy result to clipboard"
                  >
                    {copied ? '✓ Copied' : '📋 Copy'}
                  </button>
                  <button 
                    className="agent-action-pill"
                    onClick={handleToggleSpeak}
                    title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                  >
                    {isSpeaking ? '⏹ Stop' : '🔊 Listen'}
                  </button>
                  {onClearResult && (
                    <button 
                      className="agent-action-pill close"
                      onClick={onClearResult}
                      title="Clear output"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div className="agent-result-body">
                {lastResult.summary}
              </div>
            </div>
          )}

          {lastMessage && (
            <div className="agent-message" aria-live="polite">{lastMessage}</div>
          )}

          {/* Controls for active tasks */}
          {isActive && (
            <div className="agent-controls">
              <button className="agent-btn pause" onClick={onPause} aria-label="Pause Task (Ctrl+Shift+P)">⏸ Pause</button>
              <button className="agent-btn stop"  onClick={onStop} aria-label="Stop Task (Ctrl+Shift+S)">⏹ Stop</button>
            </div>
          )}

          {isPaused && (
            <div className="agent-controls">
              <button className="agent-btn resume" onClick={onResume} aria-label="Resume Task (Ctrl+Shift+P)">▶ Resume</button>
              <button className="agent-btn stop"   onClick={onStop} aria-label="Stop Task (Ctrl+Shift+S)">⏹ Stop</button>
            </div>
          )}

          {/* Input box for new tasks */}
          {isIdle && (
            <div className="agent-input-row">
              <textarea
                ref={inputRef}
                className="agent-textarea"
                rows={2}
                placeholder="Ask Sentry AI to do anything on this page… (Press Enter to run)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Agent instruction prompt"
              />
              <VoiceControls 
                onTranscriptReceived={(transcript) => {
                  setInput(transcript);
                }}
                onSendCommand={(command) => {
                  if (command.trim()) {
                    onSendTask(command.trim());
                    setInput('');
                  }
                }}
              />
              <button 
                className="agent-send-btn" 
                onClick={handleSend} 
                disabled={!input.trim()}
                aria-label="Send Task to Agent"
                title="Send instruction to AI agent"
              >
                ↵
              </button>
            </div>
          )}

          {taskState === TaskState.COMPLETED && lastInstruction && onSaveRecipe && (
            <div className="agent-recipe-prompt">
              <button 
                onClick={() => onSaveRecipe(lastInstruction)} 
                className="agent-btn save-recipe"
                aria-label="Save this completed task as a reusable recipe"
              >
                📋 Save as Recipe
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
