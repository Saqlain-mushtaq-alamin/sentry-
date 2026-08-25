import React, { useState, useRef, useEffect } from 'react';
import { TaskState } from '../../shared/types';
import { VoiceControls } from './VoiceControls';
import './AgentCommandBox.css';

interface AgentCommandBoxProps {
  onSendTask: (instruction: string) => void;
  onPause: () => void;
  onStop: () => void;
  onResume: () => void;
  taskState: TaskState;
  currentStep?: number;
  totalSteps?: number;
  lastMessage?: string;
  onSaveRecipe?: (instruction: string) => void;
  lastInstruction?: string;
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
  onSendTask, onPause, onStop, onResume, onSaveRecipe,
  taskState, currentStep, totalSteps, lastMessage, lastInstruction
}) => {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isActive = [TaskState.PLANNING, TaskState.EXECUTING, TaskState.AWAITING_CONFIRMATION].includes(taskState);
  const isPaused = taskState === TaskState.PAUSED;
  const isIdle   = taskState === TaskState.IDLE || taskState === TaskState.COMPLETED || taskState === TaskState.FAILED;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        setExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (isActive) onPause();
        else if (isPaused) onResume();
      } else if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (isActive || isPaused) onStop();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, isPaused, onPause, onResume, onStop]);

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
        onClick={() => setExpanded(e => !e)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Agent Status: ${statusLabel}. Click to toggle panel.`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
      >
        <span className="agent-indicator" style={{ background: statusColor }} />
        <span className="agent-status-label">{statusLabel}</span>
        {isActive && currentStep !== undefined && (
          <span className="agent-step-counter" aria-live="polite">
            Step {currentStep}{totalSteps ? `/${totalSteps}` : ''}
          </span>
        )}
        <span className="agent-toggle">{expanded ? '▼' : '▲'}</span>
      </div>

      {/* ── Expanded panel ───────────────────────────────────────────── */}
      {expanded && (
        <div className="agent-panel">
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
                placeholder="Ask Sentry to help… (Ctrl+Shift+Space)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Agent instruction prompt"
              />
              <VoiceControls 
                onTranscriptReceived={(transcript) => {
                  setInput(transcript);
                }}
              />
              <button 
                className="agent-send-btn" 
                onClick={handleSend} 
                disabled={!input.trim()}
                aria-label="Send Task to Agent"
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
