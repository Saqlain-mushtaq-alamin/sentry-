# 🛡️ Sentry Agentic Browser

> **Sentry** is a modern, high-performance, security-focused agentic web browser built with **Electron**, **React**, **TypeScript**, and **Puppeteer Core (CDP)**.

---

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) and `npm` installed on your machine.

### 2. Install Dependencies
```bash
npm install
```

### 3. Run in Development Mode
To launch the browser shell locally in development mode (with Vite Hot Module Replacement & TypeScript compilation):

```bash
npm run dev
```

```bash
cd D:\canvas\Sentry
npm install
npm run dev 

```

---

## 🛠️ Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite dev server and launches Electron with live reloads |
| `npm run build` | Compiles both Renderer (Vite React) and Main (TSC) for production |
| `npm run typecheck` | Validates TypeScript types across both main and renderer processes |
| `npm run lint` | Runs ESLint for strict code quality and formatting checks |
| `npm run test` | Executes unit test suite using Vitest |
| `npm run test:watch` | Runs unit tests in watch mode |
| `npm run test:e2e` | Runs end-to-end integration tests with Playwright |
| `npm run package` | Builds production-ready standalone executables via `electron-builder` |

---

## 🎹 Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + T` | Open a new tab |
| `Ctrl + W` | Close the active tab |
| `Ctrl + 1` .. `Ctrl + 9` | Switch to tab by position index |
| `Ctrl + R` / `F5` | Reload the current tab |
| `Ctrl + D` | Bookmark / un-bookmark current page |
| `Ctrl + H` | Open Browsing History page |
| `Ctrl + J` | Open Downloads Manager page |
| `Ctrl + ,` | Open Settings page |

---

## 🏗️ Architecture & Features

- **Electron + WebContentsView**: Built using Electron's modern view architecture for tab management and secure process isolation.
- **CDP Engine**: Native Chrome DevTools Protocol integration via Puppeteer Core for high-speed accessibility tree extraction and AI agent interactions.
- **Vite + React UI**: Glassmorphic, dark-mode browser interface (`TabBar`, `AddressBar`, `BookmarksBar`, `NewTab`, `History`, `Settings`, `Downloads`).
- **Encrypted Local Storage**: Persistent history, bookmarks, user preferences, and download logs.
