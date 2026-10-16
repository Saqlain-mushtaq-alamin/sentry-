import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionParser } from '../../../src/main/agent/action-parser';
import { ContextManager } from '../../../src/main/agent/context-manager';
import { TaskStateMachine } from '../../../src/main/agent/task-state-machine';
import { formatSnapshotForModel } from '../../../src/main/agent/prompts/system-prompt';
import { TaskState, AgentTask, PageSnapshot, ActionLogEntry, RiskTier, TaskState as TS } from '../../../src/shared/types';

// ─── ActionParser tests ───────────────────────────────────────────────────────

describe('ActionParser', () => {
  let parser: ActionParser;

  beforeEach(() => { parser = new ActionParser(); });

  it('parses a clean JSON click action', () => {
    const raw = JSON.stringify({
      thought: 'I need to click the login button',
      action: { type: 'click', target: '3', reason: 'To log in' }
    });
    const result = parser.parse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.action.type).toBe('click');
      expect(result.action.target).toBe('3');
      expect(result.action.thought).toBe('I need to click the login button');
    }
  });

  it('parses a type action with value', () => {
    const raw = JSON.stringify({
      thought: 'Fill the email field',
      action: { type: 'type', target: '1', value: 'user@example.com', reason: 'Enter email' }
    });
    const result = parser.parse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.action.type).toBe('type');
      expect(result.action.value).toBe('user@example.com');
    }
  });

  it('strips markdown code fences before parsing', () => {
    const raw = '```json\n{"thought":"ok","action":{"type":"scroll","target":"","reason":"scroll"}}\n```';
    const result = parser.parse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.action.type).toBe('scroll');
  });

  it('fixes trailing commas in JSON', () => {
    const raw = '{"thought":"t","action":{"type":"done","reason":"finished",}}';
    const result = parser.parse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.action.type).toBe('done');
  });

  it('returns error for invalid JSON that cannot be fixed', () => {
    const result = parser.parse('this is not json at all');
    expect(result.ok).toBe(false);
  });

  it('returns error for unknown action type', () => {
    const raw = JSON.stringify({
      thought: 'hmm',
      action: { type: 'teleport', target: '0', reason: 'magic' }
    });
    const result = parser.parse(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Unknown action type');
  });

  it('parses done action correctly', () => {
    const raw = JSON.stringify({
      thought: 'Task is complete',
      action: { type: 'done', reason: 'Successfully completed the task' }
    });
    const result = parser.parse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.action.type).toBe('done');
  });

  it('parses navigate action and synchronizes target and value', () => {
    const raw = JSON.stringify({
      thought: 'Need to go to google',
      action: { type: 'navigate', target: 'https://google.com' }
    });
    const result = parser.parse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.action.type).toBe('navigate');
      expect(result.action.target).toBe('https://google.com');
      expect(result.action.value).toBe('https://google.com');
      expect(result.action.reason).toBe('Need to go to google');
    }
  });

  it('normalizes case and aliases like goback, go_back, and goforward', () => {
    const raw1 = JSON.stringify({
      thought: 'Going back',
      action: { type: 'goback', reason: 'previous page' }
    });
    const result1 = parser.parse(raw1);
    expect(result1.ok).toBe(true);
    if (result1.ok) expect(result1.action.type).toBe('goBack');

    const raw2 = JSON.stringify({
      thought: 'Going forward',
      action: { type: 'goforward', reason: 'next page' }
    });
    const result2 = parser.parse(raw2);
    expect(result2.ok).toBe(true);
    if (result2.ok) expect(result2.action.type).toBe('goForward');
  });
});

// ─── TaskStateMachine tests ───────────────────────────────────────────────────

