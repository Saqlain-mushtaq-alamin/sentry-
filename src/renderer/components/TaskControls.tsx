import React, { useState } from 'react';
import { TaskState, ActionLogEntry } from '../../shared/types';
import './TaskControls.css';

interface TaskControlsProps {
  taskState: TaskState;
  actionLog: ActionLogEntry[];
  onPause: () => void;
  onStop: () => void;
  onResume: () => void;
  onUndoLast: (entryToUndo: ActionLogEntry) => Promise<boolean>;
  onViewPlan?: () => void;
  onToggleVisionMode?: () => void;
  isVisionModeActive?: boolean;
}

export const TaskControls: React.FC<TaskControlsProps> = ({
  taskState,
  actionLog,
  onPause,
  onStop,
  onResume,
  onUndoLast,
  onViewPlan,
  onToggleVisionMode,
  isVisionModeActive = false,
}) => {
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);

  const isActive = [
    TaskState.PLANNING,
    TaskState.EXECUTING,
    TaskState.AWAITING_CONFIRMATION,
  ].includes(taskState);
  const isPaused = taskState === TaskState.PAUSED;

  const undoableEntries = actionLog.filter(
    (e) => e.executed && ['type', 'fill', 'navigate', 'select'].includes(e.action.type)
  );
  const lastUndoable = undoableEntries[undoableEntries.length - 1];

  const handleUndo = async () => {
    if (!lastUndoable || isUndoing) return;
    setIsUndoing(true);
    setUndoMessage(`Undoing: ${lastUndoable.action.type} on ${lastUndoable.action.target}...`);

    try {
      const success = await onUndoLast(lastUndoable);
      if (success) {
        setUndoMessage(`✅ Successfully undone ${lastUndoable.action.type}`);
      } else {
        setUndoMessage(`❌ Could not undo action`);
      }
    } catch {
      setUndoMessage(`❌ Undo failed with error`);
    } finally {
      setIsUndoing(false);
      setTimeout(() => setUndoMessage(null), 3000);
    }
  };

  return (
    <div className="task-controls-bar">
      <div className="controls-left">
        {isActive && (
          <button className="control-btn pause" onClick={onPause}>
            ⏸ Pause
          </button>
        )}
        {isPaused && (
          <button className="control-btn resume" onClick={onResume}>
            ▶ Resume
          </button>
        )}
        {(isActive || isPaused) && (
          <button className="control-btn stop" onClick={onStop}>
            ⏹ Stop
          </button>
        )}
      </div>

      <div className="controls-center">
        {undoMessage && <span className="undo-status-msg">{undoMessage}</span>}
      </div>

      <div className="controls-right">
        <button
          className={`control-btn undo ${!lastUndoable || isUndoing ? 'disabled' : ''}`}
          onClick={handleUndo}
          disabled={!lastUndoable || isUndoing}
          title={lastUndoable ? `Undo ${lastUndoable.action.type}` : 'No reversible actions to undo'}
        >
          ↩ Undo Last Action
        </button>

        {onToggleVisionMode && (
          <button
            className={`control-btn vision ${isVisionModeActive ? 'active' : ''}`}
            onClick={onToggleVisionMode}
            title="Toggle Agent Vision overlay"
          >
            👁 Vision Mode
          </button>
        )}

        {onViewPlan && (
          <button className="control-btn plan" onClick={onViewPlan}>
            📋 Plan
          </button>
        )}
      </div>
    </div>
  );
};
