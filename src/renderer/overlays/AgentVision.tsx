import React from 'react';
import { PageSnapshot, InteractiveElement } from '../../shared/types';
import './AgentVision.css';

interface AgentVisionProps {
  snapshot?: PageSnapshot;
  targetElementIndex?: number | string;
  onClose: () => void;
}

export const AgentVision: React.FC<AgentVisionProps> = ({
  snapshot,
  targetElementIndex,
  onClose,
}) => {
  if (!snapshot) {
    return (
      <div className="agent-vision-overlay">
        <div className="vision-header">
          <span>👁 Agent Vision Overlay</span>
          <span className="vision-status">No active page snapshot available</span>
          <button className="vision-close-btn" onClick={onClose}>✕ Close Vision</button>
        </div>
      </div>
    );
  }

  const elements = snapshot.interactiveElements || [];
  const formCount = snapshot.forms?.length || 0;
  const linkCount = snapshot.links?.length || 0;
  const currentTargetIdx =
    typeof targetElementIndex === 'string'
      ? parseInt(targetElementIndex, 10)
      : targetElementIndex;

  const getElementCategoryClass = (el: InteractiveElement) => {
    if (el.index === currentTargetIdx) return 'target-highlight';
    if (['input', 'textarea', 'select'].includes(el.tag.toLowerCase())) return 'form-highlight';
    if (['button', 'a'].includes(el.tag.toLowerCase()) || el.role === 'button' || el.role === 'link') return 'interactive-highlight';
    return 'default-highlight';
  };

  return (
    <div className="agent-vision-overlay">
      <div className="vision-header">
        <div className="vision-info">
          <span className="vision-badge">👁 AGENT VISION MODE</span>
          <span className="vision-stats">
            Targeting {elements.length} Interactive Elements | {formCount} Forms | {linkCount} Links
          </span>
        </div>
        <div className="vision-legend">
          <span className="legend-item target">🟡 Current Target</span>
          <span className="legend-item interactive">🟦 Buttons / Links</span>
          <span className="legend-item form">🟪 Form Fields</span>
        </div>
        <button className="vision-close-btn" onClick={onClose}>✕ Close Vision</button>
      </div>

      <div className="vision-canvas">
        {elements.map((el) => {
          const categoryClass = getElementCategoryClass(el);
          const box = el.boundingBox || { x: 50 + (el.index % 5) * 120, y: 80 + Math.floor(el.index / 5) * 60, width: 100, height: 36 };

          return (
            <div
              key={el.index}
              className={`vision-bounding-box ${categoryClass}`}
              style={{
                left: `${box.x}px`,
                top: `${box.y}px`,
                width: `${Math.max(box.width, 60)}px`,
                height: `${Math.max(box.height, 24)}px`,
              }}
            >
              <div className="vision-tag-label">
                <span className="index-num">[{el.index}]</span>
                <span className="el-label">{el.label || el.tag}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
