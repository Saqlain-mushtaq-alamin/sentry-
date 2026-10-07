import React, { useState, useRef, useEffect } from 'react';
import { History, X } from 'lucide-react';
import { ActionLogEntry, RiskTier } from '../../shared/types';
import { WhyExplanation } from '../components/WhyExplanation';
import { useHideNativeView } from '../hooks/useHideNativeView';
import { IconButton } from '../components/ui/IconButton';
import './ActionLog.css';

interface ActionLogProps {
  entries: ActionLogEntry[];
  onClearLog?: () => void;
}

export const ActionLog: React.FC<ActionLogProps> = ({ entries, onClearLog }) => {
  const [filterTier, setFilterTier] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWhyEntry, setSelectedWhyEntry] = useState<ActionLogEntry | null>(null);
  const [selectedSnapshotEntry, setSelectedSnapshotEntry] = useState<ActionLogEntry | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Hide native WebContentsView when Time Machine snapshot modal is open
  useHideNativeView(!!selectedSnapshotEntry);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const filteredEntries = entries.filter((e) => {
    const tier = e.decision?.riskTier || e.action.riskTier || RiskTier.LOW;
    if (filterTier !== 'all' && tier !== filterTier) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchAction = e.action.type.toLowerCase().includes(q);
      const matchTarget = (e.action.target || '').toLowerCase().includes(q);
      const matchReason = (e.action.reason || '').toLowerCase().includes(q);
      return matchAction || matchTarget || matchReason;
    }
    return true;
  });

  const getTierDot = (tier: RiskTier) => {
    switch (tier) {
      case RiskTier.LOW: return <span className="status-dot ok" />;
      case RiskTier.MEDIUM:
      case RiskTier.HIGH: return <span className="status-dot warn" />;
      case RiskTier.CRITICAL: return <span className="status-dot danger" />;
      default: return <span className="status-dot neutral" />;
    }
  };

  const exportLog = (format: 'json' | 'csv') => {
    let content = '';
    let mimeType = 'text/plain';
    const filename = `sentry-actions-${Date.now()}.${format}`;

    if (format === 'json') {
      content = JSON.stringify(entries, null, 2);
      mimeType = 'application/json';
    } else {
      const headers = ['Timestamp', 'Type', 'Target', 'RiskTier', 'Allowed', 'Reason'];
      const rows = entries.map((e) => [
        new Date(e.timestamp || Date.now()).toISOString(),
        e.action.type,
        `"${(e.action.target || '').replace(/"/g, '""')}"`,
        e.decision?.riskTier || e.action.riskTier || RiskTier.LOW,
        e.decision?.allowed ?? true,
        `"${(e.action.reason || '').replace(/"/g, '""')}"`
      ]);
      content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="action-log-container">
      <div className="action-log-content">
        <div className="log-toolbar">
          <input
            type="text"
            placeholder="Search actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="log-search-input"
          />
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="log-filter-select"
          >
            <option value="all">All tiers</option>
            <option value={RiskTier.LOW}>Low</option>
            <option value={RiskTier.MEDIUM}>Medium</option>
            <option value={RiskTier.HIGH}>High</option>
            <option value={RiskTier.CRITICAL}>Critical</option>
          </select>
          <button className="export-btn" onClick={() => exportLog('json')}>JSON</button>
          <button className="export-btn" onClick={() => exportLog('csv')}>CSV</button>
          {onClearLog && <button className="clear-btn" onClick={onClearLog}>Clear</button>}
        </div>

        <div className="log-timeline" role="log" aria-label="Agent action log" aria-live="polite">
          {filteredEntries.length === 0 ? (
            <div className="empty-log-state">No agent actions recorded yet.</div>
          ) : (
            filteredEntries.map((entry, idx) => {
              const tier = entry.decision?.riskTier || entry.action.riskTier || RiskTier.LOW;
              const timeStr = new Date(entry.timestamp || Date.now()).toLocaleTimeString();
              return (
                <div 
                  key={idx} 
                  className="timeline-item" 
                  role="listitem" 
                  aria-label={`Action ${entry.action.type} on ${entry.action.target || 'page'}, ${tier} risk`}
                >
                  <span className="time-col">{timeStr}</span>
                  <span className="tier-col" title={`Risk tier: ${tier}`}>
                    {getTierDot(tier)}
                  </span>
                  <div className="action-desc" onClick={() => {
                    if (entry.result?.beforeSnapshot) {
                      setSelectedSnapshotEntry(entry);
                    }
                  }}>
                    <span className="action-type">{entry.action.type}</span>
                    <span className="action-target">{entry.action.target || 'page'}</span>
                    {entry.action.value && <code className="action-val">{entry.action.value}</code>}
                    {!entry.executed && <span className="blocked-tag">Blocked</span>}
                  </div>
                  <button
                    className="why-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWhyEntry(entry);
                    }}
                  >
                    Why?
                  </button>
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {selectedWhyEntry && (
        <WhyExplanation
          entry={selectedWhyEntry}
          onClose={() => setSelectedWhyEntry(null)}
        />
      )}

      {selectedSnapshotEntry && (
        <div className="time-machine-modal-backdrop" onClick={() => setSelectedSnapshotEntry(null)}>
          <div className="time-machine-card" onClick={(e) => e.stopPropagation()}>
            <div className="time-machine-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Step snapshot</span>
              </div>
              <IconButton label="Close" onClick={() => setSelectedSnapshotEntry(null)} style={{ width: '24px', height: '24px' }}>
                <X size={14} />
              </IconButton>
            </div>
            <div className="time-machine-body">
              <p><strong>Action:</strong> {selectedSnapshotEntry.action.type} on {selectedSnapshotEntry.action.target}</p>
              <p><strong>Reason:</strong> {selectedSnapshotEntry.action.reason}</p>
              <div className="snapshot-preview-box">
                <h4>URL:</h4>
                <code>{selectedSnapshotEntry.result?.beforeSnapshot?.url || selectedSnapshotEntry.action.url}</code>
                <h4>Page Title:</h4>
                <p>{selectedSnapshotEntry.result?.beforeSnapshot?.title || 'Snapshot available'}</p>
                <h4>Interactive Elements:</h4>
                <p>{selectedSnapshotEntry.result?.beforeSnapshot?.interactiveElements?.length ?? 'Available'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
