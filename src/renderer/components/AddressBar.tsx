import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Lock,
  Globe,
  Star,
  Bot,
  MoreHorizontal,
  History as HistoryIcon,
  Bookmark as BookmarkIcon,
  Download,
  Puzzle,
  FileText,
  ShieldCheck,
  Cpu,
  Terminal,
  Settings as SettingsIcon,
} from 'lucide-react';
import { TabItem, BookmarkItem, HistoryItem, AgentNotification } from '../../shared/types';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import { Menu, MenuItem, MenuDivider } from './ui/Menu';
import { NotificationCenter } from './NotificationCenter';
import { useHideNativeView } from '../hooks/useHideNativeView';

interface AddressBarProps {
  activeTab: TabItem | null;
  bookmarks: BookmarkItem[];
  history: HistoryItem[];
  routingDecision?: any;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  notifications: AgentNotification[];
  onDismissNotification: (id: string) => void;
  onClearNotifications: () => void;
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
  isSidebarOpen,
  onToggleSidebar,
  notifications,
  onDismissNotification,
  onClearNotifications,
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const activeUrl = activeTab?.url;

  useEffect(() => {
    if (activeUrl) {
      setInputUrl(activeUrl === 'sentry://newtab' ? '' : activeUrl);
    }
  }, [activeUrl]);

  // Hide native WebContentsView when suggestions are showing so they aren't cut in half
  const showSuggestions = isFocused && suggestions.length > 0;
  useHideNativeView(showSuggestions);

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
  const isInternal = activeTab?.url.startsWith('sentry://');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-1)',
        padding: '6px 12px',
        gap: '6px',
        borderBottom: '1px solid var(--border)',
        position: 'relative',
        height: '42px',
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {/* Navigation Buttons */}
      <IconButton
        id="nav-btn-back"
        label="Go Back (Alt+Left)"
        disabled={!activeTab?.canGoBack}
        onClick={onGoBack}
      >
        <ArrowLeft size={15} />
      </IconButton>

      <IconButton
        id="nav-btn-forward"
        label="Go Forward (Alt+Right)"
        disabled={!activeTab?.canGoForward}
        onClick={onGoForward}
      >
        <ArrowRight size={15} />
      </IconButton>

      <IconButton
        id="nav-btn-reload"
        label={activeTab?.isLoading ? 'Stop loading (Esc)' : 'Reload page (Ctrl+R)'}
        onClick={onReload}
      >
        {activeTab?.isLoading ? <X size={15} /> : <RotateCw size={14} />}
      </IconButton>

      {/* Address Bar Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          flexGrow: 1,
          minWidth: 0,
          position: 'relative',
          display: 'flex',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            height: 'var(--control-h)',
            background: 'var(--bg-2)',
            borderRadius: 'var(--radius-sm)',
            padding: '0 8px',
            border: isFocused ? '1px solid var(--accent)' : '1px solid var(--border)',
            transition: 'border-color 0.15s ease',
          }}
        >
          {/* Security / Scheme Icon */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: isInternal ? 'var(--accent)' : isHttps ? 'var(--ok)' : 'var(--text-3)',
              marginRight: '6px',
              flexShrink: 0,
            }}
          >
            {isInternal ? (
              <ShieldCheck size={14} />
            ) : isHttps ? (
              <Lock size={13} />
            ) : (
              <Globe size={13} />
            )}
          </span>

          <input
            type="text"
            value={inputUrl}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search with Google or enter address"
            style={{
              flexGrow: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: '12px',
              fontFamily: 'inherit',
            }}
          />

          {/* Bookmark Star Button */}
          {activeTab && !isInternal && (
            <IconButton
              type="button"
              label={isBookmarked ? 'Remove bookmark' : 'Bookmark this tab (Ctrl+D)'}
              onClick={() => onToggleBookmark(activeTab.url, activeTab.title)}
              style={{
                width: '20px',
                height: '20px',
                color: isBookmarked ? 'var(--warn)' : 'var(--text-3)',
              }}
            >
              <Star size={13} fill={isBookmarked ? 'var(--warn)' : 'none'} />
            </IconButton>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && (
          <div
            style={{
              position: 'absolute',
              top: '34px',
              left: 0,
              right: 0,
              background: 'var(--bg-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.55)',
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
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--text)',
                  borderBottom: idx === suggestions.length - 1 ? 'none' : '1px solid var(--border)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
                  {s.type === 'bookmark' ? <Star size={12} fill="var(--warn)" color="var(--warn)" /> : <HistoryIcon size={12} />}
                </span>
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title}
                </span>
                <span style={{ color: 'var(--text-3)', fontSize: '11px', marginLeft: 'auto', flexShrink: 0 }}>
                  {s.url}
                </span>
              </div>
            ))}
          </div>
        )}
      </form>

      {/* Agent Toggle Button */}
      <Button
        variant={isSidebarOpen ? 'primary' : 'secondary'}
        onClick={onToggleSidebar}
        title="Toggle AI Agent Sidebar (Ctrl+Shift+Space)"
        style={{
          height: 'var(--control-h)',
          padding: '0 10px',
          fontWeight: 500,
        }}
        icon={<Bot size={14} />}
      >
        Agent
      </Button>

      {/* Notifications Drawer */}
      <NotificationCenter
        notifications={notifications}
        onDismiss={onDismissNotification}
        onClearAll={onClearNotifications}
      />

      {/* More ("⋯") Menu Button */}
      <div style={{ position: 'relative' }}>
        <IconButton
          label="More options"
          active={isMenuOpen}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <MoreHorizontal size={16} />
        </IconButton>

        <Menu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          top="34px"
          right={0}
          width={220}
        >
          <MenuItem
            icon={<HistoryIcon size={14} />}
            label="History"
            shortcut="Ctrl+H"
            onClick={() => {
              onOpenPage('history');
              setIsMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<BookmarkIcon size={14} />}
            label="Bookmarks"
            shortcut="Ctrl+D"
            onClick={() => {
              onOpenPage('bookmarks');
              setIsMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<Download size={14} />}
            label="Downloads"
            shortcut="Ctrl+J"
            onClick={() => {
              onOpenPage('downloads');
              setIsMenuOpen(false);
            }}
          />

          <MenuDivider />

          <MenuItem
            icon={<Puzzle size={14} />}
            label="Extensions"
            onClick={() => {
              onOpenPage('extensions');
              setIsMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<FileText size={14} />}
            label="Recipes"
            onClick={() => {
              onOpenPage('recipes');
              setIsMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<ShieldCheck size={14} />}
            label="Trust & Security"
            onClick={() => {
              onOpenPage('trust');
              setIsMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<Cpu size={14} />}
            label="AI Models"
            onClick={() => {
              onOpenPage('models');
              setIsMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<Terminal size={14} />}
            label="Developer Mode"
            onClick={() => {
              onOpenPage('developer');
              setIsMenuOpen(false);
            }}
          />

          <MenuDivider />

          <MenuItem
            icon={<SettingsIcon size={14} />}
            label="Settings"
            shortcut="Ctrl+,"
            onClick={() => {
              onOpenPage('settings');
              setIsMenuOpen(false);
            }}
          />
        </Menu>
      </div>
    </div>
  );
};
