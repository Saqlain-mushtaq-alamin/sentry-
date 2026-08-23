/**
 * ElementResolver — Task 3.5
 *
 * Translates agent element references (index, text, role, selector) into
 * actionable CSS selectors or coordinates on the live page.
 */

import { PageSnapshot, ElementReference } from '../../shared/types';

export class ElementResolver {
  /**
   * Resolves an abstract agent reference into a concrete CSS selector.
   * Uses the provided snapshot as the source of truth.
   */
  public resolve(ref: ElementReference, snapshot: PageSnapshot): string | undefined {
    switch (ref.kind) {
      case 'index':
        return this.resolveByIndex(ref.value, snapshot);
      case 'selector':
        return ref.value; // Trust the agent's selector, verify later
      case 'text':
        return this.resolveByText(ref.value, snapshot);
      case 'label':
        return this.resolveByLabel(ref.value, snapshot);
      case 'role':
        return this.resolveByRole(ref.value, ref.proximity, snapshot);
      default:
        console.warn(`[ElementResolver] Unknown reference kind: ${ref.kind}`);
        return undefined;
    }
  }

  private resolveByIndex(indexStr: string, snapshot: PageSnapshot): string | undefined {
    const idx = parseInt(indexStr.replace(/\D/g, ''), 10);
    if (isNaN(idx)) return undefined;

    const el = snapshot.interactiveElements.find(e => e.index === idx);
    return el?.selector;
  }

  private resolveByText(text: string, snapshot: PageSnapshot): string | undefined {
    const lowerText = text.toLowerCase();
    
    // Exact match first
    let el = snapshot.interactiveElements.find(e => e.label.toLowerCase() === lowerText);
    
    // Partial match second
    if (!el) {
      el = snapshot.interactiveElements.find(e => e.label.toLowerCase().includes(lowerText));
    }
    
    return el?.selector;
  }

  private resolveByLabel(label: string, snapshot: PageSnapshot): string | undefined {
    const lowerLabel = label.toLowerCase();
    
    // Exact match on form fields
    for (const form of snapshot.forms) {
      for (const field of form.fields) {
        if (field.label.toLowerCase() === lowerLabel) {
          return field.selector;
        }
      }
    }
    
    // Fall back to interactive elements
    return this.resolveByText(label, snapshot);
  }

  private resolveByRole(role: string, proximity: string | undefined, snapshot: PageSnapshot): string | undefined {
    const lowerRole = role.toLowerCase();
    const candidates = snapshot.interactiveElements.filter(e => e.role.toLowerCase() === lowerRole);
    
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0]?.selector;
    
    if (proximity) {
      const lowerProx = proximity.toLowerCase();
      // Heuristic: pick the candidate whose label contains the proximity text
      const proxMatch = candidates.find(e => e.label.toLowerCase().includes(lowerProx));
      if (proxMatch) return proxMatch.selector;
    }
    
    // Fallback to the first one (agent should be more specific)
    return candidates[0]?.selector;
  }
}
