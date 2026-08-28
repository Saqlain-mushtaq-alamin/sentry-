import React, { useState, useEffect } from 'react';
import { LoadedExtension } from '../../shared/types';
import './ExtensionManager.css';

export const ExtensionManagerPage: React.FC = () => {
  const [extensions, setExtensions] = useState<LoadedExtension[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchExtensions = async () => {
    if ((window as any).sentry?.extensions) {
      const exts = await (window as any).sentry.extensions.getAll();
      setExtensions(exts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExtensions();
  }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    if ((window as any).sentry?.extensions) {
      await (window as any).sentry.extensions.toggle(id, enabled);
      await fetchExtensions();
    }
  };

  const handleRemove = async (id: string) => {
    if ((window as any).sentry?.extensions) {
      await (window as any).sentry.extensions.unload(id);
      await fetchExtensions();
    }
  };

  const handleLoadUnpacked = async () => {
    if ((window as any).sentry?.extensions) {
      try {
        const loaded = await (window as any).sentry.extensions.chooseAndLoad();
        if (loaded) {
          await fetchExtensions();
        }
      } catch (err) {
        alert('Failed to load extension: ' + String(err));
      }
    }
  };

  return (
    <div className="extension-manager-page">
      <div className="ext-header">
        <h1>🧩 Extensions</h1>
      </div>
      
      <div className="ext-actions-bar">
        <button className="ext-btn ext-btn-primary" onClick={handleLoadUnpacked}>
          Load Unpacked Extension
        </button>
        <button className="ext-btn">
          Get Extensions (Chrome Store)
        </button>
      </div>

      <div className="ext-list">
        {loading ? (
          <div>Loading extensions...</div>
        ) : extensions.length === 0 ? (
          <div className="ext-empty">No extensions installed.</div>
        ) : (
          extensions.map(ext => (
            <div key={ext.id} className={`ext-card ${ext.isEnabled ? '' : 'ext-disabled'}`}>
              <div className="ext-card-header">
                <span className="ext-name">🧩 {ext.name}</span>
                <span className="ext-version">v{ext.version}</span>
                <span className={`ext-status ${ext.isEnabled ? 'ext-status-on' : 'ext-status-off'}`}>
                  [{ext.isEnabled ? 'Enabled' : 'Disabled'}]
                </span>
              </div>
              <div className="ext-card-body">
                <div className="ext-detail"><strong>Permissions:</strong> {ext.permissions.length > 0 ? ext.permissions.join(', ') : 'None'}</div>
                <div className="ext-detail"><strong>Path:</strong> {ext.installPath}</div>
                {ext.permissions.includes('webRequest') && (
                  <div className="ext-warning">⚠️ Note: Extension intercepts network requests (ad-blocker pattern)</div>
                )}
                {ext.name.toLowerCase().includes('password') || ext.name.toLowerCase().includes('bitwarden') || ext.name.toLowerCase().includes('1password') ? (
                  <div className="ext-warning" style={{color: '#f87171'}}>⚠️ Agent interaction: ALWAYS requires CRITICAL confirmation</div>
                ) : null}
              </div>
              <div className="ext-card-actions">
                <button 
                  className="ext-btn"
                  onClick={() => handleToggle(ext.id, !ext.isEnabled)}
                >
                  {ext.isEnabled ? 'Disable' : 'Enable'}
                </button>
                <button 
                  className="ext-btn ext-btn-danger"
                  onClick={() => handleRemove(ext.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
