import React, { useState } from 'react';
import { Copy, Check, Volume2, Square, X, Sparkles } from 'lucide-react';
import { IconButton } from './ui/IconButton';
import { Card } from './ui/Card';
import { speak, stop } from '../services/tts';

export interface AgentResultCardProps {
  instruction: string;
  summary: string;
  timestamp?: number;
  onClear?: () => void;
  style?: React.CSSProperties;
}

export const AgentResultCard: React.FC<AgentResultCardProps> = ({
  instruction,
  summary,
  timestamp,
  onClear,
  style,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeak = () => {
    if (!summary) return;
    if (isSpeaking) {
      stop();
      setIsSpeaking(false);
    } else {
      speak(summary);
      setIsSpeaking(true);
    }
  };


  return (
    <Card
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
            AI Result
          </span>
          {timestamp && (
            <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <IconButton
            label={copied ? 'Copied' : 'Copy result'}
            onClick={handleCopy}
            style={{ width: '24px', height: '24px' }}
          >
            {copied ? <Check size={13} style={{ color: 'var(--ok)' }} /> : <Copy size={13} />}
          </IconButton>

          <IconButton
            label={isSpeaking ? 'Stop speaking' : 'Read aloud'}
            onClick={handleToggleSpeak}
            style={{ width: '24px', height: '24px' }}
          >
            {isSpeaking ? <Square size={12} style={{ color: 'var(--danger)' }} /> : <Volume2 size={13} />}
          </IconButton>

          {onClear && (
            <IconButton
              label="Dismiss output"
              onClick={onClear}
              style={{ width: '24px', height: '24px' }}
            >
              <X size={13} />
            </IconButton>
          )}
        </div>
      </div>

      {/* Instruction query quote */}
      {instruction && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-2)',
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={instruction}
        >
          "{instruction}"
        </div>
      )}

      {/* Result body */}
      <div
        style={{
          fontSize: '12px',
          color: 'var(--text)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: 'var(--bg-1)',
          padding: '8px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          maxHeight: '260px',
          overflowY: 'auto',
          userSelect: 'text',
        }}
      >
        {summary}
      </div>
    </Card>
  );
};
