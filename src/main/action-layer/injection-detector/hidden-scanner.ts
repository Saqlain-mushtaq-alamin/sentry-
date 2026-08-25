import { CDPManager } from '../../cdp/cdp-manager';
import { HiddenContent } from './types';

export class HiddenScanner {
  constructor(private cdp: CDPManager) {}

  public async scanForHiddenContent(tabId: string): Promise<HiddenContent[]> {
    const attached = await this.cdp.attach(tabId);
    if (!attached) return [];

    const script = `
      (() => {
        const results = [];
        const isElementHidden = (el) => {
          const style = window.getComputedStyle(el);
          return style.display === 'none' || 
                 style.visibility === 'hidden' || 
                 style.opacity === '0' ||
                 el.hasAttribute('hidden');
        };

        const isZeroSize = (el) => {
          const rect = el.getBoundingClientRect();
          return rect.width === 0 || rect.height === 0;
        };

        const isOffscreen = (el) => {
          const rect = el.getBoundingClientRect();
          return rect.top < -9000 || rect.left < -9000;
        };

        const isSameColor = (el) => {
          const style = window.getComputedStyle(el);
          return style.color === style.backgroundColor && style.color !== 'rgba(0, 0, 0, 0)';
        };

        // Scan DOM for elements
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          if (!el.textContent || !el.textContent.trim()) continue;
          if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
          
          let type = null;
          if (isElementHidden(el)) type = 'hidden-element';
          else if (isZeroSize(el)) type = 'zero-size';
          else if (isOffscreen(el)) type = 'offscreen';
          else if (isSameColor(el)) type = 'same-color';
          else if (el.getAttribute('aria-hidden') === 'true') type = 'aria-hidden';
          
          if (type) {
            // Check if text might be an injection (heuristic: length > 10)
            const text = el.textContent.trim();
            if (text.length > 10) {
              // Generate simple selector for reporting
              let selector = el.tagName.toLowerCase();
              if (el.id) selector += '#' + el.id;
              else if (el.className && typeof el.className === 'string') selector += '.' + el.className.split(' ').join('.');
              
              results.push({ type, content: text, selector, confidence: 0.8 });
            }
          }

          // Check data attributes for large suspicious text
          for (const attr of el.attributes) {
            if (attr.name.startsWith('data-') && attr.value.length > 20) {
              results.push({ type: 'data-attribute', content: attr.value, selector: el.tagName.toLowerCase(), confidence: 0.5 });
            }
          }
        }

        // Scan comments
        const iterator = document.createNodeIterator(document, NodeFilter.SHOW_COMMENT, null);
        let node;
        while (node = iterator.nextNode()) {
          const text = node.nodeValue?.trim();
          if (text && text.length > 10) {
            results.push({ type: 'comment', content: text, selector: '<!-- -->', confidence: 0.6 });
          }
        }

        return results;
      })();
    `;

    try {
      const res = await this.cdp.send<{ result: { value: HiddenContent[] } }>(tabId, 'Runtime.evaluate', {
        expression: script,
        returnByValue: true
      });
      return res?.result?.value || [];
    } catch (err) {
      console.error('[HiddenScanner] Error scanning hidden content:', err);
      return [];
    }
  }
}
