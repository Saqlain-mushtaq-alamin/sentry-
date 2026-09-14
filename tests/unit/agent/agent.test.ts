import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionParser } from '../../../src/main/agent/action-parser';
import { ContextManager } from '../../../src/main/agent/context-manager';
import { TaskStateMachine } from '../../../src/main/agent/task-state-machine';
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
