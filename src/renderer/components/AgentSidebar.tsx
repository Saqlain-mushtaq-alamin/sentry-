import React, { useState } from 'react';
import { TaskState, ActionLogEntry, TaskPlan } from '../../shared/types';
import { AgentCommandBox } from './AgentCommandBox';
import { ActionLog } from '../overlays/ActionLog';
import { TaskControls } from './TaskControls';
import './AgentSidebar.css';

interface AgentSidebarProps {
  taskState: TaskState;
  actionLog: ActionLogEntry[];
  plan?: TaskPlan;
  currentStep?: number;
  totalSteps?: number;
  lastMessage?: string;
  onSendTask: (instruction: string) => void;
  onPause: () => void;
  onStop: () => void;
  onResume: () => void;
  onUndoLast: (entry: ActionLogEntry) => Promise<boolean>;
  onToggleVisionMode?: () => void;
  isVisionModeActive?: boolean;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  taskState,
  actionLog,
  plan,
  currentStep,
  totalSteps,
  lastMessage,
  onSendTask,
  onPause,
  onStop,
  onResume,
  onUndoLast,
  onToggleVisionMode,
  isVisionModeActive = false,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(340);

  if (collapsed) {
    return (
      <div className="agent-sidebar-collapsed" onClick={() => setCollapsed(false)}>
        <span>🤖 Sentry Sidebar</span>
      </div>
    );
  }

  return (
    <div className="agent-sidebar" style={{ width: `${width}px` }}>
      <div className="sidebar-header">
        <span className="sidebar-title">🤖 Sentry Agent Companion</span>
        <button className="sidebar-collapse-btn" onClick={() => setCollapsed(true)}>
          ▶ Collapse
        </button>
      </div>

      <div className="sidebar-scrollable-body">
        {/* Controls */}
        <TaskControls
          taskState={taskState}
          actionLog={actionLog}
          onPause={onPause}
          onStop={onStop}
          onResume={onResume}
          onUndoLast={onUndoLast}
          onToggleVisionMode={onToggleVisionMode}
          isVisionModeActive={isVisionModeActive}
        />

        {/* Plan card if available */}
        {plan && (
          <div className="sidebar-plan-card">
            <h4>📋 Active Task Plan ({plan.steps.length} Steps)</h4>
            <div className="plan-steps-mini">
              {plan.steps.map((step) => {
                const isCompleted = currentStep !== undefined && step.stepNumber < currentStep;
                const isCurrent = currentStep === step.stepNumber;
                return (
                  <div
                    key={step.stepNumber}
                    className={`mini-step ${isCompleted ? 'done' : ''} ${isCurrent ? 'active' : ''}`}
                  >
                    <span>{isCompleted ? '✅' : isCurrent ? '⏳' : '⚪'}</span>
                    <span>Step {step.stepNumber}: {step.description}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Log */}
        <ActionLog entries={actionLog} />
      </div>

      <div className="sidebar-footer">
        <AgentCommandBox
          onSendTask={onSendTask}
          onPause={onPause}
          onStop={onStop}
          onResume={onResume}
          taskState={taskState}
          currentStep={currentStep}
          totalSteps={totalSteps}
          lastMessage={lastMessage}
        />
      </div>
    </div>
  );
};