describe('TaskStateMachine', () => {
  let sm: TaskStateMachine;

  beforeEach(() => { sm = new TaskStateMachine(); });

  it('starts in IDLE state', () => {
    expect(sm.getState()).toBe(TaskState.IDLE);
  });

  it('transitions states correctly', () => {
    sm.transition(TaskState.EXECUTING);
    expect(sm.getState()).toBe(TaskState.EXECUTING);
  });

  it('pauses from EXECUTING', () => {
    sm.transition(TaskState.EXECUTING);
    sm.pause();
    expect(sm.getState()).toBe(TaskState.PAUSED);
    expect(sm.isPaused()).toBe(true);
  });

  it('resumes from PAUSED', () => {
    sm.transition(TaskState.EXECUTING);
    sm.pause();
    sm.resume();
    expect(sm.getState()).toBe(TaskState.EXECUTING);
    expect(sm.isPaused()).toBe(false);
  });

  it('marks stopped after stop()', () => {
    sm.transition(TaskState.EXECUTING);
    sm.stop();
    expect(sm.isStopped()).toBe(true);
  });

  it('resets to IDLE', () => {
    sm.transition(TaskState.COMPLETED);
    sm.reset();
    expect(sm.getState()).toBe(TaskState.IDLE);
    expect(sm.isStopped()).toBe(false);
  });
});

// ─── ContextManager tests ─────────────────────────────────────────────────────

describe('ContextManager', () => {
  let cm: ContextManager;
  const emptySnapshot: PageSnapshot = {
    url: 'https://test.com',
    title: 'Test',
    timestamp: Date.now(),
    dom: { tag: 'body', children: [] },
    accessibilityTree: [],
    visibleText: 'Hello world',
    forms: [],
    links: [],
    interactiveElements: [
      { index: 0, tag: 'button', role: 'button', label: 'Submit', selector: '#submit', boundingBox: { x: 0, y: 0, width: 10, height: 10 }, isVisible: true, isEnabled: true },
    ],
    estimatedTokenCount: 20,
  };

  const task: AgentTask = {
    id: 't1',
    tabId: 'tab-1',
    instruction: 'Click submit',
    context: { currentUrl: 'https://test.com', userInstruction: 'Click submit', currentStep: 1, totalSteps: 3 },
    createdAt: Date.now(),
  };

  beforeEach(() => { cm = new ContextManager(); });

  it('includes original instruction in messages', () => {
    const msgs = cm.buildMessageHistory(task, emptySnapshot, [], 128_000);
    expect(msgs[0]?.role).toBe('user');
    expect(msgs[0]?.content).toContain('Click submit');
  });

  it('includes current snapshot in messages', () => {
    const msgs = cm.buildMessageHistory(task, emptySnapshot, [], 128_000);
    const snapshotMsg = msgs.find(m => m.content.includes('Interactive Elements'));
    expect(snapshotMsg).toBeDefined();
  });

  it('includes action history when provided', () => {
    const mockEntry: ActionLogEntry = {
      action: {
        id: 'a1', type: 'click', target: '#btn', riskTier: RiskTier.LOW,
        reason: 'test', timestamp: Date.now(), tabId: 'tab-1', url: 'https://test.com'
      },
      decision: {
        actionId: 'a1', allowed: true, requiresConfirmation: false,
        riskTier: RiskTier.LOW,
        classification: { tier: RiskTier.LOW, reasons: [], policyRulesFired: [], confidence: 1 },
        siteTrust: 0 as any,
        explanation: 'Low risk', detailedReason: ''
      },
      executed: true,
      timestamp: Date.now()
    };

    const msgs = cm.buildMessageHistory(task, emptySnapshot, [mockEntry], 128_000);
    const histMsg = msgs.find(m => m.content.includes('Previous steps'));
    expect(histMsg).toBeDefined();
  });
});

// ─── formatSnapshotForModel tests ─────────────────────────────────────────────

