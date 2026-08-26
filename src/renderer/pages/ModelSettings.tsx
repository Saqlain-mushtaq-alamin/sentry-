import React, { useState } from 'react';
import './ModelSettings.css';

export const ModelSettings: React.FC = () => {
  const [routingMode, setRoutingMode] = useState('auto');

  return (
    <div className="model-settings-page">
      <div className="settings-header">
        <h1>⚙️ AI Model Settings</h1>
      </div>
      
      <div className="settings-content">
        <section className="settings-section">
          <h2>Routing Mode</h2>
          <div className="radio-group">
            <label className="radio-label">
              <input type="radio" name="routing" value="local_only" checked={routingMode === 'local_only'} onChange={(e) => setRoutingMode(e.target.value)} />
              <div className="radio-text">
                <strong>Local only</strong>
                <span>All processing stays on your device. High privacy, lower capability for complex tasks.</span>
              </div>
            </label>
            <label className="radio-label">
              <input type="radio" name="routing" value="cloud_only" checked={routingMode === 'cloud_only'} onChange={(e) => setRoutingMode(e.target.value)} />
              <div className="radio-text">
                <strong>Cloud only</strong>
                <span>Uses your API key for all tasks. Costs money, highest capability.</span>
              </div>
            </label>
            <label className="radio-label">
              <input type="radio" name="routing" value="auto" checked={routingMode === 'auto'} onChange={(e) => setRoutingMode(e.target.value)} />
              <div className="radio-text">
                <strong>Auto (Recommended)</strong>
                <span>Routes by task complexity. Uses local for simple tasks, cloud for complex tasks.</span>
              </div>
            </label>
            <label className="radio-label">
              <input type="radio" name="routing" value="prefer_local" checked={routingMode === 'prefer_local'} onChange={(e) => setRoutingMode(e.target.value)} />
              <div className="radio-text">
                <strong>Prefer local</strong>
                <span>Cloud only used when absolutely necessary or local is unavailable.</span>
              </div>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2>Local Model</h2>
          <div className="model-list">
            <div className="model-item">
              <span className="model-name">llama3.1:8b</span>
              <span className="model-status installed">✅ Installed (5.2 GB)</span>
              <div className="model-actions">
                <button className="btn-secondary">Test</button>
                <button className="btn-danger">Delete</button>
              </div>
            </div>
            <div className="model-item">
              <span className="model-name">phi-3:mini</span>
              <span className="model-status installed">✅ Installed (2.1 GB)</span>
              <div className="model-actions">
                <button className="btn-secondary">Test</button>
                <button className="btn-danger">Delete</button>
              </div>
            </div>
          </div>
          <button className="btn-primary" style={{ marginTop: '12px' }}>Download New Model (Ollama)</button>
        </section>

        <section className="settings-section">
          <h2>Cloud Providers</h2>
          <div className="provider-list">
            <div className="provider-item active">
              <div className="provider-info">
                <strong>OpenAI</strong>
                <span className="api-key">sk-...••••</span>
                <span className="model-sel">Model: gpt-4o</span>
              </div>
              <span className="provider-status">✅</span>
            </div>
            <div className="provider-item">
              <div className="provider-info">
                <strong>Anthropic</strong>
                <span className="api-key empty">(not set)</span>
              </div>
              <span className="provider-status">❌</span>
            </div>
          </div>
          <div className="provider-actions" style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
            <button className="btn-primary">Add Provider</button>
            <button className="btn-secondary">Test Connection</button>
          </div>
        </section>

        <section className="settings-section">
          <h2>Per-Site Privacy</h2>
          <p className="section-desc">Sites that will ALWAYS use the local model, regardless of routing mode.</p>
          <ul className="site-list">
            <li>banking.com</li>
            <li>medical-portal.com</li>
            <li>*.gov</li>
          </ul>
          <button className="btn-secondary" style={{ marginTop: '12px' }}>Add Site</button>
        </section>
      </div>
    </div>
  );
};
