/**
 * ActionExecutor — Task 3.4
 *
 * Executes abstract actions (click, type, scroll) against the page via CDP.
 * Responsible for before/after snapshots and waiting for conditions.
 */

import { ActionRequest, ActionResult, PageSnapshot } from '../../shared/types';
import { CDPManager } from './cdp-manager';
import { PageObserver } from './page-observer';
import { ElementResolver } from './element-resolver';

export class ActionExecutor {
  private cdp: CDPManager;
  private observer: PageObserver;
  private resolver: ElementResolver;

  constructor(cdp: CDPManager, observer: PageObserver, resolver: ElementResolver) {
    this.cdp = cdp;
    this.observer = observer;
    this.resolver = resolver;
  }

  /**
   * Main entry point for executing an action.
   */
  public async execute(tabId: string, action: ActionRequest): Promise<ActionResult> {
    const start = Date.now();
    let beforeSnapshot: PageSnapshot | undefined;
    let afterSnapshot: PageSnapshot | undefined;
    let success = false;
    let error: string | undefined;

    try {
      try {
        beforeSnapshot = await this.observer.getPageSnapshot(tabId);
      } catch {
        // Ignored — page may be internal sentry:// or currently navigating
      }
      
      let selector: string | undefined;
      if (action.target) {
        const indexMatch = action.target.trim().match(/^\[?(\d+)\]?$/);
        if (indexMatch && beforeSnapshot) {
          selector = this.resolver.resolve({ kind: 'index', value: indexMatch[1]! }, beforeSnapshot);
        } else if (beforeSnapshot) {
          selector = this.resolver.resolve({ kind: 'selector', value: action.target }, beforeSnapshot) || action.target;
        } else {
          selector = action.target;
        }
      }

      switch (action.type) {
        case 'click':
          success = await this.doClick(tabId, selector);
          break;
        case 'type':
          success = await this.doType(tabId, selector, action.value);
          break;
        case 'clear':
          success = await this.doClear(tabId, selector);
          break;
        case 'select':
          success = await this.doSelect(tabId, selector, action.value);
          break;
        case 'scroll':
          success = await this.doScroll(tabId, action.direction, action.amount);
          break;
        case 'hover':
          success = await this.doHover(tabId, selector);
          break;
        case 'navigate':
          success = await this.doNavigate(tabId, action.value || action.target);
          break;
        case 'goBack':
          success = await this.doEval(tabId, 'window.history.back()');
          break;
        case 'goForward':
          success = await this.doEval(tabId, 'window.history.forward()');
          break;
        case 'reload':
          success = await this.doEval(tabId, 'window.location.reload()');
          break;
        case 'waitFor':
          success = await this.doWaitFor(tabId, selector, action.timeout);
          break;
        case 'screenshot':
          // Screenshot is a special case handled below
          success = true;
          break;
        default:
          error = `Unsupported action type: ${action.type}`;
      }

      if (success) {
        // Wait a bit for UI to settle
        await new Promise(r => setTimeout(r, 300));
        afterSnapshot = await this.observer.getPageSnapshot(tabId);
      }

    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err);
      success = false;
    }

    const result: ActionResult = {
      success,
      error,
      beforeSnapshot,
      afterSnapshot,
      duration: Date.now() - start,
    };

    if (action.type === 'screenshot' && success) {
      result.screenshotBase64 = await this.captureScreenshot(tabId);
    }

