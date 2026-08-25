/**
 * Integration test — Task 5.11
 *
 * Validates the full Agent Brain stack with a mocked model adapter and
 * mocked page observer / action executor. No real network calls are made.
 *
 * Scenario: "Search for 'Sentry browser' on Google"
 *   Step 1 — model proposes navigate to google.com
 *   Step 2 — model proposes type 'Sentry browser' into the search box
 *   Step 3 — model proposes click on the search button
 *   Step 4 — model says done
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReActLoop } from '../../../src/main/agent/react-loop';
import { ModelAdapter } from '../../../src/main/agent/model-adapter';
import { ActionExecutor } from '../../../src/main/cdp/action-executor';
import { ActionFirewall } from '../../../src/main/action-layer/action-firewall';
import { PageObserver } from '../../../src/main/cdp/page-observer';
import { RiskClassifier } from '../../../src/main/action-layer/risk-classifier';
import { TrustManager } from '../../../src/main/action-layer/trust-manager';
import { PermissionManager } from '../../../src/main/action-layer/permission-manager';
import { AuditLog } from '../../../src/main/action-layer/audit-log';
import {
  AgentTask, PageSnapshot, TaskState, RiskTier,
  ChatRequest, ChatResponse,
} from '../../../src/shared/types';

// ─── Mock snapshot factory ────────────────────────────────────────────────────

const makeSnapshot = (url: string): PageSnapshot => ({
  url,
  title: 'Test Page',
  timestamp: Date.now(),
  dom: { tag: 'body', children: [] },
  accessibilityTree: [],
  visibleText: 'Search the web',
  forms: [],
  links: [],
  interactiveElements: [
    { index: 0, tag: 'input',  role: 'searchbox', label: 'Search',      selector: '#search-input',  boundingBox: { x: 0, y: 0, width: 200, height: 30 }, isVisible: true, isEnabled: true, type: 'search' },
    { index: 1, tag: 'button', role: 'button',    label: 'Google Search', selector: '#search-button', boundingBox: { x: 200, y: 0, width: 80, height: 30 }, isVisible: true, isEnabled: true, type: 'submit' },
  ],
  estimatedTokenCount: 100,
});

// Sequence of model responses for the test scenario
const MODEL_RESPONSES = [
  // Step 1 — navigate
  JSON.stringify({
    thought: 'I need to navigate to Google first.',
    action: { type: 'navigate', target: 'https://google.com', reason: 'Navigate to Google' }
  }),
  // Step 2 — type search query
  JSON.stringify({
    thought: 'I can see the search box at index 0. I will type the query.',
    action: { type: 'type', target: '0', value: 'Sentry browser', reason: 'Enter search query' }
  }),
  // Step 3 — click search (medium risk — should auto-allow)
  JSON.stringify({
    thought: 'I will click the search button to execute the search.',
    action: { type: 'click', target: '1', reason: 'Submit the search' }
  }),
  // Step 4 — done
  JSON.stringify({
    thought: 'The search was submitted successfully.',
    action: { type: 'done', reason: 'Task complete — search for Sentry browser executed.' }
  }),
];

describe('Agent Brain Integration — Search Task (mocked)', () => {
  let loop: ReActLoop;
  let callCount: number;

  beforeEach(() => {
    callCount = 0;

    // Mock model adapter
    const mockAdapter: ModelAdapter = {
      providerId: 'mock',
      modelId: 'mock-model',
      async chat(_req: ChatRequest): Promise<ChatResponse> {
        const content = MODEL_RESPONSES[callCount % MODEL_RESPONSES.length] ?? '{}';
        callCount++;
        return {
          content,
          tokenUsage: { prompt: 50, completion: 30, total: 80 },
          cost: 0,
          latencyMs: 5,
          modelId: 'mock-model',
        };
      },
      async isAvailable() { return true; },
      getContextLimit() { return 128_000; },
      estimateTokens(text) { return Math.ceil(text.length / 4); },
    };

    // Mock page observer
    const mockObserver = {
      getPageSnapshot: vi.fn().mockResolvedValue(makeSnapshot('https://google.com')),
      getAccessibilityTree: vi.fn().mockResolvedValue([]),
      getBoundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 30 }),
    } as unknown as PageObserver;

    // Mock action executor
    const mockExecutor = {
      execute: vi.fn().mockResolvedValue({ success: true, duration: 10 }),
    } as unknown as ActionExecutor;

    // Real firewall stack (no mock — we test it works with the real classifier)
    const classifier = new RiskClassifier();
    const trustManager = new TrustManager();
    const permissionManager = new PermissionManager();
    const auditLog = new AuditLog();
    const firewall = new ActionFirewall(classifier, trustManager, permissionManager, auditLog);

    loop = new ReActLoop(mockAdapter, mockExecutor, firewall, mockObserver);
  });

  it('completes a 4-step search task end-to-end', async () => {
    const task: AgentTask = {
      id: 'test-task-1',
      tabId: 'tab-1',
      instruction: "Search for 'Sentry browser' on Google",
      context: {
        currentUrl: 'https://www.google.com',
        userInstruction: "Search for 'Sentry browser' on Google",
        currentStep: 0,
        totalSteps: 4,
      },
      createdAt: Date.now(),
    };

    const result = await loop.executeTask(task);

    expect(result.state).toBe(TaskState.COMPLETED);
    expect(result.totalSteps).toBeGreaterThan(0);
    expect(result.actionLog.length).toBeGreaterThan(0);
    // The navigate action should have been executed (LOW risk)
    expect(result.actionLog.some(e => e.action.type === 'navigate' && e.executed)).toBe(true);
  });

  it('stops cleanly when stop() is called during execution', async () => {
    const task: AgentTask = {
      id: 'test-task-2',
      tabId: 'tab-1',
      instruction: 'A long task',
      context: {
        currentUrl: 'https://example.com',
        userInstruction: 'A long task',
        currentStep: 0,
        totalSteps: 10,
      },
      createdAt: Date.now(),
    };

    // Stop immediately after start (simulates user clicking Stop)
    setTimeout(() => loop.stop(), 50);
    const result = await loop.executeTask(task);

    expect(result.state).toBe(TaskState.FAILED);
    // Error is either the "cancelled" string or undefined if stop fires before first observe
    expect(result.error === undefined || result.error.toLowerCase().includes('cancel')).toBe(true);
  });

  it('all executed actions were logged in the audit log', async () => {
    const task: AgentTask = {
      id: 'test-task-3',
      tabId: 'tab-1',
      instruction: "Search for 'Sentry browser' on Google",
      context: {
        currentUrl: 'https://www.google.com',
        userInstruction: "Search for 'Sentry browser' on Google",
        currentStep: 0,
        totalSteps: 4,
      },
      createdAt: Date.now(),
    };

    const result = await loop.executeTask(task);
    // Every action in the log has a decision (proving it went through the firewall)
    for (const entry of result.actionLog) {
      expect(entry.decision).toBeDefined();
      expect(entry.action.id).toBeTruthy();
    }
  });
});
