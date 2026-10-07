import { ipcMain } from 'electron';

export function handle<T>(channel: string, fn: (...args: any[]) => T | Promise<T>): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      const result = await fn(...args);
      return { ok: true, data: result };
    } catch (err: any) {
      console.error(`[IPC ${channel}]`, err);
      return { ok: false, error: err?.message ?? String(err) };
    }
  });
}
