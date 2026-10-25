import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Play,
  Pause,
  Square,
  ChevronDown,
  ChevronRight,
  Send,
  Sparkles,
  BookmarkPlus,
} from 'lucide-react';
import { TaskState, ActionLogEntry, TaskPlan, ProposedAction, FirewallDecision, ConfirmationResponse } from '../../shared/types';
import { AgentResultCard } from './AgentResultCard';
import { ActionLog } from '../overlays/ActionLog';
import { VoiceControls } from './VoiceControls';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ConfirmationBar } from './ConfirmationBar';
import './AgentSidebar.css';

export interface AgentResultData {
  instruction: string;
  summary: string;
  timestamp: number;
}

interface AgentSidebarProps {
  taskState: TaskState;
  actionLog: ActionLogEntry[];
  plan?: TaskPlan;
  currentStep?: number;
  totalSteps?: number;
  lastMessage?: string;
  lastResult?: AgentResultData | null;
  routingDecision?: any;
  lastInstruction?: string;
  pendingConfirmation?: {
    action: ProposedAction;
    decision: FirewallDecision;
  } | null;
  onRespondConfirmation?: (response: ConfirmationResponse) => void;
  onClearResult?: () => void;
  onSendTask: (instruction: string) => void;
  onPause: () => void;
  onStop: () => void;
  onResume: () => void;
  onUndoLast: (entry: ActionLogEntry) => Promise<boolean>;
  onClose: () => void;
  onSaveRecipe?: (instruction: string) => void;
  onToggleVisionMode?: () => void;
  isVisionModeActive?: boolean;
  focusTrigger?: number;
}

