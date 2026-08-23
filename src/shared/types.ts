/** Risk tiers for the Action Firewall (A1) */
export enum RiskTier {
  LOW = 'low',         // 🟢 Read, scroll, navigate
  MEDIUM = 'medium',   // 🟡 Download, new tab, non-sensitive form
  HIGH = 'high',       // 🟠 Send message, submit personal data
  CRITICAL = 'critical' // 🔴 Passwords, payments, deletions
}

/** Website trust levels (A2) */
export enum SiteTrustLevel {
  READ_ACT = 'read_act',
  READ_ONLY = 'read_only',
  HIGHLY_RESTRICTED = 'highly_restricted',
  BLOCKED = 'blocked'
}

export interface LoadedExtension {
  id: string;
  name: string;
  version: string;
  manifestVersion: number;
  permissions: string[];
  isEnabled: boolean;
  installPath: string;
}

/** An action proposed by the agent */
export interface ProposedAction {
  id: string;
  type: string;         // 'click' | 'fill' | 'navigate' | 'submit' | etc.
  target: string;       // CSS selector or accessibility label
  value?: string;       // For fill actions
  riskTier: RiskTier;
  reason: string;       // "Why?" explanation (A4)
  timestamp: number;
  tabId: string;
  url: string;
}

/** User's response to a confirmation prompt */
export type ConfirmationResponse = 'allow_once' | 'allow_site' | 'deny';

/** Agent task state */
export enum TaskState {
  IDLE = 'idle',
  PLANNING = 'planning',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  EXECUTING = 'executing',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}


/** Tab State representation for UI */
export interface TabItem {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isActive: boolean;
  isPinned?: boolean;
  zoomLevel?: number;
}

/** Bookmark Item */
export interface BookmarkItem {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  folderId?: string | null;
  createdAt: number;
  position: number;
}

/** Bookmark Folder */
export interface BookmarkFolderItem {
  id: string;
  name: string;
  parentId?: string | null;
  position: number;
}

/** History Entry */
export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  timestamp: number;
  visitCount: number;
}

/** Download Item */
export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  savePath: string;
  receivedBytes: number;
  totalBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  startTime: number;
  endTime?: number;
}

