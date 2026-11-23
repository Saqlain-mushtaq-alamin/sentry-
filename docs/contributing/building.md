# Building from Source

This guide explains how to clone, install dependencies, compile, and run Sentry locally.

---

## Prerequisites

- **Node.js:** v20.x or higher LTS
- **npm:** v10.x or higher
- **Git**
- **C/C++ Build Tools:**
  - **Windows:** Visual Studio Build Tools (C++ workload) or `npm install --global windows-build-tools`
  - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
  - **Linux:** `build-essential`, `libsecret-1-dev`

---

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sentry-browser/sentry.git
   cd sentry
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   This runs Vite dev server for the renderer and compiles TypeScript for the main process concurrently.

4. **Production Build:**
   ```bash
   npm run build
   ```

5. **Package Installers:**
   ```bash
   npm run package          # Current platform
   npm run package:win      # Windows installer
   npm run package:mac      # macOS DMG and zip
   npm run package:linux    # Linux AppImage/deb/rpm
   ```

