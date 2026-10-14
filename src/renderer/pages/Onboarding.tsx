import React, { useState } from 'react';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Shield, Cpu, Cloud, Sparkles, Check, ArrowRight, ArrowLeft, Bookmark, Puzzle, Play } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
  onTryTask?: (task: string) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onTryTask }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [modelChoice, setModelChoice] = useState<'auto' | 'local_only' | 'cloud_only'>('auto');
  const [importBookmarks, setImportBookmarks] = useState(false);
  const [importExtensions, setImportExtensions] = useState(false);
  const [sampleTask, setSampleTask] = useState('Search for the weather in my city');
  const [isFinishing, setIsFinishing] = useState(false);

  const totalSteps = 5;

  const handleNext = async () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    } else {
      await handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    if (window.sentry) {
      // Save onboarding completed in settings
      await window.sentry.settings.update({
        hasCompletedOnboarding: true,
      });

      // Save model preference if changed
      if (modelChoice) {
        const currentConfig = await window.sentry.agent.getModelConfig();
        await window.sentry.agent.setModelConfig({
          localModel: currentConfig?.localModel || 'llama3.1:8b',
          cloudModel: currentConfig?.cloudModel || 'gpt-4o',
          routingMode: modelChoice,
        });
      }
    }
    setIsFinishing(false);
    onComplete();
  };

  const handleTryNow = async () => {
    if (window.sentry) {
      await window.sentry.settings.update({
        hasCompletedOnboarding: true,
      });
    }
    if (onTryTask && sampleTask) {
      onTryTask(sampleTask);
    } else {
      onComplete();
    }
  };

  return (
    <PageShell
      title="Welcome to Sentry"
      description="A browser where you're in complete control of the AI agent."
    >
      {/* Progress Dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const stepNum = idx + 1;
          const isDone = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          return (
            <div
              key={stepNum}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: isCurrent ? 'var(--accent)' : isDone ? 'var(--ok)' : 'var(--bg-3)',
                transition: 'background 0.2s ease',
              }}
            />
          );
        })}
      </div>

      {/* Step 1: Welcome */}
      {currentStep === 1 && (
        <Card title="A browser where you're in control of the AI">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px', color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.6 }}>
            <p>
              Traditional browsers are passive tools. AI-enabled browsers often send your private browsing context to remote clouds without transparency or oversight.
            </p>
            <p>
              <strong>Sentry is different:</strong> It gives you an autonomous browsing assistant backed by an <strong>Action Firewall</strong>, <strong>Prompt Injection Detector</strong>, and <strong>Local-First Model Router</strong>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '8px' }}>
              <div style={{ background: 'var(--bg-1)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <Shield size={20} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Action Firewall</div>
                <div style={{ fontSize: '12px' }}>Categorizes actions into 4 risk tiers before anything executes.</div>
              </div>
              <div style={{ background: 'var(--bg-1)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <Cpu size={20} style={{ color: 'var(--ok)', marginBottom: '8px' }} />
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Local-First AI</div>
                <div style={{ fontSize: '12px' }}>Runs locally with Ollama for 100% private, free operation.</div>
              </div>
              <div style={{ background: 'var(--bg-1)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <Sparkles size={20} style={{ color: 'var(--warn)', marginBottom: '8px' }} />
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Transparent AI</div>
                <div style={{ fontSize: '12px' }}>Every step explains "Why?" with audit logging and full undo.</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Set Up AI Model */}
      {currentStep === 2 && (
        <Card title="Choose how Sentry's AI runs">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
            {[
              {
                id: 'auto',
                title: 'Auto (Recommended)',
                badge: 'Smart Routing',
                desc: 'Routes lightweight and private tasks to your local model; uses cloud for complex multi-step reasoning when configured.',
                icon: <Sparkles size={18} style={{ color: 'var(--accent)' }} />,
              },
              {
                id: 'local_only',
                title: 'Local only',
                badge: '100% Private',
                desc: 'All agent reasoning stays on your machine using Ollama. Zero network requests, completely free, requires local Ollama.',
                icon: <Cpu size={18} style={{ color: 'var(--ok)' }} />,
              },
              {
                id: 'cloud_only',
                title: 'Cloud',
                badge: 'Fast & Powerful',
                desc: 'Direct reasoning through cloud models (GPT-4o, Claude 3.5 Sonnet). Requires your own API key stored securely in OS keychain.',
                icon: <Cloud size={18} style={{ color: 'var(--warn)' }} />,
              },
            ].map((option) => (
              <div
                key={option.id}
                onClick={() => setModelChoice(option.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: 'var(--radius-sm)',
                  background: modelChoice === option.id ? 'var(--bg-3)' : 'var(--bg-1)',
                  border: modelChoice === option.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ marginTop: '2px' }}>{option.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px' }}>{option.title}</span>
                    <span className="badge-tint accent" style={{ fontSize: '10px' }}>{option.badge}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.4 }}>{option.desc}</div>
                </div>
                <input
                  type="radio"
                  name="modelChoice"
                  checked={modelChoice === option.id}
                  onChange={() => setModelChoice(option.id as any)}
                  style={{ accentColor: 'var(--accent)', marginTop: '4px' }}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Step 3: Import Data */}
      {currentStep === 3 && (
        <Card title="Bring your existing browser data (optional)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.5 }}>
              Sentry supports importing bookmarks and Chrome Web Store extensions so you can make Sentry your daily browser effortlessly.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={importBookmarks}
                  onChange={(e) => setImportBookmarks(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <Bookmark size={18} style={{ color: 'var(--accent)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: '13px' }}>Import bookmarks from Chrome/Edge/Firefox</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Imports bookmarks HTML file or default profile bookmarks</div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={importExtensions}
                  onChange={(e) => setImportExtensions(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <Puzzle size={18} style={{ color: 'var(--ok)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: '13px' }}>Enable extension support</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Load unpacked extensions (uBlock Origin, Bitwarden, etc.)</div>
                </div>
              </label>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic' }}>
              You can also manage or import bookmarks and extensions at any time via Settings.
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Understand Trust Levels */}
      {currentStep === 4 && (
        <Card title="Sentry protects you by default with 4 Trust Tiers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.5 }}>
              The Action Firewall inspects every click, form submission, and navigation before execution. Sites are assigned a Trust Level:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className="status-dot ok" />
                  <strong style={{ color: 'var(--text)', fontSize: '12px' }}>READ_ACT</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                  Normal trusted browsing. Low/Medium actions auto-allowed; High actions require confirmation.
                </div>
              </div>

              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className="status-dot warn" />
                  <strong style={{ color: 'var(--text)', fontSize: '12px' }}>READ_ONLY</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                  Agent can read page text and scroll, but cannot click buttons or submit forms.
                </div>
              </div>

              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className="status-dot danger" />
                  <strong style={{ color: 'var(--text)', fontSize: '12px' }}>HIGHLY_RESTRICTED</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                  Sensitive domains (banks, email). All state changes require explicit step-by-step approval.
                </div>
              </div>

              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className="status-dot danger" />
                  <strong style={{ color: 'var(--text)', fontSize: '12px' }}>BLOCKED</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                  Agent is completely disabled on this domain. No observations or actions permitted.
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>
              You can adjust trust levels per-domain anytime in <strong>Settings &gt; Trust Dashboard</strong>.
            </div>
          </div>
        </Card>
      )}

      {/* Step 5: Try It Out */}
      {currentStep === 5 && (
        <Card title="Give Sentry a task to see how it works">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.5 }}>
              Try giving Sentry a simple first task. You can watch the ReAct loop plan and observe each step in the docked agent sidebar.
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
              }}
            >
              <input
                type="text"
                value={sampleTask}
                onChange={(e) => setSampleTask(e.target.value)}
                placeholder="Enter a task for the AI agent…"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text)',
                  fontSize: '13px',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <Button variant="primary" onClick={handleTryNow} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Play size={14} /> Try Now
              </Button>
              <Button variant="secondary" onClick={handleFinish} disabled={isFinishing}>
                Skip &amp; Open New Tab
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Navigation Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
        {currentStep > 1 ? (
          <Button variant="secondary" onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={14} /> Back
          </Button>
        ) : (
          <div />
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          {currentStep < totalSteps && (
            <Button variant="secondary" onClick={handleFinish} disabled={isFinishing}>
              Skip Setup
            </Button>
          )}
          {currentStep < totalSteps && (
            <Button variant="primary" onClick={handleNext} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Next <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
};
