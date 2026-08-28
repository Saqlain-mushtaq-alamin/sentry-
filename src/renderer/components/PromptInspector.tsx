import React, { useState } from 'react';
import { TraceStep } from '../../shared/types';
import './PromptInspector.css';

interface PromptInspectorProps {
  steps?: TraceStep[];
  onCopyAll?: () => void;
}

export const PromptInspector: React.FC<PromptInspectorProps> = ({ steps = [], onCopyAll }) => {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [systemPromptExpanded, setSystemPromptExpanded] = useState<boolean>(false);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  if (!steps || steps.length === 0) {
    // Sample fallback data if no steps exist yet
    const fallbackStep: TraceStep = {
      stepNumber: 1,
      timestamp: new Date().toLocaleTimeString(),
      observation: 'Page URL: https://www.google.com | Interactive elements: 14',
      modelThought: 'I see the search box at element [0]. I should type the search query.',
      proposedAction: {
        id: 'action-1',
        type: 'type',
        target: '[0]',
        value: 'sentry ai browser',
        riskTier: 'low' as any,
        reason: 'Typing search query in search box',
        timestamp: Date.now(),
        tabId: 'tab-1',
        url: 'https://www.google.com',
      },
      firewallDecision: {
        actionId: 'action-1',
        allowed: true,
        requiresConfirmation: false,
        riskTier: 'low' as any,
        classification: { tier: 'low' as any, reasons: ['Standard search input'], policyRulesFired: ['safe-text-input'], confidence: 0.98 },
        siteTrust: 'read_act' as any,
        explanation: 'Low risk search query',
        detailedReason: 'Typing non-sensitive search text into public input element.',
      },
      injectionScanResult: { isClean: true, confidence: 1.0 },
      latency: { observation: 15, model: 1240, firewall: 8, execution: 85 },
      rawPrompt: {
        systemPrompt: 'You are Sentry, an AI browser assistant operating strictly under user oversight. Follow instructions, output JSON.',
        userMessage: `Current page snapshot:\nURL: https://www.google.com\n[0] Search box (role: searchbox)\n[1] "Google Search" button\n\nYour task: "Search for sentry ai browser"`,
        modelResponse: JSON.stringify({
          thought: 'I see the search box at element [0]',
          action: {
            type: 'type',
            target: '[0]',
            value: 'sentry ai browser',
            reason: 'Typing search query in search box'
          }
        }, null, 2),
        tokensIn: 1240,
        tokensOut: 89,
        latencyMs: 1340,
      }
    };
    steps = [fallbackStep];
  }

  const currentStep = steps[Math.min(currentStepIdx, steps.length - 1)];
  const raw = currentStep.rawPrompt || {
    systemPrompt: 'You are Sentry, an AI browser assistant operating strictly under user oversight.',
    userMessage: `Observation: ${currentStep.observation}\nTask instruction: "${currentStep.proposedAction.reason}"`,
    modelResponse: JSON.stringify({
      thought: currentStep.modelThought,
      action: {
        type: currentStep.proposedAction.type,
        target: currentStep.proposedAction.target,
        value: currentStep.proposedAction.value,
        reason: currentStep.proposedAction.reason,
      }
    }, null, 2),
    tokensIn: 850,
    tokensOut: 64,
    latencyMs: currentStep.latency.model || 980,
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotice(`${label} copied!`);
    setTimeout(() => setCopiedNotice(null), 2000);
  };

  return (
    <div className="prompt-inspector">
      <div className="inspector-header">
        <div className="inspector-title">
          <span>📝 Prompt Inspector (Step {currentStep.stepNumber})</span>
          {copiedNotice && <span style={{ color: '#4ade80', fontSize: '12px' }}>{copiedNotice}</span>}
        </div>
        <div className="inspector-step-controls">
          <button
            className="inspector-btn"
            disabled={currentStepIdx === 0}
            onClick={() => setCurrentStepIdx(prev => Math.max(0, prev - 1))}
          >
            Previous Step
          </button>
          <select
            className="inspector-step-select"
            value={currentStepIdx}
            onChange={(e) => setCurrentStepIdx(Number(e.target.value))}
          >
            {steps.map((s, idx) => (
              <option key={idx} value={idx}>
                Step {s.stepNumber} ({s.proposedAction.type})
              </option>
            ))}
          </select>
          <button
            className="inspector-btn"
            disabled={currentStepIdx >= steps.length - 1}
            onClick={() => setCurrentStepIdx(prev => Math.min(steps.length - 1, prev + 1))}
          >
            Next Step
          </button>
        </div>
      </div>

      {/* System Prompt */}
      <div className="inspector-section">
        <div
          className="inspector-section-header"
          onClick={() => setSystemPromptExpanded(!systemPromptExpanded)}
        >
          <span>System Prompt ({systemPromptExpanded ? 'Expanded' : 'Collapsed'})</span>
          <span>{systemPromptExpanded ? '▲' : '▼'}</span>
        </div>
        {systemPromptExpanded && (
          <div className="inspector-section-content">{raw.systemPrompt}</div>
        )}
      </div>

      {/* User Message */}
      <div className="inspector-section">
        <div className="inspector-section-header">
          <span>User Message / Page Snapshot</span>
        </div>
        <div className="inspector-section-content">{raw.userMessage}</div>
      </div>

      {/* Model Response */}
      <div className="inspector-section">
        <div className="inspector-section-header">
          <span>Model Response (JSON Output)</span>
        </div>
        <div className="inspector-section-content">{raw.modelResponse}</div>
      </div>

      {/* Metrics Banner */}
      <div className="inspector-metrics-bar">
        <span>
          Tokens: <strong>{raw.tokensIn ?? 1200}</strong> in / <strong>{raw.tokensOut ?? 80}</strong> out
        </span>
        <span>
          Model Latency: <strong>{raw.latencyMs ?? 1000} ms</strong>
        </span>
        <span>
          Action Exec: <strong>{currentStep.latency.execution} ms</strong>
        </span>
      </div>

      {/* Actions */}
      <div className="inspector-actions">
        <button
          className="inspector-btn"
          onClick={() => handleCopy(raw.userMessage, 'Prompt')}
        >
          Copy Prompt
        </button>
        <button
          className="inspector-btn"
          onClick={() => handleCopy(raw.modelResponse, 'Response')}
        >
          Copy Response
        </button>
        <button
          className="inspector-btn inspector-btn-primary"
          onClick={() => {
            const allText = `=== SYSTEM PROMPT ===\n${raw.systemPrompt}\n\n=== USER MESSAGE ===\n${raw.userMessage}\n\n=== MODEL RESPONSE ===\n${raw.modelResponse}`;
            handleCopy(allText, 'All prompt details');
            if (onCopyAll) onCopyAll();
          }}
        >
          Copy All
        </button>
      </div>
    </div>
  );
};
