import React from 'react';

export interface PageShellProps {
  title: string;
  description?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
}

export const PageShell: React.FC<PageShellProps> = ({
  title,
  description,
  headerActions,
  children,
  maxWidth = 720,
}) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        background: 'var(--bg-0)',
        color: 'var(--text)',
        padding: '32px 24px 64px 24px',
      }}
    >
      <div
        style={{
          maxWidth: `${maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
        }}
      >
        {/* Page Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            paddingBottom: 'var(--space-4)',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--text)',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h1>
            {description && (
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-2)',
                  marginTop: '4px',
                  lineHeight: 1.4,
                }}
              >
                {description}
              </p>
            )}
          </div>
          {headerActions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {headerActions}
            </div>
          )}
        </div>

        {/* Page Content Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {children}
        </div>
      </div>
    </div>
  );
};
