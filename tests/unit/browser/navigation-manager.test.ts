import { describe, it, expect } from 'vitest';
import { NavigationManager } from '../../../src/main/browser/navigation-manager';

describe('NavigationManager.formatUrl', () => {
  it('passes through full https URLs untouched', () => {
    expect(NavigationManager.formatUrl('https://example.com')).toBe('https://example.com');
    expect(NavigationManager.formatUrl('https://example.com/path?q=1#frag')).toBe(
      'https://example.com/path?q=1#frag',
    );
  });

  it('passes through full http URLs untouched', () => {
    expect(NavigationManager.formatUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('prepends https:// to bare domain names', () => {
    expect(NavigationManager.formatUrl('example.com')).toBe('https://example.com');
    expect(NavigationManager.formatUrl('docs.example.com/guide')).toBe('https://docs.example.com/guide');
  });

  it('treats localhost input as a URL rather than a search', () => {
    expect(NavigationManager.formatUrl('localhost:8080')).toBe('https://localhost:8080');
  });

  it('converts plain text into a Google search URL by default', () => {
    expect(NavigationManager.formatUrl('how to build an agentic browser')).toBe(
      'https://www.google.com/search?q=how%20to%20build%20an%20agentic%20browser',
    );
  });

  it('passes sentry:// internal pages through unchanged', () => {
    expect(NavigationManager.formatUrl('sentry://newtab')).toBe('sentry://newtab');
    expect(NavigationManager.formatUrl('sentry://settings')).toBe('sentry://settings');
  });

  it('passes about: pages through unchanged', () => {
    expect(NavigationManager.formatUrl('about:blank')).toBe('about:blank');
    expect(NavigationManager.formatUrl('about:config')).toBe('about:config');
  });

  it('returns sentry://newtab for empty or whitespace-only input', () => {
    expect(NavigationManager.formatUrl('')).toBe('sentry://newtab');
    expect(NavigationManager.formatUrl('   ')).toBe('sentry://newtab');
  });

  it('produces DuckDuckGo search URLs for the duckduckgo engine', () => {
    expect(NavigationManager.formatUrl('react vitest mocking', 'duckduckgo')).toBe(
      'https://duckduckgo.com/?q=react%20vitest%20mocking',
    );
  });

  it('produces Bing search URLs for the bing engine', () => {
    expect(NavigationManager.formatUrl('electron webcontentsview', 'bing')).toBe(
      'https://www.bing.com/search?q=electron%20webcontentsview',
    );
  });

  it('still applies the engine to text that contains spaces and punctuation', () => {
    expect(NavigationManager.formatUrl('what is a "tab grouper"?', 'google')).toBe(
      'https://www.google.com/search?q=what%20is%20a%20%22tab%20grouper%22%3F',
    );
  });
});
