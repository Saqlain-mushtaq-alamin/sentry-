import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  X,
} from 'lucide-react';
import { AgentNotification } from '../../shared/types';
import { IconButton } from './ui/IconButton';
import { useHideNativeView } from '../hooks/useHideNativeView';
import './NotificationCenter.css';

interface NotificationCenterProps {
  notifications: AgentNotification[];
  onDismiss: (id: string) => void;
  onNotificationClick?: (notif: AgentNotification) => void;
  onActionClick?: (notifId: string, actionKey: string) => void;
  onClearAll?: () => void;
  onMarkAllRead?: () => void;
}

const timeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
};

const TOAST_MS = 5000;

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onDismiss,
  onNotificationClick,
  onActionClick,
  onClearAll,
  onMarkAllRead,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hiddenToasts, setHiddenToasts] = useState<Set<string>>(() => new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Hide native WebContentsView when notification drawer is open
  useHideNativeView(isOpen);

  // Auto dismiss non-critical toasts after 5 seconds without clearing from history
  useEffect(() => {
    const timers = notifications
      .filter((n) => n.type !== 'confirmation' && n.type !== 'security_alert' && !hiddenToasts.has(n.id))
      .map((n) =>
        setTimeout(
          () => setHiddenToasts((prev) => new Set(prev).add(n.id)),
          Math.max(0, TOAST_MS - (Date.now() - n.timestamp)),
        ),
      );
    return () => timers.forEach(clearTimeout);
  }, [notifications, hiddenToasts]);

  const toggleDrawer = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) onMarkAllRead?.();
  };

  // Close drawer on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const recentToasts = notifications.filter((n) => !hiddenToasts.has(n.id)).slice(-2); // max 2 toasts

  const renderIcon = (type: AgentNotification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={14} color="var(--ok)" />;
      case 'confirmation':
      case 'warning' as any:
        return <AlertTriangle size={14} color="var(--warn)" />;
      case 'error':
      case 'security_alert':
        return <AlertOctagon size={14} color="var(--danger)" />;
      case 'info':
      default:
        return <Info size={14} color="var(--accent)" />;
    }
  };

  return (
    <div className="notification-center-wrapper" ref={containerRef}>
      {/* Bell Button */}
      <div style={{ position: 'relative' }}>
        <IconButton
          label="Notifications"
          active={isOpen}
          onClick={toggleDrawer}
        >
          <Bell size={15} />
        </IconButton>
        {unreadCount > 0 && (
          <span className="bell-unread-badge">{unreadCount}</span>
        )}
      </div>

      {/* Floating Toast Stack */}
      {recentToasts.length > 0 && !isOpen && (
        <div className="toast-stack">
          {recentToasts.map((notif) => (
            <div
              key={notif.id}
              className={`toast-item ${notif.type}`}
              onClick={() => onNotificationClick && onNotificationClick(notif)}
            >
              <span className="toast-icon">{renderIcon(notif.type)}</span>
              <div className="toast-content">
                <strong>{notif.title}</strong>
                <p>{notif.message}</p>
                {notif.actions && notif.actions.length > 0 && (
                  <div className="toast-actions">
                    {notif.actions.map((action) => (
                      <button
                        key={action.actionKey}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onActionClick) onActionClick(notif.id, action.actionKey);
                        }}
                        className="toast-action-btn"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <IconButton
                label="Dismiss"
                onClick={(e) => {
                  e.stopPropagation();
                  setHiddenToasts((prev) => new Set(prev).add(notif.id));
                }}
                style={{ width: '20px', height: '20px' }}
              >
                <X size={12} />
              </IconButton>
            </div>
          ))}
        </div>
      )}

      {/* Drawer */}
      {isOpen && (
        <div className="notification-drawer">
          <div className="drawer-header">
            <span style={{ fontWeight: 600, fontSize: '13px' }}>
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {notifications.length > 0 && onClearAll && (
                <button
                  onClick={onClearAll}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-3)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Clear all
                </button>
              )}
              <IconButton label="Close" onClick={() => setIsOpen(false)} style={{ width: '24px', height: '24px' }}>
                <X size={14} />
              </IconButton>
            </div>
          </div>

          <div className="drawer-body">
            {notifications.length === 0 ? (
              <div className="empty-notifs">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`drawer-notif-item ${n.type}`}>
                  <span className="notif-icon">{renderIcon(n.type)}</span>
                  <div className="notif-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong>{n.title}</strong>
                      <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>{timeAgo(n.timestamp)}</span>
                    </div>
                    <p>{n.message}</p>
                    {n.actions && n.actions.length > 0 && (
                      <div className="notif-actions">
                        {n.actions.map((action) => (
                          <button
                            key={action.actionKey}
                            onClick={() => {
                              if (onActionClick) onActionClick(n.id, action.actionKey);
                            }}
                            className="notif-action-btn"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
