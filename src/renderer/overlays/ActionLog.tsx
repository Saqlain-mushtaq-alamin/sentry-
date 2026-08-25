import React, { useState, useEffect, useRef } from 'react';
import { ActionLogEntry, RiskTier, PageSnapshot } from '../../shared/types';
import { WhyExplanation } from '../components/WhyExplanation';
import './ActionLog.css';

interface ActionLogProps {
  entries: ActionLogEntry[];
  onSelectTimeMachineEntry?: (entry: ActionLogEntry) => void;
  onClearLog?: () => void;
}

export const ActionLog: React.FC<ActionLogProps> = ({
  entries,
  onSelectTimeMachineEntry,
  onClearLog,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedWhyEntry, setSelectedWhyEntry] = useState<ActionLogEntry | null>(null);
  const [selectedSnapshotEntry, setSelectedSnapshotEntry] = useState<ActionLogEntry | null>(null);
  const [filterTier, setFilterTier] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, collapsed]);

  const getTierIcon = (tier: RiskTier) => {
    switch (tier) {
      case RiskTier.LOW: return '🟢';
      case RiskTier.MEDIUM: return '🟡';
      case RiskTier.HIGH: return '🟠';
      case RiskTier.CRITICAL: return '🔴';
      default: return '🟢';
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const tier = entry.decision?.riskTier || entry.action?.riskTier || RiskTier.LOW;
    if (filterTier !== 'all' && tier !== filterTier) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTarget = entry.action.target?.toLowerCase() || '';
      const matchReason = entry.action.reason?.toLowerCase() || '';
      const matchType = entry.action.type?.toLowerCase() || '';
      return matchTarget.includes(q) || matchReason.includes(q) || matchType.includes(q);
    }
    return true;
  });

  const lowCount = entries.filter(e => (e.decision?.riskTier || e.action.riskTier) === RiskTier.LOW).length;
  const medCount = entries.filter(e => (e.decision?.riskTier || e.action.riskTier) === RiskTier.MEDIUM).length;
  const highCount = entries.filter(e => (e.decision?.riskTier || e.action.riskTier) === RiskTier.HIGH).length;
  const critCount = entries.filter(e => (e.decision?.riskTier || e.action.riskTier) === RiskTier.CRITICAL).length;

  const exportLog = (format: 'json' | 'csv') => {
    let content = '';
    let mimeType = 'text/plain';
    let filename = `sentry-action-log-${Date.now()}.${format}`;

    if (format === 'json') {
      content = JSON.stringify(entries, null, 2);
      mimeType = 'application/json';
    } else {
      const headers = ['Timestamp', 'Type', 'Target', 'Value', 'RiskTier', 'Allowed', 'Reason'];
      const rows = entries.map(e => [
        new Date(e.timestamp || Date.now()).toISOString(),
        e.action.type,
        `"${(e.action.target || '').replace(/"/g, '""')}"`,
        `"${(e.action.value || '').replace(/"/g, '""')}"`,
        e.decision?.riskTier || e.action.riskTier,
        e.executed ? 'TRUE' : 'FALSE',
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
    <div className={`action-log-container ${collapsed ? 'collapsed' : ''}`}>
      <div className="action-log-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="log-title">
          <span>📜 Action Log & Timeline</span>
          <span className="log-summary-pills">
            <span className="pill low">{lowCount} 🟢</span>
            <span className="pill med">{medCount} 🟡</span>
            <span className="pill high">{highCount} 🟠</span>
            <span className="pill crit">{critCount} 🔴</span>
          </span>
        </div>
        <button className="toggle-btn">{collapsed ? 'Expand ▲' : 'Collapse ▼'}</button>
      </div>

      {!collapsed && (
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
              <option value="all">All Tiers</option>
              <option value={RiskTier.LOW}>🟢 Low</option>
              <option value={RiskTier.MEDIUM}>🟡 Medium</option>
              <option value={RiskTier.HIGH}>🟠 High</option>
              <option value={RiskTier.CRITICAL}>🔴 Critical</option>
            </select>
            <button className="export-btn" onClick={() => exportLog('json')}>Export JSON</button>
            <button className="export-btn" onClick={() => exportLog('csv')}>Export CSV</button>
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
                    <span className="tier-col">{getTierIcon(tier)}</span>
                    <div className="action-col" onClick={() => {
                      setSelectedSnapshotEntry(entry);
                      if (onSelectTimeMachineEntry) onSelectTimeMachineEntry(entry);
                    }}>
                      <span className="action-type">{entry.action.type.toUpperCase()}</span>
                      <span className="action-target">{entry.action.target || 'page'}</span>
                      {entry.action.value && <code className="action-val">{entry.action.value}</code>}
                      {!entry.executed && <span className="blocked-tag">[BLOCKED]</span>}
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
      )}

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
              <h3>🕒 Time Machine View — Step Snapshot</h3>
              <button onClick={() => setSelectedSnapshotEntry(null)}>✕</button>
            </div>
            <div className="time-machine-body">
              <p><strong>Action:</strong> {selectedSnapshotEntry.action.type} on {selectedSnapshotEntry.action.target}</p>
              <p><strong>Reason:</strong> {selectedSnapshotEntry.action.reason}</p>
              <div className="snapshot-preview-box">
                <h4>Before Snapshot URL:</h4>
                <code>{selectedSnapshotEntry.result?.beforeSnapshot?.url || selectedSnapshotEntry.action.url}</code>
                <h4>Before Snapshot Title:</h4>
                <p>{selectedSnapshotEntry.result?.beforeSnapshot?.title || 'Page Snapshot'}</p>
                <h4>Interactive Elements Count:</h4>
                <p>{selectedSnapshotEntry.result?.beforeSnapshot?.interactiveElements?.length ?? 'Snapshot available'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
