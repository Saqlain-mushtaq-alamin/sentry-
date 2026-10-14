import React, { useState, useMemo } from 'react';
import { Search, Globe } from 'lucide-react';
import { HistoryItem } from '../../shared/types';
import { Card } from '../components/ui/Card';

interface NewTabProps {
  history: HistoryItem[];
  onNavigate: (url: string) => void;
}

export const NewTab: React.FC<NewTabProps> = ({ history, onNavigate }) => {
  const [query, setQuery] = useState('');

  // Deduplicate and sanitize history to get the top distinct frequently visited sites
  const topSites = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; title: string; url: string; displayHost: string }[] = [];

    for (const item of history) {
      if (!item.url || item.url.startsWith('sentry://')) continue;
      let host = item.url;
      try {
        const u = new URL(item.url);
        host = u.hostname.replace(/^www\./, '');
      } catch {}
      if (seen.has(host)) continue;
      seen.add(host);

      list.push({
        id: item.id || host,
        title: item.title && item.title.trim() ? item.title : host,
        url: item.url,
        displayHost: host,
      });

      if (list.length >= 6) break;
    }

    if (list.length === 0) {
      return [
        { id: 'default-1', title: 'Google', url: 'https://google.com', displayHost: 'google.com' },
        { id: 'default-2', title: 'GitHub', url: 'https://github.com', displayHost: 'github.com' },
        { id: 'default-3', title: 'Wikipedia', url: 'https://wikipedia.org', displayHost: 'wikipedia.org' },
        { id: 'default-4', title: 'YouTube', url: 'https://youtube.com', displayHost: 'youtube.com' },
        { id: 'default-5', title: 'Reddit', url: 'https://reddit.com', displayHost: 'reddit.com' },
        { id: 'default-6', title: 'Hacker News', url: 'https://news.ycombinator.com', displayHost: 'news.ycombinator.com' },
      ];
    }

    return list;
  }, [history]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onNavigate(query.trim());
    }
  };

  return (
    <div
      style={{
        minHeight: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-0)',
        color: 'var(--text)',
        fontFamily: 'inherit',
        padding: '32px 20px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontSize: '26px',
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
            marginBottom: '32px',
            boxSizing: 'border-box',
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
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              width: '100%',
              boxSizing: 'border-box',
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
        <div style={{ width: '100%', boxSizing: 'border-box' }}>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-3)',
              marginBottom: '10px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Frequently visited
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: '10px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {topSites.map((item) => (
              <Card
                key={item.id}
                padding="none"
                onClick={() => onNavigate(item.url)}
                title={`${item.title} (${item.url})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  minWidth: 0,
                  width: '100%',
                  overflow: 'hidden',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  boxSizing: 'border-box',
                  transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-3)';
                  e.currentTarget.style.borderColor = 'var(--text-3)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-2)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-2)',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${item.displayHost}&sz=32`}
                    alt=""
                    style={{ width: '16px', height: '16px', borderRadius: '2px' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div style={{ display: 'none', alignItems: 'center', justifyContent: 'center' }}>
                    <Globe size={14} />
                  </div>
                </div>
                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: '12px',
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-3)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '1px',
                    }}
                  >
                    {item.displayHost}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
