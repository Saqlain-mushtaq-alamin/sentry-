import { describe, it, expect, vi } from 'vitest';
import { PageObserver } from '../../../src/main/cdp/page-observer';
import { CDPManager } from '../../../src/main/cdp/cdp-manager';

function makeCdp(handlers: Record<string, (params?: Record<string, unknown>) => unknown>) {
  return {
    send: vi.fn(async (_tabId: string, method: string, params?: Record<string, unknown>) => {
      const handler = handlers[method];
      return handler ? handler(params) : undefined;
    }),
  } as unknown as CDPManager;
}

describe('PageObserver', () => {
  describe('getPageSnapshot (inline script path)', () => {
    const payload = {
      url: 'https://example.com',
      title: 'Example Page',
      innerText: 'Welcome to the page. Click below to continue with your journey across the site.',
      elements: [
        {
          index: 0,
          tag: 'a',
          role: undefined,
          label: 'Docs',
          href: 'https://example.com/docs',
          selector: '[data-sentry-id="0"]',
          inView: true,
          isVisible: true,
          isEnabled: true,
          boundingBox: { x: 10, y: 10, width: 80, height: 20 },
        },
        {
          index: 1,
          tag: 'input',
          type: 'email',
          role: undefined,
          label: 'Email address',
          selector: '[data-sentry-id="1"]',
          inView: false,
          isVisible: true,
          isEnabled: true,
          boundingBox: { x: 10, y: 40, width: 200, height: 30 },
        },
        {
          index: 2,
          tag: 'button',
          role: 'button',
          label: 'Sign In',
          selector: '[data-sentry-id="2"]',
          inView: true,
          isVisible: true,
          isEnabled: true,
          boundingBox: { x: 10, y: 80, width: 100, height: 32 },
        },
        {
          index: 3,
          tag: 'a',
          role: 'link',
          label: 'External docs',
          href: 'https://external.dev/docs',
          selector: '[data-sentry-id="3"]',
          inView: true,
          isVisible: true,
          isEnabled: false,
          boundingBox: { x: 10, y: 120, width: 90, height: 20 },
        },
      ],
    };

    function observerWithPayload(value: unknown) {
      const cdp = makeCdp({
        'Runtime.evaluate': () => ({ result: { value } }),
        'DOM.getDocument': () => ({ root: { nodeId: 1, nodeType: 1, nodeName: 'body', children: [] } }),
      });
      return { observer: new PageObserver(cdp), cdp };
    }

    it('produces url, title, visibleText and token estimate from the script payload', async () => {
      const { observer } = observerWithPayload(JSON.stringify(payload));

      const snapshot = await observer.getPageSnapshot('tab-1');

      expect(snapshot.url).toBe('https://example.com');
      expect(snapshot.title).toBe('Example Page');
      expect(snapshot.visibleText).toBe(payload.innerText);
      expect(snapshot.estimatedTokenCount).toBe(Math.ceil(payload.innerText.length / 4));
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });

    it('maps interactive elements with indexes, selectors, roles and labels', async () => {
      const { observer } = observerWithPayload(JSON.stringify(payload));

      const snapshot = await observer.getPageSnapshot('tab-1');

      expect(snapshot.interactiveElements).toHaveLength(4);
      // in-view elements are sorted ahead of off-screen ones (stable sort)
      expect(snapshot.interactiveElements.map((e) => e.index)).toEqual([0, 2, 3, 1]);
      expect(snapshot.interactiveElements[0]).toMatchObject({
        tag: 'a',
        label: 'Docs',
        selector: '[data-sentry-id="0"]',
        isVisible: true,
        isEnabled: true,
      });
      expect(snapshot.interactiveElements[1]).toMatchObject({ tag: 'button', role: 'button', label: 'Sign In' });
      expect(snapshot.interactiveElements[3]).toMatchObject({ tag: 'input', type: 'email', label: 'Email address' });
    });

    it('sorts in-view elements before off-screen ones', async () => {
      const { observer } = observerWithPayload(JSON.stringify(payload));

      const snapshot = await observer.getPageSnapshot('tab-1');

      expect(snapshot.interactiveElements.map((e) => e.inView)).toEqual([true, true, true, false]);
    });

    it('collects link info and marks links that leave the current origin as external', async () => {
      const { observer } = observerWithPayload(JSON.stringify(payload));

      const snapshot = await observer.getPageSnapshot('tab-1');

      expect(snapshot.links).toEqual([
        {
          href: 'https://example.com/docs',
          text: 'Docs',
          selector: '[data-sentry-id="0"]',
          isExternal: false,
        },
        {
          href: 'https://external.dev/docs',
          text: 'External docs',
          selector: '[data-sentry-id="3"]',
          isExternal: true,
        },
      ]);
    });

    it('does not call DOM.getDocument when the script collected elements', async () => {
      const { observer, cdp } = observerWithPayload(JSON.stringify(payload));

      await observer.getPageSnapshot('tab-1');

      expect((cdp.send as any).mock.calls.some((c: any[]) => c[1] === 'DOM.getDocument')).toBe(false);
    });

    it('survives a missing script result and falls back to an empty snapshot', async () => {
      const { observer } = observerWithPayload(undefined);

      const snapshot = await observer.getPageSnapshot('tab-1');

      expect(snapshot.url).toBe('');
      expect(snapshot.title).toBe('');
      expect(snapshot.visibleText).toBe('');
      expect(snapshot.estimatedTokenCount).toBe(0);
    });

    it('survives malformed script output without throwing', async () => {
      const { observer } = observerWithPayload('not-json{');

      const snapshot = await observer.getPageSnapshot('tab-1');

      expect(snapshot.url).toBe('');
      expect(Array.isArray(snapshot.interactiveElements)).toBe(true);
    });
  });

  describe('getPageSnapshot (DOM.getDocument fallback)', () => {
    function fallbackCdp() {
      return makeCdp({
        'Runtime.evaluate': () => ({ result: {} }), // no value → script path yields nothing
        'DOM.getDocument': () => ({
          root: {
            nodeId: 1,
            nodeType: 1,
            nodeName: 'body',
            children: [
              {
                nodeId: 2,
                nodeType: 1,
                nodeName: 'a',
                attributes: ['href', 'https://example.com/docs', 'class', 'nav-link'],
                children: [{ nodeId: 3, nodeType: 3, nodeName: '#text', nodeValue: 'Read the docs' }],
              },
              {
                nodeId: 4,
                nodeType: 1,
                nodeName: 'button',
                attributes: ['id', 'go-btn', 'aria-label', 'Go now'],
                children: [{ nodeId: 5, nodeType: 3, nodeName: '#text', nodeValue: 'Go' }],
              },
              {
                nodeId: 6,
                nodeType: 1,
                nodeName: 'input',
                attributes: ['name', 'email', 'type', 'email', 'placeholder', 'Your email'],
                children: [],
              },
              {
                nodeId: 7,
                nodeType: 1,
                nodeName: 'script',
                attributes: [],
                children: [{ nodeId: 8, nodeType: 3, nodeName: '#text', nodeValue: 'evil();' }],
              },
            ],
          },
        }),
      });
    }

    it('still produces a snapshot with interactive elements parsed from the DOM tree', async () => {
      const observer = new PageObserver(fallbackCdp());

      const snapshot = await observer.getPageSnapshot('tab-1');

      expect(snapshot.interactiveElements.length).toBe(3);

      const [link, button, input] = snapshot.interactiveElements;
      expect(link).toMatchObject({ tag: 'a', role: 'link', label: 'Read the docs' });
      expect(link!.selector).toBe('a.nav-link');
      expect(button).toMatchObject({ tag: 'button', role: 'button', label: 'Go now', selector: '#go-btn' });
      expect(input).toMatchObject({ tag: 'input', role: 'textbox', type: 'email', label: 'Your email' });
      expect(input!.selector).toBe('input[name="email"]');
      // href lives on the simplified DOM node, not on the interactive element
      expect(snapshot.dom.children[0]!.href).toBe('https://example.com/docs');
    });

    it('builds a simplified DOM without script/style content', async () => {
      const observer = new PageObserver(fallbackCdp());

      const snapshot = await observer.getPageSnapshot('tab-1');

      expect(snapshot.dom.tag).toBe('body');
      expect(snapshot.dom.children.map((c) => c.tag)).toEqual(['a', 'button', 'input']);
      expect(JSON.stringify(snapshot.dom)).not.toContain('evil();');
    });

    it('returns an empty DOM when the document response has no root', async () => {
      const cdp = makeCdp({
        'Runtime.evaluate': () => ({}),
        'DOM.getDocument': () => ({}),
      });
      const observer = new PageObserver(cdp);

      const snapshot = await observer.getPageSnapshot('tab-x');

      expect(snapshot.dom).toEqual({ tag: 'body', children: [] });
      expect(snapshot.interactiveElements).toEqual([]);
    });
  });

  describe('getBoundingBox', () => {
    it('derives a bounding box from DOM.querySelector + DOM.getBoxModel', async () => {
      const cdp = makeCdp({
        'DOM.querySelector': () => ({ nodeId: 5 }),
        'DOM.getBoxModel': () => ({
          model: { content: [10, 20, 110, 20, 110, 80, 10, 80] },
        }),
      });
      const observer = new PageObserver(cdp);

      const box = await observer.getBoundingBox('tab-1', '#target');

      expect(cdp.send).toHaveBeenCalledWith('tab-1', 'DOM.querySelector', { nodeId: 1, selector: '#target' });
      expect(cdp.send).toHaveBeenCalledWith('tab-1', 'DOM.getBoxModel', { nodeId: 5 });
      expect(box).toEqual({ x: 10, y: 20, width: 100, height: 60 });
    });

    it('returns undefined when the selector matches nothing', async () => {
      const cdp = makeCdp({
        'DOM.querySelector': () => ({ nodeId: 0 }),
      });
      const observer = new PageObserver(cdp);

      expect(await observer.getBoundingBox('tab-1', '#missing')).toBeUndefined();
    });

    it('returns undefined when the box model is missing', async () => {
      const cdp = makeCdp({
        'DOM.querySelector': () => ({ nodeId: 5 }),
        'DOM.getBoxModel': () => ({}),
      });
      const observer = new PageObserver(cdp);

      expect(await observer.getBoundingBox('tab-1', '#target')).toBeUndefined();
    });

    it('returns undefined instead of throwing when CDP errors', async () => {
      const cdp = {
        send: vi.fn(async (_t: string, method: string) => {
          if (method === 'DOM.querySelector') throw new Error('No node with given id');
          return {};
        }),
      } as unknown as CDPManager;
      const observer = new PageObserver(cdp);

      expect(await observer.getBoundingBox('tab-1', '#target')).toBeUndefined();
    });
  });

  describe('getAccessibilityTree', () => {
    it('converts AX nodes, filters ignored roles and flags interactive roles', async () => {
      const cdp = makeCdp({
        'Accessibility.getFullAXTree': () => ({
          nodes: [
            {
              role: { value: 'button' },
              name: { value: 'OK' },
              value: { value: 'ok' },
              description: { value: 'Confirms the dialog' },
              children: [
                { role: { value: 'none' }, name: { value: 'ignored' } },
                { role: { value: 'link' }, name: { value: 'Docs' }, children: [] },
              ],
            },
            { role: { value: 'ignored' }, name: { value: 'skip me' } },
            { role: { value: 'textbox' }, name: { value: 'Email' }, children: [] },
          ],
        }),
      });
      const observer = new PageObserver(cdp);

      const tree = await observer.getAccessibilityTree('tab-1');

      expect(cdp.send).toHaveBeenCalledWith('tab-1', 'Accessibility.getFullAXTree');
      expect(tree).toHaveLength(2);
      expect(tree[0]).toEqual({
        role: 'button',
        name: 'OK',
        value: 'ok',
        description: 'Confirms the dialog',
        isInteractive: true,
        boundingBox: undefined,
        children: [
          {
            role: 'link',
            name: 'Docs',
            value: undefined,
            description: undefined,
            isInteractive: true,
            boundingBox: undefined,
            children: [],
          },
        ],
      });
      expect(tree[1]).toMatchObject({ role: 'textbox', name: 'Email', isInteractive: true });
    });

    it('returns an empty tree when the CDP call yields nothing', async () => {
      const cdp = makeCdp({});
      const observer = new PageObserver(cdp);

      expect(await observer.getAccessibilityTree('tab-1')).toEqual([]);
    });
  });
});
