import React, { useState, useEffect } from 'react';
import { Puzzle, FolderOpen, Trash2, Check, AlertCircle } from 'lucide-react';
import { LoadedExtension } from '../../shared/types';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { IconButton } from '../components/ui/IconButton';

export const ExtensionManagerPage: React.FC = () => {
  const [extensions, setExtensions] = useState<LoadedExtension[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'ok' | 'error' } | null>(null);

  const fetchExtensions = async () => {
    if ((window as any).sentry?.extensions) {
      const exts = await (window as any).sentry.extensions.getAll();
      setExtensions(exts || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExtensions();
  }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    if ((window as any).sentry?.extensions) {
      await (window as any).sentry.extensions.toggle(id, enabled);
      await fetchExtensions();
    }
  };

  const handleRemove = async (id: string) => {
    if ((window as any).sentry?.extensions) {
      await (window as any).sentry.extensions.unload(id);
      await fetchExtensions();
      setFeedback({ message: 'Extension removed.', type: 'ok' });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleLoadUnpacked = async () => {
    if ((window as any).sentry?.extensions) {
      try {
        const loaded = await (window as any).sentry.extensions.chooseAndLoad();
        if (loaded) {
          await fetchExtensions();
          setFeedback({ message: `Loaded extension "${loaded.name}".`, type: 'ok' });
          setTimeout(() => setFeedback(null), 3000);
        }
      } catch (err) {
        setFeedback({ message: `Failed to load extension: ${String(err)}`, type: 'error' });
        setTimeout(() => setFeedback(null), 4000);
      }
    }
  };

  return (
    <PageShell
      title="Extensions"
      description="Manage Chrome extensions and background scripts."
      headerActions={
        <Button variant="primary" size="sm" onClick={handleLoadUnpacked} icon={<FolderOpen size={12} />}>
          Load unpacked extension
        </Button>
      }
    >
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            background: feedback.type === 'ok' ? 'var(--ok-bg)' : 'var(--danger-bg)',
            color: feedback.type === 'ok' ? 'var(--ok)' : 'var(--danger)',
            border: `1px solid ${feedback.type === 'ok' ? 'rgba(63, 178, 127, 0.25)' : 'rgba(229, 72, 77, 0.25)'}`,
          }}
        >
          {feedback.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <Card style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>
          Loading extensions…
        </Card>
      ) : extensions.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>
          <p style={{ fontWeight: 500, color: 'var(--text)' }}>No extensions installed</p>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>
            Load an unpacked extension directory (.crx or manifest directory) to get started.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {extensions.map((ext) => (
            <Card
              key={ext.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Puzzle size={16} style={{ color: 'var(--accent)' }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text)' }}>
                      {ext.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>v{ext.version}</span>
                    <Badge variant={ext.isEnabled ? 'ok' : 'neutral'} dot>
                      {ext.isEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={ext.isEnabled}
                    onChange={(e) => handleToggle(ext.id, e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Active
                </label>
                <IconButton label="Remove extension" onClick={() => handleRemove(ext.id)}>
                  <Trash2 size={13} />
                </IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
};
