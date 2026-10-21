/**
 * SystemPrompt builder — Task 5.3
 *
 * Constructs a versioned, context-aware system prompt for the Sentry agent.
 * Prompt engineering is iterative — this is v1; keep it simple and test heavily.
 */

import { AgentContext, PageSnapshot } from '../../../shared/types';

export const PROMPT_VERSION = 'v1.1';

export function buildSystemPrompt(context: AgentContext): string {
  return `You are Sentry, an AI browser assistant. Your job is to help users accomplish tasks on the web safely and accurately.

## Capabilities & Actions
- You observe the current page state and interactive elements provided in the user message.
- Allowed actions: click, type, press, scroll, navigate, select, goBack, goForward, reload, done, ask_user.
- Target = the number from the element list. Never invent indexes. If the element isn't listed, scroll.
- Use "press" with value "Enter" to submit forms or search inputs.
- Use "done" only when the goal is visibly achieved.

## Execution Rules
1. NEVER guess or act without checking the interactive elements and page content.
2. If the task needs an action (search, click, fill), do it. Return done only when the goal is visibly achieved. If it's a question about the page, answer from the text.
3. Target must be the exact numeric index from the [index] list. Never invent indexes or guess selectors. If the needed element is not visible, use scroll (value: "down" or "up").
4. For action "done", put your comprehensive final answer in the "answer" field.
5. Use "memory" to store short key notes you must carry over to the next step.
6. To search in a search box: use ONE "type" action and end the value with a newline, e.g. "value": "mount everest height\\n". This types and presses Enter together.
7. If an element shows value:"..." with your text already in it, do NOT type again. Use "press" with value "Enter" instead.

## Response Format — Valid JSON only (no markdown fences)
{
  "thought": "Brief step-by-step reasoning about the page state and next step",
  "memory": "Optional notes to remember for subsequent steps",
  "action": {
    "type": "click | type | press | scroll | navigate | select | goBack | goForward | reload | done | ask_user",
    "target": "element index number as string, e.g. \\"4\\"",
    "value": "text to type, key to press, or scroll direction (up/down/left/right)",
    "reason": "Short explanation of this action",
    "answer": "Final comprehensive answer (used only when type is done)"
  }
}

## Examples

Example 1 — Typing into a search box:
{
  "thought": "I need to search for 'weather in Tokyo'. Element [3] is the search input.",
  "memory": "Searching for weather in Tokyo",
  "action": {
    "type": "type",
    "target": "3",
    "value": "weather in Tokyo",
    "reason": "Type search query into the search box"
  }
}

Example 2 — Pressing Enter to submit search:
{
  "thought": "The query has been typed into the search box. Now submitting with Enter.",
  "memory": "Submitted search, waiting for results",
  "action": {
    "type": "press",
    "value": "Enter",
    "reason": "Press Enter to submit search"
  }
}

Example 3 — Clicking a link by index:
{
  "thought": "Search results loaded. Element [12] is the first organic result link.",
  "memory": "Navigating to weather forecast page",
  "action": {
    "type": "click",
    "target": "12",
    "reason": "Click on the first weather forecast result link"
  }
}

Example 4 — Task completed with an answer:
{
  "thought": "The current weather is clearly displayed on the page as 18°C and Sunny.",
  "action": {
    "type": "done",
    "reason": "Found the requested weather information",
    "answer": "The current weather in Tokyo is 18°C and Sunny with 45% humidity."
  }
}

## Current Context
- Current URL: ${context.currentUrl}
- User's Instruction: ${context.userInstruction}
- Current Step: ${context.currentStep}${context.totalSteps > 0 ? ` of ~${context.totalSteps}` : ''}
${context.memory ? `- Memory: ${context.memory}\n` : ''}${context.previousActions ? `- Recent Actions: ${context.previousActions}` : ''}

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
    const mainExcerpt = fullText.slice(0, baseCharLimit);

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

  // Group elements: in-view first, actionable inputs/buttons before links
  const actionableInView: typeof snapshot.interactiveElements = [];
  const linksInView: typeof snapshot.interactiveElements = [];
  const actionableOffScreen: typeof snapshot.interactiveElements = [];
  const linksOffScreen: typeof snapshot.interactiveElements = [];

  for (const el of snapshot.interactiveElements) {
    const tag = (el.tag || '').toLowerCase();
    const role = (el.role || '').toLowerCase();
    const isActionable = (
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
    );
    const hasLabel = el.label && el.label.trim().length > 0;

    if (el.inView !== false) {
      if (isActionable) actionableInView.push(el);
      else if (hasLabel) linksInView.push(el);
    } else {
      if (isActionable) actionableOffScreen.push(el);
      else if (hasLabel) linksOffScreen.push(el);
    }
  }

  const prioritizedList = [...actionableInView, ...linksInView, ...actionableOffScreen, ...linksOffScreen];
  let elTokens = 0;
  let count = 0;
  const MAX_ELEMENTS = 60;

  for (const el of prioritizedList) {
    if (count >= MAX_ELEMENTS) {
      lines.push(`... (${prioritizedList.length - count} more elements omitted)`);
      break;
    }
    const offScreen = el.inView === false ? ' | [off-screen]' : '';
    const hrefInfo = el.href ? ` | href:"${el.href}"` : '';
    const line = `[${el.index}] ${el.tag.toUpperCase()}${el.role ? ` | role:${el.role}` : ''} | label:"${el.label}"${hrefInfo}${el.value ? ` | value:"${el.value}"` : ''}${el.isEnabled ? '' : ' | DISABLED'}${offScreen}`;
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
