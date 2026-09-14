import React, { useState, useEffect } from 'react';
import { SiteTrustEntry, SiteTrustLevel } from '../../shared/types';
import { ForgetControls } from '../components/ForgetControls';
import './TrustDashboard.css';

export const TrustDashboard: React.FC = () => {
  const [entries, setEntries] = useState<SiteTrustEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const loadEntries = async () => {
    const sentry = (window as any).sentry;
    if (sentry?.trust?.getAll) {
      const liveEntries = await sentry.trust.getAll();
      setEntries(liveEntries || []);
    } else {
      // Fallback mock data when running outside Electron (browser dev mode)
      setEntries([
        { domain: 'chase.com', trustLevel: SiteTrustLevel.HIGHLY_RESTRICTED, setBy: 'default', lastModified: Date.now() },
        { domain: 'gmail.com', trustLevel: SiteTrustLevel.HIGHLY_RESTRICTED, setBy: 'default', lastModified: Date.now() },
        { domain: 'example.com', trustLevel: SiteTrustLevel.READ_ACT, setBy: 'user', lastModified: Date.now() },
        { domain: 'malicious.com', trustLevel: SiteTrustLevel.BLOCKED, setBy: 'user', lastModified: Date.now() }
      ]);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleTrustChange = async (domain: string, newLevel: SiteTrustLevel) => {
    const entry = entries.find(e => e.domain === domain);
    if (!entry) return;

    if (entry.trustLevel === SiteTrustLevel.HIGHLY_RESTRICTED && newLevel !== SiteTrustLevel.HIGHLY_RESTRICTED) {
      const confirm = window.confirm(
        `WARNING: You are downgrading the trust level of ${domain} from HIGHLY RESTRICTED to ${newLevel}. ` +
        `This will allow the AI agent to perform more actions on this site without explicit confirmation.\n\nAre you sure you want to proceed?`
      );
      if (!confirm) return;
    }

    const sentry = (window as any).sentry;
    if (sentry?.trust?.setLevel) {
      await sentry.trust.setLevel(domain, newLevel);
    }
    setEntries(prev => prev.map(e => e.domain === domain ? { ...e, trustLevel: newLevel, setBy: 'user', lastModified: Date.now() } : e));
  };

  const handleAddDomain = async () => {
    const domain = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (!domain) return;
    const sentry = (window as any).sentry;
    if (sentry?.trust?.setLevel) {
      await sentry.trust.setLevel(domain, SiteTrustLevel.READ_ACT);
    }
    setEntries(prev => [...prev, { domain, trustLevel: SiteTrustLevel.READ_ACT, setBy: 'user', lastModified: Date.now() }]);
    setNewDomain('');
    setIsAdding(false);
  };

  const handleRemoveDomain = async (domain: string) => {
    setEntries(prev => prev.filter(e => e.domain !== domain));
    // Note: TrustManager doesn't have a delete API — removing from local state is the best we can do
    // without adding a new IPC channel. Could also set to READ_ACT which is the default.
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
        {isAdding ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="example.com"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddDomain()}
              className="search-input"
              autoFocus
            />
            <button className="add-domain-btn" onClick={handleAddDomain}>Add</button>
            <button className="delete-btn" onClick={() => { setIsAdding(false); setNewDomain(''); }}>Cancel</button>
          </div>
        ) : (
          <button className="add-domain-btn" onClick={() => setIsAdding(true)}>+ Add Domain</button>
        )}
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
                <button className="delete-btn" onClick={() => handleRemoveDomain(entry.domain)}>Remove</button>
              </td>
            </tr>
          ))}
          {filteredEntries.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>No domains configured. Add a domain above or visit websites to populate this list.</td></tr>
          )}
        </tbody>
      </table>

      <ForgetControls />
    </div>
  );
};

