import React, { useState, useEffect } from 'react';
import { AgentNotification } from '../../shared/types';
import './NotificationCenter.css';

interface NotificationCenterProps {
  notifications: AgentNotification[];
  onDismiss: (id: string) => void;
  onNotificationClick?: (notif: AgentNotification) => void;
  onActionClick?: (notifId: string, actionKey: string) => void;
  onClearAll?: () => void;
}

const timeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(timestamp).toLocaleDateString();
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onDismiss,
  onNotificationClick,
  onActionClick,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Auto dismiss non-confirmation toasts after 5 seconds
  useEffect(() => {
    const activeToasts = notifications.filter(
      (n) => n.type !== 'confirmation' && n.type !== 'security_alert'
    );
    const timers = activeToasts.map((n) =>
      setTimeout(() => {
        onDismiss(n.id);
      }, 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications, onDismiss]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const recentToasts = notifications.slice(-3); // show max 3 floating toasts

  const getIcon = (type: AgentNotification['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'confirmation': return '⚠️';
      case 'error': return '❌';
      case 'security_alert': return '🔴';
      case 'info': default: return 'ℹ️';
    }
  };

  return (
    <div className="notification-center-wrapper">
      {/* ── Bell Icon Button ────────────────────────────────────────── */}
      <button
        className="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Agent Notifications"
      >
        🔔
        {unreadCount > 0 && <span className="bell-unread-badge">{unreadCount}</span>}
      </button>

      {/* ── Floating Toast Stack ────────────────────────────────────── */}
      <div className="toast-stack">
        {recentToasts.map((notif) => (
          <div
            key={notif.id}
            className={`toast-item ${notif.type}`}
            onClick={() => onNotificationClick && onNotificationClick(notif)}
          >
            <span className="toast-icon">{getIcon(notif.type)}</span>
            <div className="toast-content">
              <strong>{notif.title}</strong>
              <p>{notif.message}</p>
              {notif.actions && notif.actions.length > 0 && (
                <div className="toast-actions">
                  {notif.actions.map(action => (
                    <button 
                      key={action.actionKey}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onActionClick) onActionClick(notif.id, action.actionKey);
                      }}
                      className="toast-action-btn"
                    >
                      [{action.label}]
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="toast-dismiss"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(notif.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* ── Drawer / Panel for all notifications ────────────────────── */}
      {isOpen && (
        <div className="notification-drawer">
          <div className="drawer-header">
            <span>🔔 Notifications {unreadCount > 0 && `(${unreadCount})`}</span>
            <button onClick={() => setIsOpen(false)}>✕</button>
          </div>
          <div className="drawer-body">
            {notifications.length === 0 ? (
              <div className="empty-notifs">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`drawer-notif-item ${n.type}`}>
                  <span className="notif-icon">{getIcon(n.type)}</span>
                  <div className="notif-info">
                    <strong>{timeAgo(n.timestamp)} — {n.title}</strong>
                    <p>{n.message}</p>
                    {n.actions && n.actions.length > 0 && (
                      <div className="notif-actions">
                        {n.actions.map(action => (
                          <button 
                            key={action.actionKey}
                            onClick={() => {
                              if (onActionClick) onActionClick(n.id, action.actionKey);
                            }}
                            className="notif-action-btn"
                          >
                            [{action.label}]
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          {notifications.length > 0 && (
            <div className="drawer-footer">
              <button className="clear-all-btn" onClick={() => onClearAll && onClearAll()}>
                [Clear All]
              </button>
              <button className="settings-btn">
                [Settings]
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

