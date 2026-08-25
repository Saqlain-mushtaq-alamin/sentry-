/**
 * OpenAIAdapter — Task 5.2a
 *
 * Calls the OpenAI chat completions API (gpt-4o, gpt-4-turbo, etc.).
 * Implements exponential-backoff retry and cost estimation.
 */

import { ModelAdapter } from '../model-adapter';
import { ChatRequest, ChatResponse } from '../../../shared/types';

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':       { input: 0.000005, output: 0.000015 },
  'gpt-4-turbo':  { input: 0.00001,  output: 0.00003  },
  'gpt-3.5-turbo':{ input: 0.0000005, output: 0.0000015 },
};

export class OpenAIAdapter implements ModelAdapter {
  readonly providerId = 'openai';
  readonly modelId: string;
  private readonly apiKey: string;
  private readonly contextLimit: number;
  private readonly baseUrl: string;

  constructor(
    apiKey: string,
    modelId = 'gpt-4o',
    baseUrl = 'https://api.openai.com/v1',
  ) {
    this.apiKey = apiKey;
    this.modelId = modelId;
    this.baseUrl = baseUrl;
    this.contextLimit = modelId.startsWith('gpt-4') ? 128_000 : 16_385;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const messages = [
      { role: 'system', content: request.systemPrompt },
      ...request.messages.map(m => ({ role: m.role, content: m.content })),
    ];

    const body = {
      model: this.modelId,
      messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 1024,
      ...(request.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
    };

    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };

    const usage = data.usage;
    const pricing = PRICING[this.modelId] ?? { input: 0, output: 0 };
    const cost =
      usage.prompt_tokens * pricing.input +
      usage.completion_tokens * pricing.output;

    return {
      content: data.choices[0]?.message?.content ?? '',
      tokenUsage: {
        prompt: usage.prompt_tokens,
        completion: usage.completion_tokens,
        total: usage.total_tokens,
      },
      cost,
      latencyMs: Date.now() - start,
      modelId: data.model ?? this.modelId,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  getContextLimit(): number { return this.contextLimit; }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
    let lastError: Error = new Error('unknown');
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(30_000),
        });
        if (res.ok || res.status < 500) return res;
        lastError = new Error(`HTTP ${res.status}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    }
    throw lastError;
  }
}
