/**
 * PropertyNode — Property intelligence marker for the spatial operating system
 *
 * Displays property risk as colored circles with pulse animation for high-risk
 * properties. Integrates with the Orbital Intelligence visual language.
 */
import React, { useRef, useEffect, useMemo } from 'react';
import { CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

export interface PropertyNodeProps {
  /** Property latitude */
  lat: number;
  /** Property longitude */
  lng: number;
  /** Property address for display */
  address: string;
  /** Risk score (0-100) */
  riskScore: number;
  /** Property type */
  propertyType: 'Residential' | 'Commercial' | 'Industrial' | 'Agricultural' | 'Unknown';
  /** Current data sync state */
  status: 'LIVE' | 'SYNCING' | 'STALE' | 'DEGRADED' | 'OFFLINE';
  /** Unique property ID */
  id: string;
  /** Click handler */
  onClick?: (property: PropertyNodeProps) => void;
  /** Show popup on hover */
  showPopupOnHover?: boolean;
  /** Custom popup content */
  children?: React.ReactNode;
}

/** Risk color gradient: green (low) → yellow (medium) → red (high) */
const getRiskColor = (riskScore: number): string => {
  if (riskScore >= 75) return '#ef4444';      // Red - Critical
  if (riskScore >= 50) return '#f97316';      // Orange - High
  if (riskScore >= 25) return '#fbbf24';      // Amber - Medium
  return '#22c55e';                            // Green - Low
};

/** Risk level label */
const getRiskLabel = (riskScore: number): string => {
  if (riskScore >= 75) return 'Critical';
  if (riskScore >= 50) return 'High';
  if (riskScore >= 25) return 'Medium';
  return 'Low';
};

/** Marker radius based on risk score (8-20px) */
const getRiskRadius = (riskScore: number): number => {
  return 8 + Math.min(riskScore / 100 * 12, 12);
};

/** State indicator colors */
const STATE_COLORS: Record<string, string> = {
  LIVE: '#22c55e',       // Green
  SYNCING: '#fbbf24',    // Amber
  STALE: '#6b7280',      // Gray
  DEGRADED: '#f97316',   // Orange
  OFFLINE: '#ef4444',    // Red
};

/** State indicator pulse speeds (ms) */
const STATE_PULSE_SPEEDS: Record<string, number> = {
  LIVE: 2000,
  SYNCING: 1000,
  STALE: 0,       // No pulse
  DEGRADED: 1500,
  OFFLINE: 0,     // No pulse
};

interface StateIndicatorRef {
  element: HTMLDivElement | null;
  animationId: number;
}

const StateIndicator: React.FC<{
  status: PropertyNodeProps['status'];
  size: number;
  className?: string;
}> = ({ status, size, className = '' }) => {
  const ref = useRef<StateIndicatorRef>({ element: null, animationId: 0 });
  const pulseSpeed = STATE_PULSE_SPEEDS[status] || 0;
  const color = STATE_COLORS[status] || STATE_COLORS.OFFLINE;

  useEffect(() => {
    const el = ref.current.element;
    if (!el || pulseSpeed === 0) return;

    let startTime = performance.now();
    const animate = (timestamp: number) => {
      const progress = ((timestamp - startTime) % pulseSpeed) / pulseSpeed;
      const opacity = 0.4 + 0.4 * Math.sin(progress * Math.PI * 2);
      el.style.boxShadow = `0 0 0 ${size * 0.15}px ${color}, 0 0 0 ${size * 0.3}px ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
      ref.current.animationId = requestAnimationFrame(animate);
    };
    ref.current.animationId = requestAnimationFrame(animate);

    return () => {
      if (ref.current.animationId) {
        cancelAnimationFrame(ref.current.animationId);
      }
    };
  }, [status, pulseSpeed, color, size]);

  const isOffline = status === 'OFFLINE';

  return (
    <div
      ref={(el) => { ref.current.element = el; }}
      className={`state-indicator state-indicator-${status.toLowerCase()} ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        background: isOffline ? 'transparent' : color,
        boxShadow: `0 0 0 ${size * 0.15}px ${color}`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 10,
        ...(isOffline && {
          background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, currentColor 2px, currentColor 4px)',
          backgroundColor: 'transparent',
        }),
      }}
      aria-label={`Data status: ${status}`}
      title={`Data status: ${status}`}
    >
      {isOffline && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '60%',
          height: '2px',
          background: 'currentColor',
          transformOrigin: 'center',
          transform: 'translate(-50%, -50%) rotate(45deg)',
        }} />
      )}
    </div>
  );
};

