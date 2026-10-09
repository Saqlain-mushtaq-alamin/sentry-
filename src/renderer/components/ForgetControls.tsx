import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

export const ForgetControls: React.FC = () => {
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    action: () => Promise<void> | void;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleForgetSite = async () => {
    try {
      await (window as any).sentry?.agent?.forgetSite?.();
      showStatus('Trust rules and preferences cleared for this domain.');
    } catch (e: any) {
      showStatus('Failed to clear domain data: ' + (e.message || String(e)));
    }
  };

  const handleForgetHistory = () => {
    setConfirmModal({
      title: 'Clear action history',
      description: 'Are you sure you want to clear all action logs and temporary task history?',
      action: async () => {
        try {
          await (window as any).sentry?.agent?.clearLogs?.();
          showStatus('Action history cleared.');
        } catch (e: any) {
          showStatus('Failed to clear action history: ' + (e.message || String(e)));
        }
      },
    });
  };


  const handleForgetAll = () => {
    setConfirmModal({
      title: 'Reset agent memory',
      description: 'This will reset all agent memory, active recipes, and site trust preferences. Continue?',
      action: async () => {
        await window.sentry?.agent?.forgetAll();
        showStatus('Agent memory securely reset.');
      },
    });
  };

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
          Memory & Privacy
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
          Control what the agent remembers across sessions.
        </p>
      </div>

      {statusMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            background: 'var(--ok-bg)',
            color: 'var(--ok)',
            border: '1px solid rgba(63, 178, 127, 0.25)',
          }}
        >
          <Check size={13} />
          <span>{statusMessage}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Button variant="secondary" size="sm" onClick={handleForgetSite} icon={<Trash2 size={12} />}>
          Forget current site
        </Button>
        <Button variant="secondary" size="sm" onClick={handleForgetHistory} icon={<Trash2 size={12} />}>
          Clear action logs
        </Button>
        <Button variant="danger" size="sm" onClick={handleForgetAll} icon={<AlertTriangle size={12} />}>
          Reset all memory
        </Button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          fontSize: '11px',
          color: 'var(--text-3)',
          lineHeight: 1.4,
          paddingTop: '6px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <ShieldCheck size={14} style={{ color: 'var(--ok)', flexShrink: 0, marginTop: '1px' }} />
        <span>
          Passwords and authentication credentials are never stored in agent memory. They remain securely in your system browser storage.
        </span>
      </div>

      {confirmModal && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmModal(null)}
          title={confirmModal.title}
          description={confirmModal.description}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setConfirmModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await confirmModal.action();
                  setConfirmModal(null);
                }}
              >
                Confirm
              </Button>
            </>
          }
        >
          <p style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            This will immediately remove selected memory records from local storage.
          </p>
        </Modal>
      )}
    </Card>
  );
};
