import React from 'react';
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

export const InjectionAlert: React.FC<InjectionAlertProps> = ({ report, onDismiss, onReportFalsePositive }) => {
  const primaryDetection = report.detections[0];

  return (
    <div className="injection-alert-overlay">
      <div className="injection-alert-modal">
        <div className="injection-alert-header">
          <span className="icon">🛡️</span>
          <h2>PROMPT INJECTION DETECTED</h2>
        </div>
        
        <div className="injection-alert-body">
          <p className="intro-text">
            This page contains hidden or suspicious text that attempted to override Sentry's instructions:
          </p>
          
          <div className="detection-details">
            <div className="detail-row">
              <strong>Source:</strong> <span>{primaryDetection.sourceLocation}</span>
            </div>
            <div className="detail-row">
              <strong>Content:</strong> 
              <code className="suspicious-content">"{primaryDetection.sourceText}"</code>
            </div>
            <div className="detail-row">
              <strong>Matched Pattern:</strong> <span>{primaryDetection.matchedPatterns.join(', ')}</span>
            </div>
          </div>
          
          <div className="what-happened">
            <h3>What happened:</h3>
            <ul>
              <li>✅ The malicious content was detected</li>
              <li>✅ It was removed before reaching the AI agent</li>
              <li>✅ No unsafe actions were taken</li>
            </ul>
          </div>
          
          <div className="why-matters">
            <h3>Why this matters:</h3>
            <p>
              Webpage content cannot override your instructions to Sentry. This is a safety feature that prevents websites from hijacking the agent to exfiltrate data or perform unauthorized actions.
            </p>
          </div>
        </div>
        
        <div className="injection-alert-footer">
          <button className="btn-secondary" onClick={onReportFalsePositive}>Report False Positive</button>
          <button className="btn-primary" onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  );
};
