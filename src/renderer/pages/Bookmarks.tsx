import React from 'react';
import { Star, Trash2 } from 'lucide-react';
import { BookmarkItem } from '../../shared/types';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { IconButton } from '../components/ui/IconButton';

interface BookmarksProps {
  bookmarks: BookmarkItem[];
  onNavigate: (url: string) => void;
  onRemoveBookmark: (id: string) => void;
}

export const Bookmarks: React.FC<BookmarksProps> = ({ bookmarks, onNavigate, onRemoveBookmark }) => {
  return (
    <PageShell
      title="Bookmarks"
      description="Manage and open your saved pages."
    >
      {bookmarks.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>
          No bookmarks saved yet. Use the star icon in the address bar or press Ctrl+D.
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {bookmarks.map((bm) => (
            <Card
              key={bm.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
              }}
            >
              <div
                onClick={() => onNavigate(bm.url)}
                style={{ cursor: 'pointer', overflow: 'hidden', flex: 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Star size={13} fill="var(--warn)" color="var(--warn)" />
                  <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--text)' }}>
                    {bm.title || 'Untitled bookmark'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {bm.url}
                </div>
              </div>

              <IconButton
                label="Remove bookmark"
                onClick={() => onRemoveBookmark(bm.id)}
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
