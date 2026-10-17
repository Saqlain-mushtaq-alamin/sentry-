import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ElementResolver } from '../../../src/main/cdp/element-resolver';
import { PageSnapshot, InteractiveElement } from '../../../src/shared/types';

function element(overrides: Partial<InteractiveElement>): InteractiveElement {
  return {
    index: 0,
    tag: 'button',
    role: 'button',
    label: '',
    selector: '#el',
    boundingBox: { x: 0, y: 0, width: 10, height: 10 },
    isVisible: true,
    isEnabled: true,
    ...overrides,
  };
}

describe('ElementResolver gap coverage', () => {
  let resolver: ElementResolver;
  let snapshot: PageSnapshot;

  beforeEach(() => {
    resolver = new ElementResolver();
    snapshot = {
      url: 'https://test.com',
      title: 'Test',
      timestamp: Date.now(),
      dom: { tag: 'body', children: [] },
      accessibilityTree: [],
      visibleText: '',
      forms: [
        {
          fields: [
            { selector: '#username', label: 'User Name', type: 'text', required: false },
            { selector: '#password', label: 'Password', type: 'password', required: true },
          ],
        },
      ],
      links: [],
      interactiveElements: [
        element({ index: 0, role: 'button', label: 'Sign In', selector: '#submit' }),
        element({ index: 1, role: 'textbox', label: 'Email address', selector: '#email' }),
        element({ index: 2, role: 'button', label: 'Sign in with Google', selector: '#google' }),
        element({ index: 3, role: 'button', label: 'Cancel', selector: '#cancel' }),
        element({ index: 4, role: 'textbox', label: 'Username', selector: '#user-input' }),
      ],
      estimatedTokenCount: 10,
    };
  });

  it('resolveByLabel falls back to partial interactive-element matches', () => {
    // no exact form field match ("Email" vs "Email Address"), no exact label
    expect(resolver.resolve({ kind: 'label', value: 'Email' }, snapshot)).toBe('#email');
    // case-insensitive exact form-field match still wins over interactive text
    expect(resolver.resolve({ kind: 'label', value: 'user name' }, snapshot)).toBe('#username');
  });

  it('resolveByRole picks the candidate nearest the proximity element', () => {
    expect(resolver.resolve({ kind: 'role', value: 'button' }, snapshot)).toBe('#submit');
    expect(resolver.resolve({ kind: 'role', value: 'button', proximity: 'google' }, snapshot)).toBe('#google');
    expect(resolver.resolve({ kind: 'role', value: 'button', proximity: 'Cancel' }, snapshot)).toBe('#cancel');
  });

  it('resolveByRole without proximity falls back to the first candidate', () => {
    expect(resolver.resolve({ kind: 'role', value: 'button', proximity: 'does-not-exist' }, snapshot)).toBe('#submit');
  });

  it('resolveByRole returns undefined when no candidate has the role', () => {
    expect(resolver.resolve({ kind: 'role', value: 'combobox' }, snapshot)).toBeUndefined();
  });

  it('text matching is case-insensitive for exact and partial matches', () => {
    expect(resolver.resolve({ kind: 'text', value: 'SIGN IN' }, snapshot)).toBe('#submit');
    expect(resolver.resolve({ kind: 'text', value: 'wItH gOoGlE' }, snapshot)).toBe('#google');
  });

  it('returns undefined for refs that resolve to nothing', () => {
    expect(resolver.resolve({ kind: 'index', value: 'not-a-number' }, snapshot)).toBeUndefined();
    expect(resolver.resolve({ kind: 'index', value: '99' }, snapshot)).toBeUndefined();
    expect(resolver.resolve({ kind: 'text', value: 'no such element' }, snapshot)).toBeUndefined();
    expect(resolver.resolve({ kind: 'label', value: 'nope' }, snapshot)).toBeUndefined();
  });

  it('selector refs pass through and invalid kinds return undefined', () => {
    expect(resolver.resolve({ kind: 'selector', value: '.direct-css' }, snapshot)).toBe('.direct-css');

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolver.resolve({ kind: 'mystery' as any, value: 'x' }, snapshot)).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
