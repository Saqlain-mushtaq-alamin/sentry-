import React, { useState } from 'react';
import { HistoryItem } from '../../shared/types';

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
        background: 'radial-gradient(circle at top, #1e293b 0%, #0f172a 100%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontSize: '3.5rem',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #60a5fa 0%, #a855f7 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem',
          letterSpacing: '-0.03em',
        }}
      >
        Sentry Browser
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '2.5rem' }}>
        Private, Fast, Agentic Web Browsing
      </p>

      {/* Centered Search Bar */}
      <form
        onSubmit={handleSearch}
        style={{
          width: '100%',
          maxWidth: '640px',
          marginBottom: '3rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(30, 41, 59, 0.8)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '9999px',
            padding: '12px 24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '1.2rem', marginRight: '12px', color: '#94a3b8' }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the web or type a URL..."
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '1.1rem',
            }}
          />
        </div>
      </form>

      {/* Quick Access Tiles */}
      <div style={{ width: '100%', maxWidth: '640px' }}>
        <h3 style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>
          Quick Access
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
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
            <div
              key={item.id}
              onClick={() => onNavigate(item.url)}
              style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(51, 65, 85, 0.8)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                {item.title[0]}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.url}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
