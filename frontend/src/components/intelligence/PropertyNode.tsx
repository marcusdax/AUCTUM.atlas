/**
 * PropertyNode — Property intelligence node for the map
 * 
 * Colored circle marker on map based on riskScore
 * Pulse animation for high-risk properties
 * Click handler for property details
 */

import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Home, Briefcase, Users, Cloud, Zap, AlertTriangle, TrendingUp, ExternalLink, ChevronRight } from 'lucide-react';
import { CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import clsx from 'clsx';

export interface PropertyNodeProps {
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
  /** Property address */
  address: string;
  /** Risk score 0-100 */
  riskScore: number;
  /** Property status */
  status: string;
  /** Property type */
  propertyType: 'job' | 'lead' | 'storm' | 'property';
  /** Unique identifier */
  id: string;
  /** Source entity ID */
  sourceId: string;
  /** Optional storm name for storm-type properties */
  stormName?: string;
  /** Optional property metadata */
  metadata?: Record<string, unknown>;
  /** Click handler */
  onClick?: (property: PropertyNodeProps) => void;
  /** Whether this node is selected */
  isSelected?: boolean;
  /** Custom radius override */
  radius?: number;
}

/**
 * Property intelligence node marker for the storm map.
 * Renders as a colored circle with risk-based coloring and pulse animation for high-risk properties.
 */
const PropertyNode: React.FC<PropertyNodeProps> = ({
  lat,
  lng,
  address,
  riskScore,
  status,
  propertyType,
  id,
  sourceId,
  stormName,
  metadata,
  onClick,
  isSelected = false,
  radius,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const map = useMap();

  // Risk-based styling
  const riskConfig = useMemo(() => {
    if (riskScore >= 70) {
      return {
        color: '#ef4444', // red
        bgColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: '#ef4444',
        pulseColor: 'rgba(239, 68, 68, 0.6)',
        label: 'CRITICAL',
        icon: AlertTriangle,
      };
    }
    if (riskScore >= 40) {
      return {
        color: '#f97316', // orange
        bgColor: 'rgba(249, 115, 22, 0.2)',
        borderColor: '#f97316',
        pulseColor: 'rgba(249, 115, 22, 0.6)',
        label: 'HIGH',
        icon: Zap,
      };
    }
    if (riskScore >= 20) {
      return {
        color: '#fbbf24', // amber
        bgColor: 'rgba(251, 191, 36, 0.2)',
        borderColor: '#fbbf24',
        pulseColor: 'rgba(251, 191, 36, 0.6)',
        label: 'MODERATE',
        icon: TrendingUp,
      };
    }
    return {
      color: '#22c55e', // green
      bgColor: 'rgba(34, 197, 94, 0.2)',
      borderColor: '#22c55e',
      pulseColor: 'rgba(34, 197, 94, 0.6)',
      label: 'LOW',
      icon: Home,
    };
  }, [riskScore]);

  // Property type icon and color
  const typeConfig = useMemo(() => {
    switch (propertyType) {
      case 'job':
        return { icon: Briefcase, label: 'JOB', color: '#3b82f6' };
      case 'lead':
        return { icon: Users, label: 'LEAD', color: '#8b5cf6' };
      case 'storm':
        return { icon: Cloud, label: 'STORM', color: '#06b6d4' };
      default:
        return { icon: Home, label: 'PROPERTY', color: '#64748b' };
    }
  }, [propertyType]);

  const computedRadius = useMemo(() => {
    if (radius) return radius;
    // Base radius on risk score: 8-16px
    return Math.max(8, Math.min(16, 8 + (riskScore / 100) * 8));
  }, [radius, riskScore]);

  // Handle click - both on marker and for external handler
  const handleClick = (e: React.MouseEvent<SVGElement> | L.LeafletMouseEvent) => {
    if ('stopPropagation' in e) {
      e.stopPropagation();
    }
    setShowPopup(true);
    onClick?.({
      lat,
      lng,
      address,
      riskScore,
      status,
      propertyType,
      id,
      sourceId,
      stormName,
      metadata,
    });
  };

  // Pulse animation for high-risk properties
  const shouldPulse = riskScore >= 70 || (riskScore >= 40 && propertyType === 'storm');

  // Custom SVG marker for high-risk properties
  const markerIcon = useMemo(() => {
    if (!shouldPulse) return null;

    return L.divIcon({
      className: 'property-node-pulse-marker',
      html: `
        <div class="pulse-ring" style="
          width: ${computedRadius * 3}px;
          height: ${computedRadius * 3}px;
          border: 2px solid ${riskConfig.pulseColor};
          border-radius: 50%;
          animation: pulse-ring 2s ease-out infinite;
        "></div>
        <div class="pulse-ring" style="
          width: ${computedRadius * 2.5}px;
          height: ${computedRadius * 2.5}px;
          border: 2px solid ${riskConfig.pulseColor};
          border-radius: 50%;
          animation: pulse-ring 2s ease-out 0.5s infinite;
        "></div>
        <div class="pulse-ring" style="
          width: ${computedRadius * 2}px;
          height: ${computedRadius * 2}px;
          border: 2px solid ${riskConfig.pulseColor};
          border-radius: 50%;
          animation: pulse-ring 2s ease-out 1s infinite;
        "></div>
      `,
      iconSize: [computedRadius * 3, computedRadius * 3],
      iconAnchor: [computedRadius * 1.5, computedRadius * 1.5],
    });
  }, [shouldPulse, computedRadius, riskConfig.pulseColor]);

  // Inject pulse animation styles once
  useEffect(() => {
    if (shouldPulse && !document.getElementById('property-node-pulse-styles')) {
      const style = document.createElement('style');
      style.id = 'property-node-pulse-styles';
      style.textContent = `
        @keyframes pulse-ring {
          0% {
            transform: scale(0.5);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        .property-node-pulse-marker {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .property-node-pulse-marker .pulse-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
      `;
      document.head.appendChild(style);
      return () => {
        if (document.getElementById('property-node-pulse-styles')) {
          document.getElementById('property-node-pulse-styles')?.remove();
        }
      };
    }
  }, [shouldPulse]);

  // Render popup content
  const popupContent = (
    <div className="property-node-popup p-3 min-w-[280px]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', `bg-[${riskConfig.color}]/10 text-[${riskConfig.color}]`)}>
            <typeConfig.icon size={16} />
          </div>
          <div>
            <p className="font-semibold text-text-primary truncate max-w-[180px]">{address}</p>
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[hsl(var(--background-elevated))]">
                <typeConfig.icon size={10} />
                {typeConfig.label}
              </span>
              <span className={clsx('flex items-center gap-1 px-1.5 py-0.5 rounded font-medium', `bg-[${riskConfig.color}]/10 text-[${riskConfig.color}]`)}>
                <riskConfig.icon size={10} />
                {riskConfig.label} ({riskScore})
              </span>
            </div>
          </div>
        </div>
        {isSelected && (
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-white">
            <MapPin size={12} />
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-text-secondary">
          <MapPin size={14} className="text-text-tertiary" />
          <span className="font-mono">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
        </div>

        {stormName && (
          <div className="flex items-center gap-2 text-amber">
            <Zap size={14} />
            <span>Associated Storm: <span className="font-medium text-text-primary">{stormName}</span></span>
          </div>
        )}

        <div className="flex items-center gap-2 text-text-secondary">
          <span className="text-text-tertiary">Status:</span>
          <span className="font-medium text-text-primary capitalize">{status.toLowerCase().replace('_', ' ')}</span>
        </div>

        {metadata && Object.keys(metadata).length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-text-tertiary mb-1">Metadata</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {Object.entries(metadata).slice(0, 6).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-text-tertiary capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-text-primary font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-xs text-text-tertiary">ID: {sourceId.slice(0, 8)}...</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick?.({ lat, lng, address, riskScore, status, propertyType, id, sourceId, stormName, metadata });
          }}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
        >
          View Details
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Pulse rings for high-risk properties */}
      {shouldPulse && markerIcon && (
        <CircleMarker
          center={[lat, lng]}
          radius={computedRadius * 1.5}
          pathOptions={{
            fillColor: 'transparent',
            color: 'transparent',
            weight: 0,
            interactive: false,
          }}
          className="property-node-pulse-container"
        >
          <div className="property-node-pulse-marker leaflet-zoom-hide" style={{
            width: `${computedRadius * 3}px`,
            height: `${computedRadius * 3}px`,
          }}>
            <div className="pulse-ring" style={{
              width: `${computedRadius * 3}px`,
              height: `${computedRadius * 3}px`,
              border: `2px solid ${riskConfig.pulseColor}`,
              borderRadius: '50%',
              animation: 'pulse-ring 2s ease-out infinite',
            }}></div>
            <div className="pulse-ring" style={{
              width: `${computedRadius * 2.5}px`,
              height: `${computedRadius * 2.5}px`,
              border: `2px solid ${riskConfig.pulseColor}`,
              borderRadius: '50%',
              animation: 'pulse-ring 2s ease-out 0.5s infinite',
            }}></div>
            <div className="pulse-ring" style={{
              width: `${computedRadius * 2}px`,
              height: `${computedRadius * 2}px`,
              border: `2px solid ${riskConfig.pulseColor}`,
              borderRadius: '50%',
              animation: 'pulse-ring 2s ease-out 1s infinite',
            }}></div>
          </div>
        </CircleMarker>
      )}

      {/* Main property marker */}
      <CircleMarker
        center={[lat, lng]}
        radius={computedRadius}
        pathOptions={{
          fillColor: riskConfig.bgColor,
          color: riskConfig.borderColor,
          fillOpacity: isHovered || isSelected ? 0.4 : 0.25,
          weight: isSelected ? 3 : 2,
          opacity: 0.8,
          dashArray: propertyType === 'storm' ? '4, 4' : undefined,
          interactive: true,
          className: clsx(
            'property-node-marker transition-all duration-200',
            isHovered && 'hover-scale',
            isSelected && 'selected',
            shouldPulse && 'high-risk'
          ),
        }}
        eventHandlers={{
          mouseover: () => setIsHovered(true),
          mouseout: () => setIsHovered(false),
          click: handleClick,
        }}
      >
        {showPopup && (
          <Popup
            className="property-node-popup-container"
            closeButton={false}
            autoClose={false}
            closeOnClick={false}
          >
            {popupContent}
          </Popup>
        )}
      </CircleMarker>
    </>
  );
};

/**
 * Batch render multiple property nodes efficiently
 */
export interface PropertyNodeBatchProps {
  properties: PropertyNodeProps[];
  onPropertyClick?: (property: PropertyNodeProps) => void;
  selectedId?: string;
}

export const PropertyNodeBatch: React.FC<PropertyNodeBatchProps> = ({
  properties,
  onPropertyClick,
  selectedId,
}) => {
  return (
    <>
      {properties.map((prop) => (
        <PropertyNode
          key={prop.id}
          {...prop}
          isSelected={selectedId === prop.id}
          onClick={onPropertyClick}
        />
      ))}
    </>
  );
};

/**
 * Risk-based color utility for external use
 */
export function getRiskColor(riskScore: number): { color: string; bgColor: string; label: string } {
  if (riskScore >= 70) return { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', label: 'CRITICAL' };
  if (riskScore >= 40) return { color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)', label: 'HIGH' };
  if (riskScore >= 20) return { color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.15)', label: 'MODERATE' };
  return { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', label: 'LOW' };
}

/**
 * Get property type configuration
 */
export function getPropertyTypeConfig(type: PropertyNodeProps['propertyType']) {
  switch (type) {
    case 'job':
      return { icon: Briefcase, label: 'JOB', color: '#3b82f6' };
    case 'lead':
      return { icon: Users, label: 'LEAD', color: '#8b5cf6' };
    case 'storm':
      return { icon: Cloud, label: 'STORM', color: '#06b6d4' };
    default:
      return { icon: Home, label: 'PROPERTY', color: '#64748b' };
  }
}

export default PropertyNode;