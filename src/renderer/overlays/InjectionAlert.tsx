import React from 'react';
import { ShieldAlert, Check } from 'lucide-react';
import { useHideNativeView } from '../hooks/useHideNativeView';
import { Button } from '../components/ui/Button';
import './InjectionAlert.css';

interface DetectionResult {
  isInjection: boolean;
  confidence: number;
  matchedPatterns: string[];
  sourceText: string;
  sourceLocation: string;
  explanation: string;
}

interface ScanReport {
  isClean: boolean;
  detections: DetectionResult[];
  hiddenContentFound: number;
  sanitizedSnapshot: any;
  scanDuration: number;
}

interface InjectionAlertProps {
  report: ScanReport;
  onDismiss: () => void;
  onReportFalsePositive: () => void;
}

export const InjectionAlert: React.FC<InjectionAlertProps> = ({
  report,
  onDismiss,
  onReportFalsePositive,
}) => {
  useHideNativeView(true);

  const primaryDetection = report?.detections?.[0] || {
    sourceLocation: 'Page DOM',
    sourceText: 'Attempted prompt injection sequence',
    matchedPatterns: ['system_prompt_override'],
  };

  return (
    <div className="injection-alert-overlay" onClick={onDismiss}>
      <div className="injection-alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="injection-alert-header">
          <ShieldAlert size={18} style={{ color: 'var(--warn)', flexShrink: 0 }} />
          <h2>Suspicious content blocked on this page</h2>
        </div>

        <div className="injection-alert-body">
          <p className="intro-text">
            Sentry's safety filter neutralized text that attempted to override the AI agent's instructions before it could execute:
          </p>

          <div className="detection-details">
            <div className="detail-row">
              <span className="detail-label">Source:</span>
              <span className="detail-val">{primaryDetection.sourceLocation}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Content:</span>
              <code className="suspicious-content">"{primaryDetection.sourceText}"</code>
            </div>
            {primaryDetection.matchedPatterns && primaryDetection.matchedPatterns.length > 0 && (
              <div className="detail-row">
                <span className="detail-label">Matched pattern:</span>
                <span className="detail-val">{primaryDetection.matchedPatterns.join(', ')}</span>
              </div>
            )}
          </div>

          <div className="what-happened">
            <h3>Safety summary</h3>
            <ul>
              <li><Check size={13} style={{ color: 'var(--ok)' }} /> Potentially hostile instructions were stripped</li>
              <li><Check size={13} style={{ color: 'var(--ok)' }} /> No unauthorized actions were executed</li>
              <li><Check size={13} style={{ color: 'var(--ok)' }} /> Your browsing session remains secure</li>
            </ul>
          </div>
        </div>

        <div className="injection-alert-footer">
          <Button variant="secondary" size="sm" onClick={onReportFalsePositive}>
            Report false positive
          </Button>
          <Button variant="primary" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
};
