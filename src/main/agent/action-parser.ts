/**
 * ActionParser — Task 5.7
 *
 * Parses the model's raw JSON text into a structured ParsedModelAction.
 * Handles common LLM output issues: markdown fences, trailing commas,
 * missing fields, and invalid action types.
 */

import { ParsedModelAction } from '../../shared/types';

const VALID_ACTION_TYPES = new Set([
  'click', 'type', 'press', 'clear', 'select', 'scroll', 'hover',
  'navigate', 'goBack', 'goForward', 'reload', 'waitFor',
  'screenshot', 'done', 'ask_user',
]);

const ACTION_TYPE_MAP: Record<string, string> = {
  click: 'click',
  type: 'type',
  fill: 'type',
  press: 'press',
  key: 'press',
  keypress: 'press',
  enter: 'press',
  clear: 'clear',
  select: 'select',
  scroll: 'scroll',
  hover: 'hover',
  navigate: 'navigate',
  goto: 'navigate',
  open: 'navigate',
  goback: 'goBack',
  go_back: 'goBack',
  back: 'goBack',
  goforward: 'goForward',
  go_forward: 'goForward',
  forward: 'goForward',
  reload: 'reload',
  refresh: 'reload',
  waitfor: 'waitFor',
  wait_for: 'waitFor',
  wait: 'waitFor',
  screenshot: 'screenshot',
  done: 'done',
  finish: 'done',
  complete: 'done',
  ask_user: 'ask_user',
  askuser: 'ask_user',
  ask: 'ask_user',
};

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

    const rawActionType = String(action['type'] ?? '').trim();
    const lookupKey = rawActionType.toLowerCase().replace(/[-\s]/g, '_');
    const type = ACTION_TYPE_MAP[lookupKey] || ACTION_TYPE_MAP[lookupKey.replace(/_/g, '')];

    if (!type || !VALID_ACTION_TYPES.has(type)) {
      return {
        ok: false,
        error: `Unknown action type: "${rawActionType}". Must be one of: ${[...VALID_ACTION_TYPES].join(', ')}`,
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
    const answer = action['answer'] !== undefined ? String(action['answer']) : (parsed['answer'] !== undefined ? String(parsed['answer']) : undefined);
    const memory = parsed['memory'] !== undefined ? String(parsed['memory']) : (action['memory'] !== undefined ? String(action['memory']) : undefined);

    return {
      ok: true,
      action: { type, target, value, reason, thought, answer, memory },
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
