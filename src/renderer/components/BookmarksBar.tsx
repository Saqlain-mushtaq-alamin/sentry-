import React from 'react';
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
        background: '#0f172a',
        padding: '4px 12px',
        gap: '12px',
        borderBottom: '1px solid #1e2937',
        fontSize: '12px',
        overflowX: 'auto',
      }}
    >
      {bookmarks.slice(0, 10).map((bm) => (
        <div
          key={bm.id}
          onClick={() => onNavigate(bm.url)}
          onContextMenu={(e) => {
            e.preventDefault();
            onRemoveBookmark(bm.id);
          }}
          title={`${bm.title} (${bm.url}) - Right-click to delete`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '4px',
            color: '#cbd5e1',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#1e293b')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span>★</span>
          <span>{bm.title}</span>
        </div>
      ))}
    </div>
  );
};
