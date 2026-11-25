import React, { useState, useEffect, useCallback } from 'react';
import { ArrowDownCircle, RefreshCw, X, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import './UpdateNotification.css';

export interface UpdateNotificationProps {
  onDismiss?: () => void;
  storageKey?: string;
}

interface UpdateState {
  state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseNotes?: string | Array<{ version: string; note: string }>;
  percent?: number;
  error?: string;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  onDismiss,
  storageKey = 'sentry_skipped_version',
}) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleStatus = (status: any) => {
      if (!status) return;
      const skipped = localStorage.getItem(storageKey);
      if (status.version && skipped === status.version && status.state === 'available') {
        return;
      }
      setUpdateInfo({
        state: status.state,
        version: status.version,
        releaseNotes: status.releaseNotes,
        percent: status.progress?.percent ?? status.percent,
        error: status.error,
      });
      if (status.state === 'available' || status.state === 'downloading' || status.state === 'downloaded') {
        setDismissed(false);
      }
    };

    let unsub: (() => void) | undefined;
    if (window.sentry?.updater?.onUpdateStatus) {
      unsub = window.sentry.updater.onUpdateStatus(handleStatus);
    } else if (window.sentry?.beta?.onUpdateStatus) {
      unsub = window.sentry.beta.onUpdateStatus(handleStatus);
    }

    return () => {
      unsub?.();
    };
  }, [storageKey]);

  const handleDownload = useCallback(async () => {
    if (window.sentry?.updater?.downloadUpdate) {
      await window.sentry.updater.downloadUpdate();
    } else if (window.sentry?.beta?.downloadUpdate) {
      await window.sentry.beta.downloadUpdate();
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (window.sentry?.updater?.installUpdate) {
      await window.sentry.updater.installUpdate();
    } else if (window.sentry?.beta?.installUpdate) {
      await window.sentry.beta.installUpdate();
    }
  }, []);

  const handleLater = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  const handleSkip = useCallback(() => {
    if (updateInfo?.version) {
      localStorage.setItem(storageKey, updateInfo.version);
    }
    setDismissed(true);
    onDismiss?.();
  }, [updateInfo, storageKey, onDismiss]);

  if (dismissed || !updateInfo) return null;
  if (updateInfo.state === 'idle' || updateInfo.state === 'not-available' || updateInfo.state === 'checking') {
    return null;
  }

  // Parse release notes into bullet list
  const renderReleaseNotes = () => {
    if (!updateInfo.releaseNotes) {
      return (
        <ul className="update-notes-list">
          <li>Improved injection detection and firewall accuracy</li>
          <li>Performance optimizations and bug fixes</li>
          <li>Updated model providers and routing presets</li>
        </ul>
      );
    }

    if (Array.isArray(updateInfo.releaseNotes)) {
      return (
        <ul className="update-notes-list">
          {updateInfo.releaseNotes.map((note, idx) => (
            <li key={idx}>{typeof note === 'string' ? note : note.note}</li>
          ))}
        </ul>
      );
    }

    if (typeof updateInfo.releaseNotes === 'string') {
      const lines = updateInfo.releaseNotes
        .split('\n')
        .map((l) => l.trim().replace(/^[-*•]\s*/, ''))
        .filter((l) => l.length > 0 && !l.startsWith('#'));
      return (
        <ul className="update-notes-list">
          {lines.slice(0, 5).map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      );
    }

    return null;
  };

  return (
    <aside className="update-notification-container" role="alert" aria-live="polite">
      <div className="update-notification-header">
        <div className="update-notification-title">
          {updateInfo.state === 'downloaded' ? (
            <>
              <CheckCircle size={18} color="#10b981" />
              <span>Update Ready: v{updateInfo.version}</span>
            </>
          ) : updateInfo.state === 'error' ? (
            <>
              <AlertCircle size={18} color="#f87171" />
              <span>Update Issue</span>
            </>
          ) : (
            <>
              <Sparkles size={18} color="#38bdf8" />
              <span>Update Available: v{updateInfo.version}</span>
            </>
          )}
        </div>
        <button
          className="update-close-btn"
          onClick={handleLater}
          title="Dismiss for now"
          aria-label="Dismiss update notification"
        >
          <X size={16} />
        </button>
      </div>

      {updateInfo.state === 'available' && (
        <>
          <div className="update-notes-title">What&apos;s new:</div>
          {renderReleaseNotes()}
          <div className="update-actions">
            <button className="update-btn update-btn-tertiary" onClick={handleSkip}>
              Skip
            </button>
            <button className="update-btn update-btn-secondary" onClick={handleLater}>
              Later
            </button>
            <button className="update-btn update-btn-primary" onClick={handleDownload}>
              Download &amp; Install
            </button>
          </div>
        </>
      )}

      {updateInfo.state === 'downloading' && (
        <div className="update-progress-container">
          <div className="update-progress-bar-bg">
            <div
              className="update-progress-bar-fill"
              style={{ width: `${Math.round(updateInfo.percent ?? 0)}%` }}
            />
          </div>
          <div className="update-progress-info">
            <span>Downloading update...</span>
            <span>{Math.round(updateInfo.percent ?? 0)}%</span>
          </div>
        </div>
      )}

      {updateInfo.state === 'downloaded' && (
        <>
          <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#cbd5e1' }}>
            The new version has been downloaded and is ready to install. Restart Sentry to apply the update now.
          </p>
          <div className="update-actions">
            <button className="update-btn update-btn-secondary" onClick={handleLater}>
              Later
            </button>
            <button className="update-btn update-btn-primary" onClick={handleInstall}>
              Restart Now
            </button>
          </div>
        </>
      )}

      {updateInfo.state === 'error' && (
        <>
          <div className="update-error-text">
            {updateInfo.error || 'Failed to check or download update. Please try again later.'}
          </div>
          <div className="update-actions">
            <button className="update-btn update-btn-secondary" onClick={handleLater}>
              Dismiss
            </button>
            <button className="update-btn update-btn-primary" onClick={handleDownload}>
              <RefreshCw size={14} style={{ marginRight: 6 }} />
              Retry
            </button>
          </div>
        </>
      )}
    </aside>
  );
};

export default UpdateNotification;

