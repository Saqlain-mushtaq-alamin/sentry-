import React from 'react';
import { DownloadItem } from '../../shared/types';

interface DownloadsProps {
  downloads: DownloadItem[];
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
}

export const Downloads: React.FC<DownloadsProps> = ({ downloads, onOpenFile, onOpenFolder }) => {
  return (
    <div style={{ padding: '2rem 4rem', color: '#f8fafc', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Downloads</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {downloads.map((dl) => (
          <div
            key={dl.id}
            style={{
              padding: '16px',
              background: '#1e293b',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600 }}>{dl.filename}</span>
              <span style={{ fontSize: '0.8rem', color: '#60a5fa' }}>{dl.state}</span>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>{dl.url}</div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => onOpenFile(dl.savePath)}
                style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Open File
              </button>
              <button
                onClick={() => onOpenFolder(dl.savePath)}
                style={{ background: '#475569', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Show in Folder
              </button>
            </div>
          </div>
        ))}
        {downloads.length === 0 && (
          <p style={{ color: '#64748b', textAlign: 'center' }}>No downloads recorded.</p>
        )}
      </div>
    </div>
  );
};
