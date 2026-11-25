# Setting Up Cloud AI Providers

Sentry supports leading cloud LLM providers when maximum reasoning power or multimodal capabilities are required:
- **Anthropic Claude** (Claude 3.5 Sonnet, Claude 3 Haiku)
- **OpenAI** (GPT-4o, GPT-4o-mini)
- **Google Gemini** (Gemini 1.5 Pro, Gemini 1.5 Flash)

---

## Secure Key Storage with Electron `safeStorage`

API keys are **never stored in plaintext**. Sentry encrypts API keys on disk using Electron's native `safeStorage` API:
- **Windows:** DPAPI (Data Protection API)
- **macOS:** Keychain Services
- **Linux:** Secret Service API / libsecret

---

## Adding Your API Key

1. Open Sentry and navigate to **Settings** (`Ctrl + ,`).
2. Go to **Model Settings**.
3. Under **Cloud Providers**, select your provider:
   - **Anthropic:** Requires `ANTHROPIC_API_KEY` (format: `sk-ant-...`)
   - **OpenAI:** Requires `OPENAI_API_KEY` (format: `sk-...`)
   - **Google Gemini:** Requires `GEMINI_API_KEY`
4. Paste your API key into the secure input field.
5. Click **Verify & Save**. Sentry makes a lightweight ping to verify that the credentials are valid.
6. Select your default Cloud Model (e.g. `claude-3-5-sonnet-20241022` or `gpt-4o`).

---

## Setting Token and Budget Limits

To prevent accidental high token usage:
1. Under **Budget & Safety**, set a **Max Cost Per Task** (e.g. `$0.10`).
2. Set a **Monthly Token Ceiling** (e.g. `1,000,000 tokens`).
3. If an agent task reaches 80% of its budget, Sentry pauses execution and prompts for approval.

