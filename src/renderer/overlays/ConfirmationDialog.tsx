import React from 'react';
import { ProposedAction, RiskTier, SiteTrustLevel } from '../../shared/types';
import './ConfirmationDialog.css';

interface ConfirmationDialogProps {
  action: ProposedAction;
  riskTier: RiskTier;
  siteTrust: SiteTrustLevel;
  explanation: string;
  onConfirm: (response: 'allow_once' | 'allow_site' | 'deny') => void;
  domain: string;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  action,
  riskTier,
  siteTrust,
  explanation,
  onConfirm,
  domain
}) => {
  const isCritical = riskTier === RiskTier.CRITICAL;

  return (
    <div className="modal-backdrop">
      <div 
        className={`confirmation-dialog ${isCritical ? 'critical' : 'high'}`}
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <div className="dialog-header" id="confirm-title">
          {isCritical ? '🔴 CRITICAL ACTION REQUIRES APPROVAL' : '🟠 Sentry wants to perform an action'}
        </div>
        
        <div className="dialog-body" id="confirm-desc">
          <p><strong>Action:</strong> {action.type.toUpperCase()} on {action.target}</p>
          
          {siteTrust === SiteTrustLevel.HIGHLY_RESTRICTED && (
            <div className="warning-box">
              ⚠️ This site ({domain}) is marked as HIGHLY RESTRICTED.
            </div>
          )}
          
          <div className="explanation-box">
            <strong>Exactly what will happen:</strong>
            <p>{explanation}</p>
          </div>
          
          {action.value && (
            <div className="data-box">
              <strong>Data being used:</strong>
              <code>{action.value}</code>
            </div>
          )}

          <div className="reason-box">
            <strong>Why the agent wants to do this:</strong>
            <p>"{action.reason}"</p>
          </div>
        </div>

        <div className="dialog-footer">
          {isCritical ? (
            <>
              <button className="btn-deny" onClick={() => onConfirm('deny')} aria-label="Deny this action">Deny</button>
              <button className="btn-allow-once critical-btn" onClick={() => onConfirm('allow_once')} aria-label="Allow this single critical action">
                Allow This One Action
              </button>
              <div className="footer-note">
                ℹ️ This action cannot be pre-approved for future use. You will be asked again next time.
              </div>
            </>
          ) : (
            <>
              <button className="btn-deny" onClick={() => onConfirm('deny')} aria-label="Deny this action">Deny</button>
              <button className="btn-allow-site" onClick={() => onConfirm('allow_site')} aria-label={`Allow all actions for ${domain}`}>
                Allow for {domain}
              </button>
              <button className="btn-allow-once" onClick={() => onConfirm('allow_once')} aria-label="Allow this single action">
                Allow Once
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
