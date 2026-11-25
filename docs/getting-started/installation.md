# Installation Guide

Sentry is available as a native desktop application for Windows, macOS, and Linux.

---

## System Requirements

- **Operating System:**
  - **Windows:** Windows 10 or Windows 11 (64-bit)
  - **macOS:** macOS 12 (Monterey) or later (Apple Silicon M1/M2/M3 or Intel 64-bit)
  - **Linux:** Ubuntu 20.04+, Debian 11+, Fedora 36+, or compatible 64-bit distribution
- **Memory (RAM):**
  - 4 GB RAM minimum for cloud model usage
  - 16 GB+ recommended if running local LLMs (Ollama with 7B+ models)
- **Disk Space:**
  - 500 MB for browser installation
  - 5–15 GB additional if downloading local Ollama weights

---

## Windows Installation

1. Download `Sentry-Setup-1.0.0.exe` from the official [GitHub Releases](https://github.com/sentry-browser/sentry/releases).
2. Run the installer executable.
3. Choose your installation path and choose whether to create desktop and Start Menu shortcuts.
4. Launch **Sentry** from your Start Menu or Desktop.

> **Portable Windows Version:** If you prefer not to install system-wide, download `Sentry-1.0.0-portable.exe` which runs directly from any folder or USB drive.

---

## macOS Installation

1. Download the `.dmg` matching your architecture:
   - Apple Silicon (M1/M2/M3/M4): `Sentry-1.0.0-arm64.dmg`
   - Intel processors: `Sentry-1.0.0-x64.dmg`
2. Open the downloaded `.dmg` file.
3. Drag the **Sentry** application icon into your `/Applications` folder.
4. Launch Sentry from Launchpad or Spotlight (`Cmd + Space`).

---

## Linux Installation

### AppImage (Universal)
```bash
chmod +x Sentry-1.0.0.AppImage
./Sentry-1.0.0.AppImage
```

### Debian / Ubuntu (.deb)
```bash
sudo dpkg -i sentry_1.0.0_amd64.deb
sudo apt-get install -f # resolve any missing dependencies if needed
```

### Fedora / RHEL (.rpm)
```bash
sudo rpm -ivh sentry-1.0.0.x86_64.rpm
```

---

## Automatic Updates

Sentry includes an automatic update system powered by `electron-updater`:
- Background update checks run every 4 hours.
- When an update is detected, an update notification will highlight the new version and changelog.
- You can review what changed and click **Download & Install**, **Later**, or **Skip This Version**.

