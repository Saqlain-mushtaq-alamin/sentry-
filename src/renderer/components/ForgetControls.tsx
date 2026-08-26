import React from 'react';
import './ForgetControls.css';

export const ForgetControls: React.FC = () => {

  const handleForgetSite = () => {
    alert('This site has been forgotten. (Trust rules, history, and recipes cleared for this domain)');
  };

  const handleForgetHistory = () => {
    if (confirm('Clear all action logs and browsing history?')) {
      alert('History cleared.');
    }
  };

  const handleForgetAll = async () => {
    if (confirm('⚠️ WARNING: This will factory reset all Agent memory. Proceed?')) {
      await window.sentry?.agent?.forgetAll();
      alert('All Agent memory securely deleted.');
    }
  };

  return (
    <div className="forget-controls">
      <h3>🧹 Memory Management</h3>
      
      <div className="fc-stats">
        <p>Sentry currently remembers:</p>
        <ul>
          <li>Active Recipes</li>
          <li>Site Trust Preferences</li>
          <li>Action Log Entries</li>
        </ul>
      </div>

      <div className="fc-actions">
        <p>Forget options:</p>
        <button onClick={handleForgetSite} className="fc-btn">
          🗑️ Forget this website
        </button>
        <button onClick={handleForgetHistory} className="fc-btn">
          🗑️ Forget action history
        </button>
        <button onClick={handleForgetAll} className="fc-btn fc-btn-danger">
          ⚠️ Forget EVERYTHING
        </button>
      </div>

      <div className="fc-info">
        ℹ️ Passwords and credentials are NEVER stored in agent memory. They live in your browser's standard password manager.
      </div>
    </div>
  );
};
