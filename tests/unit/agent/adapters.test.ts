import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAIAdapter } from '../../../src/main/agent/adapters/openai-adapter';
import { AnthropicAdapter } from '../../../src/main/agent/adapters/anthropic-adapter';
import { OllamaAdapter } from '../../../src/main/agent/adapters/ollama-adapter';
import { ChatRequest } from '../../../src/shared/types';

const BASE = 'http://localhost:9999/v1';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

const request: ChatRequest = {
  systemPrompt: 'You are helpful.',
  messages: [
    { role: 'system', content: 'inline system message' },
    { role: 'user', content: 'Hello there' },
  ],
  temperature: 0.1,
  maxTokens: 128,
  responseFormat: 'json',
};

describe('OpenAIAdapter', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('chat() POSTs to /chat/completions and parses content, token usage, and cost', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      model: 'gpt-4o-mini-2024-07-18',
    }));

    const adapter = new OpenAIAdapter('sk-test', 'gpt-4o-mini', BASE);
    const res = await adapter.chat(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/chat/completions`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are helpful.' });
    expect(body.messages[1]).toEqual({ role: 'system', content: 'inline system message' });
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.temperature).toBe(0.1);
    expect(body.max_tokens).toBe(128);

    expect(res.content).toBe('{"ok":true}');
    expect(res.tokenUsage).toEqual({ prompt: 10, completion: 5, total: 15 });
    // gpt-4o-mini pricing: 10 * 0.00000015 + 5 * 0.0000006
    expect(res.cost).toBeCloseTo(4.5e-6, 12);
    expect(res.modelId).toBe('gpt-4o-mini-2024-07-18');
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('chat() throws a descriptive error on a non-retryable 4xx response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'bad request' }, 400));
    const adapter = new OpenAIAdapter('sk-test', 'gpt-4o', BASE);
    await expect(adapter.chat(request)).rejects.toThrow('OpenAI API error (400)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('chat() retries after a 5xx response and succeeds on the second attempt', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'server exploded' }, 500))
      .mockResolvedValueOnce(jsonResponse({
        choices: [{ message: { content: 'recovered' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        model: 'gpt-4o',
      }));

    const adapter = new OpenAIAdapter('sk-test', 'gpt-4o', BASE);
    const pending = adapter.chat(request);
    await vi.advanceTimersByTimeAsync(1000); // first exponential-backoff delay
    const res = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.content).toBe('recovered');
  });

  it('isAvailable() returns true on ok and false on error or thrown network failure', async () => {
    const adapter = new OpenAIAdapter('sk-test', 'gpt-4o', BASE);

    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    expect(await adapter.isAvailable()).toBe(true);

    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, 401));
    expect(await adapter.isAvailable()).toBe(false);

    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await adapter.isAvailable()).toBe(false);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/models`);
  });

  it('estimateTokens and getContextLimit are sane', () => {
    const gpt4 = new OpenAIAdapter('sk-test', 'gpt-4o', BASE);
    expect(gpt4.estimateTokens('abcdefgh')).toBe(2);
    expect(gpt4.getContextLimit()).toBe(128_000);

    const gpt35 = new OpenAIAdapter('sk-test', 'gpt-3.5-turbo', BASE);
    expect(gpt35.getContextLimit()).toBe(16_385);
  });
});

