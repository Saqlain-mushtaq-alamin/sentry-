import React from 'react';
import { ActionLogEntry, RiskTier } from '../../shared/types';
import './WhyExplanation.css';

interface WhyExplanationProps {
  entry: ActionLogEntry;
  onClose: () => void;
}

export const WhyExplanation: React.FC<WhyExplanationProps> = ({ entry, onClose }) => {
  const { action, decision } = entry;
  const riskTier = decision.riskTier || action.riskTier || RiskTier.LOW;

  const getTierIcon = (tier: RiskTier) => {
    switch (tier) {
      case RiskTier.LOW: return '🟢';
      case RiskTier.MEDIUM: return '🟡';
      case RiskTier.HIGH: return '🟠';
      case RiskTier.CRITICAL: return '🔴';
    }
  };

  return (
    <div className="why-modal-backdrop" onClick={onClose}>
      <div className="why-card" onClick={(e) => e.stopPropagation()}>
        <div className="why-header">
          <h3>❓ Why did Sentry do this?</h3>
          <button className="why-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="why-body">
          <div className="why-action-title">
            <span>{getTierIcon(riskTier)}</span>
            <strong>{action.type.toUpperCase()}</strong> on <code>{action.target || 'page'}</code>
          </div>

          <div className="why-section">
            <label>Agent's Stated Reason:</label>
            <p className="why-reason-text">"{action.reason || 'No explicit reason specified.'}"</p>
          </div>

          {action.value && (
            <div className="why-section">
              <label>Value / Payload Used:</label>
              <code className="why-code">{action.value}</code>
            </div>
          )}

          <div className="why-grid">
            <div>
              <label>Risk Classification:</label>
              <span>{getTierIcon(riskTier)} {riskTier.toUpperCase()}</span>
            </div>
            <div>
              <label>Domain Trust Level:</label>
              <span>{decision.siteTrust ? String(decision.siteTrust) : 'READ_ACT'}</span>
            </div>
            <div>
              <label>Policy Rules Fired:</label>
              <span>{decision.classification?.policyRulesFired?.join(', ') || 'Default Rule'}</span>
            </div>
            <div>
              <label>Firewall Decision:</label>
              <span>{decision.allowed ? 'Allowed' : 'Blocked / Required Confirmation'}</span>
            </div>
          </div>

          <div className="why-meta">
            <span><strong>URL:</strong> {action.url || 'Unknown'}</span>
            <span><strong>Timestamp:</strong> {new Date(action.timestamp || Date.now()).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
