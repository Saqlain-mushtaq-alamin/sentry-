import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActionExecutor } from '../../../src/main/cdp/action-executor';
import { CDPManager } from '../../../src/main/cdp/cdp-manager';
import { PageObserver } from '../../../src/main/cdp/page-observer';
import { ElementResolver } from '../../../src/main/cdp/element-resolver';
import { ActionRequest, PageSnapshot } from '../../../src/shared/types';

function makeSnapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: 'https://example.com',
    title: 'Example',
    timestamp: 1,
    dom: { tag: 'body', children: [] },
    accessibilityTree: [],
    visibleText: 'hello world',
    forms: [],
    links: [],
    interactiveElements: [],
    estimatedTokenCount: 3,
    ...overrides,
  };
}

function makeCdp() {
  return {
    send: vi.fn(async (_tabId: string, method: string, params?: Record<string, unknown>) => {
      switch (method) {
        case 'Runtime.evaluate': {
          const expression = String(params?.expression ?? '');
          if (expression.includes('getBoundingClientRect')) {
            return { result: { value: { x: 10, y: 20, width: 100, height: 40 } } };
          }
          return { result: { value: true } };
        }
        case 'Page.captureScreenshot':
          return { data: 'base64-screenshot' };
        default:
          return {};
      }
    }),
    waitForLoad: vi.fn(async () => undefined),
  };
}

