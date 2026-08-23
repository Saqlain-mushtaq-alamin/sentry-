import React, { useState, useEffect } from 'react';
import { UserSettings } from '../../shared/types';

interface SettingsProps {
  onClearHistory: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClearHistory }) => {
  const [settings, setSettings] = useState<UserSettings>({
    searchEngine: 'google',
    startupBehavior: 'newtab',
    theme: 'dark',
    showBookmarksBar: true,
    defaultDownloadPath: '',
    askDownloadPath: false,
  });

  useEffect(() => {
    if (window.sentry) {
      window.sentry.settings.get().then((data: UserSettings) => {
        if (data) setSettings(data);
      });
    }
  }, []);

  const handleUpdate = (updates: Partial<UserSettings>) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    if (window.sentry) {
      window.sentry.settings.update(updates);
    }
  };

  return (
    <div style={{ padding: '2rem 4rem', color: '#f8fafc', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
        Settings
      </h1>

      {/* General Settings */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: '#60a5fa', marginBottom: '1rem' }}>Search & Startup</h2>

        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label>Default Search Engine</label>
          <select
            value={settings.searchEngine}
            onChange={(e) => handleUpdate({ searchEngine: e.target.value as UserSettings['searchEngine'] })}
            style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px' }}
          >
            <option value="google">Google</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="bing">Bing</option>
          </select>
        </div>

        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label>On Startup</label>
          <select
            value={settings.startupBehavior}
            onChange={(e) => handleUpdate({ startupBehavior: e.target.value as UserSettings['startupBehavior'] })}
            style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px' }}
          >
            <option value="newtab">Open New Tab</option>
            <option value="restore">Restore last session</option>
          </select>
        </div>
      </section>

      {/* Appearance */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: '#60a5fa', marginBottom: '1rem' }}>Appearance</h2>

        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label>Theme</label>
          <select
            value={settings.theme}
            onChange={(e) => handleUpdate({ theme: e.target.value as UserSettings['theme'] })}
            style={{ background: '#1e293b', color: '#fff', border: '1px solid #475569', padding: '6px 12px', borderRadius: '6px' }}
          >
            <option value="dark">Dark Mode</option>
            <option value="light">Light Mode</option>
            <option value="system">System Default</option>
          </select>
        </div>
      </section>

      {/* Privacy */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: '#60a5fa', marginBottom: '1rem' }}>Privacy & Data</h2>
        <button
          onClick={() => {
            onClearHistory();
            alert('Browsing history cleared!');
          }}
          style={{
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Clear Browsing Data
        </button>
      </section>

      {/* Advanced Developer Mode */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: '#38bdf8', marginBottom: '1rem' }}>Advanced & Developer Mode</h2>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={settings.developerMode ?? false}
              onChange={(e) => handleUpdate({ developerMode: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            Enable Developer / Research Mode
          </label>
          <p style={{ color: '#fbbf24', fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: '1.4' }}>
            ⚠️ <strong>Warning:</strong> Developer mode exposes internal prompts, agent execution traces, model latency metrics, and benchmark suites. Recommended for advanced users and security researchers.
          </p>
        </div>
      </section>

      {/* Agent Settings */}
      <section>
        <h2 style={{ fontSize: '1.25rem', color: '#a855f7', marginBottom: '1rem' }}>Agent & Model Settings</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Model Router, Risk Tier Policies, Local-First Mode options, and Recipe Memory management are active.
        </p>
      </section>
    </div>
  );
};
