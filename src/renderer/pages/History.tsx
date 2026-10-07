import React, { useState } from 'react';
import { Clock, Trash2, Search } from 'lucide-react';
import { HistoryItem } from '../../shared/types';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';

interface HistoryProps {
  history: HistoryItem[];
  onNavigate: (url: string) => void;
  onClearHistory: () => void;
  onRemoveEntry: (id: string) => void;
}

export const History: React.FC<HistoryProps> = ({
  history,
  onNavigate,
  onClearHistory,
  onRemoveEntry,
}) => {
  const [filter, setFilter] = useState('');

  const filtered = history.filter(
    (h) =>
      h.title.toLowerCase().includes(filter.toLowerCase()) ||
      h.url.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <PageShell
      title="History"
      description="View and manage visited sites and pages."
      headerActions={
        history.length > 0 ? (
          <Button variant="danger" size="sm" onClick={onClearHistory} icon={<Trash2 size={12} />}>
            Clear history
          </Button>
        ) : undefined
      }
    >
      {/* Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 10px',
        }}
      >
        <Search size={14} style={{ color: 'var(--text-3)' }} />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search history…"
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

      {filtered.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>
          {filter ? 'No history matching your search.' : 'No browsing history recorded.'}
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filtered.map((item) => (
            <Card
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
              }}
            >
              <div
                onClick={() => onNavigate(item.url)}
                style={{ cursor: 'pointer', overflow: 'hidden', flex: 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={12} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title || 'Untitled page'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', paddingLeft: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.url}
                </div>
              </div>

              <IconButton
                label="Remove entry"
                onClick={() => onRemoveEntry(item.id)}
                style={{ color: 'var(--text-3)' }}
              >
                <Trash2 size={13} />
              </IconButton>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
};
