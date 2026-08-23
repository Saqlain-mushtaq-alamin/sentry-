import {
  PageSnapshot,
  SimplifiedDOM,
  A11yNode,
  InteractiveElement,
  FormInfo,
  LinkInfo,
  BoundingBox,
} from '../../shared/types';
import { CDPManager } from './cdp-manager';

interface CdpDomNode {
  nodeId: number;
  nodeType: number;
  nodeName: string;
  nodeValue?: string;
  attributes?: string[];
  children?: CdpDomNode[];
  shadowRoots?: CdpDomNode[];
}

interface CdpAXNode {
  role?: { value?: string };
  name?: { value?: string };
  value?: { value?: string };
  description?: { value?: string };
  properties?: Array<{ name: string; value?: { value?: unknown } }>;
  children?: CdpAXNode[];
}

interface CdpBoxModel {
  content?: number[];
}

const STRIP_TAGS = new Set([
  'script', 'style', 'noscript', 'link', 'meta', 'head',
  'template', 'svg', 'canvas', 'object', 'embed',
]);

const SEMANTIC_TAGS = new Set([
  'a', 'button', 'input', 'select', 'textarea', 'form',
  'nav', 'main', 'article', 'section', 'header', 'footer', 'aside',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
  'img', 'video', 'audio', 'label', 'fieldset', 'legend',
  'details', 'summary', 'dialog',
]);

const INTERACTIVE_TAGS = new Set([
  'a', 'button', 'input', 'select', 'textarea',
]);

export class PageObserver {
  private cdp: CDPManager;
  private interactiveIndex = 0;

  constructor(cdp: CDPManager) {
    this.cdp = cdp;
  }

  public async getPageSnapshot(tabId: string): Promise<PageSnapshot> {
    const start = Date.now();

    const [documentResult, axResult, metaResult] = await Promise.all([
      this.cdp.send<{ root: CdpDomNode }>(tabId, 'DOM.getDocument', { depth: -1, pierce: true }),
      this.cdp.send<{ nodes: CdpAXNode[] }>(tabId, 'Accessibility.getFullAXTree'),
      this.cdp.send<{ result: { value: string } }>(tabId, 'Runtime.evaluate', {
        expression: 'JSON.stringify({ url: location.href, title: document.title })',
        returnByValue: true,
      }),
    ]);

    let url = '';
    let title = '';
    try {
      const meta = JSON.parse(metaResult?.result?.value ?? '{}');
      url = meta.url ?? '';
      title = meta.title ?? '';
    } catch {
      // ignore parse errors
    }

    const interactiveElements: InteractiveElement[] = [];
    this.interactiveIndex = 0;

    const simplifiedDom = documentResult?.root
      ? this.simplifyNode(documentResult.root, interactiveElements)
      : { tag: 'body', children: [] };

    const accessibilityTree = this.convertAXNodes(axResult?.nodes ?? []);
    const visibleText = this.extractVisibleText(simplifiedDom);
    const forms = this.extractForms(simplifiedDom);
    const links = this.extractLinks(simplifiedDom);

    const snapshot: PageSnapshot = {
      url,
      title,
      timestamp: Date.now(),
      dom: simplifiedDom,
      accessibilityTree,
      visibleText,
      forms,
      links,
      interactiveElements,
      estimatedTokenCount: Math.ceil(visibleText.length / 4),
    };

    console.debug(`[PageObserver] snapshot in ${Date.now() - start}ms`);

    return snapshot;
  }

  public async getAccessibilityTree(tabId: string): Promise<A11yNode[]> {
    const result = await this.cdp.send<{ nodes: CdpAXNode[] }>(
      tabId,
      'Accessibility.getFullAXTree',
    );
    return this.convertAXNodes(result?.nodes ?? []);
  }

  private simplifyNode(
    node: CdpDomNode,
    interactive: InteractiveElement[],
  ): SimplifiedDOM {
    const tag = node.nodeName.toLowerCase();

    if (node.nodeType === 3) {
      const text = (node.nodeValue ?? '').trim();
      return { tag: '#text', text, children: [] };
    }

    if (STRIP_TAGS.has(tag)) {
      return { tag, children: [] };
    }

    const attrs = this.parseAttributes(node.attributes ?? []);

    if (
      attrs['aria-hidden'] === 'true' ||
      attrs['hidden'] !== undefined ||
      attrs['type'] === 'hidden'
    ) {
      return { tag, children: [] };
    }

    const allChildren = [
      ...(node.children ?? []),
      ...(node.shadowRoots ?? []),
    ];

    const children = allChildren
      .map((c) => this.simplifyNode(c, interactive))
      .filter((c) => this.isNonEmpty(c));

    const simplified: SimplifiedDOM = { tag, children };

    if (attrs['id']) simplified.id = attrs['id'];
    if (attrs['class']) simplified.classes = attrs['class'].split(/\s+/).filter(Boolean);
    if (attrs['role']) simplified.role = attrs['role'];
    if (attrs['aria-label']) simplified.label = attrs['aria-label'];
    if (attrs['aria-labelledby']) simplified.label = simplified.label ?? attrs['aria-labelledby'];
    if (attrs['href']) simplified.href = attrs['href'];
    if (attrs['type']) simplified.type = attrs['type'];
    if (attrs['value']) simplified.value = attrs['value'];
    if (attrs['placeholder']) simplified.placeholder = attrs['placeholder'];

    const textNode = children.find((c) => c.tag === '#text' && c.text);
    if (textNode?.text && !simplified.text) {
      simplified.text = textNode.text;
    }

    if (INTERACTIVE_TAGS.has(tag) || attrs['role'] === 'button' || attrs['tabindex'] !== undefined) {
      const label = this.resolveLabel(simplified);
      const selector = this.buildSelector(attrs, tag);

      interactive.push({
        index: this.interactiveIndex++,
        tag,
        type: attrs['type'],
        role: attrs['role'] ?? this.inferRole(tag),
        label,
        selector,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        isVisible: true,
        isEnabled: attrs['disabled'] === undefined && attrs['aria-disabled'] !== 'true',
        value: attrs['value'],
      });
    }

    return simplified;
  }

