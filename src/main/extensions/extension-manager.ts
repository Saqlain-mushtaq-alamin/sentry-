import { session, Extension } from 'electron';
import { ElectronChromeExtensions } from 'electron-chrome-extensions';
import { TabManager } from '../browser/tab-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { LoadedExtension } from '../../shared/types';

export class ExtensionManager {
  private chromeExtensions: ElectronChromeExtensions | null = null;
  private loadedExtensions: Map<string, LoadedExtension> = new Map();
  private tabManager: TabManager;

  constructor(tabManager: TabManager) {
    this.tabManager = tabManager;
  }

  public initialize(ses: Electron.Session = session.defaultSession): void {
    this.chromeExtensions = new ElectronChromeExtensions({
      session: ses,
      license: 'GPL-3.0',
      createTab: (details: any) => {
        const tab = this.tabManager.createTab(details.url || 'https://google.com');
        return { id: tab.id, url: tab.url, active: true } as any;
      },
      selectTab: (tab: any, browserWindow: any) => {
        this.tabManager.switchTab(tab.id);
      },
      removeTab: (tab: any, browserWindow: any) => {
        this.tabManager.closeTab(tab.id);
      },
      createWindow: (details: any) => {
        // Mock window creation for now, returning dummy window info
        return { id: 1, tabs: [] } as any;
      },
      removeWindow: (window: any) => {
        // Handle window removal if needed
      }
    });

    console.log('[ExtensionManager] Initialized Chrome Extension compatibility layer');
  }

  public async loadExtension(extensionPath: string): Promise<LoadedExtension> {
    try {
      const extension = await session.defaultSession.loadExtension(extensionPath, { allowFileAccess: true });
      
      const loaded: LoadedExtension = {
        id: extension.id,
        name: extension.name,
        version: extension.version,
        manifestVersion: extension.manifest.manifest_version || 2,
        permissions: (extension.manifest.permissions as string[]) || [],
        isEnabled: true,
        installPath: extension.path,
      };
      
      this.loadedExtensions.set(loaded.id, loaded);
      console.log(`[ExtensionManager] Loaded extension: ${loaded.name} (${loaded.id})`);
      return loaded;
    } catch (err) {
      console.error(`[ExtensionManager] Failed to load extension from ${extensionPath}:`, err);
      throw err;
    }
  }

  public async unloadExtension(id: string): Promise<void> {
    const ext = this.loadedExtensions.get(id);
    if (!ext) throw new Error(`Extension ${id} not found`);
    
    session.defaultSession.removeExtension(id);
    this.loadedExtensions.delete(id);
    console.log(`[ExtensionManager] Unloaded extension: ${id}`);
  }

  public getExtensions(): LoadedExtension[] {
    return Array.from(this.loadedExtensions.values());
  }

  public async toggleExtension(id: string, enabled: boolean): Promise<void> {
    const ext = this.loadedExtensions.get(id);
    if (!ext) throw new Error(`Extension ${id} not found`);
    
    if (enabled && !ext.isEnabled) {
      await this.loadExtension(ext.installPath);
    } else if (!enabled && ext.isEnabled) {
      await this.unloadExtension(id);
      ext.isEnabled = false;
      this.loadedExtensions.set(id, ext); // Keep metadata but marked disabled
    }
  }
}
