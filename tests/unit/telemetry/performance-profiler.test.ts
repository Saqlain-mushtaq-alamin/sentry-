/**
 * Task 14.1 — Performance Profiler & Baseline Metric Verification Tests
 */

import { describe, it, expect } from 'vitest';
import { PerformanceProfiler } from '../../../src/main/telemetry/performance-profiler';

describe('Task 14.1 — Performance Profiling & Baseline Targets', () => {
  it('records metrics and calculates summary stats', () => {
    const profiler = new PerformanceProfiler();

    profiler.recordColdStartup(1500); // Target < 3000ms
    profiler.recordTabOpen(120);       // Target < 500ms
    profiler.recordTabOpen(140);
    profiler.recordCdpSnapshot(85);    // Target < 200ms
    profiler.recordCdpSnapshot(3, true); // Target < 5ms (cached)
    profiler.recordActionExecution(45); // Target < 100ms
    profiler.recordFirewallEvaluation(4); // Target < 10ms
    profiler.recordInjectionScan(35);   // Target < 100ms

    const report = profiler.getReport();

    expect(report.coldStartup.meetsTarget).toBe(true);
    expect(report.coldStartup.latest).toBe(1500);

    expect(report.tabOpen.meetsTarget).toBe(true);
    expect(report.tabOpen.avg).toBe(130);

    expect(report.cdpSnapshot.meetsTarget).toBe(true);
    expect(report.cdpSnapshot.latest).toBe(85);

    expect(report.cachedSnapshot.meetsTarget).toBe(true);
    expect(report.cachedSnapshot.latest).toBe(3);

    expect(report.actionExecution.meetsTarget).toBe(true);
    expect(report.actionExecution.latest).toBe(45);

    expect(report.firewallEvaluation.meetsTarget).toBe(true);
    expect(report.firewallEvaluation.latest).toBe(4);

    expect(report.injectionScan.meetsTarget).toBe(true);
    expect(report.injectionScan.latest).toBe(35);

    expect(report.meetsAllTargets).toBe(true);
  });

  it('measures process memory usage', () => {
    const profiler = new PerformanceProfiler();
    const memMB = profiler.getMemoryUsageMB();
    expect(memMB).toBeGreaterThan(0);
    expect(memMB).toBeLessThan(2500); // Baseline memory limit
  });
});
