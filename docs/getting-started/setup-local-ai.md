# Setting Up Local AI with Ollama

Sentry is built from the ground up to support **local-first AI execution**. By pairing Sentry with Ollama, you can run autonomous web agents entirely on your local machine with zero data leaving your device.

---

## Why Run Local AI?

- **100% Data Privacy:** Browser sessions, page content, and form data never touch cloud servers.
- **Zero API Costs:** No token billing or recurring subscriptions.
- **Offline Operation:** Execute web automation tasks on intranets or without internet access.

---

## Step 1: Install Ollama

1. Download Ollama for your operating system from [ollama.com](https://ollama.com).
2. Install and launch the Ollama service.
3. Verify Ollama is running in your terminal:
   ```bash
   ollama --version
   ```

---

## Step 2: Download Recommended Models

For browser reasoning and DOM navigation, we recommend models with strong tool-use and instruction-following capabilities:

```bash
# Recommended default (8B parameters, fast and accurate):
ollama pull llama3.1:8b

# Or Qwen 2.5 (excellent coding and structured JSON support):
ollama pull qwen2.5:7b

# For high-end GPUs (14B or 70B):
ollama pull qwen2.5:14b
```

---

## Step 3: Connect Sentry to Ollama

1. Open Sentry and navigate to **Settings** (`Ctrl + ,` or click the gear icon in the toolbar).
2. Click **Model Settings**.
3. Under **Local Inference Engine**, Sentry will automatically detect `http://localhost:11434`.
4. From the **Local Model** dropdown, select your installed model (e.g. `llama3.1:8b`).
5. Choose your **Routing Mode**:
   - `Local Only`: Never call cloud providers, even for complex tasks.
   - `Hybrid (Cost/Security Aware)`: Use local models for sensitive or read-heavy pages, fall back to cloud only when requested.
6. Click **Save Configuration**.

The cloud usage meter in Sentry's toolbar will display a green **Local** badge indicating zero cloud token expenditure.

