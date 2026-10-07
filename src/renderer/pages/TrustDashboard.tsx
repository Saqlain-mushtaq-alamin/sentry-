import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { SiteTrustEntry, SiteTrustLevel } from '../../shared/types';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { ForgetControls } from '../components/ForgetControls';

export const TrustDashboard: React.FC = () => {
  const [entries, setEntries] = useState<SiteTrustEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [pendingWarning, setPendingWarning] = useState<{
    domain: string;
    targetLevel: SiteTrustLevel;
  } | null>(null);

  const loadEntries = async () => {
    const sentry = (window as any).sentry;
    if (sentry?.trust?.getAll) {
      const liveEntries = await sentry.trust.getAll();
      setEntries(liveEntries || []);
    } else {
      setEntries([
        { domain: 'chase.com', trustLevel: SiteTrustLevel.HIGHLY_RESTRICTED, setBy: 'default', lastModified: Date.now() },
        { domain: 'gmail.com', trustLevel: SiteTrustLevel.HIGHLY_RESTRICTED, setBy: 'default', lastModified: Date.now() },
        { domain: 'example.com', trustLevel: SiteTrustLevel.READ_ACT, setBy: 'user', lastModified: Date.now() },
        { domain: 'malicious.com', trustLevel: SiteTrustLevel.BLOCKED, setBy: 'user', lastModified: Date.now() },
      ]);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleTrustChange = async (domain: string, newLevel: SiteTrustLevel) => {
    const entry = entries.find((e) => e.domain === domain);
    if (!entry) return;

    if (entry.trustLevel === SiteTrustLevel.HIGHLY_RESTRICTED && newLevel !== SiteTrustLevel.HIGHLY_RESTRICTED) {
      setPendingWarning({ domain, targetLevel: newLevel });
      return;
    }

    applyTrustChange(domain, newLevel);
  };

  const applyTrustChange = async (domain: string, newLevel: SiteTrustLevel) => {
    const sentry = (window as any).sentry;
    if (sentry?.trust?.setLevel) {
      await sentry.trust.setLevel(domain, newLevel);
    }
    setEntries((prev) =>
      prev.map((e) => (e.domain === domain ? { ...e, trustLevel: newLevel, setBy: 'user', lastModified: Date.now() } : e))
    );
  };

  const handleAddDomain = async () => {
    const domain = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (!domain) return;
    const sentry = (window as any).sentry;
    if (sentry?.trust?.setLevel) {
      await sentry.trust.setLevel(domain, SiteTrustLevel.READ_ACT);
    }
    setEntries((prev) => [...prev, { domain, trustLevel: SiteTrustLevel.READ_ACT, setBy: 'user', lastModified: Date.now() }]);
    setNewDomain('');
    setIsAdding(false);
  };

  const handleRemoveDomain = async (domain: string) => {
    setEntries((prev) => prev.filter((e) => e.domain !== domain));
  };

  const getLevelBadge = (level: SiteTrustLevel) => {
    switch (level) {
      case SiteTrustLevel.READ_ACT:
        return <Badge variant="ok" dot>Read & Act</Badge>;
      case SiteTrustLevel.READ_ONLY:
        return <Badge variant="warn" dot>Read only</Badge>;
      case SiteTrustLevel.HIGHLY_RESTRICTED:
        return <Badge variant="danger" dot>Restricted</Badge>;
      case SiteTrustLevel.BLOCKED:
        return <Badge variant="neutral" dot>Blocked</Badge>;
    }
  };

  const filteredEntries = entries.filter((e) => e.domain.toLowerCase().includes(filter.toLowerCase()));

  return (
    <PageShell
      title="Security & Trust"
      description="Define permissions for how the AI agent interacts with specific web domains."
    >
      {/* Controls Bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            flex: 1,
          }}
        >
          <Search size={14} style={{ color: 'var(--text-3)' }} />
          <input
            type="text"
            placeholder="Search domains…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: '12px',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {isAdding ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="domain.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
              style={{
                background: 'var(--bg-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                fontSize: '12px',
                color: 'var(--text)',
                fontFamily: 'inherit',
                outline: 'none',
                width: '140px',
              }}
              autoFocus
            />
            <Button variant="primary" size="sm" onClick={handleAddDomain}>
              Add
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setIsAdding(false); setNewDomain(''); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)} icon={<Plus size={13} />}>
            Add domain
          </Button>
        )}
      </div>

      {/* Trust Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', color: 'var(--text-2)' }}>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Domain</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Trust status</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Policy selector</th>
                <th style={{ padding: '8px 12px', fontWeight: 500 }}>Source</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr
                  key={entry.domain}
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--text)' }}>
                    {entry.domain}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {getLevelBadge(entry.trustLevel)}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <select
                      value={entry.trustLevel}
                      onChange={(e) => handleTrustChange(entry.domain, e.target.value as SiteTrustLevel)}
                      style={{
                        background: 'var(--bg-1)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        fontFamily: 'inherit',
                        outline: 'none',
                      }}
                    >
                      <option value={SiteTrustLevel.READ_ACT}>Read & Act</option>
                      <option value={SiteTrustLevel.READ_ONLY}>Read Only</option>
                      <option value={SiteTrustLevel.HIGHLY_RESTRICTED}>Highly Restricted</option>
                      <option value={SiteTrustLevel.BLOCKED}>Blocked</option>
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-3)', fontSize: '11px' }}>
                    {entry.setBy === 'default' ? 'System default' : 'Custom'}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <IconButton
                      label="Remove rule"
                      onClick={() => handleRemoveDomain(entry.domain)}
                      style={{ color: 'var(--text-3)', marginLeft: 'auto' }}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '24px' }}>
                    No matching domains found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Memory Controls */}
      <ForgetControls />

      {/* Warning Modal when downgrading restricted domains */}
      {pendingWarning && (
        <Modal
          isOpen={true}
          onClose={() => setPendingWarning(null)}
          title="Lower security restriction"
          description={`You are changing the security level of ${pendingWarning.domain} from Highly Restricted to ${pendingWarning.targetLevel}.`}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setPendingWarning(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  applyTrustChange(pendingWarning.domain, pendingWarning.targetLevel);
                  setPendingWarning(null);
                }}
              >
                Apply change
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ color: 'var(--warn)', flexShrink: 0 }} />
            <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.4 }}>
              This domain is marked sensitive by default (e.g. banking or email). Lowering its security tier allows the AI agent to interact with form inputs and take actions without requiring manual confirmation.
            </p>
          </div>
        </Modal>
      )}
    </PageShell>
  );
};
