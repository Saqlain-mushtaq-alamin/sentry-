import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { ProposedAction, RiskTier, ConfirmationResponse } from '../../shared/types';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface Props {
  action: ProposedAction;
  riskTier: RiskTier;
  explanation: string;
  domain: string;
  onConfirm: (r: ConfirmationResponse) => void;
  floating?: boolean;
}

export const ConfirmationBar: React.FC<Props> = ({
  action,
  riskTier,
  explanation,
  domain,
  onConfirm,
  floating = false,
}) => {
  const critical = riskTier === RiskTier.CRITICAL;
  const color = critical ? 'var(--danger)' : 'var(--warn)';

  return (
    <div
      role="alertdialog"
      className="confirmation-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 12px',
        marginBottom: floating ? 0 : '8px',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        ...(floating
          ? {
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              width: '360px',
              maxWidth: 'calc(100vw - 48px)',
              zIndex: 9999,
            }
          : {
              width: '100%',
            }),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldAlert size={15} style={{ color, flexShrink: 0 }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
            Permission Required
          </span>
        </div>
        <Badge variant={critical ? 'danger' : 'warn'} dot>
          {riskTier}
        </Badge>
      </div>

      <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
        <div style={{ color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>
          Sentry wants to <strong style={{ color: 'var(--accent)' }}>{action.type}</strong> on <strong>{domain}</strong>
          {!critical && action.value ? ` — "${action.value.slice(0, 45)}${action.value.length > 45 ? '…' : ''}"` : ''}
        </div>
        <div style={{ color: 'var(--text-2)', fontSize: '11px', marginTop: '3px', wordBreak: 'break-word' }}>
          {action.reason} {explanation ? `· ${explanation}` : ''}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onConfirm('allow_once')}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          Allow once
        </Button>
        {!critical && (
          <Button
            size="sm"
            onClick={() => onConfirm('allow_site')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Allow site
          </Button>
        )}
        <Button
          variant="danger"
          size="sm"
          onClick={() => onConfirm('deny')}
          style={{ justifyContent: 'center' }}
        >
          Deny
        </Button>
      </div>
    </div>
  );
};
