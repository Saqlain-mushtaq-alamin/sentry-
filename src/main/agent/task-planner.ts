/**
 * TaskPlanner — Task 5.5
 *
 * Generates a high-level TaskPlan before the ReAct loop runs.
 * The plan is shown to the user for review/approval.
 */

import * as crypto from 'crypto';
import { TaskPlan, PlannedStep, PageSnapshot, RiskTier } from '../../shared/types';
import { ModelAdapter } from './model-adapter';

export class TaskPlanner {
  constructor(private adapter: ModelAdapter) {}

  async generatePlan(
    instruction: string,
    currentSnapshot: PageSnapshot,
  ): Promise<TaskPlan> {
    const planningPrompt = `You are a web automation planner. Break the following task into 3–8 high-level steps.

Task: "${instruction}"
Current URL: ${currentSnapshot.url}
Current Page Title: ${currentSnapshot.title}

Return a JSON object with this exact shape:
{
  "steps": [
    {
      "stepNumber": 1,
      "description": "Brief description of what will happen in this step",
      "expectedActions": ["navigate to example.com"],
      "estimatedRisk": "low | medium | high | critical"
    }
  ],
  "estimatedActions": 5,
  "estimatedTime": "~30 seconds",
  "risks": ["May need to handle a login page"],
  "requiresHighRiskActions": false
}`;

    let planData: {
      steps: Array<{ stepNumber: number; description: string; expectedActions: string[]; estimatedRisk: string }>;
      estimatedActions: number;
      estimatedTime: string;
      risks: string[];
      requiresHighRiskActions: boolean;
    };

    try {
      const response = await this.adapter.chat({
        systemPrompt: 'You are a helpful web automation planner. Always respond with valid JSON only.',
        messages: [{ role: 'user', content: planningPrompt }],
        temperature: 0.2,
        responseFormat: 'json',
        maxTokens: 800,
      });

      planData = JSON.parse(response.content) as typeof planData;
    } catch {
      // Fallback plan if model call fails or JSON parse fails
      planData = {
        steps: [{ stepNumber: 1, description: instruction, expectedActions: [instruction], estimatedRisk: 'medium' }],
        estimatedActions: 1,
        estimatedTime: '~unknown',
        risks: [],
        requiresHighRiskActions: false,
      };
    }

    const steps: PlannedStep[] = (planData.steps ?? []).map(s => ({
      stepNumber: s.stepNumber,
      description: s.description,
      expectedActions: s.expectedActions ?? [],
      estimatedRisk: this.parseRisk(s.estimatedRisk),
    }));

    return {
      taskId: crypto.randomUUID(),
      instruction,
      steps,
      estimatedActions: planData.estimatedActions ?? steps.length,
      estimatedTime: planData.estimatedTime ?? '~unknown',
      risks: planData.risks ?? [],
      requiresHighRiskActions:
        planData.requiresHighRiskActions ??
        steps.some(s => s.estimatedRisk === RiskTier.HIGH || s.estimatedRisk === RiskTier.CRITICAL),
    };
  }

  private parseRisk(raw: string): RiskTier {
    switch ((raw ?? '').toLowerCase()) {
      case 'critical': return RiskTier.CRITICAL;
      case 'high':     return RiskTier.HIGH;
      case 'medium':   return RiskTier.MEDIUM;
      default:         return RiskTier.LOW;
    }
  }
}
