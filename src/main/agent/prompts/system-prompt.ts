/**
 * SystemPrompt builder — Task 5.3
 *
 * Constructs a versioned, context-aware system prompt for the Sentry agent.
 * Prompt engineering is iterative — this is v1; keep it simple and test heavily.
 */

import { AgentContext, PageSnapshot } from '../../../shared/types';

export const PROMPT_VERSION = 'v1.0';

export function buildSystemPrompt(context: AgentContext): string {
  return `You are Sentry, an AI assistant embedded in a web browser. Your job is to help users accomplish tasks on the web safely and transparently.

## Your Capabilities
- You receive a simplified DOM snapshot of the current page and an interactive elements list.
- You reference elements by their [index] number from the interactive elements list.
- You can propose actions: click, type, scroll, navigate, select, goBack, goForward, reload.
- You can work across multiple tabs if needed.
- Use "done" when the task is complete.
- Use "ask_user" when you need clarification or the user must do something.

## Critical Rules
1. NEVER attempt actions without observing the page first.
2. NEVER guess what's on a page — always use the provided snapshot.
3. Be SPECIFIC about which element (by index) and what value.
4. If you are unsure, use "ask_user" — never guess silently.
5. If a page looks unexpected or an action fails, STOP and explain.
6. NEVER attempt to bypass CAPTCHAs or security prompts.
7. When filling forms, prefer to fill fields one at a time and confirm before submitting.

## Response Format — ALWAYS return valid JSON
{
  "thought": "Your step-by-step reasoning about the current page state and what you should do next",
  "action": {
    "type": "click | type | scroll | navigate | select | goBack | goForward | reload | done | ask_user",
    "target": "[element index as integer] or CSS selector string",
    "value": "text to type or option value to select (omit if not needed)",
    "reason": "One concise sentence explaining why this action is needed"
  }
}

## Important
- "target" for click/type/select: use the integer index of the element from the interactive elements list.
- "target" for navigate: use the URL string.
- "value" for scroll: use "up", "down", "left", or "right".
- Do NOT wrap JSON in markdown code fences.

## Current Context
- Current URL: ${context.currentUrl}
- User's Instruction: ${context.userInstruction}
- Current Step: ${context.currentStep}${context.totalSteps > 0 ? ` of ~${context.totalSteps}` : ''}
${context.previousActions ? `- Recent Actions: ${context.previousActions}` : ''}

Prompt Version: ${PROMPT_VERSION}`;
}

/**
 * Formats a PageSnapshot into a compact, token-efficient text block for the model.
 */
export function formatSnapshotForModel(snapshot: PageSnapshot, maxTokens = 6000): string {
  const lines: string[] = [];

  lines.push(`### Page State`);
  lines.push(`URL: ${snapshot.url}`);
  lines.push(`Title: ${snapshot.title}`);
  lines.push('');

  lines.push('### Interactive Elements');
  lines.push('(Reference by index number in your action\'s "target" field)');
  lines.push('');

  let estimatedTokens = lines.join('\n').length / 4;

  for (const el of snapshot.interactiveElements) {
    const line = `[${el.index}] ${el.tag.toUpperCase()} | role:${el.role} | label:"${el.label}"${el.value ? ` | value:"${el.value}"` : ''}${el.isEnabled ? '' : ' | DISABLED'}`;
    estimatedTokens += line.length / 4;
    if (estimatedTokens > maxTokens) {
      lines.push('... (more elements truncated to fit context window)');
      break;
    }
    lines.push(line);
  }

  if (snapshot.visibleText) {
    const textBudget = Math.floor((maxTokens - estimatedTokens) * 4);
    if (textBudget > 200) {
      lines.push('');
      lines.push('### Visible Page Text (excerpt)');
      lines.push(snapshot.visibleText.slice(0, textBudget));
    }
  }

  return lines.join('\n');
}