/**
 * Custom CircleMarker with risk-based styling and state indicator
 */
const PropertyCircleMarker: React.FC<PropertyNodeProps> = ({
  lat,
  lng,
  address,
  riskScore,
  propertyType,
  status,
  id,
  onClick,
  showPopupOnHover = true,
  children,
}) => {
  const map = useMap();
  const circleRef = useRef<L.CircleMarker | null>(null);
  const riskColor = getRiskColor(riskScore);
  const riskRadius = getRiskRadius(riskScore);
  const riskLabel = getRiskLabel(riskScore);
  const isHighRisk = riskScore >= 75;

  // Pulse animation for high-risk properties
  useEffect(() => {
    if (!isHighRisk || !circleRef.current || !map.hasLayer(circleRef.current)) return;

    const circle = circleRef.current;
    let startTime = performance.now();
    const pulseDuration = 2000;

    const animate = (timestamp: number) => {
      if (!map.hasLayer(circle)) return;
      const progress = ((timestamp - startTime) % pulseDuration) / pulseDuration;
      const scale = 1 + 0.15 * Math.sin(progress * Math.PI * 2);
      circle.setRadius(riskRadius * scale);
      circle.setStyle({ fillOpacity: 0.5 + 0.2 * Math.sin(progress * Math.PI * 2) });
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [map, isHighRisk, riskRadius]);

  const handleClick = (e: L.LeafletMouseEvent) => {
    e.originalEvent?.stopPropagation();
    onClick?.({ lat, lng, address, riskScore, propertyType, status, id, onClick, showPopupOnHover, children });
  };

  return (
    <CircleMarker
      ref={circleRef}
      center={[lat, lng]}
      radius={riskRadius}
      color="#ffffff"
      fillColor={riskColor}
      fillOpacity={0.6}
      weight={2}
      className={`property-node-marker risk-${riskLabel.toLowerCase()} ${isHighRisk ? 'high-risk-pulse' : ''}`}
      eventHandlers={{
        click: handleClick,
        mouseover: (e) => {
          if (circleRef.current) {
            circleRef.current.setStyle({ fillOpacity: 0.9, weight: 3 });
            circleRef.current.bringToFront();
          }
        },
        mouseout: (e) => {
          if (circleRef.current) {
            circleRef.current.setStyle({ fillOpacity: 0.6, weight: 2 });
          }
        },
      }}
    >
      {showPopupOnHover && (
        <Popup
          className="storm-popup-modern property-popup"
          aria-label={`Property: ${address}`}
        >
          <div className="popup-content-modern">
            <div className="popup-header">
              <span className={`badge risk-badge-${riskLabel.toLowerCase()}`}>
                {riskLabel} Risk ({riskScore})
              </span>
              <span className={`state-badge state-${status.toLowerCase()}`}>
                {status}
              </span>
            </div>
            <h4>{address}</h4>
            <p className="popup-period">
              <strong>Type:</strong> {propertyType}
            </p>
            <p className="popup-period">
              <strong>Risk Score:</strong> {riskScore}/100
            </p>
            <p className="popup-period">
              <strong>Status:</strong> {status}
            </p>
            {children}
          </div>
        </Popup>
      )}
      <StateIndicator status={status} size={riskRadius * 2 + 8} />
    </CircleMarker>
  );
};

export const PropertyNode: React.FC<PropertyNodeProps> = (props) => {
  // Validate required props
  const validProps = useMemo(() => ({
    ...props,
    lat: Number(props.lat),
    lng: Number(props.lng),
    riskScore: Math.max(0, Math.min(100, Number(props.riskScore))),
  }), [props.lat, props.lng, props.riskScore]);

  if (isNaN(validProps.lat) || isNaN(validProps.lng)) {
    return null;
  }

  return <PropertyCircleMarker {...validProps} />;
};

export default PropertyNode;