/** User Settings */
export interface UserSettings {
  searchEngine: 'google' | 'duckduckgo' | 'bing';
  startupBehavior: 'newtab' | 'restore';
  theme: 'dark' | 'light' | 'system';
  showBookmarksBar: boolean;
  defaultDownloadPath: string;
  askDownloadPath: boolean;
  developerMode?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Action Layer Types
// ─────────────────────────────────────────────────────────────────────────────

/** Bounding box for a DOM element in viewport coordinates */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Simplified DOM node — stripped, semantics-only representation */
export interface SimplifiedDOM {
  tag: string;
  id?: string;
  classes?: string[];
  text?: string;
  role?: string;        // ARIA role
  label?: string;       // ARIA label / visible label
  href?: string;        // For <a> elements
  type?: string;        // For <input> elements
  value?: string;       // Current value of input/select
  placeholder?: string; // Placeholder text
  children: SimplifiedDOM[];
}

/** Form field info extracted from the page */
export interface FormInfo {
  formId?: string;
  action?: string;
  method?: string;
  fields: Array<{
    selector: string;
    label: string;
    type: string;
    name?: string;
    value?: string;
    placeholder?: string;
    required: boolean;
  }>;
}

/** Clickable link info */
export interface LinkInfo {
  href: string;
  text: string;
  selector: string;
  isExternal: boolean;
}

/** An interactive element that the agent can act on */
export interface InteractiveElement {
  index: number;        // Unique 0-based index for the agent to reference
  tag: string;
  type?: string;        // For input elements
  role: string;         // ARIA role or inferred role
  label: string;        // Human-readable label (ARIA label > visible text > placeholder > name)
  selector: string;     // CSS selector to target this element
  boundingBox: BoundingBox;
  isVisible: boolean;
  isEnabled: boolean;
  value?: string;       // Current value
}

/** Full page snapshot — the agent's view of the current page state */
export interface PageSnapshot {
  url: string;
  title: string;
  timestamp: number;
  dom: SimplifiedDOM;
  accessibilityTree: A11yNode[];
  visibleText: string;
  forms: FormInfo[];
  links: LinkInfo[];
  interactiveElements: InteractiveElement[];
  /** Approximate token count of this snapshot for context-window planning */
  estimatedTokenCount: number;
}

/** Enhanced Accessibility Tree Node (Phase 3 replacement for the old A11yNode) */
export interface A11yNode {
  role: string;
  name: string;
  value?: string;
  description?: string;
  isInteractive: boolean;
  boundingBox?: BoundingBox;
  children: A11yNode[];
}

/** All action types the executor can perform */
export type ActionType =
  | 'click'
  | 'type'
  | 'clear'
  | 'select'
  | 'scroll'
  | 'hover'
  | 'navigate'
  | 'goBack'
  | 'goForward'
  | 'reload'
  | 'waitFor'
  | 'screenshot';

/** A concrete action request */
export interface ActionRequest {
  type: ActionType;
  /** CSS selector, element index (as '#3'), or URL for navigate */
  target?: string;
  value?: string;           // text to type, option value for select, URL for navigate
  direction?: 'up' | 'down' | 'left' | 'right'; // for scroll
  amount?: number;          // pixels or lines to scroll
  timeout?: number;         // ms for waitFor
}

/** Result of executing an action */
export interface ActionResult {
  success: boolean;
  error?: string;
  beforeSnapshot?: PageSnapshot;
  afterSnapshot?: PageSnapshot;
  screenshotBase64?: string;  // For 'screenshot' action
  duration: number;           // ms
}

/** How an element can be referenced by the agent */
export interface ElementReference {
  /** One of: 'index', 'selector', 'text', 'label', 'role' */
  kind: 'index' | 'selector' | 'text' | 'label' | 'role';
  value: string;
  /** Optional secondary constraint, e.g. role kind when kind='role' */
  proximity?: string;
}

/** Cache entry for page snapshots */
export interface CacheEntry {
  url: string;
  urlHash: string;
  snapshot: PageSnapshot;
  timestamp: number;
  ttl: number;
  domHash: string;
}

// ─── Legacy compatibility aliases (old ipc-types used these) ───────────────
/** @deprecated Use PageSnapshot instead */
export interface DOMSnapshot {
  html: string;
  url: string;
  timestamp: number;
}

/** Action Payload (Phase 0/2 legacy IPC; replaced by ActionRequest in Phase 3) */
export interface ActionPayload {
  actionType: 'click' | 'type' | 'scroll';
  selector?: string;
  coordinates?: { x: number; y: number };
  value?: string;
}

/** Trust Score */
export interface TrustScore {
  domain: string;
  score: number;
  level: 'trusted' | 'neutral' | 'suspicious' | 'blocked';
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Action Firewall Types
// ─────────────────────────────────────────────────────────────────────────────

/** Context used by the Risk Classifier rules engine */
export interface ActionContext {
  action: ProposedAction;
  pageSnapshot: PageSnapshot;
  siteTrust: SiteTrustLevel;
  targetElement?: InteractiveElement | SimplifiedDOM | FormInfo['fields'][0];
}

/** The result of risk classification */
export interface RiskClassification {
  tier: RiskTier;
  reasons: string[];           // Why this tier was assigned
  policyRulesFired: string[];  // Which rules contributed
  confidence: number;          // 0-1 confidence in classification
  escalatedFrom?: RiskTier;    // If site trust level escalated it
}

/** Website Trust Entry */
export interface SiteTrustEntry {
  domain: string;
  trustLevel: SiteTrustLevel;
  setBy: 'user' | 'default';
  lastModified: number;
  notes?: string;
}

/** Phase 9: Task Memory Recipes */
export interface Recipe {
  id: string;
  name: string;                    // User-assigned name
  description: string;             // Auto-generated or user-edited
  version: number;                 // Increments on edit
  steps: RecipeStep[];
  variables: RecipeVariable[];     // Parameterizable values
  sitePatterns: string[];          // URL patterns this recipe targets
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
  tags: string[];
  isPublic: boolean;               // Could be shared (future feature)
}

export interface WaitCondition {
  type: 'networkIdle' | 'elementVisible' | 'textPresent' | 'time';
  target?: string;
  timeoutMs: number;
}

export interface RecipeStep {
  order: number;
  actionType: string;              // click, type, navigate, etc.
  target: ElementSelector;         // How to find the target element
  value?: string | { type: 'variable'; name: string };  // Static value or variable reference
  waitCondition?: WaitCondition;   // What to wait for after this step
  fallback?: RecipeStep;           // Alternative if this step fails
  riskTier: RiskTier;              // Recorded from original execution
}

export interface RecipeVariable {
  name: string;                    // e.g., "searchQuery", "departureCity"
  description: string;             // "What to search for"
  type: 'text' | 'number' | 'date' | 'select';
  defaultValue?: string;
  required: boolean;
}

export interface ElementSelector {
  primary: string;                 // CSS selector
  fallbacks: string[];             // Alternative selectors if primary fails
  textContent?: string;            // Expected text (for validation)
  ariaLabel?: string;              // Expected ARIA label
  role?: string;                   // Expected ARIA role
}
export interface PermissionGrant {
  id: string;
  domain: string;
  actionPattern: string;      // e.g., "click:navigation-link", "fill:search-box"
  scope: 'once' | 'site' | 'session';
  grantedAt: number;
  expiresAt: number | null;
  riskTierAtGrant: RiskTier;
}

/** Phase 9: Task Memory Recipes */
export interface Recipe {
  id: string;
  name: string;                    // User-assigned name
  description: string;             // Auto-generated or user-edited
  version: number;                 // Increments on edit
  steps: RecipeStep[];
  variables: RecipeVariable[];     // Parameterizable values
  sitePatterns: string[];          // URL patterns this recipe targets
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
  tags: string[];
  isPublic: boolean;               // Could be shared (future feature)
}

export interface WaitCondition {
  type: 'networkIdle' | 'elementVisible' | 'textPresent' | 'time';
  target?: string;
  timeoutMs: number;
}

export interface RecipeStep {
  order: number;
  actionType: string;              // click, type, navigate, etc.
  target: ElementSelector;         // How to find the target element
  value?: string | { type: 'variable'; name: string };  // Static value or variable reference
  waitCondition?: WaitCondition;   // What to wait for after this step
  fallback?: RecipeStep;           // Alternative if this step fails
  riskTier: RiskTier;              // Recorded from original execution
}

export interface RecipeVariable {
  name: string;                    // e.g., "searchQuery", "departureCity"
  description: string;             // "What to search for"
  type: 'text' | 'number' | 'date' | 'select';
  defaultValue?: string;
  required: boolean;
}

export interface ElementSelector {
  primary: string;                 // CSS selector
  fallbacks: string[];             // Alternative selectors if primary fails
  textContent?: string;            // Expected text (for validation)
  ariaLabel?: string;              // Expected ARIA label
  role?: string;                   // Expected ARIA role
}

/** Firewall Decision */
export interface FirewallDecision {
  actionId: string;
  allowed: boolean;
  requiresConfirmation: boolean;
  riskTier: RiskTier;
  classification: RiskClassification;
  siteTrust: SiteTrustLevel;
  matchedGrant?: PermissionGrant;
  explanation: string;
  detailedReason: string;
}

/** Audit Log Entry */
export interface AuditEntry {
  id: string;
  timestamp: number;
  actionId: string;
  action: ProposedAction;
  decision: FirewallDecision;
  userResponse?: ConfirmationResponse;
  wasExecuted: boolean;
  wasUndone: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — Agent Brain Types
// ─────────────────────────────────────────────────────────────────────────────

/** A chat message in the model conversation */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

/** Tool definition for function-calling models */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** A tool call returned by the model */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Request sent to a model adapter */
export interface ChatRequest {
  systemPrompt: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  tools?: ToolDefinition[];
}

/** Response from a model adapter */
export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  tokenUsage: { prompt: number; completion: number; total: number };
  cost: number;
  latencyMs: number;
  modelId: string;
}

/** A single step in an agent's task plan */
export interface PlannedStep {
  stepNumber: number;
  description: string;
  expectedActions: string[];
  estimatedRisk: RiskTier;
}

/** A full task plan generated before execution */
export interface TaskPlan {
  taskId: string;
  instruction: string;
  steps: PlannedStep[];
  estimatedActions: number;
  estimatedTime: string;
  risks: string[];
  requiresHighRiskActions: boolean;
}

/** An entry in the running action log */
export interface ActionLogEntry {
  action: ProposedAction;
  decision: FirewallDecision;
  executed: boolean;
  result?: import('./types').ActionResult;
  timestamp?: number;
}

/** The final result of an agent task */
export interface TaskResult {
  state: TaskState;
  actionLog: ActionLogEntry[];
  totalSteps: number;
  error?: string;
  summary?: string;
}

/** Context passed to the system prompt builder */
export interface AgentContext {
  currentUrl: string;
  userInstruction: string;
  currentStep: number;
  totalSteps: number;
  previousActions?: string;
}

/** An agent task description */
export interface AgentTask {
  id: string;
  tabId: string;
  instruction: string;
  context: AgentContext;
  plan?: TaskPlan;
  createdAt: number;
}

/** Error types the agent can report */
export interface AgentError {
  type:
    | 'parse_error'
    | 'action_failed'
    | 'page_changed'
    | 'timeout'
    | 'model_error'
    | 'max_steps'
    | 'firewall_denied'
    | 'unknown';
  message: string;
  suggestion: string;
  technicalDetail?: string;
  recoverable: boolean;
}

/** What the model proposes after parsing its JSON output */
export interface ParsedModelAction {
  type: string;         // click | type | scroll | navigate | select | done | ask_user
  target?: string;
  value?: string;
  reason: string;
  thought: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 — Agent UX Types
// ─────────────────────────────────────────────────────────────────────────────

/** Diff for a form field before and after action execution */
export interface FieldDiff {
  fieldId?: string;
  label: string;
  selector: string;
  currentValue: string;
  newValue: string;
  type?: string;
}

/** Simulated step result in dry-run mode */
export interface DryRunStepResult {
  stepNumber: number;
  description: string;
  simulatedAction: ProposedAction;
  predictedRisk: RiskTier;
  predictedUrl?: string;
  explanation: string;
}

/** Complete report produced by a dry run */
export interface DryRunReport {
  steps: DryRunStepResult[];
  highestRisk: RiskTier;
  estimatedTime: string;
  warnings: string[];
  confirmedSafe: boolean;
}

/** Agent Notification for toast center */
export interface AgentNotification {
  id: string;
  type: 'success' | 'confirmation' | 'error' | 'info' | 'security_alert';
  title: string;
  message: string;
  timestamp: number;
  actionId?: string;
  read?: boolean;
  actions?: { label: string; actionKey: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — Multi-Tab & Background Orchestration Types
// ─────────────────────────────────────────────────────────────────────────────

export type CoordinatorState = 'initializing' | 'running' | 'paused' | 'completed' | 'failed';

export interface TabAssignment {
  tabId: string | number;
  url?: string;
  subtask?: string;
  subInstruction?: string;
  status: 'pending' | 'running' | 'active' | 'completed' | 'failed' | 'paused';
  progress?: number;
  progressPercent?: number;
}

export interface TabResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface MultiTabTask {
  id: string;
  instruction: string;
  createdAt?: number;
  tabs: TabAssignment[];
  coordinatorState?: CoordinatorState;
  results?: Record<string, TabResult>;
}

export interface MultiTabResult {
  taskId: string;
  success: boolean;
  combinedSummary: string;
  tabResults: Record<string, TabResult>;
}

export interface TabGroup {
  id: string;
  name: string;
  color: string;
  tabIds: (string | number)[];
  taskId?: string;
  autoCreated: boolean;
  autoCloseOnComplete: boolean;
}

export interface BackgroundTask {
  id: string;
  instruction: string;
  priority: 'low' | 'normal' | 'high';
  status: TaskState;
  progress: number;
  startedAt: number;
  estimatedCompletion?: number;
  notifications: AgentNotification[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 12 — Developer / Research Mode Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TraceStep {
  stepNumber: number;
  timestamp: string;
  observation: string;       // Summarized page state
  modelThought: string;      // The model's reasoning
  proposedAction: ProposedAction;
  firewallDecision: FirewallDecision;
  userResponse?: ConfirmationResponse;
  actionResult?: ActionResult;
  injectionScanResult: { isClean: boolean; confidence: number };
  latency: {
    observation: number;     // ms to get page snapshot
    model: number;          // ms for model inference
    firewall: number;       // ms for firewall evaluation
    execution: number;      // ms to execute action
  };
  rawPrompt?: {
    systemPrompt: string;
    userMessage: string;
    modelResponse: string;
    tokensIn?: number;
    tokensOut?: number;
    latencyMs?: number;
  };
}

export interface TaskTrace {
  version: '1.0';
  exportedAt: string;      // ISO timestamp
  sentryVersion: string;
  task: {
    id: string;
    instruction: string;
    startedAt: string;
    completedAt: string;
    state: TaskState;
    totalSteps: number;
  };
  model: {
    providerId: string;
    modelId: string;
    isLocal: boolean;
    totalTokens: number;
    estimatedCost: number;
  };
  steps: TraceStep[];
  firewallSummary: {
    totalDecisions: number;
    allowed: number;
    blocked: number;
    confirmationsAsked: number;
    confirmationsDenied: number;
  };
  injectionSummary: {
    totalScans: number;
    detectionsFound: number;
    falsePositives: number;
  };
  performance: {
    totalDurationMs: number;
    avgStepLatencyMs: number;
    avgModelLatencyMs: number;
    avgActionLatencyMs: number;
  };
}

export interface BenchmarkTask {
  id: string;
  name: string;
  instruction: string;
  setupUrl: string;          // Page to start on
  expectedOutcome: string;   // What success looks like
  maxSteps: number;
  timeout: number;           // ms
}

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  tasks: BenchmarkTask[];
}

export interface BenchmarkResults {
  suiteId: string;
  suiteName: string;
  timestamp: number;
  taskSuccessRate: number;           // % of tasks completed successfully
  avgTaskDuration: number;           // ms
  firewallBlockRate: number;         // % of actions blocked
  firewallFalsePositiveRate: number; // % of blocked actions that were actually safe
  injectionDetectionRate: number;    // % of injections caught
  avgTokensPerTask: number;
  avgCostPerTask: number;
  totalTasks: number;
  completedTasks: number;
}

export interface DeveloperSessionStats {
  tasksCompleted: number;
  actionsExecuted: number;
  firewallBlocks: number;
  confirmationsAsked: number;
  injectionsDetected: number;
  falsePositives: number;
  totalTokens: number;
  estimatedCost: number;
  avgActionLatencyMs: number;
  lastModelInfo?: {
    activeModel: string;
    providerId: string;
    isLocal: boolean;
    routerDecision: string;
    contextUsageTokens: number;
    contextLimitTokens: number;
    lastLatencyMs: number;
    avgLatencyMs: number;
  };
  lastActionAnalysis?: {
    actionType: string;
    target: string;
    riskScore: number;
    riskTier: RiskTier;
    policyRulesFired: string[];
    firewallDecision: 'ALLOWED' | 'BLOCKED' | 'REQUIRES_CONFIRMATION';
    injectionScanClean: boolean;
    injectionScanTimeMs: number;
    executionTimeMs: number;
  };
}

