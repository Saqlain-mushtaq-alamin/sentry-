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
}

export const ConfirmationBar: React.FC<Props> = ({ action, riskTier, explanation, domain, onConfirm }) => {
  const critical = riskTier === RiskTier.CRITICAL;
  const color = critical ? 'var(--danger)' : 'var(--warn)';
  return (
    <div
      role="alertdialog"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        flexShrink: 0,
        background: 'var(--bg-2)',
        borderBottom: '1px solid var(--border)',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <ShieldAlert size={16} style={{ color, flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1, fontSize: 12, lineHeight: 1.4 }}>
        <div style={{ color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Sentry wants to {action.type} on {domain}
          {!critical && action.value ? ` — "${action.value.slice(0, 40)}"` : ''}
        </div>
        <div style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {action.reason} · {explanation}
        </div>
      </div>
      <Badge variant={critical ? 'danger' : 'warn'} dot>{riskTier}</Badge>
      <Button variant="primary" size="sm" onClick={() => onConfirm('allow_once')}>Allow once</Button>
      {!critical && <Button size="sm" onClick={() => onConfirm('allow_site')}>Allow on this site</Button>}
      <Button variant="danger" size="sm" onClick={() => onConfirm('deny')}>Deny</Button>
    </div>
  );
};
