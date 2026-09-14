/**
 * ActionParser — Task 5.7
 *
 * Parses the model's raw JSON text into a structured ParsedModelAction.
 * Handles common LLM output issues: markdown fences, trailing commas,
 * missing fields, and invalid action types.
 */

import { ParsedModelAction } from '../../shared/types';

const VALID_ACTION_TYPES = new Set([
  'click', 'type', 'scroll', 'navigate', 'select',
  'goBack', 'goForward', 'reload', 'done', 'ask_user',
  'hover', 'screenshot', 'waitFor',
]);

export interface ParseSuccess {
  ok: true;
  action: ParsedModelAction;
}
export interface ParseFailure {
  ok: false;
  error: string;
  rawContent: string;
}
export type ParseResult = ParseSuccess | ParseFailure;

export class ActionParser {
  parse(rawContent: string): ParseResult {
    let jsonString = this.extractJson(rawContent);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonString) as Record<string, unknown>;
    } catch {
      // Try to fix common issues
      jsonString = this.attemptFix(jsonString);
      try {
        parsed = JSON.parse(jsonString) as Record<string, unknown>;
      } catch (err2) {
        return {
          ok: false,
          error: `JSON parse failed: ${err2 instanceof Error ? err2.message : String(err2)}`,
          rawContent,
        };
      }
    }

    // Validate required fields
    const action = parsed['action'] as Record<string, unknown> | undefined;
    if (!action || typeof action !== 'object') {
      return { ok: false, error: 'Missing "action" field in model response', rawContent };
    }

    const type = String(action['type'] ?? '').toLowerCase();
    if (!VALID_ACTION_TYPES.has(type)) {
      return {
        ok: false,
        error: `Unknown action type: "${type}". Must be one of: ${[...VALID_ACTION_TYPES].join(', ')}`,
        rawContent,
      };
    }

    const thought = String(parsed['thought'] ?? action['thought'] ?? 'No thought provided');
    let target = action['target'] !== undefined ? String(action['target']) : undefined;
    let value  = action['value']  !== undefined ? String(action['value'])  : undefined;

    if (type === 'navigate') {
      if (!value && target) value = target;
      if (!target && value) target = value;
    }

    const fallbackReason = thought !== 'No thought provided' ? thought : (type === 'navigate' && (value || target) ? `Navigating to ${value || target}` : 'Executing requested action');
    const reason = String(action['reason'] ?? fallbackReason);

    return {
      ok: true,
      action: { type, target, value, reason, thought },
    };
  }

  private extractJson(raw: string): string {
    // Strip markdown code fences if present
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();

    // Strip any leading/trailing non-JSON text
    const firstBrace = raw.indexOf('{');
    const lastBrace  = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return raw.slice(firstBrace, lastBrace + 1);
    }

    return raw.trim();
  }

  private attemptFix(json: string): string {
    // Remove trailing commas before } or ]
    return json
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/:\s*undefined/g, ': null');
  }
}
