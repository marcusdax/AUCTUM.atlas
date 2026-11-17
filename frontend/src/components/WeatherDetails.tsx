import React from 'react';
import { MapPin, Thermometer, Wind, Droplets, Gauge, Info, Cloud, CloudRain, Sun } from '../assets/icons';
import './WeatherDetails.css';

// Weather icon selector based on forecast text
const getWeatherIcon = (shortForecast) => {
  if (!shortForecast) return Cloud;
  const text = shortForecast.toLowerCase();
  if (text.includes('sunny') || text.includes('clear')) return Sun;
  if (text.includes('rain') || text.includes('shower')) return CloudRain;
  if (text.includes('cloud')) return Cloud;
  if (text.includes('storm') || text.includes('thunder')) return CloudRain;
  return Cloud;
};

// SVG mini bar chart for temperature forecast
const TempMiniChart = ({ periods }) => {
  if (!periods || periods.length === 0) return null;

  const temps = periods.map(p => p.temperature || 0);
  const maxTemp = Math.max(...temps, 1);
  const minTemp = Math.min(...temps, 0);
  const range = maxTemp - minTemp || 1;
  const width = 200;
  const height = 60;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="mini-chart"
      role="img"
      aria-label="Temperature forecast chart"
    >
      {/* Background grid lines */}
      <line x1="0" y1={height - 4} x2={width} y2={height - 4} stroke="var(--c-border)" strokeWidth="1" />

      {periods.map((period, i) => {
        const barHeight = Math.max(4, ((period.temperature - minTemp) / range) * (height - 20));
        const x = 12 + i * ((width - 24) / periods.length);
        const barW = (width - 24) / periods.length - 4;
        const isToday = i === 0;

        return (
          <g key={i}>
            <rect
              x={x}
              y={height - 8 - barHeight}
              width={barW}
              height={barHeight}
              rx="2"
              fill={isToday ? 'var(--c-blue)' : 'var(--c-bg-accent)'}
              stroke={isToday ? 'var(--c-blue)' : 'var(--c-border)'}
              strokeWidth="1"
            />
            <text
              x={x + barW / 2}
              y={height - 4}
              textAnchor="middle"
              fontSize="9"
              fill="var(--c-text-tertiary)"
            >
              {period.name?.slice(0, 3) || ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const WeatherDetails = ({ data }) => {
  if (data.loading) {
    return (
      <div className="weather-details-modern weather-loading" role="status">
        <div className="loading-skeleton">
          <div className="skeleton-line"></div>
          <div className="skeleton-line short"></div>
          <div className="skeleton-line shorter"></div>
        </div>
        <p>Fetching weather data…</p>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="weather-details-modern weather-error" role="alert">
        <Info size={32} className="error-icon-svg" />
        <p>{data.error}</p>
      </div>
    );
  }

  const { forecast, severe } = data;

  return (
    <div className="weather-details-modern">
      {/* ===== Location Header ===== */}
      <div className="location-header-modern">
        <div className="location-coords-modern">
          <MapPin size={14} />
          <span>{data.lat.toFixed(4)}, {data.lon.toFixed(4)}</span>
        </div>
        {forecast?.location?.city && (
          <h4 className="location-city-modern">
            {forecast.location.city}, {forecast.location.state}
          </h4>
        )}
        {forecast?.location?.city && (
          <p className="location-region-modern">{forecast.location.state}, {forecast.location.country || 'USA'}</p>
        )}
      </div>

      {/* ===== Temperature Mini Chart ===== */}
      {forecast?.periods && forecast.periods.length > 1 && (
        <div className="temp-chart-container">
          <h5 className="section-label-modern">7-Day Temperature Trend</h5>
          <TempMiniChart periods={forecast.periods.slice(0, 7)} />
        </div>
      )}

      {/* ===== Severe Weather Warning ===== */}
      {severe?.hasAlerts && (
        <div className="severe-warning-modern" role="alert" aria-live="assertive">
          <div className="warning-header-modern">
            <Info size={20} className="warning-icon-svg" />
            <span className="warning-title-modern">Severe Weather Alert</span>
          </div>
          <p className="warning-count-modern">
            {severe.alertCount} {severe.alertCount === 1 ? 'active alert' : 'active alerts'} for this area
          </p>
          <div className="warning-alerts-modern">
            {severe.alerts.slice(0, 3).map((alert, idx) => {
              const Icon = getWeatherIcon(alert.type);
              return (
                <div
                  key={idx}
                  className="warning-item-modern"
                  style={{
                    borderLeftColor: getSeverityColorValue(alert.severity),
                    backgroundColor: getSeverityBgValue(alert.severity)
                  }}
                >
                  <div className="warning-item-left">
                    <Icon size={16} className="warning-item-icon" />
                    <span className="item-type-modern">{alert.type}</span>
                  </div>
                  <span
                    className="item-severity-modern"
                    style={{ color: getSeverityColorValue(alert.severity) }}
                  >
                    {alert.severity}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Current Conditions ===== */}
      {severe?.currentConditions && (
        <div className="current-conditions-modern">
          <h5 className="section-label-modern">Current Conditions</h5>
          <div className="conditions-grid-modern">
            {severe.currentConditions.temperature != null && (
              <div className="condition-item-modern">
                <div className="condition-icon-wrapper">
                  <Thermometer size={16} />
                </div>
                <span className="condition-label-modern">Temperature</span>
                <span className="condition-value-modern">
                  {severe.currentConditions.temperature}°F
                </span>
              </div>
            )}
            {severe.currentConditions.windSpeed && (
              <div className="condition-item-modern">
                <div className="condition-icon-wrapper">
                  <Wind size={16} />
                </div>
                <span className="condition-label-modern">Wind</span>
                <span className="condition-value-modern">
                  {severe.currentConditions.windSpeed}
                </span>
              </div>
            )}
            {severe.currentConditions.humidity != null && (
              <div className="condition-item-modern">
                <div className="condition-icon-wrapper">
                  <Droplets size={16} />
                </div>
                <span className="condition-label-modern">Humidity</span>
                <span className="condition-value-modern">
                  {severe.currentConditions.humidity}%
                </span>
              </div>
            )}
            {severe.currentConditions.visibility != null && (
              <div className="condition-item-modern">
                <div className="condition-icon-wrapper">
                  <Gauge size={16} />
                </div>
                <span className="condition-label-modern">Visibility</span>
                <span className="condition-value-modern">
                  {(severe.currentConditions.visibility / 1609.34)?.toFixed(1)} mi
                </span>
              </div>
            )}
          </div>
          {severe.currentConditions.shortForecast && (
            <p className="forecast-short-modern">
              {severe.currentConditions.shortForecast}
            </p>
          )}
          {severe.currentConditions.detailedForecast && (
            <p className="forecast-detailed-modern">
              {severe.currentConditions.detailedForecast}
            </p>
          )}
        </div>
      )}

      {/* ===== Forecast Periods ===== */}
      {forecast?.periods && (
        <div className="forecast-section-modern">
          <h5 className="section-label-modern">7-Day Forecast</h5>
          <div className="forecast-list-modern">
            {forecast.periods.slice(0, 7).map((period, idx) => {
              const Icon = getWeatherIcon(period.shortForecast);
              const isDay = period.isDaytime !== false;

              return (
                <div key={idx} className="forecast-period-modern">
                  <div className="period-main">
                    <span className="period-name-modern">
                      {period.name}
                    </span>
                    {period.temperature !== null && (
                      <span className="period-temp-modern">
                        {isDay ? 'High' : 'Low'}: {period.temperature}°{period.temperatureUnit}
                      </span>
                    )}
                  </div>
                  <div className="period-details">
                    <div className="period-weather">
                      <Icon size={16} className="period-weather-icon" />
                      <span className="period-short-forecast">{period.shortForecast}</span>
                    </div>
                    {period.windSpeed && (
                      <span className="period-wind-modern">
                        <Wind size={12} /> {period.windSpeed}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Footer ===== */}
      <div className="weather-footer-modern">
        <span>
          Updated: {new Date(severe?.timestamp || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>
    </div>
  );
};

// Helper: map severity to color value
function getSeverityColorValue(severity) {
  switch (severity) {
    case 'Extreme': return 'var(--c-severity-extreme)';
    case 'Severe': return 'var(--c-severity-severe)';
    case 'Moderate': return 'var(--c-severity-moderate)';
    case 'Minor': return 'var(--c-severity-minor)';
    default: return 'var(--c-text-disabled)';
  }
}

function getSeverityBgValue(severity) {
  switch (severity) {
    case 'Extreme': return 'var(--c-sev-extreme-bg)';
    case 'Severe': return 'var(--c-sev-severe-bg)';
    case 'Moderate': return 'var(--c-sev-moderate-bg)';
    case 'Minor': return 'var(--c-sev-minor-bg)';
    default: return 'rgba(100, 116, 128, 0.12)';
  }
}

export default WeatherDetails;
