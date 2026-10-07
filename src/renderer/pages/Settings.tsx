import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { UserSettings } from '../../shared/types';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ForgetControls } from '../components/ForgetControls';

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
  const [notice, setNotice] = useState<string | null>(null);

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
    setNotice('Settings saved.');
    setTimeout(() => setNotice(null), 2500);
  };

  const handleClearData = () => {
    onClearHistory();
    setNotice('Browsing data cleared.');
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <PageShell
      title="Settings"
      description="Configure browser preferences, search, privacy, and developer tools."
    >
      {notice && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            background: 'var(--ok-bg)',
            color: 'var(--ok)',
            border: '1px solid rgba(63, 178, 127, 0.25)',
          }}
        >
          <Check size={14} />
          <span>{notice}</span>
        </div>
      )}

      {/* Search & Navigation */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
          Search & startup
        </h2>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
              Default search engine
            </label>
            <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              Used when entering queries in the address bar.
            </p>
          </div>
          <select
            value={settings.searchEngine}
            onChange={(e) => handleUpdate({ searchEngine: e.target.value as UserSettings['searchEngine'] })}
            style={{
              background: 'var(--bg-1)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            <option value="google">Google</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="bing">Bing</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
              On startup
            </label>
            <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              Choose what happens when opening a new browser window.
            </p>
          </div>
          <select
            value={settings.startupBehavior}
            onChange={(e) => handleUpdate({ startupBehavior: e.target.value as UserSettings['startupBehavior'] })}
            style={{
              background: 'var(--bg-1)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            <option value="newtab">Open new tab page</option>
            <option value="restore">Restore previous session</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
              Bookmarks bar
            </label>
            <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              Show the bookmarks toolbar beneath the address bar when bookmarks exist.
            </p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.showBookmarksBar ?? true}
              onChange={(e) => handleUpdate({ showBookmarksBar: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
            />
          </label>
        </div>
      </Card>

      {/* Privacy & Browsing Data */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
          Browsing data
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
              Clear browsing history
            </span>
            <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              Removes all visited URLs and history entries.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={handleClearData}>
            Clear history
          </Button>
        </div>
      </Card>

      {/* Memory Management */}
      <ForgetControls />

      {/* Advanced & Developer Mode */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
          Developer & research tools
        </h2>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={settings.developerMode ?? false}
                onChange={(e) => handleUpdate({ developerMode: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
              />
              Enable developer mode
            </label>
            <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px', lineHeight: 1.4 }}>
              Exposes step execution traces, CDP latency metrics, Ollama inspection, and security benchmark suites.
            </p>
          </div>
        </div>
      </Card>
    </PageShell>
  );
};
