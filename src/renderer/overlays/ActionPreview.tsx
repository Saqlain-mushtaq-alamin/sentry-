import React, { useState } from 'react';
import { ProposedAction, RiskTier, FieldDiff } from '../../shared/types';
import './ActionPreview.css';

interface ActionPreviewProps {
  action: ProposedAction;
  riskTier: RiskTier;
  explanation: string;
  diffs?: FieldDiff[];
  nextActionSummary?: string;
  onConfirmSubmit: (modifiedValue?: string, modifiedDiffs?: FieldDiff[]) => void;
  onConfirmFillOnly?: (modifiedDiffs?: FieldDiff[]) => void;
  onCancel: () => void;
}

export const ActionPreview: React.FC<ActionPreviewProps> = ({
  action,
  riskTier,
  explanation,
  diffs: initialDiffs = [],
  nextActionSummary,
  onConfirmSubmit,
  onConfirmFillOnly,
  onCancel,
}) => {
  const [diffs, setDiffs] = useState<FieldDiff[]>(
    initialDiffs.length > 0
      ? initialDiffs
      : [
          {
            label: action.target || 'Input Field',
            selector: action.target || '',
            currentValue: '(empty)',
            newValue: action.value || '',
          },
        ]
  );
  const [singleValue, setSingleValue] = useState(action.value || '');

  const handleDiffValueChange = (index: number, val: string) => {
    setDiffs((prev) =>
      prev.map((d, i) => (i === index ? { ...d, newValue: val } : d))
    );
  };

  const isCritical = riskTier === RiskTier.CRITICAL;

  return (
    <div className="preview-modal-backdrop">
      <div className={`action-preview-card ${isCritical ? 'critical' : 'high'}`}>
        <div className="preview-header">
          <span className="preview-badge">
            {isCritical ? '🔴 CRITICAL ACTION PREVIEW' : '📝 ACTION DIFF PREVIEW'}
          </span>
          <h3>{action.reason || 'Sentry proposed a state-changing action'}</h3>
        </div>

        <div className="preview-body">
          <p className="preview-explanation">{explanation}</p>

          {diffs.length > 0 && (
            <div className="diff-table-container">
              <div className="diff-table-header">
                <span>Field</span>
                <span>Current Value</span>
                <span>→ Proposed New Value (Editable)</span>
              </div>
              {diffs.map((d, idx) => (
                <div className="diff-row" key={idx}>
                  <div className="diff-field-label">
                    <strong>{d.label}</strong>
                    <span className="diff-selector">{d.selector}</span>
                  </div>
                  <div className="diff-current-val">{d.currentValue || '(empty)'}</div>
                  <div className="diff-new-val">
                    <input
                      type="text"
                      className="diff-input"
                      value={d.newValue}
                      onChange={(e) => handleDiffValueChange(idx, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {nextActionSummary && (
            <div className="next-action-callout">
              ⚡ <strong>Next Step:</strong> {nextActionSummary}
            </div>
          )}

          <div className="preview-hint">
            ✏️ You can click and edit any proposed values before confirming.
          </div>
        </div>

        <div className="preview-footer">
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>

          {onConfirmFillOnly && (
            <button
              className="btn-fill-only"
              onClick={() => onConfirmFillOnly(diffs)}
            >
              Confirm Fill Only
            </button>
          )}

          <button
            className={`btn-confirm ${isCritical ? 'critical-btn' : ''}`}
            onClick={() => onConfirmSubmit(diffs[0]?.newValue || singleValue, diffs)}
          >
            {isCritical ? 'Confirm & Execute' : 'Confirm & Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
};
