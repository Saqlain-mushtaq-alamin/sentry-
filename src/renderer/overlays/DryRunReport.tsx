import React from 'react';
import { DryRunReport as DryRunReportType, RiskTier } from '../../shared/types';
import './DryRunReport.css';

interface DryRunReportProps {
  report: DryRunReportType;
  onExecutePlan: () => void;
  onCancel: () => void;
}

export const DryRunReport: React.FC<DryRunReportProps> = ({
  report,
  onExecutePlan,
  onCancel,
}) => {
  const getRiskBadge = (tier: RiskTier) => {
    switch (tier) {
      case RiskTier.LOW: return <span className="risk-badge low">🟢 LOW</span>;
      case RiskTier.MEDIUM: return <span className="risk-badge med">🟡 MED</span>;
      case RiskTier.HIGH: return <span className="risk-badge high">🟠 HIGH</span>;
      case RiskTier.CRITICAL: return <span className="risk-badge crit">🔴 CRITICAL</span>;
    }
  };

  return (
    <div className="dry-run-modal-backdrop">
      <div className="dry-run-card">
        <div className="dry-run-header">
          <div className="dry-run-title">
            <span>🔍 Dry Run Simulation Complete</span>
            <span className="safe-tag">No actions were executed</span>
          </div>
          <p className="dry-run-subtitle">
            Estimated duration: <strong>{report.estimatedTime}</strong> | Peak Risk Tier: {getRiskBadge(report.highestRisk)}
          </p>
        </div>

        <div className="dry-run-body">
          {report.warnings.length > 0 && (
            <div className="dry-run-warnings">
              <strong>⚠️ Simulation Warnings:</strong>
              <ul>
                {report.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="simulated-steps-list">
            <h4>Predicted Step Execution Sequence:</h4>
            {report.steps.map((step) => (
              <div className="simulated-step-item" key={step.stepNumber}>
                <div className="step-num-col">Step {step.stepNumber}</div>
                <div className="step-desc-col">
                  <strong>{step.description}</strong>
                  <div className="step-explanation">{step.explanation}</div>
                </div>
                <div className="step-risk-col">{getRiskBadge(step.predictedRisk)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="dry-run-footer">
          <button className="btn-dry-cancel" onClick={onCancel}>
            Cancel Plan
          </button>
          <button className="btn-dry-execute" onClick={onExecutePlan}>
            Execute This Plan ▶
          </button>
        </div>
      </div>
    </div>
  );
};
