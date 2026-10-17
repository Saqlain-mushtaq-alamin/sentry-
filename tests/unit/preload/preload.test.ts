import { describe, it, expect, beforeEach, vi } from 'vitest';

const electronMock = vi.hoisted(() => ({
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn().mockResolvedValue('ok'),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

vi.mock('electron', () => electronMock);

import '../../../src/preload/index';

type Api = Record<string, any>;

describe('preload bridge (src/preload/index.ts)', () => {
  let api: Api;

  beforeAll(() => {
    const call = electronMock.contextBridge.exposeInMainWorld.mock.calls[0];
    expect(call?.[0]).toBe('sentry');
    api = call![1] as Api;
  });

  beforeEach(() => {
    electronMock.ipcRenderer.invoke.mockClear();
    electronMock.ipcRenderer.on.mockClear();
    electronMock.ipcRenderer.removeListener.mockClear();
  });

  it('exposes the sentry API exactly once via contextBridge', () => {
    expect(electronMock.contextBridge.exposeInMainWorld).toHaveBeenCalledTimes(1);
  });

  it('exposes all top-level namespaces', () => {
    for (const ns of [
      'window',
      'tabs',
      'nav',
      'bookmarks',
      'history',
      'downloads',
      'settings',
      'view',
      'trust',
      'secrets',
      'voice',
      'agent',
      'extensions',
    ]) {
      expect(api[ns], `namespace ${ns}`).toBeDefined();
      expect(typeof api[ns]).toBe('object');
    }
  });

  describe('invoke channel wiring', () => {
    it('window controls', () => {
      api.window.minimize();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('window:minimize');

      api.window.maximize();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('window:maximize');

      api.window.close();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('window:close');
    });

    it('tabs.create → tabs:create with the url argument', async () => {
      await api.tabs.create('https://example.com');

      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('tabs:create', 'https://example.com');
    });

    it('tabs lifecycle channels', () => {
      api.tabs.getAll();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('tabs:get-all');

      api.tabs.close('tab-1');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('tabs:close', 'tab-1');

      api.tabs.switch('tab-1');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('tabs:switch', 'tab-1');

      api.tabs.reorder(['a', 'b']);
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('tabs:reorder', ['a', 'b']);

      api.tabs.duplicate('tab-1');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('tabs:duplicate', 'tab-1');

      api.tabs.togglePin('tab-1');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('tabs:toggle-pin', 'tab-1');
    });

    it('navigation channels', () => {
      api.nav.navigate('tab-1', 'https://example.com');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('nav:navigate', 'tab-1', 'https://example.com');

      api.nav.goBack('tab-1');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('nav:go-back', 'tab-1');

      api.nav.goForward('tab-1');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('nav:go-forward', 'tab-1');

      api.nav.reload('tab-1');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('nav:reload', 'tab-1');

      api.nav.setZoom('tab-1', 1.5);
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('nav:set-zoom', 'tab-1', 1.5);
    });

    it('bookmarks channels', () => {
      api.bookmarks.getAll();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('bookmarks:get-all');

      api.bookmarks.add({ title: 'X', url: 'https://x.com' });
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('bookmarks:add', { title: 'X', url: 'https://x.com' });

      api.bookmarks.remove('bm-1');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('bookmarks:remove', 'bm-1');

      api.bookmarks.isBookmarked('https://x.com');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('bookmarks:is-bookmarked', 'https://x.com');
    });

    it('history channels', () => {
      api.history.getAll('query');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('history:get-all', 'query');

      api.history.clear();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('history:clear');

      api.history.removeEntry('his-1');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('history:remove-entry', 'his-1');
    });

    it('downloads channels', () => {
      api.downloads.getAll();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('downloads:get-all');

      api.downloads.openFile('/tmp/a.pdf');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('downloads:open-file', '/tmp/a.pdf');

      api.downloads.openFolder('/tmp/a.pdf');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('downloads:open-folder', '/tmp/a.pdf');
    });

    it('settings.update → settings:update', () => {
      api.settings.get();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('settings:get');

      api.settings.update({ theme: 'light' });
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('settings:update', { theme: 'light' });
    });

    it('view layout channels', () => {
      api.view.setLayoutOffsets({ topOffset: 100 });
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('view:set-layout-offsets', { topOffset: 100 });

      api.view.setBounds({ x: 0, y: 0, width: 100, height: 100 });
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('view:set-bounds', {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });

      api.view.setHidden(true);
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('view:set-hidden', true);
    });

    it('agent.runTask → agent:run-task', () => {
      api.agent.runTask('summarize this page');

      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('agent:run-task', 'summarize this page');
    });

    it('agent control channels', () => {
      api.agent.pause();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('agent:pause');

      api.agent.resume();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('agent:resume');

      api.agent.stop();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('agent:stop');

      api.agent.getHistory();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('agent:get-history');

      api.agent.forgetSite('example.com');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('agent:forget-site', 'example.com');

      api.agent.speak('hello');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('agent:speak', 'hello', 'normal');

      api.agent.speak('hurry', 'urgent');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('agent:speak', 'hurry', 'urgent');

      api.agent.stopSpeech();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('agent:stop-speech');
    });

    it('agent.respondConfirmation → agent:confirm:<id> with the response', () => {
      api.agent.respondConfirmation('action-7', 'deny');

      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('agent:confirm:action-7', 'deny');

      api.agent.respondConfirmation('action-8', 'allow_once');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('agent:confirm:action-8', 'allow_once');
    });

    it('voice.transcribe → voice:transcribe with audio and mime', () => {
      const audio = new ArrayBuffer(8);

      api.voice.transcribe(audio, 'audio/webm');

      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('voice:transcribe', audio, 'audio/webm');
    });

    it('trust channels', () => {
      api.trust.getAll();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('trust:get-all');

      api.trust.setLevel('example.com', 'trusted');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('trust:set-level', 'example.com', 'trusted');

      api.trust.remove('example.com');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('trust:remove', 'example.com');

      api.trust.getDefaults();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('trust:get-defaults');
    });

    it('secrets channels', () => {
      api.secrets.set('api-key', 'secret');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('secrets:set', 'api-key', 'secret');

      api.secrets.has('api-key');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('secrets:has', 'api-key');
    });

    it('extensions channels', () => {
      api.extensions.getAll();
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('extensions:get-all');

      api.extensions.load('/path/to/ext');
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('extensions:load', '/path/to/ext');

      api.extensions.toggle('ext-1', false);
      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith('extensions:toggle', 'ext-1', false);
    });
  });

  describe('event subscriptions', () => {
    it('onTabsUpdated registers a listener and returns an unsubscribe function', () => {
      const cb = vi.fn();

      const unsubscribe = api.onTabsUpdated(cb);

      expect(typeof unsubscribe).toBe('function');
      expect(electronMock.ipcRenderer.on).toHaveBeenCalledWith('tabs:updated', expect.any(Function));

      const handler = electronMock.ipcRenderer.on.mock.calls[0]![1];
      handler({}, [{ id: 'tab-1' }]);
      expect(cb).toHaveBeenCalledWith([{ id: 'tab-1' }]);

      unsubscribe();
      expect(electronMock.ipcRenderer.removeListener).toHaveBeenCalledWith('tabs:updated', handler);
    });

    it('onDownloadsUpdated wires downloads:updated with unsubscribe', () => {
      const unsubscribe = api.onDownloadsUpdated(vi.fn());

      expect(electronMock.ipcRenderer.on).toHaveBeenCalledWith('downloads:updated', expect.any(Function));

      unsubscribe();
      expect(electronMock.ipcRenderer.removeListener).toHaveBeenCalledWith('downloads:updated', expect.any(Function));
    });

    it('onInternalPageReload wires tabs:reload-internal with unsubscribe', () => {
      const cb = vi.fn();
      const unsubscribe = api.onInternalPageReload(cb);

      const handler = electronMock.ipcRenderer.on.mock.calls[0]![1];
      handler({}, 'sentry://settings');
      expect(cb).toHaveBeenCalledWith('sentry://settings');

      unsubscribe();
      expect(electronMock.ipcRenderer.removeListener).toHaveBeenCalledWith('tabs:reload-internal', handler);
    });

    it('agent shortcut listeners all return unsubscribe functions', () => {
      for (const [name, channel] of [
        ['onToggleCommandBox', 'agent:toggle-command-box'],
        ['onShortcutPauseResume', 'agent:shortcut-pause-resume'],
        ['onShortcutStop', 'agent:shortcut-stop'],
        ['onActionLogged', 'agent:action-logged'],
        ['onStateChanged', 'agent:state-changed'],
        ['onInjectionDetected', 'agent:injection-detected'],
        ['onConfirmationRequired', 'agent:confirmation-required'],
      ] as const) {
        const unsubscribe = api.agent[name](vi.fn());
        expect(typeof unsubscribe).toBe('function');
        expect(electronMock.ipcRenderer.on).toHaveBeenCalledWith(channel, expect.any(Function));
        unsubscribe();
        expect(electronMock.ipcRenderer.removeListener).toHaveBeenCalledWith(channel, expect.any(Function));
      }
    });
  });
});
