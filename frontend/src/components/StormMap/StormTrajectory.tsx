/**
 * StormTrajectory — Animated storm path visualization
 *
 * Renders an animated dashed polyline with direction arrows to show
 * storm movement trajectories. Uses CSS keyframes for smooth animation.
 */
import React, { useRef, useEffect, useMemo } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

interface StormTrajectoryProps {
  /** Array of [lat, lng] coordinates defining the storm path */
  coordinates: [number, number][];
  /** Storm severity for color coding */
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  /** Optional custom color override */
  color?: string;
  /** Animation speed multiplier (default: 1) */
  speed?: number;
  /** Show direction arrow at the end */
  showDirection?: boolean;
  /** Line weight in pixels */
  weight?: number;
  /** Opacity of the line (0-1) */
  opacity?: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  Extreme: '#ef4444',
  Severe: '#f97316',
  Moderate: '#fbbf24',
  Minor: '#3b82f6',
  Unknown: '#6b7280',
};

/**
 * Custom Leaflet polyline with animated dash offset
 */
const AnimatedPolyline = ({
  coordinates,
  color,
  weight = 3,
  opacity = 0.8,
  speed = 1,
  className = 'storm-trajectory',
}: {
  coordinates: [number, number][];
  color: string;
  weight?: number;
  opacity?: number;
  speed?: number;
  className?: string;
}) => {
  const pathRef = useRef<L.Polyline | null>(null);
  const animationRef = useRef<number>(0);
  const map = useMap();

  useEffect(() => {
    if (!map || coordinates.length < 2) return;

    // Create the polyline
    const polyline = L.polyline(coordinates, {
      color,
      weight,
      opacity,
      dashArray: '15, 10',
      lineCap: 'round',
      lineJoin: 'round',
      className,
      interactive: false,
    }).addTo(map);

    pathRef.current = polyline;

    // Animate dash offset using requestAnimationFrame
    let offset = 0;
    const animate = () => {
      if (!pathRef.current || !map.hasLayer(polyline)) return;
      
      offset -= 0.5 * speed;
      pathRef.current.setStyle({ dashOffset: String(offset) });
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (pathRef.current && map.hasLayer(pathRef.current)) {
        map.removeLayer(pathRef.current);
      }
    };
  }, [map, coordinates, color, weight, opacity, speed, className]);

  return null;
};

/**
 * Direction arrow marker at the end of trajectory
 */
const DirectionArrow = ({
  coordinates,
  color,
  size = 12,
}: {
  coordinates: [number, number][];
  color: string;
  size?: number;
}) => {
  const map = useMap();
  const arrowRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!map || coordinates.length < 2) return;

    const lastPoint = coordinates[coordinates.length - 1];
    const prevPoint = coordinates[coordinates.length - 2];
    
    // Calculate bearing
    const lat1 = prevPoint[0] * Math.PI / 180;
    const lat2 = lastPoint[0] * Math.PI / 180;
    const dLon = (lastPoint[1] - prevPoint[1]) * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;

    // Create arrow marker using DivIcon
    const arrowIcon = L.divIcon({
      className: 'storm-trajectory-arrow',
      html: `<svg width="${size * 2}" height="${size * 2}" viewBox="0 0 24 24" style="transform: rotate(${bearing}deg);">
        <path fill="${color}" d="M12 2 L22 12 L12 22 L14 12 L22 12 Z" />
      </svg>`,
      iconSize: [size * 2, size * 2],
      iconAnchor: [size, size],
    });

    const marker = L.marker(lastPoint, {
      icon: arrowIcon,
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(map);

    arrowRef.current = marker;

    return () => {
      if (arrowRef.current && map.hasLayer(arrowRef.current)) {
        map.removeLayer(arrowRef.current);
      }
    };
  }, [map, coordinates, color, size]);

  return null;
};

export const StormTrajectory: React.FC<StormTrajectoryProps> = ({
  coordinates,
  severity,
  color,
  speed = 1,
  showDirection = true,
  weight = 3,
  opacity = 0.8,
}) => {
  const lineColor = color || SEVERITY_COLORS[severity] || SEVERITY_COLORS.Unknown;

  // Validate coordinates
  const validCoordinates = useMemo(() => 
    coordinates.filter((c): c is [number, number] => 
      Array.isArray(c) && c.length === 2 && 
      typeof c[0] === 'number' && typeof c[1] === 'number' &&
      !isNaN(c[0]) && !isNaN(c[1])
    ),
    [coordinates]
  );

  if (validCoordinates.length < 2) {
    return null;
  }

  return (
    <>
      <AnimatedPolyline
        coordinates={validCoordinates}
        color={lineColor}
        weight={weight}
        opacity={opacity}
        speed={speed}
        className="storm-trajectory"
      />
      {showDirection && (
        <DirectionArrow
          coordinates={validCoordinates}
          color={lineColor}
          size={weight * 3}
        />
      )}
    </>
  );
};

export default StormTrajectory;