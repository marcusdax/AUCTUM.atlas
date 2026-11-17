import React from 'react';
import { AlertTriangle, Clock } from '../assets/icons';
import './AlertPanel.css';

const SEVERITY_CONFIG = {
  Extreme: { label: 'Extreme', color: 'var(--c-severity-extreme)', bg: 'var(--c-sev-extreme-bg)' },
  Severe: { label: 'Severe', color: 'var(--c-severity-severe)', bg: 'var(--c-sev-severe-bg)' },
  Moderate: { label: 'Moderate', color: 'var(--c-severity-moderate)', bg: 'var(--c-sev-moderate-bg)' },
  Minor: { label: 'Minor', color: 'var(--c-severity-minor)', bg: 'var(--c-sev-minor-bg)' },
  Unknown: { label: 'Unknown', color: 'var(--c-text-disabled)', bg: 'rgba(100, 116, 128, 0.15)' }
};

const SEVERITY_ORDER = ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'];

const formatTime = (timeString) => {
  if (!timeString) return null;
  const date = new Date(timeString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs < 0) return 'Expired';
  if (diffMins < 60) return `${diffMins}m left`;
  if (diffHours < 24) return `${diffHours}h left`;
  if (diffDays < 2) return `1d left`;
  return date.toLocaleDateString();
};

const AlertPanel = ({ alerts }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="alert-empty-modern" role="status" aria-live="polite">
        <div className="alert-empty-icon">
          <AlertTriangle size={32} />
        </div>
        <p>No active weather alerts</p>
        <span>All systems normal</span>
      </div>
    );
  }

  // Group alerts by severity
  const groupedAlerts = alerts.reduce((acc, alert) => {
    const severity = alert.severity || 'Unknown';
    if (!acc[severity]) acc[severity] = [];
    acc[severity].push(alert);
    return acc;
  }, {});

  const totalCount = alerts.length;

  return (
    <div className="alert-panel-modern">
      <div className="alert-summary-modern">
        <div className="alert-count-modern">
          <span className="count-total-modern">{totalCount}</span>
          <span className="count-label-modern">Active Alerts</span>
        </div>
        <div className="alert-breakdown-modern">
          {SEVERITY_ORDER.map(severity => {
            const count = groupedAlerts[severity]?.length || 0;
            if (count === 0) return null;
            const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.Unknown;
            return (
              <span
                key={severity}
                className="breakdown-item-modern"
                style={{ backgroundColor: config.bg, color: config.color }}
                aria-label={`${count} ${severity} alerts`}
              >
                {count} {severity}
              </span>
            );
          })}
        </div>
      </div>

      <div className="alert-list-modern">
        {SEVERITY_ORDER.map(severity => {
          const severityAlerts = groupedAlerts[severity] || [];
          if (severityAlerts.length === 0) return null;
          const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.Unknown;

          return (
            <div key={severity} className="alert-group-modern">
              <div
                className="alert-group-header-modern"
                style={{ backgroundColor: config.bg, color: config.color }}
                aria-label={`${severity} alerts group`}
              >
                <span className="header-icon-modern">{severity}</span>
                <span className="header-text-modern">
                  {severity} ({severityAlerts.length})
                </span>
              </div>

              {severityAlerts.slice(0, 5).map((alert, index) => (
                <div
                  key={alert.id || index}
                  className="alert-card-modern"
                  style={{
                    borderLeftColor: config.color
                  }}
                >
                  <div className="alert-header-modern">
                    <span className="alert-type-modern" style={{ color: config.color }}>
                      {alert.type}
                    </span>
                    {formatTime(alert.expires) && (
                      <span className="alert-time-modern">
                        <Clock size={12} />
                        <span>{formatTime(alert.expires)}</span>
                      </span>
                    )}
                  </div>
                  {alert.headline && (
                    <p className="alert-headline-modern">{alert.headline}</p>
                  )}
                  {alert.area && (
                    <div className="alert-meta-modern">
                      <span className="alert-area-modern">{alert.area}</span>
                      <span
                        className="alert-urgency-modern"
                        style={{ color: config.color }}
                      >
                        {alert.urgency}
                      </span>
                    </div>
                  )}
                  {alert.description && (
                    <p className="alert-description-modern">
                      {alert.description.slice(0, 200)}...
                    </p>
                  )}
                </div>
              ))}

              {severityAlerts.length > 5 && (
                <div className="alert-more-modern">
                  +{severityAlerts.length - 5} more {severity.toLowerCase()} alerts
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlertPanel;
