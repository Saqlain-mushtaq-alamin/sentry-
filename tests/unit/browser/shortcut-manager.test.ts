import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({ BrowserWindow: class {} }));

import { ShortcutManager } from '../../../src/main/browser/shortcut-manager';

describe('ShortcutManager', () => {
  it('registerShortcuts is a safe no-op that never touches the window', () => {
    const mockWindow = {
      on: vi.fn(),
      webContents: { send: vi.fn() },
      isDestroyed: vi.fn(() => false),
    };

    const manager = new ShortcutManager(mockWindow as any);

    expect(() => manager.registerShortcuts()).not.toThrow();
    expect(mockWindow.on).not.toHaveBeenCalled();
    expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    expect(mockWindow.isDestroyed).not.toHaveBeenCalled();
  });
});
