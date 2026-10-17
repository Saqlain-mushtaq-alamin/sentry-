import { describe, it, expect } from 'vitest';
import { TraceExporter } from '../../../src/main/agent/trace-exporter';
import { RiskTier, SiteTrustLevel, TaskState, TaskTrace } from '../../../src/shared/types';

const CSV_HEADER =
  'stepNumber,timestamp,actionType,target,value,riskTier,firewallAllowed,firewallReason,userResponse,executionSuccess,isClean,latencyObservationMs,latencyModelMs,latencyFirewallMs,latencyExecutionMs,modelThought';

function makeTrace(): TaskTrace {
  return {
    version: '1.0',
    exportedAt: '2026-10-01T10:00:00.000Z',
    sentryVersion: '0.1.0',
    task: {
      id: 'task-trace-1',
      instruction: 'Search for wireless headphones',
      startedAt: '2026-10-01T09:59:00.000Z',
      completedAt: '2026-10-01T10:00:00.000Z',
      state: TaskState.COMPLETED,
      totalSteps: 2,
    },
    model: {
      providerId: 'openai',
      modelId: 'gpt-4o',
      isLocal: false,
      totalTokens: 900,
      estimatedCost: 0.0042,
    },
    steps: [
      {
        stepNumber: 1,
        timestamp: '09:59:10',
        observation: 'Homepage with search box',
        modelThought: 'I will type the query into the search box',
        proposedAction: {
          id: 'act-1',
          type: 'type',
          target: '#search',
          value: 'wireless headphones',
          riskTier: RiskTier.LOW,
          reason: 'Enter the search query',
          timestamp: 1759312750000,
          tabId: 'tab-1',
          url: 'https://example.com',
        },
        firewallDecision: {
          actionId: 'act-1',
          allowed: true,
          requiresConfirmation: false,
          riskTier: RiskTier.LOW,
          classification: { tier: RiskTier.LOW, reasons: ['Fill search box'], policyRulesFired: ['fill-search'], confidence: 0.9 },
          siteTrust: SiteTrustLevel.READ_ACT,
          explanation: 'Low risk action allowed automatically.',
          detailedReason: 'Fill search box',
        },
        injectionScanResult: { isClean: true, confidence: 0.98 },
        latency: { observation: 12, model: 750, firewall: 4, execution: 40 },
      },
      {
        stepNumber: 2,
        timestamp: '09:59:40',
        observation: 'Checkout page with submit button',
        modelThought: 'Time to submit the form',
        proposedAction: {
          id: 'act-2',
          type: 'submit',
          target: '#checkout',
          riskTier: RiskTier.HIGH,
          reason: 'Place the order',
          timestamp: 1759312780000,
          tabId: 'tab-1',
          url: 'https://example.com/checkout',
        },
        firewallDecision: {
          actionId: 'act-2',
          allowed: false,
          requiresConfirmation: true,
          riskTier: RiskTier.HIGH,
          classification: { tier: RiskTier.HIGH, reasons: ['Form Submission'], policyRulesFired: ['form-submit'], confidence: 0.9 },
          siteTrust: SiteTrustLevel.READ_ACT,
          explanation: 'HIGH risk action requires confirmation.',
          detailedReason: 'Form Submission',
        },
        userResponse: 'allow_once',
        actionResult: { success: true, duration: 55 },
        injectionScanResult: { isClean: false, confidence: 0.87 },
        latency: { observation: 10, model: 820, firewall: 6, execution: 55 },
      },
    ],
    firewallSummary: {
      totalDecisions: 2,
      allowed: 1,
      blocked: 0,
      confirmationsAsked: 1,
      confirmationsDenied: 0,
    },
    injectionSummary: {
      totalScans: 2,
      detectionsFound: 1,
      falsePositives: 0,
    },
    performance: {
      totalDurationMs: 90000,
      avgStepLatencyMs: 850,
      avgModelLatencyMs: 785,
      avgActionLatencyMs: 48,
    },
  };
}

describe('TraceExporter', () => {
  it('exportToJson round-trips to an equal object', () => {
    const trace = makeTrace();
    const json = TraceExporter.exportToJson(trace);
    expect(JSON.parse(json)).toEqual(trace);
  });

  it('exportToMarkdown contains step numbers, risk tiers, and summary sections', () => {
    const md = TraceExporter.exportToMarkdown(makeTrace());

    expect(md).toContain('## 📋 Task Details');
    expect(md).toContain('## 🤖 Model & Cost Info');
    expect(md).toContain('## 🛡️ Firewall & Security Summary');
    expect(md).toContain('## ⚡ Performance Breakdown');
    expect(md).toContain('## 🐾 Step Timeline');
    expect(md).toContain('### Step 1 [09:59:10]');
    expect(md).toContain('### Step 2 [09:59:40]');
    expect(md).toContain('**Risk Tier:** `low`');
    expect(md).toContain('**Risk Tier:** `high`');
    expect(md).toContain('✅ ALLOWED');
    expect(md).toContain('**User Response:** `allow_once`');
    expect(md).toContain('⚠️ DETECTED');
    expect(md).toContain('CLEAN');
  });

  it('exportToCsv emits the exact header row and one row per step', () => {
    const csv = TraceExporter.exportToCsv(makeTrace());
    const lines = csv.split('\n');

    expect(lines[0]).toBe(CSV_HEADER);
    expect(lines).toHaveLength(3); // header + 2 steps
    expect(lines[1]).toContain('"type"');
    expect(lines[1]).toContain('"#search"');
    expect(lines[1]).toContain('"wireless headphones"');
    expect(lines[1]).toContain('true'); // firewallAllowed for step 1
    expect(lines[2]).toContain('"submit"');
    expect(lines[2]).toContain('"allow_once"');
    expect(lines[2]).toContain('"high"');
  });

  it('generateFilename produces sentry_trace_<date>_<time>_<slug>.<ext> with a sanitized slug', () => {
    const fname = TraceExporter.generateFilename('Login to my Email!!!', 'json');
    expect(fname).toMatch(/^sentry_trace_\d{4}-\d{2}-\d{2}_\d{6}_login_to_my_email\.json$/);
  });

  it('generateFilename falls back to "task" when the instruction sanitizes to nothing', () => {
    const fname = TraceExporter.generateFilename('!!! ???', 'csv');
    expect(fname).toMatch(/^sentry_trace_\d{4}-\d{2}-\d{2}_\d{6}_task\.csv$/);
  });

  it('generateFilename uses the md extension for markdown exports', () => {
    const fname = TraceExporter.generateFilename('Compare prices', 'md');
    expect(fname).toMatch(/^sentry_trace_\d{4}-\d{2}-\d{2}_\d{6}_compare_prices\.md$/);
  });
});
