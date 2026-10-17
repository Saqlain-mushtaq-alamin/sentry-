import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Pin } from 'lucide-react';
import { TabItem } from '../../shared/types';
import { useHideNativeView } from '../hooks/useHideNativeView';

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string | null;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCreateTab: () => void;
  onDuplicateTab: (id: string) => void;
  onTogglePinTab: (id: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onCreateTab,
  onDuplicateTab,
  onTogglePinTab,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Automatically hide native WebContentsView when context menu is open
  useHideNativeView(!!contextMenu);

  useEffect(() => {
    if (!contextMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const closeContextMenu = () => setContextMenu(null);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-0)',
        padding: '6px 8px 0 8px',
        gap: '4px',
        userSelect: 'none',
        overflowX: 'auto',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
      onClick={closeContextMenu}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onSwitchTab(tab.id)}
            onAuxClick={(e) => {
              if (e.button === 1) onCloseTab(tab.id); // Middle click to close
            }}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            title={tab.isSleeping ? `${tab.title || 'New Tab'} (Sleeping — click to wake)` : (tab.title || 'New Tab')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: tab.isPinned ? '0 8px' : '0 10px',
              maxWidth: tab.isPinned ? '38px' : '190px',
              minWidth: tab.isPinned ? '38px' : '110px',
              height: '32px',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              background: isActive ? 'var(--bg-1)' : 'transparent',
              color: isActive ? 'var(--text)' : 'var(--text-2)',
              opacity: tab.isSleeping && !isActive ? 0.75 : 1,
              fontSize: '12px',
              cursor: 'pointer',
              borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              borderLeft: isActive ? '1px solid var(--border)' : '1px solid transparent',
              borderRight: isActive ? '1px solid var(--border)' : '1px solid transparent',
              transition: 'background 0.12s ease, color 0.12s ease',
              position: 'relative',
              WebkitAppRegion: 'no-drag',
              flexShrink: 0,
            } as React.CSSProperties}
          >
            {/* Status dot or pin icon */}
            {tab.isPinned ? (
              <Pin size={12} style={{ color: 'var(--text-2)', transform: 'rotate(45deg)' }} />
            ) : tab.isSleeping ? (
              <span
                title="Sleeping tab (click to wake)"
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: 'transparent',
                  border: '1.5px dashed var(--text-3)',
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
            ) : (
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: tab.isLoading ? 'var(--accent)' : isActive ? 'var(--text)' : 'var(--text-3)',
                  flexShrink: 0,
                }}
              />
            )}

            {!tab.isPinned && (
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexGrow: 1,
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {tab.title || 'New Tab'}
              </span>
            )}

            {!tab.isPinned && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  width: '16px',
                  height: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  WebkitAppRegion: 'no-drag',
                  flexShrink: 0,
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--danger)';
                  e.currentTarget.style.background = 'var(--danger-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-3)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X size={11} />
              </button>
            )}
          </div>
        );
      })}

      {/* New Tab Button */}
      <button
        type="button"
        onClick={onCreateTab}
        title="New Tab (Ctrl+T)"
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-2)',
          width: '26px',
          height: '26px',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          WebkitAppRegion: 'no-drag',
          flexShrink: 0,
          transition: 'background 0.12s ease',
        } as React.CSSProperties}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Plus size={14} />
      </button>

      {/* Context Menu Popup */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            padding: '4px',
            width: '140px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'var(--text)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              onCloseTab(contextMenu.tabId);
              closeContextMenu();
            }}
          >
            Close Tab
          </div>
          <div
            style={{
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'var(--text)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              onDuplicateTab(contextMenu.tabId);
              closeContextMenu();
            }}
          >
            Duplicate
          </div>
          <div
            style={{
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'var(--text)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              onTogglePinTab(contextMenu.tabId);
              closeContextMenu();
            }}
          >
            Pin / Unpin
          </div>
        </div>
      )}
    </div>
  );
};
