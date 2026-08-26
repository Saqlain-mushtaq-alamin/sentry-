import * as crypto from 'crypto';
import { ActionLogEntry, Recipe, RecipeStep, RecipeVariable, ElementSelector, RiskTier } from '../../shared/types';

export class RecipeCapture {
  
  public capture(taskInstruction: string, actionLog: ActionLogEntry[]): Recipe {
    const steps: RecipeStep[] = [];
    const variables: RecipeVariable[] = [];
    const sitePatterns: Set<string> = new Set();
    
    let order = 0;
    
    // Auto-detect variables based on values
    for (const entry of actionLog) {
      const action = entry.action;

      if (action.url) {
        try {
          const urlObj = new URL(action.url);
          sitePatterns.add(urlObj.hostname);
        } catch {}
      }

      let stepValue: RecipeStep['value'] = action.value;

      if (action.type === 'type' && action.value) {
        // Automatically make typed strings into variables
        const varName = this.generateVariableName(action.value, variables.length);
        variables.push({
          name: varName,
          description: `Value entered into ${action.target || 'input'}`,
          type: 'text',
          defaultValue: action.value,
          required: true,
        });
        stepValue = { type: 'variable', name: varName };
      }

      if (action.type === 'navigate' && action.value) {
        // Keep URLs static by default, unless they contain obvious queries
      }

      // Convert target string to ElementSelector
      let target: ElementSelector = {
        primary: action.target || 'body',
        fallbacks: [],
      };

      steps.push({
        order: order++,
        actionType: action.type,
        target,
        value: stepValue,
        riskTier: action.riskTier || RiskTier.LOW,
      });
    }

    return {
      id: crypto.randomUUID(),
      name: this.generateRecipeName(taskInstruction),
      description: `Recipe created from: "${taskInstruction}"`,
      version: 1,
      steps,
      variables,
      sitePatterns: Array.from(sitePatterns),
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      useCount: 0,
      tags: [],
      isPublic: false,
    };
  }

  private generateVariableName(value: string, index: number): string {
    // Basic heuristic for var name
    if (value.length < 15 && /^[a-zA-Z0-9 ]+$/.test(value)) {
      return value.replace(/\s+/g, '_').toLowerCase();
    }
    return `input_var_${index + 1}`;
  }

  private generateRecipeName(instruction: string): string {
    if (instruction.length < 40) return instruction;
    return instruction.substring(0, 37) + '...';
  }
}
