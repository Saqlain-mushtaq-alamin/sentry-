import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '../../../src/shared/ipc';

describe('IPC_CHANNELS', () => {
  it('maps window, tab, navigation, bookmark, history and download channels to exact strings', () => {
    expect(IPC_CHANNELS.WINDOW_MINIMIZE).toBe('window:minimize');
    expect(IPC_CHANNELS.WINDOW_MAXIMIZE).toBe('window:maximize');
    expect(IPC_CHANNELS.WINDOW_CLOSE).toBe('window:close');

    expect(IPC_CHANNELS.TABS_GET_ALL).toBe('tabs:get-all');
    expect(IPC_CHANNELS.TABS_CREATE).toBe('tabs:create');
    expect(IPC_CHANNELS.TABS_CLOSE).toBe('tabs:close');
    expect(IPC_CHANNELS.TABS_SWITCH).toBe('tabs:switch');
    expect(IPC_CHANNELS.TABS_REORDER).toBe('tabs:reorder');
    expect(IPC_CHANNELS.TABS_UPDATED).toBe('tabs:updated');
    expect(IPC_CHANNELS.TABS_RELOAD_INTERNAL).toBe('tabs:reload-internal');

    expect(IPC_CHANNELS.NAV_NAVIGATE).toBe('nav:navigate');
    expect(IPC_CHANNELS.NAV_GO_BACK).toBe('nav:go-back');
    expect(IPC_CHANNELS.NAV_GO_FORWARD).toBe('nav:go-forward');
    expect(IPC_CHANNELS.NAV_RELOAD).toBe('nav:reload');
    expect(IPC_CHANNELS.NAV_SET_ZOOM).toBe('nav:set-zoom');

    expect(IPC_CHANNELS.BOOKMARKS_GET_ALL).toBe('bookmarks:get-all');
    expect(IPC_CHANNELS.BOOKMARKS_ADD).toBe('bookmarks:add');
    expect(IPC_CHANNELS.BOOKMARKS_REMOVE).toBe('bookmarks:remove');
    expect(IPC_CHANNELS.BOOKMARKS_IS_BOOKMARKED).toBe('bookmarks:is-bookmarked');

    expect(IPC_CHANNELS.HISTORY_GET_ALL).toBe('history:get-all');
    expect(IPC_CHANNELS.HISTORY_CLEAR).toBe('history:clear');
    expect(IPC_CHANNELS.HISTORY_REMOVE_ENTRY).toBe('history:remove-entry');

    expect(IPC_CHANNELS.DOWNLOADS_GET_ALL).toBe('downloads:get-all');
    expect(IPC_CHANNELS.DOWNLOADS_OPEN_FILE).toBe('downloads:open-file');
    expect(IPC_CHANNELS.DOWNLOADS_OPEN_FOLDER).toBe('downloads:open-folder');
    expect(IPC_CHANNELS.DOWNLOADS_UPDATED).toBe('downloads:updated');
  });

  it('maps settings, extensions, view, trust, secrets and voice channels to exact strings', () => {
    expect(IPC_CHANNELS.SETTINGS_GET).toBe('settings:get');
    expect(IPC_CHANNELS.SETTINGS_UPDATE).toBe('settings:update');

    expect(IPC_CHANNELS.EXTENSIONS_GET_ALL).toBe('extensions:get-all');
    expect(IPC_CHANNELS.EXTENSIONS_LOAD).toBe('extensions:load');
    expect(IPC_CHANNELS.EXTENSIONS_CHOOSE_AND_LOAD).toBe('extensions:choose-and-load');
    expect(IPC_CHANNELS.EXTENSIONS_UNLOAD).toBe('extensions:unload');
    expect(IPC_CHANNELS.EXTENSIONS_TOGGLE).toBe('extensions:toggle');

    expect(IPC_CHANNELS.VIEW_SET_LAYOUT_OFFSETS).toBe('view:set-layout-offsets');
    expect(IPC_CHANNELS.VIEW_SET_BOUNDS).toBe('view:set-bounds');
    expect(IPC_CHANNELS.VIEW_SET_HIDDEN).toBe('view:set-hidden');

    expect(IPC_CHANNELS.TRUST_GET_ALL).toBe('trust:get-all');
    expect(IPC_CHANNELS.TRUST_SET_LEVEL).toBe('trust:set-level');
    expect(IPC_CHANNELS.TRUST_REMOVE).toBe('trust:remove');
    expect(IPC_CHANNELS.TRUST_GET_DEFAULTS).toBe('trust:get-defaults');

    expect(IPC_CHANNELS.SECRETS_SET).toBe('secrets:set');
    expect(IPC_CHANNELS.SECRETS_HAS).toBe('secrets:has');

    expect(IPC_CHANNELS.VOICE_TRANSCRIBE).toBe('voice:transcribe');
  });

  it('maps agent control, recipe, benchmark, memory and event channels to exact strings', () => {
    expect(IPC_CHANNELS.AGENT_RUN_TASK).toBe('agent:run-task');
    expect(IPC_CHANNELS.AGENT_PAUSE).toBe('agent:pause');
    expect(IPC_CHANNELS.AGENT_RESUME).toBe('agent:resume');
    expect(IPC_CHANNELS.AGENT_STOP).toBe('agent:stop');
    expect(IPC_CHANNELS.AGENT_GET_HISTORY).toBe('agent:get-history');
    expect(IPC_CHANNELS.AGENT_GET_RECIPES).toBe('agent:get-recipes');
    expect(IPC_CHANNELS.AGENT_SAVE_RECIPE).toBe('agent:save-recipe');
    expect(IPC_CHANNELS.AGENT_DELETE_RECIPE).toBe('agent:delete-recipe');
    expect(IPC_CHANNELS.AGENT_REPLAY_RECIPE).toBe('agent:replay-recipe');
    expect(IPC_CHANNELS.AGENT_GET_BENCHMARK_SUITES).toBe('agent:get-benchmark-suites');
    expect(IPC_CHANNELS.AGENT_RUN_BENCHMARK).toBe('agent:run-benchmark');
    expect(IPC_CHANNELS.AGENT_EXPORT_TRACE).toBe('agent:export-trace');

    expect(IPC_CHANNELS.AGENT_FORGET_SITE).toBe('agent:forget-site');
    expect(IPC_CHANNELS.AGENT_CLEAR_LOGS).toBe('agent:clear-logs');
    expect(IPC_CHANNELS.AGENT_FORGET_ALL).toBe('agent:forget-all');

    expect(IPC_CHANNELS.AGENT_CONFIRMATION_REQUIRED).toBe('agent:confirmation-required');
    expect(IPC_CHANNELS.AGENT_ACTION_LOGGED).toBe('agent:action-logged');
    expect(IPC_CHANNELS.AGENT_STATE_CHANGED).toBe('agent:state-changed');
    expect(IPC_CHANNELS.AGENT_INJECTION_DETECTED).toBe('agent:injection-detected');
    expect(IPC_CHANNELS.AGENT_TOGGLE_COMMAND_BOX).toBe('agent:toggle-command-box');
    expect(IPC_CHANNELS.AGENT_SHORTCUT_PAUSE_RESUME).toBe('agent:shortcut-pause-resume');
    expect(IPC_CHANNELS.AGENT_SHORTCUT_STOP).toBe('agent:shortcut-stop');
  });

  it('keeps every channel name unique, non-empty and colon-namespaced', () => {
    const values = Object.values(IPC_CHANNELS);
    expect(values.length).toBeGreaterThan(60);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(value).toMatch(/^[a-z]+(:[a-z0-9-]+)+$/);
    }
  });
});
