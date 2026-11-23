# Chrome Extension Support

Sentry is built upon Electron with Chromium runtime capabilities, including support for standard Chrome extensions.

---

## Supported Extensions

- **Ad & Tracker Blockers:** uBlock Origin, Privacy Badger
- **Password Managers:** 1Password, Bitwarden
- **Developer Tools:** React Developer Tools, Redux DevTools

---

## Installing & Managing Extensions

1. Open **Settings → Extensions** (`sentry://extensions`).
2. Click **Load Unpacked Extension** to select an unpacked extension folder from your disk.
3. Toggle extensions on or off individually.
4. Extension background scripts run within Electron's extension sandbox and do not interfere with the Action Firewall or Agent CDP observer.

