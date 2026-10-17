import React, { useCallback, useEffect, useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import {
  BetaConsentSettings,
  BetaStatus,
  FeedbackCategory,
  FeedbackResult,
} from '../../shared/beta';

export interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: (result: FeedbackResult) => void;
}

const CATEGORIES: { value: FeedbackCategory; label: string; hint: string }[] = [
  { value: 'bug', label: 'Something went wrong', hint: 'A bug, crash, or broken behavior' },
  { value: 'suggestion', label: 'Suggestion', hint: 'An idea to make Sentry better' },
  { value: 'compliment', label: 'Compliment', hint: 'Something that worked really well' },
];

const MAX_LENGTH = 4000;

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ isOpen, onClose, onSubmitted }) => {
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [includeLogs, setIncludeLogs] = useState(false);
  const [consent, setConsent] = useState<BetaConsentSettings>({
    telemetryEnabled: false,
    crashReportingEnabled: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setError(null);
    setSubmitted(false);
    window.sentry?.beta
      ?.getStatus()
      .then((status: BetaStatus) => {
        if (!cancelled) setConsent(status.consent);
      })
      .catch(() => {
        /* status unavailable — keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const applyConsent = useCallback(async (next: BetaConsentSettings) => {
    setConsent(next);
    try {
      await window.sentry?.beta?.setConsent(next);
    } catch {
      /* consent persistence is best-effort */
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) {
      setError('Please describe your feedback.');
      return;
    }
    if (!window.sentry?.beta) {
      setError('Feedback is unavailable in this build.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await window.sentry.beta.submitFeedback({
        category,
        message: message.trim(),
        contactEmail: contactEmail.trim() || undefined,
        includeLogs,
      });
      if (result.accepted) {
        setSubmitted(true);
        setMessage('');
        setContactEmail('');
        onSubmitted?.(result);
      } else {
        setError(result.error ?? 'Failed to submit feedback.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  }, [category, message, contactEmail, includeLogs, onSubmitted]);

  const categoryButtonStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--bg-3)' : 'var(--bg-1)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'border-color 0.12s ease, background 0.12s ease',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={submitted ? 'Thanks for the feedback!' : 'Send feedback'}
      description={
        submitted
          ? 'Your feedback is queued locally and will be included in the beta report.'
          : 'Tell us what worked, what broke, or what you would improve.'
      }
      footer={
        submitted ? (
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? 'Sending…' : 'Send feedback'}
            </Button>
          </>
        )
      }
    >
      {!submitted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {CATEGORIES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setCategory(entry.value)}
                style={categoryButtonStyle(category === entry.value)}
              >
                <div style={{ fontSize: '12px', fontWeight: 600 }}>{entry.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' }}>{entry.hint}</div>
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="feedback-message" style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px' }}>
              Details
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_LENGTH}
              rows={5}
              placeholder="What happened? Steps to reproduce help a lot."
              style={{
                width: '100%',
                resize: 'vertical',
                background: 'var(--bg-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: '13px',
                fontFamily: 'inherit',
                lineHeight: 1.45,
              }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-2)', textAlign: 'right', marginTop: '2px' }}>
              {message.length}/{MAX_LENGTH}
            </div>
          </div>

          <div>
            <label htmlFor="feedback-email" style={{ display: 'block', fontSize: '12px', color: 'var(--text-2)', marginBottom: '4px' }}>
              Email (optional, only if you want a reply)
            </label>
            <input
              id="feedback-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
                background: 'var(--bg-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: '13px',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={includeLogs} onChange={(e) => setIncludeLogs(e.target.checked)} />
            Include diagnostic logs with this report
          </label>

          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Beta data sharing
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consent.telemetryEnabled}
                onChange={(e) => void applyConsent({ ...consent, telemetryEnabled: e.target.checked })}
              />
              Share anonymous usage metrics (tasks, confirmations, performance)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-2)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consent.crashReportingEnabled}
                onChange={(e) => void applyConsent({ ...consent, crashReportingEnabled: e.target.checked })}
              />
              Send crash reports so we can fix stability issues
            </label>
          </div>

          {error && (
            <div style={{ fontSize: '12px', color: 'var(--danger)', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
              {error}
            </div>
          )}
        </div>
      )}

      {submitted && (
        <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
          Your feedback has been saved locally. You can send more anytime from the titlebar.
        </div>
      )}
    </Modal>
  );
};

export default FeedbackDialog;