describe('AnthropicAdapter', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('chat() POSTs to /messages, passes systemPrompt as system, filters system messages, and parses usage', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      content: [{ type: 'text', text: 'Hi from Claude' }],
      usage: { input_tokens: 20, output_tokens: 10 },
      model: 'claude-sonnet-5-5',
    }));

    const adapter = new AnthropicAdapter('sk-ant', 'claude-sonnet-5-5', BASE);
    const res = await adapter.chat(request);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/messages`);
    expect(init.headers['x-api-key']).toBe('sk-ant');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(init.body);
    expect(body.system).toBe('You are helpful.');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello there' }]);

    expect(res.content).toBe('Hi from Claude');
    expect(res.tokenUsage).toEqual({ prompt: 20, completion: 10, total: 30 });
    // claude-sonnet-5-5 pricing: 20 * 0.000003 + 10 * 0.000015
    expect(res.cost).toBeCloseTo(2.1e-4, 12);
    expect(res.modelId).toBe('claude-sonnet-5-5');
  });

  it('chat() throws a descriptive error on a non-retryable 4xx response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'overloaded' }, 400));
    const adapter = new AnthropicAdapter('sk-ant', 'claude-sonnet-5-5', BASE);
    await expect(adapter.chat(request)).rejects.toThrow('Anthropic API error (400)');
  });

  it('isAvailable() is true unless the probe returns 401', async () => {
    const adapter = new AnthropicAdapter('sk-ant', 'claude-sonnet-5-5', BASE);

    fetchMock.mockResolvedValue(jsonResponse({}, 200));
    expect(await adapter.isAvailable()).toBe(true);

    fetchMock.mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401));
    expect(await adapter.isAvailable()).toBe(false);

    fetchMock.mockResolvedValue(jsonResponse({ error: 'server' }, 500));
    expect(await adapter.isAvailable()).toBe(true);

    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await adapter.isAvailable()).toBe(false);
  });

  it('estimateTokens and getContextLimit are sane', () => {
    const adapter = new AnthropicAdapter('sk-ant', 'claude-sonnet-5-5', BASE);
    expect(adapter.estimateTokens('abcdefgh')).toBe(2);
    expect(adapter.getContextLimit()).toBe(200_000);
  });
});

describe('OllamaAdapter', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const OLLAMA_BASE = 'http://localhost:11434';

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isAvailable() returns true when the target model is listed', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ models: [{ name: 'qwen3:8b' }] }));
    const adapter = new OllamaAdapter({ baseUrl: OLLAMA_BASE, modelId: 'qwen3:8b' });
    expect(await adapter.isAvailable()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(`${OLLAMA_BASE}/api/tags`);
  });

  it('isAvailable() returns false on empty model list, non-ok response, or network error', async () => {
    const adapter = new OllamaAdapter({ baseUrl: OLLAMA_BASE, modelId: 'qwen3:8b' });

    fetchMock.mockResolvedValue(jsonResponse({ models: [] }));
    expect(await adapter.isAvailable()).toBe(false);

    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    expect(await adapter.isAvailable()).toBe(false);

    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await adapter.isAvailable()).toBe(false);
  });

  it('listAvailableModels() returns the model names', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ models: [{ name: 'qwen3:8b' }, { name: 'llama3:8b' }] }));
    const adapter = new OllamaAdapter({ baseUrl: OLLAMA_BASE });
    expect(await adapter.listAvailableModels()).toEqual(['qwen3:8b', 'llama3:8b']);
  });

  it('listAvailableModels() returns [] on failure', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const adapter = new OllamaAdapter({ baseUrl: OLLAMA_BASE });
    expect(await adapter.listAvailableModels()).toEqual([]);
  });

  it('chat() POSTs to /api/chat with JSON and returns content and modelId at zero cost', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      message: { role: 'assistant', content: '{"thought":"t","action":{"type":"click","reason":"r"}}' },
      prompt_eval_count: 30,
      eval_count: 12,
    }));

    const adapter = new OllamaAdapter({ baseUrl: OLLAMA_BASE, modelId: 'qwen3:8b' });
    const res = await adapter.chat({ ...request, responseFormat: 'json' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${OLLAMA_BASE}/api/chat`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('qwen3:8b');
    expect(body.stream).toBe(false);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are helpful.' });
    expect(body.format).toBeDefined();

    expect(res.content).toContain('"type":"click"');
    expect(res.modelId).toBe('qwen3:8b');
    expect(res.tokenUsage).toEqual({ prompt: 30, completion: 12, total: 42 });
    expect(res.cost).toBe(0);
  });

  it('estimateTokens and getContextLimit are sane', () => {
    const adapter = new OllamaAdapter({ modelId: 'qwen3:8b' });
    expect(adapter.estimateTokens('abcdefgh')).toBe(2);
    expect(adapter.getContextLimit()).toBe(16384);
  });
});