  private isNonEmpty(node: SimplifiedDOM): boolean {
    if (node.tag === '#text') return !!(node.text?.trim());
    if (STRIP_TAGS.has(node.tag)) return false;
    if (node.text || node.href || node.value) return true;
    if (INTERACTIVE_TAGS.has(node.tag) || SEMANTIC_TAGS.has(node.tag)) return true;
    return node.children.some((c) => this.isNonEmpty(c));
  }

  private parseAttributes(raw: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < raw.length - 1; i += 2) {
      result[raw[i]!] = raw[i + 1] ?? '';
    }
    return result;
  }

  private buildSelector(attrs: Record<string, string>, tag: string): string {
    if (attrs['id']) return `#${CSS.escape(attrs['id'])}`;
    if (attrs['name']) return `${tag}[name="${attrs['name']}"]`;
    if (attrs['data-testid']) return `[data-testid="${attrs['data-testid']}"]`;
    if (attrs['class']) {
      const firstClass = attrs['class'].split(/\s+/)[0];
      if (firstClass) return `${tag}.${CSS.escape(firstClass)}`;
    }
    return tag;
  }

  private resolveLabel(node: SimplifiedDOM): string {
    if (node.label) return node.label;
    if (node.text) return node.text.substring(0, 80);
    if (node.placeholder) return node.placeholder;
    if (node.value) return node.value.substring(0, 80);
    if (node.href) return node.href.substring(0, 80);
    return node.tag;
  }

  private inferRole(tag: string): string {
    const roleMap: Record<string, string> = {
      a: 'link', button: 'button', input: 'textbox', select: 'combobox', textarea: 'textbox',
      h1: 'heading', h2: 'heading', h3: 'heading', nav: 'navigation', main: 'main', form: 'form',
    };
    return roleMap[tag] ?? 'generic';
  }

  private convertAXNodes(nodes: CdpAXNode[]): A11yNode[] {
    return nodes
      .filter((n) => n.role?.value && n.role.value !== 'none' && n.role.value !== 'ignored')
      .map((n): A11yNode => {
        const isInteractive = [
          'button', 'link', 'textbox', 'combobox', 'checkbox',
          'radio', 'slider', 'spinbutton', 'switch', 'tab',
          'menuitem', 'option', 'searchbox',
        ].includes(n.role?.value ?? '');

        return {
          role: n.role?.value ?? 'generic',
          name: n.name?.value ?? '',
          value: n.value?.value ?? undefined,
          description: n.description?.value ?? undefined,
          isInteractive,
          boundingBox: undefined,
          children: this.convertAXNodes(n.children ?? []),
        };
      });
  }

  private extractVisibleText(node: SimplifiedDOM): string {
    if (node.tag === '#text') return node.text ?? '';
    const parts: string[] = [];
    if (node.text) parts.push(node.text);
    for (const child of node.children) {
      const t = this.extractVisibleText(child);
      if (t) parts.push(t);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  private extractForms(root: SimplifiedDOM): FormInfo[] {
    const forms: FormInfo[] = [];
    this.walkNodes(root, (node) => {
      if (node.tag === 'form') {
        const fields: FormInfo['fields'] = [];
        this.walkNodes(node, (child) => {
          if (['input', 'select', 'textarea'].includes(child.tag)) {
            fields.push({
              selector: child.id ? `#${child.id}` : child.tag,
              label: child.label ?? child.placeholder ?? child.tag,
              type: child.type ?? child.tag,
              name: undefined,
              value: child.value,
              placeholder: child.placeholder,
              required: false,
            });
          }
        });
        forms.push({ formId: root.id, fields });
      }
    });
    return forms;
  }

  private extractLinks(root: SimplifiedDOM): LinkInfo[] {
    const links: LinkInfo[] = [];
    this.walkNodes(root, (node) => {
      if (node.tag === 'a' && node.href) {
        links.push({
          href: node.href,
          text: node.text ?? node.label ?? node.href,
          selector: node.id ? `#${node.id}` : 'a',
          isExternal: node.href.startsWith('http') && !node.href.startsWith(root.href ?? ''),
        });
      }
    });
    return links;
  }

  private walkNodes(node: SimplifiedDOM, visitor: (n: SimplifiedDOM) => void): void {
    visitor(node);
    for (const child of node.children) {
      this.walkNodes(child, visitor);
    }
  }

  public async getBoundingBox(tabId: string, selector: string): Promise<BoundingBox | undefined> {
    try {
      const nodeResult = await this.cdp.send<{ nodeId: number }>(
        tabId, 'DOM.querySelector',
        { nodeId: 1, selector },
      );
      if (!nodeResult?.nodeId) return undefined;

      const boxResult = await this.cdp.send<{ model: CdpBoxModel }>(
        tabId, 'DOM.getBoxModel',
        { nodeId: nodeResult.nodeId },
      );
      if (!boxResult?.model?.content) return undefined;

      const [x1, y1, x2, , , , x3, y3] = boxResult.model.content as number[];
      return {
        x: Math.min(x1 ?? 0, x3 ?? 0),
        y: Math.min(y1 ?? 0, y3 ?? 0),
        width: Math.abs((x2 ?? 0) - (x1 ?? 0)),
        height: Math.abs((y3 ?? 0) - (y1 ?? 0)),
      };
    } catch {
      return undefined;
    }
  }
}
