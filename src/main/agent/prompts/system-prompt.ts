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
2. If the user's instruction asks for information, facts, dates, summaries, answers, or data that can be found in the "Visible Page Text" above, READ the text carefully and IMMEDIATELY return action "done" with your complete, detailed answer in the "reason" field.
3. Do NOT scroll or navigate away if the answer is already visible on the current page.
4. If you need to search or navigate on the page, use specific input elements or links.
5. For "done" actions, put your final answer, summary, or report directly in the "reason" field.
6. If an element or action fails, try an alternative element or conclude with what information you have.

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
- When the user asks to summarize, explain, or answer questions (like finding dates, facts, names, or history) about the current page, READ the provided Visible Page Text and return action type "done" immediately with your comprehensive answer in the "reason" field.
- "target" for click/type/select: use the integer index of the element from the interactive elements list.
- "target" for navigate: use the URL string (prefer full URLs or absolute paths).
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
 * Prioritizes readable visible text for comprehension and question-answering,
 * followed by prioritized actionable interactive elements (inputs, buttons).
 */
export function formatSnapshotForModel(
  snapshot: PageSnapshot,
  maxTokens = 6000,
  instruction?: string,
): string {
  const lines: string[] = [];

  lines.push(`### Page State`);
  lines.push(`URL: ${snapshot.url}`);
  lines.push(`Title: ${snapshot.title}`);
  lines.push('');

  // ── 1. VISIBLE PAGE TEXT (High Priority for Comprehension) ─────────────────
  let visibleTokensUsed = 0;
  if (snapshot.visibleText && snapshot.visibleText.trim()) {
    const fullText = snapshot.visibleText.trim();
    // Default text allowance: up to ~3,200 tokens (12,800 chars)
    const baseCharLimit = 12800;
    let mainExcerpt = fullText.slice(0, baseCharLimit);

    lines.push('### Visible Page Text');
    lines.push(mainExcerpt);
    lines.push('');

    // If text is long and user asked a specific question, scan for relevant sections further down
    if (fullText.length > baseCharLimit && instruction) {
      const stopWords = new Set([
        'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'from', 'this',
        'that', 'site', 'page', 'find', 'get', 'is', 'are', 'was', 'were', 'what', 'when', 'how'
      ]);
      const terms = instruction
        .toLowerCase()
        .split(/\W+/)
        .filter(t => t.length > 2 && !stopWords.has(t));

      // Check if any keyword matches beyond the base excerpt
      for (const term of terms) {
        const matchIdx = fullText.toLowerCase().indexOf(term, baseCharLimit);
        if (matchIdx !== -1) {
          const startIdx = Math.max(baseCharLimit, matchIdx - 300);
          const endIdx = Math.min(fullText.length, matchIdx + 1500);
          const relevantSnippet = fullText.slice(startIdx, endIdx);
          lines.push(`### Relevant Page Content (matching "${term}")`);
          lines.push(`... ${relevantSnippet} ...`);
          lines.push('');
          break; // Include one rich relevant snippet to stay within budget
        }
      }
    }

    visibleTokensUsed = Math.ceil(lines.join('\n').length / 4);
  }

  // ── 2. INTERACTIVE ELEMENTS (Prioritized Actionable Elements) ───────────────
  lines.push('### Interactive Elements');
  lines.push('(Reference by index number in your action\'s "target" field)');
  lines.push('');

  const remainingTokens = Math.max(1200, maxTokens - visibleTokensUsed);

  // Group elements: inputs, buttons, selects first; then links with labels
  const actionable: typeof snapshot.interactiveElements = [];
  const links: typeof snapshot.interactiveElements = [];

  for (const el of snapshot.interactiveElements) {
    const tag = (el.tag || '').toLowerCase();
    const role = (el.role || '').toLowerCase();

    if (
      tag === 'input' ||
      tag === 'button' ||
      tag === 'select' ||
      tag === 'textarea' ||
      role === 'button' ||
      role === 'searchbox' ||
      role === 'textbox' ||
      role === 'checkbox' ||
      role === 'radio' ||
      role === 'combobox'
    ) {
      actionable.push(el);
    } else if (el.label && el.label.trim().length > 1) {
      // Discard empty or single-character links
      links.push(el);
    }
  }

  const prioritizedList = [...actionable, ...links];
  let elTokens = 0;
  let count = 0;
  const MAX_ELEMENTS = 60;

  for (const el of prioritizedList) {
    if (count >= MAX_ELEMENTS) {
      lines.push(`... (${prioritizedList.length - count} more elements omitted)`);
      break;
    }
    const line = `[${el.index}] ${el.tag.toUpperCase()} | role:${el.role} | label:"${el.label}"${el.value ? ` | value:"${el.value}"` : ''}${el.isEnabled ? '' : ' | DISABLED'}`;
    elTokens += Math.ceil(line.length / 4);
    if (elTokens > remainingTokens) {
      lines.push('... (more elements truncated to fit context window)');
      break;
    }
    lines.push(line);
    count++;
  }

  return lines.join('\n');
}
