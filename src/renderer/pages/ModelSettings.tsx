import React, { useState, useEffect } from 'react';
import './ModelSettings.css';

export const ModelSettings: React.FC = () => {
  const [routingMode, setRoutingMode] = useState('auto');
  const [localModel, setLocalModel] = useState('llama3.1:8b');
  const [cloudModel, setCloudModel] = useState('gpt-4o');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sentry = (window as any).sentry;
    // Load current config
    sentry?.agent?.getModelConfig?.().then((cfg: any) => {
      if (cfg) {
        setRoutingMode(cfg.routingMode || 'auto');
        setLocalModel(cfg.localModel || 'llama3.1:8b');
        setCloudModel(cfg.cloudModel || 'gpt-4o');
      }
    });
    // Check Ollama availability
    sentry?.agent?.checkOllama?.().then((ok: boolean) => setOllamaOnline(ok));
    // List available models
    sentry?.agent?.listOllamaModels?.().then((models: string[]) => setOllamaModels(models || []));
  }, []);

  const handleSave = async () => {
    const sentry = (window as any).sentry;
    await sentry?.agent?.setModelConfig?.({ localModel, cloudModel, routingMode });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="model-settings-page">
      <div className="settings-header">
        <h1>⚙️ AI Model Settings</h1>
      </div>
      
      <div className="settings-content">
        <section className="settings-section">
          <h2>Routing Mode</h2>
          <div className="radio-group">
            {[
              { value: 'local_only', label: 'Local only', desc: 'All processing stays on your device. High privacy, lower capability for complex tasks.' },
              { value: 'cloud_only', label: 'Cloud only', desc: 'Uses your API key for all tasks. Costs money, highest capability.' },
              { value: 'auto', label: 'Auto (Recommended)', desc: 'Routes by task complexity. Uses local for simple tasks, cloud for complex tasks.' },
              { value: 'prefer_local', label: 'Prefer local', desc: 'Cloud only used when absolutely necessary or local is unavailable.' },
            ].map(opt => (
              <label className="radio-label" key={opt.value}>
                <input type="radio" name="routing" value={opt.value} checked={routingMode === opt.value} onChange={e => setRoutingMode(e.target.value)} />
                <div className="radio-text">
                  <strong>{opt.label}</strong>
                  <span>{opt.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h2>Local Model (Ollama)</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: ollamaOnline ? '#4ade80' : ollamaOnline === false ? '#f87171' : '#9ca3af' }}>
              {ollamaOnline === null ? '⏳ Checking…' : ollamaOnline ? '🟢 Ollama Online' : '🔴 Ollama Offline — Install from ollama.com'}
            </span>
          </div>
          {ollamaModels.length > 0 ? (
            <div className="model-list">
              {ollamaModels.map(m => (
                <div className="model-item" key={m}>
                  <span className="model-name">{m}</span>
                  <span className={`model-status ${localModel === m ? 'installed' : ''}`}>
                    {localModel === m ? '✅ Active' : ''}
                  </span>
                  <div className="model-actions">
                    <button className="btn-secondary" onClick={() => setLocalModel(m)}>Use This</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="model-list">
              <div className="model-item">
                <span className="model-name">{localModel}</span>
                <span className="model-status installed">{ollamaOnline ? '✅ Active' : '(offline)'}</span>
              </div>
            </div>
          )}
          <div style={{ marginTop: '8px' }}>
            <label style={{ fontSize: '13px', color: '#9ca3af', marginRight: '8px' }}>Local Model ID:</label>
            <input
              type="text"
              value={localModel}
              onChange={e => setLocalModel(e.target.value)}
              style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #374151', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', width: '200px' }}
              placeholder="e.g. llama3.1:8b"
            />
          </div>
        </section>

        <section className="settings-section">
          <h2>Cloud Provider</h2>
          <div className="provider-list">
            <div className="provider-item active">
              <div className="provider-info">
                <strong>OpenAI / Anthropic</strong>
                <span className="api-key">Set via OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '8px' }}>
            <label style={{ fontSize: '13px', color: '#9ca3af', marginRight: '8px' }}>Cloud Model:</label>
            <input
              type="text"
              value={cloudModel}
              onChange={e => setCloudModel(e.target.value)}
              style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #374151', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', width: '200px' }}
              placeholder="e.g. gpt-4o"
            />
          </div>
        </section>

        <section className="settings-section">
          <h2>Per-Site Privacy</h2>
          <p className="section-desc">Sites that will ALWAYS use the local model. Configure in <strong>Trust Dashboard</strong> by setting a site to "Highly Restricted".</p>
        </section>

        <div style={{ marginTop: '24px' }}>
          <button className="btn-primary" onClick={handleSave} style={{ background: saved ? '#4ade80' : undefined, color: saved ? '#0f172a' : undefined }}>
            {saved ? '✅ Saved!' : '💾 Save Model Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

