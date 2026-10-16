import React, { useState, useEffect } from 'react';
import { Check, Key, Shield } from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export const ModelSettings: React.FC = () => {
  const [routingMode, setRoutingMode] = useState('auto');
  const [localModel, setLocalModel] = useState('qwen3:8b');
  const [cloudModel, setCloudModel] = useState('gpt-4o');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);

  // API Keys state
  const [openAIKey, setOpenAIKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [hasOpenAI, setHasOpenAI] = useState(false);
  const [hasAnthropic, setHasAnthropic] = useState(false);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sentry = (window as any).sentry;
    if (sentry?.agent?.getModelConfig) {
      sentry.agent.getModelConfig().then((cfg: any) => {
        if (cfg) {
          setRoutingMode(cfg.routingMode || 'auto');
          setLocalModel(cfg.localModel || 'qwen3:8b');
          setCloudModel(cfg.cloudModel || 'gpt-4o');
        }
      });
    }
    if (sentry?.agent?.checkOllama) {
      sentry.agent.checkOllama().then((ok: boolean) => setOllamaOnline(ok));
    }
    if (sentry?.agent?.listOllamaModels) {
      sentry.agent.listOllamaModels().then((models: string[]) => setOllamaModels(models || []));
    }
    if (sentry?.secrets?.has) {
      sentry.secrets.has('openai').then((has: boolean) => setHasOpenAI(has));
      sentry.secrets.has('anthropic').then((has: boolean) => setHasAnthropic(has));
    }
  }, []);

  const handleSave = async () => {
    const sentry = (window as any).sentry;
    if (sentry?.agent?.setModelConfig) {
      await sentry.agent.setModelConfig({ localModel, cloudModel, routingMode });
    }

    if (sentry?.secrets?.set) {
      if (openAIKey.trim()) {
        await sentry.secrets.set('openai', openAIKey.trim());
        setOpenAIKey('');
        setHasOpenAI(true);
      }
      if (anthropicKey.trim()) {
        await sentry.secrets.set('anthropic', anthropicKey.trim());
        setAnthropicKey('');
        setHasAnthropic(true);
      }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const routingOptions = [
    { value: 'auto', label: 'Auto (Recommended)', desc: 'Routes by task complexity. Uses local for simple DOM actions and cloud for multi-step reasoning.' },
    { value: 'local_only', label: 'Local only', desc: 'All processing stays on your device via Ollama. Maximum privacy, zero API costs.' },
    { value: 'prefer_local', label: 'Prefer local', desc: 'Uses local Ollama by default, only failing over to cloud if the local model stalls.' },
    { value: 'cloud_only', label: 'Cloud only', desc: 'Routes all prompts to frontier models (OpenAI/Anthropic) using your API keys.' },
  ];

  return (
    <PageShell
      title="AI Models"
      description="Configure model routing between local on-device LLMs and cloud providers."
      headerActions={
        <Button variant="primary" size="sm" onClick={handleSave} icon={saved ? <Check size={13} /> : undefined}>
          {saved ? 'Saved' : 'Save changes'}
        </Button>
      }
    >
      {/* Routing Mode */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
          Routing mode
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {routingOptions.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: routingMode === opt.value ? 'var(--bg-3)' : 'var(--bg-1)',
                border: `1px solid ${routingMode === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'background 0.1s ease, border-color 0.1s ease',
              }}
            >
              <input
                type="radio"
                name="routing"
                value={opt.value}
                checked={routingMode === opt.value}
                onChange={(e) => setRoutingMode(e.target.value)}
                style={{ marginTop: '2px', accentColor: 'var(--accent)' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.4 }}>
                  {opt.desc}
                </span>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* Cloud Model & Credentials */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
            Cloud API Credentials & Model
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
            Keys are encrypted on disk with your OS keystore via safeStorage and never exposed to web pages.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
              Provider model
            </span>
            <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              Frontier model used when cloud execution is required.
            </p>
          </div>
          <select
            value={cloudModel}
            onChange={(e) => setCloudModel(e.target.value)}
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
            <option value="gpt-4o">OpenAI gpt-4o</option>
            <option value="gpt-4o-mini">OpenAI gpt-4o-mini</option>
            <option value="claude-sonnet-5-5">Anthropic Claude Sonnet 5.5</option>
            <option value="claude-haiku-5-5">Anthropic Claude Haiku 5.5</option>
          </select>
        </div>

        {/* OpenAI Key */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={13} />
              OpenAI API key
            </label>
            <Badge variant={hasOpenAI ? 'ok' : 'neutral'} dot>
              {hasOpenAI ? 'Configured' : 'Not set'}
            </Badge>
          </div>
          <input
            type="password"
            placeholder={hasOpenAI ? '•••••••••••••••• (Key saved — enter new key to replace)' : 'sk-...'}
            value={openAIKey}
            onChange={(e) => setOpenAIKey(e.target.value)}
            style={{
              background: 'var(--bg-1)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontFamily: 'inherit',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Anthropic Key */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={13} />
              Anthropic API key
            </label>
            <Badge variant={hasAnthropic ? 'ok' : 'neutral'} dot>
              {hasAnthropic ? 'Configured' : 'Not set'}
            </Badge>
          </div>
          <input
            type="password"
            placeholder={hasAnthropic ? '•••••••••••••••• (Key saved — enter new key to replace)' : 'sk-ant-...'}
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            style={{
              background: 'var(--bg-1)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontFamily: 'inherit',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </Card>

      {/* Local Model (Ollama) */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
              Local model (Ollama)
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
              Connects to your local Ollama daemon on localhost:11434.
            </p>
          </div>
          <Badge variant={ollamaOnline ? 'ok' : ollamaOnline === false ? 'danger' : 'neutral'} dot>
            {ollamaOnline === null ? 'Checking…' : ollamaOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>

        {ollamaModels.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Installed models:</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {ollamaModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setLocalModel(m)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    background: localModel === m ? 'var(--accent-bg)' : 'var(--bg-1)',
                    color: localModel === m ? 'var(--accent)' : 'var(--text-2)',
                    border: `1px solid ${localModel === m ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>
            No Ollama models detected. Run <code style={{ color: 'var(--accent)' }}>ollama pull qwen3:8b</code> in your terminal.
          </p>
        )}
      </Card>
    </PageShell>
  );
};
