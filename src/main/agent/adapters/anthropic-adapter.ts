/**
 * AnthropicAdapter — Task 5.2b
 *
 * Calls the Anthropic Messages API (claude-sonnet-4-*, claude-haiku, etc.).
 * Maps the Sentry ChatRequest format to Anthropic's distinct messages API.
 */

import { ModelAdapter } from '../model-adapter';
import { ChatRequest, ChatResponse } from '../../../shared/types';

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 0.000003,  output: 0.000015  },
  'claude-haiku-3-20240307':  { input: 0.00000025, output: 0.00000125 },
  'claude-opus-4-20250514':   { input: 0.000015,   output: 0.000075  },
};

export class AnthropicAdapter implements ModelAdapter {
  readonly providerId = 'anthropic';
  readonly modelId: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    apiKey: string,
    modelId = 'claude-sonnet-4-20250514',
    baseUrl = 'https://api.anthropic.com/v1',
  ) {
    this.apiKey = apiKey;
    this.modelId = modelId;
    this.baseUrl = baseUrl;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();

    const body = {
      model: this.modelId,
      system: request.systemPrompt,
      messages: request.messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content })),
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 1024,
    };

    const response = await this.fetchWithRetry(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    const usage = data.usage;
    const pricing = PRICING[this.modelId] ?? { input: 0, output: 0 };
    const cost =
      usage.input_tokens * pricing.input +
      usage.output_tokens * pricing.output;

    const textBlock = data.content.find(b => b.type === 'text');

    return {
      content: textBlock?.text ?? '',
      tokenUsage: {
        prompt: usage.input_tokens,
        completion: usage.output_tokens,
        total: usage.input_tokens + usage.output_tokens,
      },
      cost,
      latencyMs: Date.now() - start,
      modelId: data.model ?? this.modelId,
    };
  }

  async isAvailable(): Promise<boolean> {
    // Anthropic doesn't have a dedicated /models endpoint; probe with a minimal request
    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(5000),
      });
      return res.status !== 401;
    } catch {
      return false;
    }
  }

  getContextLimit(): number { return 200_000; }

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
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    }
    throw lastError;
  }
}
