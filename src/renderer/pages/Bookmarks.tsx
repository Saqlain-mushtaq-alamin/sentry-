import React from 'react';
import { BookmarkItem } from '../../shared/types';

interface BookmarksProps {
  bookmarks: BookmarkItem[];
  onNavigate: (url: string) => void;
  onRemoveBookmark: (id: string) => void;
}

export const Bookmarks: React.FC<BookmarksProps> = ({ bookmarks, onNavigate, onRemoveBookmark }) => {
  return (
    <div style={{ padding: '2rem 4rem', color: '#f8fafc', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Bookmarks Manager</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        {bookmarks.map((bm) => (
          <div
            key={bm.id}
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
            <div onClick={() => onNavigate(bm.url)} style={{ cursor: 'pointer', overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>★ {bm.title}</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{bm.url}</div>
            </div>
            <button
              onClick={() => onRemoveBookmark(bm.id)}
              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
            >
              ✕
            </button>
          </div>
        ))}
        {bookmarks.length === 0 && (
          <p style={{ color: '#64748b', gridColumn: 'span 2', textAlign: 'center' }}>No bookmarks saved yet.</p>
        )}
      </div>
    </div>
  );
};