describe('ActionExecutor', () => {
  let cdp: ReturnType<typeof makeCdp>;
  let observer: { getPageSnapshot: ReturnType<typeof vi.fn>; getBoundingBox: ReturnType<typeof vi.fn> };
  let resolver: { resolve: ReturnType<typeof vi.fn> };
  let executor: ActionExecutor;
  let afterSnapshot: PageSnapshot;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    cdp = makeCdp();
    afterSnapshot = makeSnapshot({ url: 'https://example.com/after' });
    observer = {
      getPageSnapshot: vi.fn(async () => afterSnapshot),
      getBoundingBox: vi.fn(async () => ({ x: 10, y: 20, width: 100, height: 40 })),
    };
    resolver = { resolve: vi.fn(() => '#resolved') };
    executor = new ActionExecutor(
      cdp as unknown as CDPManager,
      observer as unknown as PageObserver,
      resolver as unknown as ElementResolver,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function run(action: ActionRequest, before?: PageSnapshot) {
    const pending = executor.execute('tab-1', action, before);
    await vi.advanceTimersByTimeAsync(2000);
    return pending;
  }

  describe('click', () => {
    it('measures the element and dispatches mouseMoved/Pressed/Released at its center', async () => {
      const result = await run({ type: 'click', target: '#submit' });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      const mouseCalls = cdp.send.mock.calls.filter((c) => c[1] === 'Input.dispatchMouseEvent');
      expect(mouseCalls.map((c) => c[2].type)).toEqual(['mouseMoved', 'mousePressed', 'mouseReleased']);
      // center of {x:10,y:20,w:100,h:40}
      expect(mouseCalls[0]![2]).toMatchObject({ x: 60, y: 40 });
      expect(mouseCalls[1]![2]).toMatchObject({ button: 'left', clickCount: 1 });
      expect(cdp.waitForLoad).toHaveBeenCalledWith('tab-1');
    });

    it('targets the element via the resolved selector when a before-snapshot is provided', async () => {
      const before = makeSnapshot();

      await run({ type: 'click', target: 'Sign In' }, before);

      expect(resolver.resolve).toHaveBeenCalledWith({ kind: 'selector', value: 'Sign In' }, before);
      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('#resolved');
    });

    it('falls back to the raw target when the resolver cannot resolve it', async () => {
      resolver.resolve.mockReturnValue(undefined);

      await run({ type: 'click', target: '#raw' }, makeSnapshot());

      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('#raw');
    });

    it('translates a numeric index target into a [data-sentry-id] selector', async () => {
      const result = await run({ type: 'click', target: '[3]' }, makeSnapshot());

      expect(result.success).toBe(true);
      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      // the selector is embedded via JSON.stringify, so quotes are escaped
      expect(String(evaluate![2]!.expression)).toContain('[data-sentry-id=\\"3\\"]');
      expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it('also accepts a bare numeric target without brackets', async () => {
      await run({ type: 'click', target: '7' }, makeSnapshot());

      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('[data-sentry-id=\\"7\\"]');
    });

    it('fails with an error when the element cannot be found', async () => {
      cdp.send.mockImplementation(async (_t, method, params) => {
        if (method === 'Runtime.evaluate' && String(params?.expression ?? '').includes('getBoundingClientRect')) {
          return { result: { value: null } };
        }
        if (method === 'Runtime.evaluate') return { result: { value: true } };
        return {};
      });

      const result = await run({ type: 'click', target: '#missing' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found or not clickable');
      expect(result.afterSnapshot).toBeUndefined();
    });

    it('fails when no target is provided', async () => {
      const result = await run({ type: 'click' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Click requires a target selector');
    });
  });

  describe('type', () => {
    it('focuses the element via Runtime.evaluate then inserts the text', async () => {
      const result = await run({ type: 'type', target: '#email', value: 'user@example.com' });

      expect(result.success).toBe(true);
      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('#email');
      expect(cdp.send).toHaveBeenCalledWith('tab-1', 'Input.insertText', { text: 'user@example.com' });
    });

    it('fails when the element is not focusable', async () => {
      cdp.send.mockResolvedValue(undefined);

      const result = await run({ type: 'type', target: '#email', value: 'x' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('fails when no text value is supplied', async () => {
      const result = await run({ type: 'type', target: '#email' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Type requires text value');
    });
  });

  describe('press', () => {
    it('dispatches keyDown and keyUp for Enter with the windows virtual key code', async () => {
      const result = await run({ type: 'press', value: 'Enter' });

      expect(result.success).toBe(true);
      const keyCalls = cdp.send.mock.calls.filter((c) => c[1] === 'Input.dispatchKeyEvent');
      expect(keyCalls.map((c) => c[2].type)).toEqual(['keyDown', 'keyUp']);
      expect(keyCalls[0]![2]).toMatchObject({ key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
      expect(keyCalls[1]![2]).toMatchObject({ key: 'Enter', code: 'Enter' });
    });

    it('dispatches plain keys without a virtual key code', async () => {
      await run({ type: 'press', value: 'a' });

      const keyCalls = cdp.send.mock.calls.filter((c) => c[1] === 'Input.dispatchKeyEvent');
      expect(keyCalls[0]![2]).toMatchObject({ type: 'keyDown', key: 'a', text: 'a' });
      expect(keyCalls[1]![2]).toMatchObject({ type: 'keyUp', key: 'a' });
    });

    it('defaults to Enter when neither value nor target is given', async () => {
      await run({ type: 'press' });

      const keyCalls = cdp.send.mock.calls.filter((c) => c[1] === 'Input.dispatchKeyEvent');
      expect(keyCalls[0]![2]).toMatchObject({ key: 'Enter' });
    });
  });

  describe('clear', () => {
    it('empties the field through a Runtime.evaluate script', async () => {
      const result = await run({ type: 'clear', target: '#email' });

      expect(result.success).toBe(true);
      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('#email');
      expect(String(evaluate![2]!.expression)).toContain("el.value = ''");
    });

    it('fails when the element cannot be cleared', async () => {
      cdp.send.mockResolvedValue(undefined);

      const result = await run({ type: 'clear', target: '#email' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not clearable');
    });
  });

  describe('select', () => {
    it('sets the option value and fires a change event', async () => {
      const result = await run({ type: 'select', target: '#country', value: 'DE' });

      expect(result.success).toBe(true);
      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('#country');
      expect(String(evaluate![2]!.expression)).toContain('"DE"');
    });

    it('fails when the select element is missing', async () => {
      cdp.send.mockResolvedValue(undefined);

      const result = await run({ type: 'select', target: '#country', value: 'DE' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Select element not found');
    });

    it('fails when no option value is supplied', async () => {
      const result = await run({ type: 'select', target: '#country' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Select requires a value');
    });
  });

  describe('scroll', () => {
    it('scrolls down by the requested amount by default', async () => {
      const result = await run({ type: 'scroll', direction: 'down', amount: 120 });

      expect(result.success).toBe(true);
      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('window.scrollBy');
      expect(String(evaluate![2]!.expression)).toContain('top: 120');
    });

    it('scrolls up with a negative offset', async () => {
      await run({ type: 'scroll', direction: 'up', amount: 50 });

      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('top: -50');
    });
  });

  describe('hover', () => {
    it('moves the mouse to the center of the element bounding box', async () => {
      const result = await run({ type: 'hover', target: '#link' });

      expect(result.success).toBe(true);
      expect(observer.getBoundingBox).toHaveBeenCalledWith('tab-1', '#link');
      expect(cdp.send).toHaveBeenCalledWith('tab-1', 'Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: 60,
        y: 40,
      });
    });

    it('fails when the element has no bounding box', async () => {
      observer.getBoundingBox.mockResolvedValue(undefined);

      const result = await run({ type: 'hover', target: '#link' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not visible for hover');
    });
  });

  describe('navigate / goBack / goForward / reload', () => {
    it('navigate prefixes bare domains with https and waits for load', async () => {
      const result = await run({ type: 'navigate', value: 'example.com' });

      expect(result.success).toBe(true);
      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('https://example.com');
      expect(cdp.waitForLoad).toHaveBeenCalledWith('tab-1');
    });

    it('navigate keeps sentry:// urls intact', async () => {
      await run({ type: 'navigate', value: 'sentry://settings' });

      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('sentry://settings');
    });

    it('navigate fails without a url', async () => {
      const result = await run({ type: 'navigate' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Navigate requires a URL');
    });

    it('goBack invokes window.history.back() and waits for load', async () => {
      const result = await run({ type: 'goBack' });

      expect(result.success).toBe(true);
      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('window.history.back()');
      expect(cdp.waitForLoad).toHaveBeenCalled();
    });

    it('goForward invokes window.history.forward() and waits for load', async () => {
      const result = await run({ type: 'goForward' });

      expect(result.success).toBe(true);
      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('window.history.forward()');
    });

    it('reload invokes window.location.reload() and waits for load', async () => {
      const result = await run({ type: 'reload' });

      expect(result.success).toBe(true);
      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('window.location.reload()');
      expect(cdp.waitForLoad).toHaveBeenCalled();
    });
  });

  describe('waitFor', () => {
    it('succeeds as soon as the selector exists', async () => {
      const result = await run({ type: 'waitFor', target: '.ready' });

      expect(result.success).toBe(true);
      const evaluate = cdp.send.mock.calls.find((c) => c[1] === 'Runtime.evaluate');
      expect(String(evaluate![2]!.expression)).toContain('.ready');
    });

    it('succeeds immediately when no selector is given', async () => {
      const result = await run({ type: 'waitFor' });

      expect(result.success).toBe(true);
    });

    it('fails with a timeout error when the selector never appears', async () => {
      cdp.send.mockResolvedValue({ result: { value: false } });

      const pending = executor.execute('tab-1', { type: 'waitFor', target: '.never', timeout: 500 });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await pending;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout waiting for selector: .never');
    });
  });

  describe('screenshot', () => {
    it('captures the page and returns the base64 payload', async () => {
      const result = await run({ type: 'screenshot' });

      expect(result.success).toBe(true);
      expect(cdp.send).toHaveBeenCalledWith('tab-1', 'Page.captureScreenshot', { format: 'png' });
      expect(result.screenshotBase64).toBe('base64-screenshot');
    });

    it('leaves screenshotBase64 undefined when capture returns nothing', async () => {
      cdp.send.mockImplementation(async (_t, method) => {
        if (method === 'Page.captureScreenshot') return undefined;
        return {};
      });

      const result = await run({ type: 'screenshot' });

      expect(result.success).toBe(true);
      expect(result.screenshotBase64).toBeUndefined();
    });
  });

  describe('result shape and failure handling', () => {
    it('includes beforeSnapshot, afterSnapshot and duration for successful actions', async () => {
      const before = makeSnapshot({ url: 'https://example.com/before' });

      const result = await run({ type: 'reload' }, before);

      expect(result.success).toBe(true);
      expect(result.beforeSnapshot).toBe(before);
      expect(result.afterSnapshot).toBe(afterSnapshot);
      expect(observer.getPageSnapshot).toHaveBeenCalledWith('tab-1');
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(300); // includes the 300ms UI settle
    });

    it('takes its own before snapshot when none is supplied', async () => {
      const result = await run({ type: 'reload' });

      expect(result.beforeSnapshot).toBeUndefined();
      expect(result.afterSnapshot).toBe(afterSnapshot);
    });

    it('reports failure without an after snapshot when cdp.send yields nothing', async () => {
      cdp.send.mockResolvedValue(undefined);

      const result = await run({ type: 'type', target: '#x', value: 'y' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.afterSnapshot).toBeUndefined();
      expect(observer.getPageSnapshot).not.toHaveBeenCalled();
    });

    it('rejects unsupported action types', async () => {
      const result = await run({ type: 'teleport' } as unknown as ActionRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported action type: teleport');
    });
  });
});
