import { describe, it, expect } from 'vitest';
import { TraceExporter } from '../../../src/main/agent/trace-exporter';
import { BenchmarkRunner } from '../../../src/main/agent/benchmarks/benchmark-runner';
import { BUILTIN_BENCHMARK_SUITES } from '../../../src/main/agent/benchmarks/suites';
import { TaskTrace, TaskState, RiskTier, SiteTrustLevel } from '../../../src/shared/types';

describe('Phase 12 — Developer / Research Mode Tests', () => {
  const mockTrace: TaskTrace = {
    version: '1.0',
    exportedAt: '2026-08-18T12:00:00.000Z',
    sentryVersion: '0.1.0',
    task: {
      id: 'task-test-01',
      instruction: 'Find laptops under 500 dollars',
      startedAt: '2026-08-18T11:59:00.000Z',
      completedAt: '2026-08-18T12:00:00.000Z',
      state: TaskState.COMPLETED,
      totalSteps: 2,
    },
    model: {
      providerId: 'openai',
      modelId: 'gpt-4o',
      isLocal: false,
      totalTokens: 1200,
      estimatedCost: 0.003,
    },
    steps: [
      {
        stepNumber: 1,
        timestamp: '12:00:01',
        observation: 'Homepage loaded with search box',
        modelThought: 'Type query into search input',
        proposedAction: {
          id: 'action-1',
          type: 'type',
          target: '#search',
          value: 'laptops under $500',
          riskTier: RiskTier.LOW,
          reason: 'Search for laptops',
          timestamp: 1600000000,
          tabId: 'tab-1',
          url: 'https://example.com',
        },
        firewallDecision: {
          actionId: 'action-1',
          allowed: true,
          requiresConfirmation: false,
          riskTier: RiskTier.LOW,
          classification: {
            tier: RiskTier.LOW,
            reasons: ['Safe search input'],
            policyRulesFired: ['safe-text-input'],
            confidence: 0.99,
          },
          siteTrust: SiteTrustLevel.READ_ACT,
          explanation: 'Allowed safe input',
          detailedReason: 'Non-sensitive text typed into public input element.',
        },
        injectionScanResult: { isClean: true, confidence: 1.0 },
        latency: { observation: 10, model: 800, firewall: 5, execution: 50 },
      },
    ],
    firewallSummary: {
      totalDecisions: 1,
      allowed: 1,
      blocked: 0,
      confirmationsAsked: 0,
      confirmationsDenied: 0,
    },
    injectionSummary: {
      totalScans: 1,
      detectionsFound: 0,
      falsePositives: 0,
    },
    performance: {
      totalDurationMs: 60000,
      avgStepLatencyMs: 865,
      avgModelLatencyMs: 800,
      avgActionLatencyMs: 50,
    },
  };

  describe('Trace Exporter', () => {
    it('exports trace as structured JSON string', () => {
      const jsonOutput = TraceExporter.exportToJson(mockTrace);
      expect(jsonOutput).toContain('"version": "1.0"');
      expect(jsonOutput).toContain('"instruction": "Find laptops under 500 dollars"');
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.task.id).toBe('task-test-01');
    });

    it('exports trace as formatted Markdown report', () => {
      const mdOutput = TraceExporter.exportToMarkdown(mockTrace);
      expect(mdOutput).toContain('# Sentry Task Execution Trace');
      expect(mdOutput).toContain('**Instruction:** Find laptops under 500 dollars');
      expect(mdOutput).toContain('## 🛡️ Firewall & Security Summary');
      expect(mdOutput).toContain('### Step 1');
    });

    it('exports trace steps as CSV string', () => {
      const csvOutput = TraceExporter.exportToCsv(mockTrace);
      expect(csvOutput).toContain('stepNumber,timestamp,actionType');
      expect(csvOutput).toContain('1,"12:00:01","type"');
    });

    it('generates standardized filename with task instruction and timestamp', () => {
      const fname = TraceExporter.generateFilename('Search for laptops under $500', 'json');
      expect(fname).toMatch(/^sentry_trace_\d{4}-\d{2}-\d{2}_\d{6}_search_for_laptops_under\.json$/);
    });
  });

  describe('Benchmarking Suite Framework', () => {
    it('contains 5 built-in benchmark suites', () => {
      expect(BUILTIN_BENCHMARK_SUITES).toHaveLength(5);
      const suiteIds = BUILTIN_BENCHMARK_SUITES.map((s) => s.id);
      expect(suiteIds).toContain('basic-navigation');
      expect(suiteIds).toContain('form-filling');
      expect(suiteIds).toContain('adversarial-security');
      expect(suiteIds).toContain('multi-tab');
      expect(suiteIds).toContain('model-comparison');
    });

    it('runs benchmark suite and generates aggregated results', async () => {
      const runner = new BenchmarkRunner();
      const results = await runner.runSuite('basic-navigation');

      expect(results.suiteId).toBe('basic-navigation');
      expect(results.totalTasks).toBe(10);
      expect(results.completedTasks).toBe(10);
      expect(results.taskSuccessRate).toBeGreaterThan(0);
      expect(results.avgTaskDuration).toBeGreaterThan(0);
      expect(results.avgTokensPerTask).toBeGreaterThan(0);
    });

    it('handles adversarial security benchmark suite detection rates', async () => {
      const runner = new BenchmarkRunner();
      const results = await runner.runSuite('adversarial-security');

      expect(results.suiteId).toBe('adversarial-security');
      expect(results.totalTasks).toBe(20);
      expect(results.injectionDetectionRate).toBe(100);
    });
  });
});
