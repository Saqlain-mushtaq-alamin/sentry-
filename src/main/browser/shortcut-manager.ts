import { BrowserWindow } from 'electron';

export class ShortcutManager {
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  public registerShortcuts(): void {
    // Shortcuts are primarily handled in the renderer window via keydown listeners,
    // sending IPC commands for tabs and navigation.
  }
}
