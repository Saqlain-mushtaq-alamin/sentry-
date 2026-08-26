import React, { useState } from 'react';
import './CloudIndicator.css';

interface CloudIndicatorProps {
  isCloud: boolean;
  provider?: string;
  model?: string;
  estimatedTokens?: number;
  domain?: string;
}

export const CloudIndicator: React.FC<CloudIndicatorProps> = ({ 
  isCloud, 
  provider = 'Local', 
  model = 'llama3.1:8b',
  estimatedTokens = 0,
  domain = 'localhost'
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div 
      className={`cloud-indicator ${isCloud ? 'cloud' : 'local'}`}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
      role="status"
      aria-live="polite"
      aria-label={`Cloud status: ${isCloud ? `Cloud model ${provider}` : 'Local model active'}`}
    >
      <span className="indicator-icon">{isCloud ? '☁️' : '🏠'}</span>
      <span className="indicator-text">{isCloud ? `Cloud: ${provider}` : 'Local'}</span>

      {showDetails && (
        <div className="cloud-indicator-tooltip">
          <div className="tooltip-header">
            {isCloud ? '☁️ CLOUD ACTIVE' : '🏠 LOCAL ACTIVE'}
          </div>
          <div className="tooltip-body">
            <div className="detail-row">
              <span>{isCloud ? 'Sending to:' : 'Running on:'}</span>
              <strong>{provider} ({model})</strong>
            </div>
            <div className="detail-row">
              <span>Data:</span>
              <strong>page content from {domain}</strong>
            </div>
            <div className="detail-row">
              <span>Tokens:</span>
              <strong>~{estimatedTokens.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
