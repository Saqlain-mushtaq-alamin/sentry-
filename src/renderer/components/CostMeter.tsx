import React, { useState } from 'react';
import './CostMeter.css';

interface CostMeterProps {
  currentTaskCost: number;
  currentTaskTokens: number;
  todayCost: number;
  todayTokens: number;
  monthCost: number;
  monthTokens: number;
  budget: number;
}

export const CostMeter: React.FC<CostMeterProps> = ({
  currentTaskCost,
  currentTaskTokens,
  todayCost,
  todayTokens,
  monthCost,
  monthTokens,
  budget,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const budgetUsedPct = (monthCost / budget) * 100;
  const remaining = Math.max(0, budget - monthCost);
  
  let statusClass = 'good';
  if (budgetUsedPct > 80) statusClass = 'warning';
  if (budgetUsedPct > 95) statusClass = 'danger';

  return (
    <div 
      className="cost-meter"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <span className="cost-icon">💰</span>
      <span className="cost-value">${currentTaskCost.toFixed(3)}</span>

      {showDetails && (
        <div className="cost-meter-tooltip">
          <div className="tooltip-header">
            💰 SESSION COST
          </div>
          <div className="tooltip-body">
            <div className="detail-row">
              <span>This task:</span>
              <strong>${currentTaskCost.toFixed(4)} <span className="token-count">({currentTaskTokens.toLocaleString()} tokens)</span></strong>
            </div>
            <div className="detail-row">
              <span>Today:</span>
              <strong>${todayCost.toFixed(2)} <span className="token-count">({todayTokens.toLocaleString()} tokens)</span></strong>
            </div>
            <div className="detail-row">
              <span>This month:</span>
              <strong>${monthCost.toFixed(2)} <span className="token-count">({monthTokens.toLocaleString()} tokens)</span></strong>
            </div>
            
            <hr className="divider" />
            
            <div className="detail-row">
              <span>Budget:</span>
              <strong>${budget.toFixed(2)}/month</strong>
            </div>
            <div className="detail-row">
              <span>Remaining:</span>
              <strong>${remaining.toFixed(2)}</strong>
            </div>
            
            <div className="budget-bar-container">
              <div className={`budget-bar ${statusClass}`} style={{ width: `${Math.min(100, budgetUsedPct)}%` }}></div>
            </div>
            <div className="budget-pct">{budgetUsedPct.toFixed(1)}%</div>
          </div>
          <div className="tooltip-footer">
            <button className="btn-secondary btn-sm">Set Budget</button>
            <button className="btn-secondary btn-sm">View Breakdown</button>
          </div>
        </div>
      )}
    </div>
  );
};
