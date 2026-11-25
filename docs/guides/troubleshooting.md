# Troubleshooting Guide

Solutions to common issues encountered when running Sentry.

---

## 1. Local AI (Ollama) Connection Issues

**Symptoms:** Error message: *"Failed to connect to Ollama at http://localhost:11434"*.

**Fixes:**
1. Check that the Ollama service is running:
   ```bash
   curl http://localhost:11434/api/tags
   ```
2. If running on Windows, verify that Ollama is in your system tray or restart the service from PowerShell:
   ```powershell
   ollama serve
   ```
3. If running Ollama inside Docker or WSL2, ensure `OLLAMA_ORIGINS="*"` is set so localhost requests are accepted.

---

## 2. Model Context / Timeout Errors

**Symptoms:** Complex pages cause the agent to hang or fail with a timeout error.

**Fixes:**
1. In **Settings → Advanced**, enable **DOM Token Trimming** to reduce large DOM payload overhead.
2. Switch to a model with a larger context window (e.g. `llama3.1:8b` supports 128k context, Claude 3.5 Sonnet supports 200k).
3. If using slow hardware, increase the **Agent Step Timeout** setting from 30s to 60s.

---

## 3. High CPU or Memory Usage

**Symptoms:** High RAM consumption with multiple tabs open.

**Fixes:**
1. Sentry includes an automatic **Tab Unloader** that frees inactive background tabs after 15 minutes of inactivity.
2. In **Settings → Performance**, lower the background tab memory threshold or configure aggressive tab hibernation.

