import React from 'react';
import { File, Folder, ExternalLink } from 'lucide-react';
import { DownloadItem } from '../../shared/types';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

interface DownloadsProps {
  downloads: DownloadItem[];
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
}

export const Downloads: React.FC<DownloadsProps> = ({ downloads, onOpenFile, onOpenFolder }) => {
  return (
    <PageShell
      title="Downloads"
      description="View and manage downloaded files."
    >
      {downloads.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>
          No downloaded files found in this session.
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {downloads.map((dl) => (
            <Card
              key={dl.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <File size={15} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--text)' }}>
                    {dl.filename}
                  </span>
                </div>
                <Badge variant={dl.state === 'completed' ? 'ok' : 'neutral'}>
                  {dl.state}
                </Badge>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dl.url}
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onOpenFile(dl.savePath)}
                  icon={<ExternalLink size={12} />}
                >
                  Open file
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenFolder(dl.savePath)}
                  icon={<Folder size={12} />}
                >
                  Show in folder
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
};
