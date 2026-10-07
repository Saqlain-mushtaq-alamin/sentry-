/**
 * Sentry Browser — IPC Channel Constants
 * Single source of truth for all main <-> renderer IPC channels.
 */

export const IPC_CHANNELS = {
  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // Tabs
  TABS_GET_ALL: 'tabs:get-all',
  TABS_CREATE: 'tabs:create',
  TABS_CLOSE: 'tabs:close',
  TABS_SWITCH: 'tabs:switch',
  TABS_REORDER: 'tabs:reorder',
  TABS_DUPLICATE: 'tabs:duplicate',
  TABS_TOGGLE_PIN: 'tabs:toggle-pin',
  TABS_UPDATED: 'tabs:updated',
  TABS_RELOAD_INTERNAL: 'tabs:reload-internal',

  // Navigation
  NAV_NAVIGATE: 'nav:navigate',
  NAV_GO_BACK: 'nav:go-back',
  NAV_GO_FORWARD: 'nav:go-forward',
  NAV_RELOAD: 'nav:reload',
  NAV_SET_ZOOM: 'nav:set-zoom',

  // Bookmarks
  BOOKMARKS_GET_ALL: 'bookmarks:get-all',
  BOOKMARKS_ADD: 'bookmarks:add',
  BOOKMARKS_REMOVE: 'bookmarks:remove',
  BOOKMARKS_IS_BOOKMARKED: 'bookmarks:is-bookmarked',

  // History
  HISTORY_GET_ALL: 'history:get-all',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_REMOVE_ENTRY: 'history:remove-entry',

  // Downloads
  DOWNLOADS_GET_ALL: 'downloads:get-all',
  DOWNLOADS_OPEN_FILE: 'downloads:open-file',
  DOWNLOADS_OPEN_FOLDER: 'downloads:open-folder',
  DOWNLOADS_UPDATED: 'downloads:updated',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Extensions
  EXTENSIONS_GET_ALL: 'extensions:get-all',
  EXTENSIONS_LOAD: 'extensions:load',
  EXTENSIONS_CHOOSE_AND_LOAD: 'extensions:choose-and-load',
  EXTENSIONS_UNLOAD: 'extensions:unload',
  EXTENSIONS_TOGGLE: 'extensions:toggle',

  // View
  VIEW_SET_LAYOUT_OFFSETS: 'view:set-layout-offsets',
  VIEW_SET_BOUNDS: 'view:set-bounds',
  VIEW_SET_HIDDEN: 'view:set-hidden',

  // Trust
  TRUST_GET_ALL: 'trust:get-all',
  TRUST_SET_LEVEL: 'trust:set-level',
  TRUST_REMOVE: 'trust:remove',
  TRUST_GET_DEFAULTS: 'trust:get-defaults',

  // Secrets
  SECRETS_SET: 'secrets:set',
  SECRETS_HAS: 'secrets:has',

  // Voice
  VOICE_TRANSCRIBE: 'voice:transcribe',

  // Memory & Privacy
  AGENT_FORGET_SITE: 'agent:forget-site',
  AGENT_CLEAR_LOGS: 'agent:clear-logs',
  AGENT_FORGET_ALL: 'agent:forget-all',

  // Agent
  AGENT_RUN_TASK: 'agent:run-task',
  AGENT_PAUSE: 'agent:pause',
  AGENT_RESUME: 'agent:resume',
  AGENT_STOP: 'agent:stop',
  AGENT_GET_HISTORY: 'agent:get-history',
  AGENT_GET_RECIPES: 'agent:get-recipes',
  AGENT_SAVE_RECIPE: 'agent:save-recipe',
  AGENT_DELETE_RECIPE: 'agent:delete-recipe',
  AGENT_REPLAY_RECIPE: 'agent:replay-recipe',
  AGENT_GET_BENCHMARK_SUITES: 'agent:get-benchmark-suites',
  AGENT_RUN_BENCHMARK: 'agent:run-benchmark',
  AGENT_EXPORT_TRACE: 'agent:export-trace',
  AGENT_GET_DEVELOPER_STATS: 'agent:get-developer-stats',
  AGENT_GET_LAST_TRACE: 'agent:get-last-trace',
  AGENT_RESET_DEVELOPER_STATS: 'agent:reset-developer-stats',
  AGENT_GET_MODEL_CONFIG: 'agent:get-model-config',
  AGENT_SET_MODEL_CONFIG: 'agent:set-model-config',
  AGENT_LIST_OLLAMA_MODELS: 'agent:list-ollama-models',
  AGENT_CHECK_OLLAMA: 'agent:check-ollama',

  // Agent Events
  AGENT_CONFIRMATION_REQUIRED: 'agent:confirmation-required',
  AGENT_ACTION_LOGGED: 'agent:action-logged',
  AGENT_STATE_CHANGED: 'agent:state-changed',
  AGENT_INJECTION_DETECTED: 'agent:injection-detected',
  AGENT_ROUTING_DECISION: 'agent:routing-decision',
  AGENT_DEVELOPER_STATS_UPDATED: 'agent:developer-stats-updated',
  AGENT_STEP_TRACE_ADDED: 'agent:step-trace-added',
  AGENT_TOGGLE_COMMAND_BOX: 'agent:toggle-command-box',
  AGENT_SHORTCUT_PAUSE_RESUME: 'agent:shortcut-pause-resume',
  AGENT_SHORTCUT_STOP: 'agent:shortcut-stop',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
