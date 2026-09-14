import { describe, it, expect } from 'vitest';
import { NavigationManager } from '../../src/main/browser/navigation-manager';

describe('NavigationManager URL formatting & Search query handling', () => {
  it('should preserve valid http and https URLs', () => {
    expect(NavigationManager.formatUrl('https://example.com')).toBe('https://example.com');
    expect(NavigationManager.formatUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('should prepend https:// to bare domain names', () => {
    expect(NavigationManager.formatUrl('google.com')).toBe('https://google.com');
    expect(NavigationManager.formatUrl('github.com/Saqlain-mushtaq-alamin')).toBe('https://github.com/Saqlain-mushtaq-alamin');
  });

  it('should convert raw search queries into Google search URLs by default', () => {
    const formatted = NavigationManager.formatUrl('how to build an agentic browser');
    expect(formatted).toContain('google.com/search?q=how%20to%20build%20an%20agentic%20browser');
  });

  it('should support alternative search engines', () => {
    const duckUrl = NavigationManager.formatUrl('react vitest', 'duckduckgo');
    expect(duckUrl).toContain('duckduckgo.com/?q=react%20vitest');

    const bingUrl = NavigationManager.formatUrl('electron webcontentsview', 'bing');
    expect(bingUrl).toContain('bing.com/search?q=electron%20webcontentsview');
  });

  it('should return sentry://newtab for empty inputs', () => {
    expect(NavigationManager.formatUrl('')).toBe('sentry://newtab');
  });

  it('should preserve internal sentry:// protocols', () => {
    expect(NavigationManager.formatUrl('sentry://history')).toBe('sentry://history');
    expect(NavigationManager.formatUrl('sentry://settings')).toBe('sentry://settings');
    expect(NavigationManager.formatUrl('sentry://bookmarks')).toBe('sentry://bookmarks');
  });
});

