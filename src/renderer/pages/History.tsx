import React, { useState } from 'react';
import { HistoryItem } from '../../shared/types';

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
    (h) => h.title.toLowerCase().includes(filter.toLowerCase()) || h.url.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ padding: '2rem 4rem', color: '#f8fafc', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem' }}>Browsing History</h1>
        <button
          onClick={onClearHistory}
          style={{
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Clear All History
        </button>
      </div>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search history..."
        style={{
          width: '100%',
          padding: '10px 16px',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          color: '#fff',
          marginBottom: '1.5rem',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#1e293b',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div
              onClick={() => onNavigate(item.url)}
              style={{ cursor: 'pointer', overflow: 'hidden', marginRight: '1rem' }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.title}</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{item.url}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                onClick={() => onRemoveEntry(item.id)}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>No history found.</p>
        )}
      </div>
    </div>
  );
};
