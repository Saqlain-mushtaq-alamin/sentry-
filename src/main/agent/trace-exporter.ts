import { TaskTrace, TraceStep } from '../../shared/types';

export class TraceExporter {
  /**
   * Export full trace as a pretty-printed JSON string.
   */
  static exportToJson(trace: TaskTrace): string {
    return JSON.stringify(trace, null, 2);
  }

  /**
   * Export trace as a human-readable Markdown report.
   */
  static exportToMarkdown(trace: TaskTrace): string {
    const lines: string[] = [];

    lines.push(`# Sentry Task Execution Trace`);
    lines.push(``);
    lines.push(`**Exported At:** ${trace.exportedAt}`);
    lines.push(`**Sentry Version:** ${trace.sentryVersion}`);
    lines.push(``);

    lines.push(`## 📋 Task Details`);
    lines.push(`- **Task ID:** \`${trace.task.id}\``);
    lines.push(`- **Instruction:** ${trace.task.instruction}`);
    lines.push(`- **Started At:** ${trace.task.startedAt}`);
    lines.push(`- **Completed At:** ${trace.task.completedAt}`);
    lines.push(`- **Final State:** \`${trace.task.state}\``);
    lines.push(`- **Total Steps:** ${trace.task.totalSteps}`);
    lines.push(``);

    lines.push(`## 🤖 Model & Cost Info`);
    lines.push(`- **Provider:** ${trace.model.providerId}`);
    lines.push(`- **Model ID:** ${trace.model.modelId}`);
    lines.push(`- **Type:** ${trace.model.isLocal ? 'Local Model' : 'Cloud API'}`);
    lines.push(`- **Total Tokens:** ${trace.model.totalTokens.toLocaleString()}`);
    lines.push(`- **Estimated Cost:** $${trace.model.estimatedCost.toFixed(4)}`);
    lines.push(``);

    lines.push(`## 🛡️ Firewall & Security Summary`);
    lines.push(`- **Total Decisions:** ${trace.firewallSummary.totalDecisions}`);
    lines.push(`- **Allowed:** ${trace.firewallSummary.allowed}`);
    lines.push(`- **Blocked:** ${trace.firewallSummary.blocked}`);
    lines.push(`- **Confirmations Prompted:** ${trace.firewallSummary.confirmationsAsked}`);
    lines.push(`- **Confirmations Denied:** ${trace.firewallSummary.confirmationsDenied}`);
    lines.push(`- **Prompt Injection Scans:** ${trace.injectionSummary.totalScans}`);
    lines.push(`- **Injections Detected:** ${trace.injectionSummary.detectionsFound}`);
    lines.push(`- **False Positives Reported:** ${trace.injectionSummary.falsePositives}`);
    lines.push(``);

    lines.push(`## ⚡ Performance Breakdown`);
    lines.push(`- **Total Duration:** ${trace.performance.totalDurationMs} ms`);
    lines.push(`- **Avg Step Latency:** ${trace.performance.avgStepLatencyMs} ms`);
    lines.push(`- **Avg Model Inference:** ${trace.performance.avgModelLatencyMs} ms`);
    lines.push(`- **Avg Action Execution:** ${trace.performance.avgActionLatencyMs} ms`);
    lines.push(``);

    lines.push(`## 🐾 Step Timeline`);
    lines.push(``);

    trace.steps.forEach((step) => {
      lines.push(`### Step ${step.stepNumber} [${step.timestamp}]`);
      lines.push(`- **Thought:** ${step.modelThought}`);
      lines.push(`- **Proposed Action:** \`${step.proposedAction.type}\` on \`${step.proposedAction.target || 'N/A'}\` (Value: "${step.proposedAction.value ?? ''}")`);
      lines.push(`- **Risk Tier:** \`${step.firewallDecision.riskTier}\` | **Decision:** ${step.firewallDecision.allowed ? '✅ ALLOWED' : '❌ BLOCKED'}`);
      lines.push(`- **Firewall Reason:** ${step.firewallDecision.explanation}`);
      if (step.userResponse) {
        lines.push(`- **User Response:** \`${step.userResponse}\``);
      }
      lines.push(`- **Execution Success:** ${step.actionResult?.success ? 'Yes' : 'No'} (${step.latency.execution} ms)`);
      lines.push(`- **Injection Scan:** ${step.injectionScanResult.isClean ? 'CLEAN' : '⚠️ DETECTED'}`);
      lines.push(`- **Latency Split:** Obs: ${step.latency.observation}ms | Model: ${step.latency.model}ms | FW: ${step.latency.firewall}ms | Exec: ${step.latency.execution}ms`);
      lines.push(``);
    });

    return lines.join('\n');
  }

  /**
   * Export trace steps as CSV for spreadsheet analysis.
   */
  static exportToCsv(trace: TaskTrace): string {
    const headers = [
      'stepNumber',
      'timestamp',
      'actionType',
      'target',
      'value',
      'riskTier',
      'firewallAllowed',
      'firewallReason',
      'userResponse',
      'executionSuccess',
      'isClean',
      'latencyObservationMs',
      'latencyModelMs',
      'latencyFirewallMs',
      'latencyExecutionMs',
      'modelThought'
    ];

    const rows = trace.steps.map((s) => [
      s.stepNumber,
      `"${s.timestamp}"`,
      `"${s.proposedAction.type}"`,
      `"${(s.proposedAction.target || '').replace(/"/g, '""')}"`,
      `"${(s.proposedAction.value || '').replace(/"/g, '""')}"`,
      `"${s.firewallDecision.riskTier}"`,
      s.firewallDecision.allowed ? 'true' : 'false',
      `"${(s.firewallDecision.explanation || '').replace(/"/g, '""')}"`,
      `"${s.userResponse ?? ''}"`,
      s.actionResult?.success ? 'true' : 'false',
      s.injectionScanResult.isClean ? 'true' : 'false',
      s.latency.observation,
      s.latency.model,
      s.latency.firewall,
      s.latency.execution,
      `"${(s.modelThought || '').replace(/"/g, '""')}"`
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Generates a standardized filename for trace exports:
   * sentry_trace_YYYY-MM-DD_HHmmss_taskname.json / .md / .csv
   */
  static generateFilename(taskInstruction: string, format: 'json' | 'md' | 'csv'): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const cleanTaskName = (taskInstruction || 'unnamed_task')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 25)
      .replace(/^_+|_+$/g, '');

    const ext = format === 'md' ? 'md' : format;
    return `sentry_trace_${dateStr}_${timeStr}_${cleanTaskName || 'task'}.${ext}`;
  }
}
