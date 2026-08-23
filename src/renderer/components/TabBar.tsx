import React, { useState } from 'react';
import { TabItem } from '../../shared/types';

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
        background: '#0d1117',
        padding: '6px 8px 0 8px',
        gap: '4px',
        userSelect: 'none',
        overflowX: 'auto',
      }}
      onClick={closeContextMenu}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onSwitchTab(tab.id)}
            onAuxClick={(e) => {
              if (e.button === 1) onCloseTab(tab.id); // Middle click
            }}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              maxWidth: tab.isPinned ? '42px' : '200px',
              minWidth: tab.isPinned ? '42px' : '120px',
              height: '34px',
              borderRadius: '8px 8px 0 0',
              background: isActive ? '#1f2937' : 'transparent',
              color: isActive ? '#ffffff' : '#9ca3af',
              fontSize: '13px',
              cursor: 'pointer',
              borderTop: isActive ? '2px solid #3b82f6' : '2px solid transparent',
              transition: 'all 0.15s ease',
              position: 'relative',
            }}
          >
            {/* Favicon or fallback dot */}
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: tab.isLoading ? '#3b82f6' : '#6b7280',
                flexShrink: 0,
              }}
            />

            {!tab.isPinned && (
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexGrow: 1,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {tab.title || 'New Tab'}
              </span>
            )}

            {!tab.isPinned && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {/* New Tab Button */}
      <button
        onClick={onCreateTab}
        title="New Tab (Ctrl+T)"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#9ca3af',
          fontSize: '16px',
          padding: '4px 8px',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#1f2937')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        +
      </button>

      {/* Context Menu Popup */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '6px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            zIndex: 10000,
            padding: '4px 0',
            width: '140px',
          }}
        >
          <div
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#f3f4f6' }}
            onClick={() => {
              onCloseTab(contextMenu.tabId);
              closeContextMenu();
            }}
          >
            Close Tab
          </div>
          <div
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#f3f4f6' }}
            onClick={() => {
              onDuplicateTab(contextMenu.tabId);
              closeContextMenu();
            }}
          >
            Duplicate
          </div>
          <div
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#f3f4f6' }}
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
