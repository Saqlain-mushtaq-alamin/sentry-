import React, { useState } from 'react';
import { Search, Globe } from 'lucide-react';
import { HistoryItem } from '../../shared/types';
import { Card } from '../components/ui/Card';

interface NewTabProps {
  history: HistoryItem[];
  onNavigate: (url: string) => void;
}

export const NewTab: React.FC<NewTabProps> = ({ history, onNavigate }) => {
  const [query, setQuery] = useState('');

  const topSites = history.slice(0, 6);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onNavigate(query.trim());
    }
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-0)',
        color: 'var(--text)',
        fontFamily: 'inherit',
        padding: '24px',
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: '4px',
          letterSpacing: '-0.02em',
        }}
      >
        Sentry
      </h1>
      <p style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '28px' }}>
        Agentic browser
      </p>

      {/* Centered Search Bar */}
      <form
        onSubmit={handleSearch}
        style={{
          width: '100%',
          maxWidth: '560px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            transition: 'border-color 0.15s ease',
          }}
        >
          <Search size={16} style={{ color: 'var(--text-3)', marginRight: '10px', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search with Google or enter web address…"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
            autoFocus
          />
        </div>
      </form>

      {/* Quick Access Tiles */}
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '8px', fontWeight: 500 }}>
          Frequently visited
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}
        >
          {(topSites.length > 0
            ? topSites
            : [
                { id: '1', title: 'Google', url: 'https://google.com' },
                { id: '2', title: 'GitHub', url: 'https://github.com' },
                { id: '3', title: 'Wikipedia', url: 'https://wikipedia.org' },
              ]
          ).map((item) => (
            <Card
              key={item.id}
              onClick={() => onNavigate(item.url)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                cursor: 'pointer',
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-2)',
                  flexShrink: 0,
                }}
              >
                <Globe size={14} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 500, fontSize: '12px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.url}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
