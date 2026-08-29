import React from 'react';
import { MultiTabTask } from '../../shared/types';
import './MultiTabDashboard.css';

interface MultiTabDashboardProps {
  task: MultiTabTask;
  onPauseAll: () => void;
  onStopAll: () => void;
  onViewTab?: (tabId: string | number) => void;
  onSwitchToTab?: (tabId: string) => void;
}

export const MultiTabDashboard: React.FC<MultiTabDashboardProps> = ({
  task,
  onPauseAll,
  onStopAll,
  onViewTab,
  onSwitchToTab,
}) => {
  if (!task) return null;

  const handleTabClick = (tabId: string | number) => {
    if (onSwitchToTab) onSwitchToTab(String(tabId));
    if (onViewTab) onViewTab(tabId);
  };

  return (
    <div className="multi-tab-dashboard">
      <div className="dashboard-header">
        <h3>🔄 Multi-Tab Task: "{task.instruction}"</h3>
        <span className={`status-badge ${task.coordinatorState}`}>
          {task.coordinatorState}
        </span>
      </div>

      <div className="dashboard-tabs">
        {task.tabs.map((tab, idx) => {
          const hostname = tab.url ? (() => { try { return new URL(tab.url).hostname.replace('www.', ''); } catch { return tab.url; } })() : 'Active Tab';
          const progressVal = tab.progress ?? tab.progressPercent ?? 0;

          return (
            <div key={tab.tabId} className="tab-progress-row">
              <div className="tab-info">
                <span className="tab-name">Tab {idx + 1}: {hostname}</span>
                <span className="tab-subtask">→ {tab.subtask || tab.subInstruction || 'Processing'}</span>
              </div>
              
              <div className="progress-container">
                <div className="progress-bar-bg">
                  <div 
                    className={`progress-bar-fill ${tab.status}`} 
                    style={{ width: `${progressVal}%` }}
                  />
                </div>
                <span className="progress-text">
                  {Math.round(progressVal)}% {tab.status === 'completed' ? '✅' : '⏳'}
                </span>
              </div>
              
              <button className="view-tab-btn" onClick={() => handleTabClick(tab.tabId)}>
                View Tab
              </button>
            </div>
          );
        })}
      </div>

      <div className="dashboard-controls">
        <button className="btn-secondary" onClick={onPauseAll}>
          Pause All
        </button>
        <button className="btn-danger" onClick={onStopAll}>
          Stop All
        </button>
      </div>
    </div>
  );
};