    return result;
  }

  // ─── Individual Action Handlers ──────────────────────────────────────────

  private async doClick(tabId: string, selector?: string): Promise<boolean> {
    if (!selector) throw new Error('Click requires a target selector');
    
    // Evaluate click directly in page context for reliability
    const res = await this.cdp.send<{ result: { type: string; value?: boolean } }>(tabId, 'Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!el) return false;
          el.scrollIntoView({block: 'center', inline: 'center'});
          el.click();
          return true;
        })();
      `,
      returnByValue: true
    });
    
    if (res?.result?.value !== true) {
      throw new Error(`Element not found or not clickable: ${selector}`);
    }
    return true;
  }

  private async doType(tabId: string, selector?: string, text?: string): Promise<boolean> {
    if (!selector) throw new Error('Type requires a target selector');
    if (!text) throw new Error('Type requires text value');

    const res = await this.cdp.send<{ result: { type: string; value?: boolean } }>(tabId, 'Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!el) return false;
          el.focus();
          return true;
        })();
      `,
      returnByValue: true
    });

    if (res?.result?.value !== true) {
      throw new Error(`Element not found or not focusable: ${selector}`);
    }

    // Send keystrokes via CDP Input domain for realism
    for (const char of text) {
      await this.cdp.send(tabId, 'Input.dispatchKeyEvent', {
        type: 'char',
        text: char
      });
      await new Promise(r => setTimeout(r, 20 + Math.random() * 30)); // Human-like delay
    }

    return true;
  }

  private async doClear(tabId: string, selector?: string): Promise<boolean> {
    if (!selector) throw new Error('Clear requires a target selector');
    
    const res = await this.cdp.send<{ result: { type: string; value?: boolean } }>(tabId, 'Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!el) return false;
          if ('value' in el) el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })();
      `,
      returnByValue: true
    });
    
    if (res?.result?.value !== true) {
      throw new Error(`Element not found or not clearable: ${selector}`);
    }
    return true;
  }

  private async doSelect(tabId: string, selector?: string, value?: string): Promise<boolean> {
    if (!selector) throw new Error('Select requires a target selector');
    if (!value) throw new Error('Select requires a value');

    const res = await this.cdp.send<{ result: { type: string; value?: boolean } }>(tabId, 'Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!el || el.tagName !== 'SELECT') return false;
          el.value = '${value.replace(/'/g, "\\'")}';
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })();
      `,
      returnByValue: true
    });
    
    if (res?.result?.value !== true) {
      throw new Error(`Select element not found: ${selector}`);
    }
    return true;
  }

  private async doScroll(tabId: string, direction?: 'up' | 'down' | 'left' | 'right', amount: number = 300): Promise<boolean> {
    const x = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
    const y = direction === 'up' ? -amount : direction === 'down' ? amount : (direction ? 0 : amount); // default down
    
    await this.doEval(tabId, `window.scrollBy({ left: ${x}, top: ${y}, behavior: 'smooth' })`);
    await new Promise(r => setTimeout(r, 500)); // wait for smooth scroll
    return true;
  }

  private async doHover(tabId: string, selector?: string): Promise<boolean> {
    if (!selector) throw new Error('Hover requires a target selector');
    const box = await this.observer.getBoundingBox(tabId, selector);
    if (!box) throw new Error(`Element not visible for hover: ${selector}`);

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await this.cdp.send(tabId, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x, y
    });
    
    return true;
  }

  private async doNavigate(tabId: string, url?: string): Promise<boolean> {
    if (!url) throw new Error('Navigate requires a URL');
    // Using CDP Page.navigate is safer, but Runtime eval is easier to just trigger
    await this.doEval(tabId, `window.location.href = '${url}'`);
    return true;
  }

  private async doWaitFor(tabId: string, selector?: string, timeout: number = 5000): Promise<boolean> {
    if (!selector) return true; // nothing to wait for
    
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const res = await this.doEval(tabId, `!!document.querySelector('${selector.replace(/'/g, "\\'")}')`);
      if (res) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error(`Timeout waiting for selector: ${selector}`);
  }

  private async doEval(tabId: string, expression: string): Promise<boolean> {
    const res = await this.cdp.send<{ result: { value?: boolean } }>(tabId, 'Runtime.evaluate', {
      expression: `(() => { ${expression}; return true; })()`,
      returnByValue: true
    });
    return res?.result?.value === true;
  }

  private async captureScreenshot(tabId: string): Promise<string | undefined> {
    const res = await this.cdp.send<{ data: string }>(tabId, 'Page.captureScreenshot', {
      format: 'png'
    });
    return res?.data;
  }
}
