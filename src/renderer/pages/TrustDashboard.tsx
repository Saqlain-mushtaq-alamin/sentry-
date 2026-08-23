import React, { useState, useEffect } from 'react';
import { SiteTrustEntry, SiteTrustLevel } from '../../shared/types';
import { ForgetControls } from '../components/ForgetControls';
import './TrustDashboard.css';

export const TrustDashboard: React.FC = () => {
  const [entries, setEntries] = useState<SiteTrustEntry[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    // In a real app, this would use an IPC call to the main process
    // window.sentry.getTrustEntries().then(setEntries);
    // For now, mock data
    setEntries([
      { domain: 'chase.com', trustLevel: SiteTrustLevel.HIGHLY_RESTRICTED, setBy: 'default', lastModified: Date.now() },
      { domain: 'gmail.com', trustLevel: SiteTrustLevel.HIGHLY_RESTRICTED, setBy: 'default', lastModified: Date.now() },
      { domain: 'example.com', trustLevel: SiteTrustLevel.READ_ACT, setBy: 'user', lastModified: Date.now() },
      { domain: 'malicious.com', trustLevel: SiteTrustLevel.BLOCKED, setBy: 'user', lastModified: Date.now() }
    ]);
  }, []);

  const handleTrustChange = (domain: string, newLevel: SiteTrustLevel) => {
    const entry = entries.find(e => e.domain === domain);
    if (!entry) return;

    if (entry.trustLevel === SiteTrustLevel.HIGHLY_RESTRICTED && newLevel !== SiteTrustLevel.HIGHLY_RESTRICTED) {
      const confirm = window.confirm(
        `WARNING: You are downgrading the trust level of ${domain} from HIGHLY RESTRICTED to ${newLevel}. ` +
        `This will allow the AI agent to perform more actions on this site without explicit confirmation.\n\nAre you sure you want to proceed?`
      );
      if (!confirm) return;
    }

    setEntries(prev => prev.map(e => e.domain === domain ? { ...e, trustLevel: newLevel, setBy: 'user', lastModified: Date.now() } : e));
    
    // window.sentry.setTrustLevel(domain, newLevel);
  };

  const getIconForLevel = (level: SiteTrustLevel) => {
    switch (level) {
      case SiteTrustLevel.READ_ACT: return '🟢';
      case SiteTrustLevel.READ_ONLY: return '🟡';
      case SiteTrustLevel.HIGHLY_RESTRICTED: return '🔴';
      case SiteTrustLevel.BLOCKED: return '⚫';
    }
  };

  const filteredEntries = entries.filter(e => e.domain.includes(filter));

  return (
    <div className="trust-dashboard">
      <h1>Security & Trust Dashboard</h1>
      <p>Manage how Sentry interacts with different websites.</p>
      
      <div className="trust-controls">
        <input 
          type="text" 
          placeholder="Search domains..." 
          value={filter} 
          onChange={e => setFilter(e.target.value)} 
          className="search-input"
        />
        <button className="add-domain-btn">Add Domain</button>
      </div>

      <table className="trust-table">
        <thead>
          <tr>
            <th>Domain</th>
            <th>Trust Level</th>
            <th>Source</th>
            <th>Last Modified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredEntries.map(entry => (
            <tr key={entry.domain}>
              <td>{getIconForLevel(entry.trustLevel)} <strong>{entry.domain}</strong></td>
              <td>
                <select 
                  value={entry.trustLevel} 
                  onChange={e => handleTrustChange(entry.domain, e.target.value as SiteTrustLevel)}
                >
                  <option value={SiteTrustLevel.READ_ACT}>Read & Act</option>
                  <option value={SiteTrustLevel.READ_ONLY}>Read Only</option>
                  <option value={SiteTrustLevel.HIGHLY_RESTRICTED}>Highly Restricted</option>
                  <option value={SiteTrustLevel.BLOCKED}>Blocked</option>
                </select>
              </td>
              <td>{entry.setBy === 'default' ? 'System Default' : 'User Configured'}</td>
              <td>{new Date(entry.lastModified).toLocaleDateString()}</td>
              <td>
                <button className="delete-btn" onClick={() => setEntries(entries.filter(e => e.domain !== entry.domain))}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ForgetControls />
    </div>
  );
};
