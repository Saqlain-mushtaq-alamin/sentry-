import React from 'react';
import { Star, X } from 'lucide-react';
import { BookmarkItem } from '../../shared/types';

interface BookmarksBarProps {
  bookmarks: BookmarkItem[];
  onNavigate: (url: string) => void;
  onRemoveBookmark: (id: string) => void;
}

export const BookmarksBar: React.FC<BookmarksBarProps> = ({
  bookmarks,
  onNavigate,
  onRemoveBookmark,
}) => {
  if (bookmarks.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-1)',
        padding: '3px 12px',
        gap: '4px',
        borderBottom: '1px solid var(--border)',
        fontSize: '11px',
        height: '28px',
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      {bookmarks.slice(0, 12).map((bm) => (
        <div
          key={bm.id}
          onClick={() => onNavigate(bm.url)}
          onContextMenu={(e) => {
            e.preventDefault();
            onRemoveBookmark(bm.id);
          }}
          title={`${bm.title} (${bm.url}) — Right-click to remove`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-2)',
            whiteSpace: 'nowrap',
            maxWidth: '180px',
            transition: 'background 0.1s ease, color 0.1s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-2)';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-2)';
          }}
        >
          <Star size={11} fill="var(--warn)" color="var(--warn)" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{bm.title}</span>
        </div>
      ))}
    </div>
  );
};
