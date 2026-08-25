import { ModelAdapter } from '../model-adapter';
import { ChatRequest, ChatResponse, ChatMessage } from '../../../shared/types';
import * as http from 'http';

export interface OllamaConfig {
  baseUrl?: string;
  modelId?: string;
}

export class OllamaAdapter implements ModelAdapter {
  readonly providerId = 'ollama';
  public modelId: string;
  private baseUrl: string;

  constructor(config: OllamaConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://127.0.0.1:11434';
    this.modelId = config.modelId || 'llama3.1:8b';
  }

  getContextLimit(): number {
    return 8192;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return false;
      const data = await response.json();
      return data.models?.some((m: any) => m.name === this.modelId || m.name.startsWith(this.modelId)) || false;
    } catch {
      return false;
    }
  }

  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch {
      return [];
    }
  }

  async pullModel(modelName: string, onProgress?: (progress: number) => void): Promise<void> {
    // Basic implementation of pull model
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.total && data.completed && onProgress) {
            onProgress(data.completed / data.total);
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const formattedMessages = [
      { role: 'system', content: request.systemPrompt },
      ...request.messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const body = {
      model: this.modelId,
      messages: formattedMessages,
      stream: false,
      options: {
        temperature: request.temperature || 0.1,
      }
    };

    const start = Date.now();
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.message?.content || '';
    
    return {
      content,
      tokenUsage: {
        prompt: data.prompt_eval_count || this.estimateTokens(request.systemPrompt + request.messages.map(m => m.content).join('')),
        completion: data.eval_count || this.estimateTokens(content),
        total: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      },
      latencyMs: Date.now() - start,
      cost: 0,
      modelId: this.modelId,
    };
  }
}