describe('formatSnapshotForModel', () => {
  it('preserves visible page text even with hundreds of interactive elements', () => {
    // Generate 300 interactive elements like a Wikipedia article
    const manyElements = Array.from({ length: 300 }, (_, i) => ({
      index: i,
      tag: 'a',
      role: 'link',
      label: `Article Reference Link ${i}`,
      selector: `#link-${i}`,
      boundingBox: { x: 0, y: 0, width: 10, height: 10 },
      isVisible: true,
      isEnabled: true,
    }));

    const snapshot: PageSnapshot = {
      url: 'https://en.wikipedia.org/wiki/Wiki',
      title: 'Wiki - Wikipedia',
      timestamp: Date.now(),
      dom: { tag: 'body', children: [] },
      accessibilityTree: [],
      visibleText: 'Ward Cunningham started developing WikiWikiWeb in 1994, and installed it on c2.com on March 25, 1995.',
      forms: [],
      links: [],
      interactiveElements: manyElements,
      estimatedTokenCount: 500,
    };

    const formatted = formatSnapshotForModel(snapshot, 6000);
    expect(formatted).toContain('### Visible Page Text');
    expect(formatted).toContain('March 25, 1995');
    expect(formatted).toContain('### Interactive Elements');
  });

  it('extracts relevant page content matching query terms when page is long', () => {
    const longText = 'A'.repeat(15000) + ' Wiki started on March 25, 1995 when Ward Cunningham launched it. ' + 'B'.repeat(10000);

    const snapshot: PageSnapshot = {
      url: 'https://en.wikipedia.org/wiki/Wiki',
      title: 'Wiki - Wikipedia',
      timestamp: Date.now(),
      dom: { tag: 'body', children: [] },
      accessibilityTree: [],
      visibleText: longText,
      forms: [],
      links: [],
      interactiveElements: [],
      estimatedTokenCount: 6000,
    };

    const formatted = formatSnapshotForModel(snapshot, 6000, 'find the starting date of wiki from this site');
    expect(formatted).toContain('### Relevant Page Content');
    expect(formatted).toContain('March 25, 1995');
  });
});

// ─── P0-P3 Enhancements Tests ────────────────────────────────────────────────

describe('ActionParser — P0/P1/P2 Actions', () => {
  const parser = new ActionParser();

  it('parses press action and enter alias', () => {
    const raw = JSON.stringify({
      thought: 'Submitting query',
      action: { type: 'press', value: 'Enter', reason: 'submit' }
    });
    const res = parser.parse(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.action.type).toBe('press');
      expect(res.action.value).toBe('Enter');
    }

    const rawAlias = JSON.stringify({
      thought: 'Submitting',
      action: { type: 'enter', reason: 'press enter' }
    });
    const resAlias = parser.parse(rawAlias);
    expect(resAlias.ok).toBe(true);
    if (resAlias.ok) {
      expect(resAlias.action.type).toBe('press');
    }
  });

  it('parses answer and memory fields', () => {
    const raw = JSON.stringify({
      thought: 'Done task',
      memory: 'Saved token for next step',
      action: {
        type: 'done',
        reason: 'finished',
        answer: 'The weather is 20C and sunny'
      }
    });
    const res = parser.parse(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.action.answer).toBe('The weather is 20C and sunny');
      expect(res.action.memory).toBe('Saved token for next step');
    }
  });
});

