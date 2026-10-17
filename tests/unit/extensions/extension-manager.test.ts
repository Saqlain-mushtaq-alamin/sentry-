import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadExtension: vi.fn(),
  removeExtension: vi.fn(),
  chromeCtorArgs: [] as unknown[],
}));

vi.mock('electron', () => ({
  session: {
    defaultSession: {
      loadExtension: mocks.loadExtension,
      removeExtension: mocks.removeExtension,
    },
  },
}));

vi.mock('electron-chrome-extensions', () => ({
  ElectronChromeExtensions: class {
    constructor(options: unknown) {
      mocks.chromeCtorArgs.push(options);
    }
  },
}));

import { ExtensionManager } from '../../../src/main/extensions/extension-manager';
import type { TabManager } from '../../../src/main/browser/tab-manager';

const EXTENSION_FIXTURE = {
  id: 'ext1',
  name: 'uBlock Origin',
  version: '1.0.0',
  path: '/extensions/ublock',
  manifest: { manifest_version: 3, permissions: ['tabs', 'storage'] },
};

describe('ExtensionManager', () => {
  let tabManager: {
    createTab: ReturnType<typeof vi.fn>;
    switchTab: ReturnType<typeof vi.fn>;
    closeTab: ReturnType<typeof vi.fn>;
  };
  let manager: ExtensionManager;

  beforeEach(() => {
    mocks.loadExtension.mockReset();
    mocks.removeExtension.mockReset();
    mocks.chromeCtorArgs.length = 0;
    mocks.loadExtension.mockResolvedValue(EXTENSION_FIXTURE);

    tabManager = {
      createTab: vi.fn((url: string) => ({ id: 'tab-1', url })),
      switchTab: vi.fn(),
      closeTab: vi.fn(),
    };
    manager = new ExtensionManager(tabManager as unknown as TabManager);
  });

  describe('initialize', () => {
    it('constructs the Chrome extensions layer with tab callbacks wired to TabManager', () => {
      expect(() => manager.initialize({} as any)).not.toThrow();
      expect(mocks.chromeCtorArgs).toHaveLength(1);

      const options = mocks.chromeCtorArgs[0] as any;
      expect(options.session).toEqual({});
      expect(options.license).toBe('GPL-3.0');

      const created = options.createTab({ url: 'https://ext-page.example.com' });
      expect(tabManager.createTab).toHaveBeenCalledWith('https://ext-page.example.com');
      expect(created).toEqual({ id: 'tab-1', url: 'https://ext-page.example.com', active: true });

      // extension-initiated new tab without a url falls back to google.com
      options.createTab({});
      expect(tabManager.createTab).toHaveBeenCalledWith('https://google.com');

      options.selectTab({ id: 'tab-1' }, {});
      expect(tabManager.switchTab).toHaveBeenCalledWith('tab-1');

      options.removeTab({ id: 'tab-1' }, {});
      expect(tabManager.closeTab).toHaveBeenCalledWith('tab-1');

      expect(options.createWindow({})).toEqual({ id: 1, tabs: [] });
      expect(() => options.removeWindow({})).not.toThrow();
    });

    it('uses session.defaultSession by default without throwing', () => {
      expect(() => manager.initialize()).not.toThrow();
      expect(mocks.chromeCtorArgs).toHaveLength(1);
    });
  });

  describe('loadExtension / getExtensions', () => {
    it('maps the electron extension object into a LoadedExtension and lists it', async () => {
      const loaded = await manager.loadExtension('/extensions/ublock');

      expect(mocks.loadExtension).toHaveBeenCalledWith('/extensions/ublock', { allowFileAccess: true });
      expect(loaded).toEqual({
        id: 'ext1',
        name: 'uBlock Origin',
        version: '1.0.0',
        manifestVersion: 3,
        permissions: ['tabs', 'storage'],
        isEnabled: true,
        installPath: '/extensions/ublock',
      });
      expect(manager.getExtensions()).toEqual([loaded]);
    });

    it('defaults to manifest v2 and empty permissions when absent', async () => {
      mocks.loadExtension.mockResolvedValue({ id: 'ext2', name: 'Minimal', version: '0.1', path: '/p2', manifest: {} });

      const loaded = await manager.loadExtension('/p2');

      expect(loaded.manifestVersion).toBe(2);
      expect(loaded.permissions).toEqual([]);
    });

    it('rethrows when electron fails to load the extension', async () => {
      mocks.loadExtension.mockRejectedValue(new Error('invalid manifest'));

      await expect(manager.loadExtension('/bad')).rejects.toThrow('invalid manifest');
      expect(manager.getExtensions()).toEqual([]);
    });
  });

  describe('unloadExtension', () => {
    it('throws for an unknown extension id', async () => {
      await expect(manager.unloadExtension('ghost')).rejects.toThrow('Extension ghost not found');
      expect(mocks.removeExtension).not.toHaveBeenCalled();
    });

    it('removes a known extension from the session and the registry', async () => {
      await manager.loadExtension('/extensions/ublock');

      await manager.unloadExtension('ext1');

      expect(mocks.removeExtension).toHaveBeenCalledWith('ext1');
      expect(manager.getExtensions()).toEqual([]);
    });
  });

  describe('toggleExtension', () => {
    it('throws for an unknown extension id', async () => {
      await expect(manager.toggleExtension('ghost', true)).rejects.toThrow('Extension ghost not found');
    });

    it('disable unloads via removeExtension but keeps the metadata as disabled', async () => {
      await manager.loadExtension('/extensions/ublock');

      await manager.toggleExtension('ext1', false);

      expect(mocks.removeExtension).toHaveBeenCalledWith('ext1');
      const [ext] = manager.getExtensions();
      expect(ext?.id).toBe('ext1');
      expect(ext?.isEnabled).toBe(false);
    });

    it('re-enable reloads the extension from its install path', async () => {
      await manager.loadExtension('/extensions/ublock');
      await manager.toggleExtension('ext1', false);
      mocks.loadExtension.mockClear();

      await manager.toggleExtension('ext1', true);

      expect(mocks.loadExtension).toHaveBeenCalledWith('/extensions/ublock', { allowFileAccess: true });
      const [ext] = manager.getExtensions();
      expect(ext?.isEnabled).toBe(true);
    });

    it('toggling an already-enabled extension to enabled is a no-op', async () => {
      await manager.loadExtension('/extensions/ublock');
      mocks.loadExtension.mockClear();

      await manager.toggleExtension('ext1', true);

      expect(mocks.loadExtension).not.toHaveBeenCalled();
      expect(mocks.removeExtension).not.toHaveBeenCalled();
    });
  });
});