const STATE_NAMES: Record<TaskState, { label: string; variant: 'ok' | 'warn' | 'danger' | 'accent' | 'neutral' }> = {
  [TaskState.IDLE]: { label: 'Ready', variant: 'neutral' },
  [TaskState.PLANNING]: { label: 'Planning…', variant: 'accent' },
  [TaskState.AWAITING_CONFIRMATION]: { label: 'Awaiting approval', variant: 'warn' },
  [TaskState.EXECUTING]: { label: 'Executing', variant: 'accent' },
  [TaskState.PAUSED]: { label: 'Paused', variant: 'warn' },
  [TaskState.COMPLETED]: { label: 'Completed', variant: 'ok' },
  [TaskState.FAILED]: { label: 'Failed', variant: 'danger' },
};

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  taskState,
  actionLog,
  plan,
  currentStep,
  totalSteps,
  lastMessage,
  lastResult,
  routingDecision,
  lastInstruction,
  pendingConfirmation,
  onRespondConfirmation,
  onClearResult,
  onSendTask,
  onPause,
  onStop,
  onResume,
  onClose,
  onSaveRecipe,
  focusTrigger,
}) => {
  const [input, setInput] = useState('');
  const [showLog, setShowLog] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when focusTrigger changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [focusTrigger]);

  const isActive = [TaskState.PLANNING, TaskState.EXECUTING, TaskState.AWAITING_CONFIRMATION].includes(taskState);
  const isPaused = taskState === TaskState.PAUSED;
  const isIdle = !isActive && !isPaused;

  const handleSend = () => {
    const text = input.trim();
    if (!text || !isIdle) return;
    onSendTask(text);
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = '36px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    const nextHeight = Math.min(120, Math.max(36, e.target.scrollHeight));
    e.target.style.height = `${nextHeight}px`;
  };

  const isCloud = routingDecision?.isCloud ?? false;
  const provider = routingDecision?.adapter?.providerId || (isCloud ? 'Cloud' : 'Local');
  const stateInfo = STATE_NAMES[taskState] || { label: 'Ready', variant: 'neutral' };

  return (
    <aside className="agent-sidebar" aria-label="Agent Sidebar">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="agent-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bot size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
            Agent
          </span>
          <Badge variant={isCloud ? 'accent' : 'neutral'} dot>
            {isCloud ? `Cloud: ${provider}` : 'Local'}
          </Badge>
        </div>

        <IconButton label="Close Agent (Ctrl+Shift+Space)" onClick={onClose}>
          <X size={15} />
        </IconButton>
      </div>

      {/* ── Scrollable Body ───────────────────────────────────── */}
      <div className="agent-sidebar-body">
        {/* Status bar if active / paused */}
        {(isActive || isPaused) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              background: 'var(--bg-2)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`status-dot ${stateInfo.variant}`} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
                {stateInfo.label}
              </span>
              {currentStep !== undefined && (
                <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                  ({currentStep}{totalSteps ? `/${totalSteps}` : ''})
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {isActive && (
                <Button variant="secondary" size="sm" onClick={onPause} icon={<Pause size={12} />}>
                  Pause
                </Button>
              )}
              {isPaused && (
                <Button variant="primary" size="sm" onClick={onResume} icon={<Play size={12} />}>
                  Resume
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={onStop} icon={<Square size={11} />}>
                Stop
              </Button>
            </div>
          </div>
        )}

        {/* Live message if running */}
        {lastMessage && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-2)',
              padding: '6px 10px',
              background: 'var(--bg-2)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              lineHeight: 1.4,
            }}
          >
            {lastMessage}
          </div>
        )}

        {/* AI Result Card */}
        {lastResult && (
          <AgentResultCard
            instruction={lastResult.instruction}
            summary={lastResult.summary}
            timestamp={lastResult.timestamp}
            onClear={onClearResult}
          />
        )}

        {/* Save Recipe Action */}
        {taskState === TaskState.COMPLETED && lastInstruction && onSaveRecipe && (
          <div style={{ display: 'flex' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSaveRecipe(lastInstruction)}
              icon={<BookmarkPlus size={13} style={{ color: 'var(--ok)' }} />}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Save as recipe
            </Button>
          </div>
        )}

        {/* Plan card if available */}
        {plan && plan.steps.length > 0 && (
          <div
            style={{
              padding: '10px',
              background: 'var(--bg-2)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)' }}>
              Plan ({plan.steps.length} steps)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {plan.steps.map((step) => {
                const isDone = currentStep !== undefined && step.stepNumber < currentStep;
                const isCurrent = currentStep === step.stepNumber;
                return (
                  <div
                    key={step.stepNumber}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: isDone ? 'var(--text-3)' : isCurrent ? 'var(--text)' : 'var(--text-2)',
                    }}
                  >
                    <span
                      className={`status-dot ${isDone ? 'ok' : isCurrent ? 'accent' : 'neutral'}`}
                      style={{ width: '6px', height: '6px' }}
                    />
                    <span style={{ textDecoration: isDone ? 'line-through' : 'none' }}>
                      {step.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Log Accordion */}
        {actionLog.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => setShowLog(!showLog)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-2)',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <span>Activity log ({actionLog.length})</span>
              {showLog ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {showLog && (
              <div
                style={{
                  maxHeight: '280px',
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px',
                  background: 'var(--bg-0)',
                }}
              >
                <ActionLog entries={actionLog} />
              </div>
            )}
          </div>
        )}

        {/* Empty state hint */}
        {!lastResult && actionLog.length === 0 && !isActive && (
          <div className="agent-empty-state">
            <Sparkles size={24} style={{ color: 'var(--accent)', opacity: 0.8 }} />
            <p className="empty-title">Ask Sentry to do something…</p>
            <p className="empty-desc">
              Browse, summarize, compare tabs, or interact with this page.
            </p>
            <span className="empty-shortcut">Ctrl+Shift+Space to focus</span>
          </div>
        )}
      </div>

      {/* ── Pinned Footer: Prompt Input Box ───────────────────── */}
      <div className="agent-sidebar-footer">
        {pendingConfirmation && onRespondConfirmation && (
          <ConfirmationBar
            action={pendingConfirmation.action}
            riskTier={pendingConfirmation.decision.riskTier}
            explanation={pendingConfirmation.decision.explanation}
            domain={(() => {
              try {
                return new URL(pendingConfirmation.action.url).hostname;
              } catch {
                return 'this site';
              }
            })()}
            onConfirm={onRespondConfirmation}
          />
        )}
        <div className="agent-input-container">
          <textarea
            ref={inputRef}
            className="agent-textarea"
            placeholder="Ask Sentry to do something…"
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!isIdle}
          />

          <div className="agent-input-actions">
            <VoiceControls
              onTranscriptReceived={(transcript) => {
                setInput(transcript);
              }}
              onSendCommand={(command) => {
                if (command.trim() && isIdle) {
                  onSendTask(command.trim());
                  setInput('');
                }
              }}
            />

            <button
              className="agent-send-button"
              onClick={handleSend}
              disabled={!input.trim() || !isIdle}
              title="Run instruction (Enter)"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