describe('ContextManager — Detailed Failure Reporting', () => {
  const cm = new ContextManager();
  const task: AgentTask = {
    id: 't-fail',
    tabId: 'tab-1',
    instruction: 'Complete form',
    context: { currentUrl: 'https://test.com', userInstruction: 'Complete form', currentStep: 1, totalSteps: 5 },
    createdAt: Date.now()
  };
  const emptySnapshot: PageSnapshot = {
    url: 'https://test.com', title: 'Test', timestamp: Date.now(),
    dom: { tag: 'body', children: [] }, accessibilityTree: [], visibleText: 'Form',
    forms: [], links: [], interactiveElements: [], estimatedTokenCount: 10
  };

  it('records execution failure with error text instead of generic blocked', () => {
    const failedEntry: ActionLogEntry = {
      action: {
        id: 'a1', type: 'click', target: '#nonexistent', riskTier: RiskTier.LOW,
        reason: 'click button', timestamp: Date.now(), tabId: 'tab-1', url: 'https://test.com'
      },
      decision: {
        actionId: 'a1', allowed: true, requiresConfirmation: false,
        riskTier: RiskTier.LOW,
        classification: { tier: RiskTier.LOW, reasons: [], policyRulesFired: [], confidence: 1 },
        siteTrust: 0 as any, explanation: '', detailedReason: ''
      },
      executed: false,
      result: { success: false, error: 'Element not found: #nonexistent', duration: 10 },
      timestamp: Date.now()
    };

    const msgs = cm.buildMessageHistory(task, emptySnapshot, [failedEntry], 128_000);
    const histMsg = msgs.find(m => m.content.includes('FAILED: Element not found'));
    expect(histMsg).toBeDefined();
    expect(histMsg?.role).toBe('user');
  });
});

describe('ModelRouter — Escalation to Cloud on Consecutive Failures', () => {
  it('escalates to cloud adapter after 2 consecutive failed steps in auto mode', async () => {
    const { ModelRouter } = await import('../../../src/main/agent/model-router');
    const mockLocal = {
      providerId: 'ollama',
      modelId: 'qwen3:8b',
      isAvailable: vi.fn().mockResolvedValue(true),
      getContextLimit: () => 16384,
      estimateTokens: () => 10,
      chat: vi.fn(),
    };
    const mockCloud = {
      providerId: 'openai',
      modelId: 'gpt-4o',
      isAvailable: vi.fn().mockResolvedValue(true),
      getContextLimit: () => 128_000,
      estimateTokens: () => 10,
      chat: vi.fn(),
    };

    const router = new ModelRouter({
      localModel: 'qwen3:8b',
      cloudModel: 'gpt-4o',
      routingMode: 'auto',
    }, mockCloud as any);
    (router as any).localAdapter = mockLocal;

    const task: AgentTask = {
      id: 't-route', tabId: 'tab-1', instruction: 'Search something',
      context: { currentUrl: 'https://test.com', userInstruction: 'Search', currentStep: 3, totalSteps: 5 },
      createdAt: Date.now()
    };

    // 0 or 1 failure -> stays local
    const decisionInitial = await router.route({
      task, actionLog: [], pageContentLength: 500
    });
    expect(decisionInitial.isCloud).toBe(false);

    // 2 consecutive failures -> escalates to cloud
    const failedLog: ActionLogEntry[] = [
      {
        action: { id: 'a1', type: 'click', target: '#a', riskTier: RiskTier.LOW, reason: 'r', timestamp: 1, tabId: '1', url: 'u' },
        decision: { actionId: 'a1', allowed: true, requiresConfirmation: false, riskTier: RiskTier.LOW, classification: {} as any, siteTrust: 0 as any, explanation: '', detailedReason: '' },
        executed: false,
        result: { success: false, error: 'Failed', duration: 10 },
        timestamp: 1
      },
      {
        action: { id: 'a2', type: 'click', target: '#b', riskTier: RiskTier.LOW, reason: 'r', timestamp: 2, tabId: '1', url: 'u' },
        decision: { actionId: 'a2', allowed: true, requiresConfirmation: false, riskTier: RiskTier.LOW, classification: {} as any, siteTrust: 0 as any, explanation: '', detailedReason: '' },
        executed: false,
        result: { success: false, error: 'Failed again', duration: 10 },
        timestamp: 2
      }
    ];

    const decisionEscalated = await router.route({
      task, actionLog: failedLog, pageContentLength: 500
    });
    expect(decisionEscalated.isCloud).toBe(true);
    expect(decisionEscalated.reason).toContain('2 consecutive failed steps');
  });
});
