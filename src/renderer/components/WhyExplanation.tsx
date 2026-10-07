import React from 'react';
import { HelpCircle, X } from 'lucide-react';
import { ActionLogEntry, RiskTier } from '../../shared/types';
import { useHideNativeView } from '../hooks/useHideNativeView';
import { IconButton } from './ui/IconButton';
import { Badge } from './ui/Badge';
import './WhyExplanation.css';

interface WhyExplanationProps {
  entry: ActionLogEntry;
  onClose: () => void;
}

export const WhyExplanation: React.FC<WhyExplanationProps> = ({ entry, onClose }) => {
  useHideNativeView(true);

  const { action, decision } = entry;
  const riskTier = decision?.riskTier || action?.riskTier || RiskTier.LOW;

  const getTierInfo = (tier: RiskTier): { label: string; variant: 'ok' | 'warn' | 'danger' } => {
    switch (tier) {
      case RiskTier.LOW:
        return { label: 'Low risk', variant: 'ok' };
      case RiskTier.MEDIUM:
        return { label: 'Medium risk', variant: 'warn' };
      case RiskTier.HIGH:
        return { label: 'High risk', variant: 'warn' };
      case RiskTier.CRITICAL:
        return { label: 'Critical risk', variant: 'danger' };
      default:
        return { label: 'Low risk', variant: 'ok' };
    }
  };

  const tierInfo = getTierInfo(riskTier);

  return (
    <div className="why-modal-backdrop" onClick={onClose}>
      <div className="why-card" onClick={(e) => e.stopPropagation()}>
        <div className="why-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HelpCircle size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
              Action details
            </span>
          </div>
          <IconButton label="Close" onClick={onClose} style={{ width: '24px', height: '24px' }}>
            <X size={14} />
          </IconButton>
        </div>

        <div className="why-body">
          <div className="why-action-title">
            <Badge variant={tierInfo.variant} dot>
              {tierInfo.label}
            </Badge>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>
              {action.type}
            </span>
            <span style={{ color: 'var(--text-3)' }}>on</span>
            <code className="why-code">{action.target || 'page'}</code>
          </div>

          <div className="why-section">
            <span className="why-section-label">Agent reason:</span>
            <p className="why-reason-text">"{action.reason || 'No explicit reason specified.'}"</p>
          </div>

          {action.value && (
            <div className="why-section">
              <span className="why-section-label">Input payload:</span>
              <code className="why-code">{action.value}</code>
            </div>
          )}

          <div className="why-grid">
            <div className="why-grid-item">
              <span className="why-grid-label">Risk classification:</span>
              <span className="why-grid-val">{tierInfo.label}</span>
            </div>
            <div className="why-grid-item">
              <span className="why-grid-label">Domain trust:</span>
              <span className="why-grid-val">{decision?.siteTrust ? String(decision.siteTrust) : 'Standard'}</span>
            </div>
            <div className="why-grid-item">
              <span className="why-grid-label">Policy rules:</span>
              <span className="why-grid-val">{decision?.classification?.policyRulesFired?.join(', ') || 'Default policy'}</span>
            </div>
            <div className="why-grid-item">
              <span className="why-grid-label">Decision:</span>
              <span className="why-grid-val">{decision?.allowed ? 'Permitted' : 'Blocked / Required confirmation'}</span>
            </div>
          </div>

          <div className="why-meta">
            <span><strong>URL:</strong> {action.url || 'Active tab'}</span>
            <span><strong>Time:</strong> {new Date(action.timestamp || Date.now()).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
