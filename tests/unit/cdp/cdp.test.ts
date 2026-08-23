import { describe, it, expect, beforeEach } from 'vitest';
import { ElementResolver } from '../../../src/main/cdp/element-resolver';
import { PageCache } from '../../../src/main/cdp/page-cache';
import { PageSnapshot } from '../../../src/shared/types';

describe('ElementResolver', () => {
  let resolver: ElementResolver;
  let mockSnapshot: PageSnapshot;

  beforeEach(() => {
    resolver = new ElementResolver();
    mockSnapshot = {
      url: 'https://test.com',
      title: 'Test',
      timestamp: Date.now(),
      dom: { tag: 'body', children: [] },
      accessibilityTree: [],
      visibleText: '',
      forms: [
        {
          fields: [
            { selector: '#email', label: 'email', type: 'email', required: true }
          ]
        }
      ],
      links: [],
      interactiveElements: [
        { index: 0, tag: 'button', role: 'button', label: 'Sign In', selector: '#submit', boundingBox: {x:0, y:0, width:10, height:10}, isVisible: true, isEnabled: true },
        { index: 1, tag: 'input', role: 'textbox', label: 'Email', selector: '#email', boundingBox: {x:0, y:0, width:10, height:10}, isVisible: true, isEnabled: true },
      ],
      estimatedTokenCount: 10
    };
  });

  it('should resolve by index', () => {
    expect(resolver.resolve({ kind: 'index', value: '1' }, mockSnapshot)).toBe('#email');
    expect(resolver.resolve({ kind: 'index', value: 'element[0]' }, mockSnapshot)).toBe('#submit');
  });

  it('should resolve by text', () => {
    expect(resolver.resolve({ kind: 'text', value: 'Sign In' }, mockSnapshot)).toBe('#submit');
    expect(resolver.resolve({ kind: 'text', value: 'sign' }, mockSnapshot)).toBe('#submit'); // partial match
  });

  it('should resolve by role', () => {
    expect(resolver.resolve({ kind: 'role', value: 'button' }, mockSnapshot)).toBe('#submit');
    expect(resolver.resolve({ kind: 'role', value: 'textbox' }, mockSnapshot)).toBe('#email');
  });

  it('should resolve by label', () => {
    expect(resolver.resolve({ kind: 'label', value: 'Email' }, mockSnapshot)).toBe('#email');
  });
});

describe('PageCache', () => {
  let cache: PageCache;
  
  beforeEach(() => {
    cache = new PageCache();
  });

  it('should store and retrieve snapshots', () => {
    const snapshot = { url: 'https://test.com', interactiveElements: [], visibleText: '' } as unknown as PageSnapshot;
    cache.set('tab1', snapshot);
    
    expect(cache.get('tab1', 'https://test.com')).toBe(snapshot);
  });

  it('should invalidate on url change', () => {
    const snapshot = { url: 'https://test.com', interactiveElements: [], visibleText: '' } as unknown as PageSnapshot;
    cache.set('tab1', snapshot);
    
    expect(cache.get('tab1', 'https://other.com')).toBeUndefined();
  });

  it('should allow explicit invalidation', () => {
    const snapshot = { url: 'https://test.com', interactiveElements: [], visibleText: '' } as unknown as PageSnapshot;
    cache.set('tab1', snapshot);
    cache.invalidate('tab1');
    
    expect(cache.get('tab1', 'https://test.com')).toBeUndefined();
  });
});
