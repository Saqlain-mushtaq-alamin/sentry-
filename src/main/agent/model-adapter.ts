/**
 * ModelAdapter — Task 5.1
 *
 * Provider-agnostic interface that every model backend must implement.
 * This decouples the ReAct loop from any specific LLM API.
 */

import { ChatRequest, ChatResponse } from '../../shared/types';

export interface ModelAdapter {
  readonly providerId: string;
  readonly modelId: string;

  /** Send a chat completion request */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /** Check if the model is configured and reachable */
  isAvailable(): Promise<boolean>;

  /** Maximum context tokens this model supports */
  getContextLimit(): number;

  /** Fast, rough token estimator (chars / 4 is good enough for budgeting) */
  estimateTokens(text: string): number;
}
