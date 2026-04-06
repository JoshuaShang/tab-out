# AGENTS.md — Tab Out Setup Instructions for Coding Agents

Tab Out replaces the Chrome new tab page with an AI-powered mission dashboard that groups open tabs into named clusters. It works with any OpenAI-compatible LLM API.

---

## Installation Flow

### Step 1 — Clone and install

```bash
git clone https://github.com/zarazhangrui/tab-out.git
cd tab-out
npm install
```

### Step 2 — Ask the user which LLM they want

Ask the user which LLM provider they'd like to use. Recommend DeepSeek for cost-effectiveness (fractions of a cent per call). Common choices:

- DeepSeek (recommended, cheapest)
- OpenAI
- Claude/Anthropic (needs an OpenAI-compatible proxy like OpenRouter)
- Gemini (needs an OpenAI-compatible proxy like OpenRouter)
- Grok/xAI
- Kimi/Moonshot
- GLM/Zhipu
- ByteDance Seed
- Minimax
- Ollama (fully local, free, no API key)
- Any other provider with an OpenAI-compatible API

Tab Out uses the `openai` npm package, so it works with any API that follows the OpenAI chat completions format. You need to configure the provider's `baseUrl` and a `model` name suitable for chat/classification tasks.

**IMPORTANT: Do NOT rely on your training data for base URLs or model names — they go stale.** Before configuring any provider, search the web for that provider's current API documentation to get the correct base URL and an appropriate model name. Model names and API endpoints change frequently.

### Step 3 — Get their API key securely

The API key is required (except for Ollama). Do NOT let the user skip this step or "add it later" — the AI features won't work without it.

**How to handle the API key:**
1. If the user doesn't have an API key yet, give them clear step-by-step instructions on how to get one from their chosen provider (search the web for current instructions if needed).
2. Once they have the key, write it directly to the config file `~/.mission-control/config.json`. Create the file with the correct config values and a placeholder for the key.
3. Open the config file for the user so they can paste the key themselves: `open ~/.mission-control/config.json` (macOS) or equivalent.
4. **NEVER ask the user to paste the API key in the chat.** Always have them paste it into the config file directly.
5. Do NOT offer "skip" or "add it later" as options. The key is required for the core feature to work.

### Step 4 — Write the config

Create `~/.mission-control/config.json` with their choices:

```json
{
  "apiKey": "their-api-key",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-chat",
  "port": 3456,
  "refreshIntervalMinutes": 30,
  "batchSize": 200,
  "historyDays": 7,
  "customPromptRules": ""
}
```

Replace `baseUrl` and `model` with the correct values for their chosen provider. Use a cheap/fast model — this is a classification task, not creative writing.

### Step 5 — Run the setup script

```bash
npm run install-service
```

This creates the data directory, logs directory, and installs a macOS Launch Agent so the server auto-starts on login.

### Step 6 — Mention custom prompt rules (optional)

Tell the user they can customize how tabs are grouped by setting `customPromptRules` in the config. This is plain text that gets appended to the AI clustering prompt. Examples:

- "Treat all social media as one mission called 'Doom Scrolling'."
- "Group GitHub tabs by repository name."
- "I'm a student — group tabs by course/subject."

They can always edit `~/.mission-control/config.json` later to add or change this.

### Step 7 — Install the Chrome extension

The user needs to do this manually in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder inside the cloned repo

Tell the user these steps clearly. You can open the extensions page for them:
```bash
open "chrome://extensions"
```

### Step 8 — Start and verify

```bash
npm start &
sleep 2
open http://localhost:3456
```

If the dashboard loads, installation is complete. The server will auto-start on future logins.

---

## Key Facts

- Config: `~/.mission-control/config.json`
- Logs: `~/.mission-control/logs/`
- Default port: `3456`
- The server auto-starts on login (macOS Launch Agent, Linux systemd, or Windows Startup script)
- Only tab titles and URLs are sent to the LLM — browsing history stays local
- The `openai` npm package handles all LLM communication — any OpenAI-compatible API works
