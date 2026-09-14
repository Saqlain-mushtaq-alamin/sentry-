import React, { useState, useEffect } from 'react';
import { TabItem, BookmarkItem, HistoryItem } from '../../shared/types';
import { CloudIndicator } from './CloudIndicator';
import { CostMeter } from './CostMeter';

interface AddressBarProps {
  activeTab: TabItem | null;
  bookmarks: BookmarkItem[];
  history: HistoryItem[];
  routingDecision?: any;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onToggleBookmark: (url: string, title: string) => void;
  onOpenPage: (page: string) => void;
}

export const AddressBar: React.FC<AddressBarProps> = ({
  activeTab,
  bookmarks,
  history,
  routingDecision,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onToggleBookmark,
  onOpenPage,
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<{ title: string; url: string; type: string }[]>([]);

  const activeUrl = activeTab?.url;

  useEffect(() => {
    if (activeUrl) {
      setInputUrl(activeUrl === 'sentry://newtab' ? '' : activeUrl);
    }
  }, [activeUrl]);

  const handleInputChange = (val: string) => {
    setInputUrl(val);
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }

    const query = val.toLowerCase();
    const matches: { title: string; url: string; type: string }[] = [];

    // History matches
    history.forEach((h) => {
      if (h.url.toLowerCase().includes(query) || h.title.toLowerCase().includes(query)) {
        if (matches.length < 5) matches.push({ title: h.title, url: h.url, type: 'history' });
      }
    });

    // Bookmark matches
    bookmarks.forEach((b) => {
      if (b.url.toLowerCase().includes(query) || b.title.toLowerCase().includes(query)) {
        if (matches.length < 8) matches.push({ title: b.title, url: b.url, type: 'bookmark' });
      }
    });

    setSuggestions(matches);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputUrl.trim()) {
      onNavigate(inputUrl.trim());
      setIsFocused(false);
    }
  };

  const isBookmarked = activeTab ? bookmarks.some((b) => b.url === activeTab.url) : false;
  const isHttps = activeTab?.url.startsWith('https://');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: '#111827',
        padding: '6px 12px',
        gap: '8px',
        borderBottom: '1px solid #1f2937',
        position: 'relative',
      }}
    >
      {/* Navigation Buttons */}
      <button
        id="nav-btn-back"
        title="Go Back (Alt+Left)"
        disabled={!activeTab?.canGoBack}
        onClick={onGoBack}
        style={{
          border: 'none',
          background: 'transparent',
          color: activeTab?.canGoBack ? '#f3f4f6' : '#4b5563',
          cursor: activeTab?.canGoBack ? 'pointer' : 'default',
          fontSize: '15px',
          padding: '4px 8px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (activeTab?.canGoBack) e.currentTarget.style.background = '#374151';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        ←
      </button>

      <button
        id="nav-btn-forward"
        title="Go Forward (Alt+Right)"
        disabled={!activeTab?.canGoForward}
        onClick={onGoForward}
        style={{
          border: 'none',
          background: 'transparent',
          color: activeTab?.canGoForward ? '#f3f4f6' : '#4b5563',
          cursor: activeTab?.canGoForward ? 'pointer' : 'default',
          fontSize: '15px',
          padding: '4px 8px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (activeTab?.canGoForward) e.currentTarget.style.background = '#374151';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        →
      </button>

      <button
        id="nav-btn-reload"
        title={activeTab?.isLoading ? "Stop Loading (Esc)" : "Reload Page (Ctrl+R / F5)"}
        onClick={onReload}
        style={{
          border: 'none',
          background: 'transparent',
          color: '#f3f4f6',
          cursor: 'pointer',
          fontSize: '15px',
          padding: '4px 8px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#374151')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {activeTab?.isLoading ? '✕' : '↻'}
      </button>

      {/* Address Form Input */}
      <form onSubmit={handleSubmit} style={{ flexGrow: 1, position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#1f2937',
            borderRadius: '20px',
            padding: '4px 12px',
            border: isFocused ? '1px solid #3b82f6' : '1px solid transparent',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '12px', marginRight: '6px' }}>
            {activeTab?.url.startsWith('sentry://') ? '⚡' : isHttps ? '🔒' : '🌐'}
          </span>

          <input
            type="text"
            value={inputUrl}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search with Google or type a URL"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f9fafb',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          />

          {/* Bookmark Star Button */}
          {activeTab && !activeTab.url.startsWith('sentry://') && (
            <button
              type="button"
              onClick={() => onToggleBookmark(activeTab.url, activeTab.title)}
              style={{
                border: 'none',
                background: 'transparent',
                color: isBookmarked ? '#f59e0b' : '#6b7280',
                cursor: 'pointer',
                fontSize: '14px',
                marginLeft: '6px',
              }}
              title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Page (Ctrl+D)'}
            >
              ★
            </button>
          )}
        </div>

        {/* Autocomplete Suggestions Popup */}
        {isFocused && suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '38px',
              left: 0,
              right: 0,
              background: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
              zIndex: 9999,
              overflow: 'hidden',
            }}
          >
            {suggestions.map((s, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onNavigate(s.url);
                  setIsFocused(false);
                }}
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#e5e7eb',
                  borderBottom: idx === suggestions.length - 1 ? 'none' : '1px solid #2d3748',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#374151')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>{s.type === 'bookmark' ? '★' : '🕒'}</span>
                <span style={{ fontWeight: 600 }}>{s.title}</span>
                <span style={{ color: '#9ca3af', fontSize: '11px', marginLeft: 'auto' }}>{s.url}</span>
              </div>
            ))}
          </div>
        )}
      </form>

      {/* Internal Page Shortcut Buttons */}
      <button
        onClick={() => onOpenPage('trust')}
        title="Trust & Security Dashboard"
        style={{
          border: '1px solid #059669',
          background: 'rgba(5, 150, 105, 0.15)',
          color: '#10b981',
          padding: '2px 6px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        🛡️ Trust
      </button>

      <button
        onClick={() => onOpenPage('history')}
        title="History (Ctrl+H)"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#9ca3af',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        🕒
      </button>

      <button
        onClick={() => onOpenPage('bookmarks')}
        title="Bookmarks"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#9ca3af',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        ★
      </button>

      <button
        onClick={() => onOpenPage('downloads')}
        title="Downloads (Ctrl+J)"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#9ca3af',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        ⬇
      </button>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
        <CloudIndicator 
          isCloud={routingDecision?.isCloud || false} 
          provider={routingDecision?.adapter?.providerId || "Ollama"} 
          model={routingDecision?.adapter?.modelId || "llama3.1:8b"} 
          estimatedTokens={0} 
          domain={activeUrl ? (() => { try { return new URL(activeUrl.startsWith('http') ? activeUrl : 'http://localhost').hostname; } catch { return 'localhost'; } })() : 'localhost'} 
        />
        <CostMeter 
          currentTaskCost={routingDecision?.estimatedCost || 0.00} 
          currentTaskTokens={0} 
          todayCost={0.12} 
          todayTokens={48200} 
          monthCost={1.47} 
          monthTokens={587000} 
          budget={5.00} 
        />
      </div>

      <button
        onClick={() => onOpenPage('settings')}
        title="Settings (Ctrl+,)"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#9ca3af',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        ⚙
      </button>

      <button
        onClick={() => onOpenPage('recipes')}
        title="My Recipes"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#a6e3a1',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 'bold'
        }}
      >
        📋
      </button>

      <button
        onClick={() => onOpenPage('models')}
        title="AI Models"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#cba6f7',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 'bold'
        }}
      >
        🧠
      </button>

      <button
        onClick={() => onOpenPage('developer')}
        title="Developer / Research Mode"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#38bdf8',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 'bold'
        }}
      >
        🔧
      </button>

      <button
        onClick={() => onOpenPage('extensions')}
        title="Extensions"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#fbbf24',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 'bold'
        }}
      >
        🧩
      </button>
    </div>
  );
};
