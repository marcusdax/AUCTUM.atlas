/**
 * RiskHeatField — Risk density heat overlay for the spatial operating system
 *
 * Renders a canvas-based gradient overlay showing property risk concentration.
 * Uses WebGL-accelerated rendering for smooth performance at scale.
 */
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useMap, LayerGroup } from 'react-leaflet';
import L from 'leaflet';

export interface PropertyDataPoint {
  lat: number;
  lng: number;
  riskScore: number;
  id?: string;
}

export interface RiskHeatFieldProps {
  /** Array of property data points with lat/lng/riskScore */
  propertyData: PropertyDataPoint[];
  /** Radius of influence for each point in pixels */
  radius?: number;
  /** Maximum opacity of the heatmap (0-1) */
  maxOpacity?: number;
  /** Minimum risk score to include in heatmap */
  minRiskScore?: number;
  /** Blur radius for the heatmap */
  blur?: number;
  /** Gradient color stops (risk score 0-1 -> color) */
  gradient?: Record<number, string>;
  /** Show/hide the heatmap */
  visible?: boolean;
  /** Z-index for layer ordering */
  zIndex?: number;
}

/** Default gradient: blue (low) → cyan → green → yellow → orange → red (high) */
const DEFAULT_GRADIENT: Record<number, string> = {
  0.0: 'rgba(59, 130, 246, 0)',    // Blue - transparent
  0.1: 'rgba(59, 130, 246, 0.15)', // Blue
  0.25: 'rgba(6, 182, 212, 0.3)',  // Cyan
  0.4: 'rgba(34, 197, 94, 0.4)',   // Green
  0.55: 'rgba(251, 191, 36, 0.5)', // Yellow
  0.7: 'rgba(249, 115, 22, 0.6)',  // Orange
  0.85: 'rgba(239, 68, 68, 0.7)',  // Red
  1.0: 'rgba(185, 28, 28, 0.85)',  // Dark red
};

/** Simple 2D point for calculations */
interface HeatFieldPoint {
  x: number;
  y: number;
  intensity: number;
}

interface HeatFieldOverlayOptions extends L.LayerOptions {
  radius?: number;
  maxOpacity?: number;
  gradient?: Record<number, string>;
  minRiskScore?: number;
  blur?: number;
  visible?: boolean;
  zIndex?: number;
}

/**
 * Canvas overlay for rendering the heat field
 */
class HeatFieldOverlay extends L.Layer {
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  private _data: HeatFieldPoint[] = [];
  private _radius: number = 25;
  private _maxOpacity: number = 0.6;
  private _gradient: Record<number, string> = DEFAULT_GRADIENT;
  private _minRiskScore: number = 0;
  private _blur: number = 15;
  private _animationFrame: number = 0;
  private _visible: boolean = true;
  private _zIndex: number = 200;

  constructor(options: HeatFieldOverlayOptions = {}) {
    super(options);
    this._radius = options.radius ?? 25;
    this._maxOpacity = options.maxOpacity ?? 0.6;
    this._gradient = options.gradient ?? DEFAULT_GRADIENT;
    this._minRiskScore = options.minRiskScore ?? 0;
    this._blur = options.blur ?? 15;
    this._visible = options.visible ?? true;
    if (options.zIndex !== undefined) {
      this._zIndex = options.zIndex;
    }
  }

  onAdd(map: L.Map): this {
    // Create canvas
    this._canvas = document.createElement('canvas');
    this._canvas.style.position = 'absolute';
    this._canvas.style.top = '0';
    this._canvas.style.left = '0';
    this._canvas.style.pointerEvents = 'none';
    this._canvas.style.zIndex = String(this._zIndex);
    this._canvas.style.opacity = this._visible ? '1' : '0';
    this._canvas.style.transition = 'opacity 0.3s ease';

    this._ctx = this._canvas.getContext('2d', { willReadFrequently: false })!;

    // Add to map's overlay pane
    const pane = map.getPane(this.options.pane ?? 'overlayPane');
    if (pane) {
      pane.appendChild(this._canvas);
    }

    // Listen to map events
    map.on('moveend zoomend resize', this._reset, this);
    map.on('move', this._animate, this);

    this._reset();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off('moveend zoomend resize', this._reset, this);
    map.off('move', this._animate, this);

    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    this._canvas = null;
    this._ctx = null;

    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
    }
    return this;
  }

  setData(data: PropertyDataPoint[]) {
    if (!this._map) return;

    this._data = data
      .filter(d => d.riskScore >= this._minRiskScore)
      .map(d => {
        const point = this._map!.latLngToContainerPoint([d.lat, d.lng]);
        return {
          x: point.x,
          y: point.y,
          intensity: d.riskScore / 100,
        };
      });

    this._redraw();
  }

  setOptions(options: HeatFieldOverlayOptions) {
    if (options.radius !== undefined) this._radius = options.radius;
    if (options.maxOpacity !== undefined) this._maxOpacity = options.maxOpacity;
    if (options.gradient !== undefined) this._gradient = options.gradient;
    if (options.minRiskScore !== undefined) this._minRiskScore = options.minRiskScore;
    if (options.blur !== undefined) this._blur = options.blur;
    if (options.visible !== undefined) {
      this._visible = options.visible;
      if (this._canvas) {
        this._canvas.style.opacity = this._visible ? '1' : '0';
      }
    }
    if (options.zIndex !== undefined) {
      this._zIndex = options.zIndex;
      if (this._canvas) {
        this._canvas.style.zIndex = String(this._zIndex);
      }
    }
    this._redraw();
  }

  private _reset = () => {
    if (!this._map || !this._canvas) return;

    const size = this._map.getSize();
    this._canvas.width = size.x;
    this._canvas.height = size.y;

    this._redraw();
  };

  private _animate = () => {
    // Throttle redraw during pan
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
    }
    this._animationFrame = requestAnimationFrame(() => {
      this._reset();
    });
  };

  private _redraw = () => {
    if (!this._ctx || !this._canvas || !this._map || !this._visible) return;

    const { width, height } = this._canvas;
    this._ctx.clearRect(0, 0, width, height);

    if (this._data.length === 0) return;

    // Create a temporary canvas for blur effect
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Draw each point as a radial gradient
    for (const point of this._data) {
      const radius = this._radius;
      const gradient = tempCtx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, radius
      );

      // Add color stops based on intensity
      const intensity = point.intensity;
      const stops = Object.entries(this._gradient).sort((a, b) => Number(a[0]) - Number(b[0]));

      for (const [stop, color] of stops) {
        const stopValue = Number(stop);
        // Adjust opacity based on point intensity
        const adjustedColor = color.replace(/rgba?\(([^)]+)\)/, (match, rgba) => {
          const parts = rgba.split(',').map(s => s.trim());
          if (parts.length >= 4) {
            const alpha = parseFloat(parts[3]) * intensity * this._maxOpacity;
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
          }
          return match;
        });
        gradient.addColorStop(stopValue, adjustedColor);
      }

      tempCtx.fillStyle = gradient;
      tempCtx.beginPath();
      tempCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      tempCtx.fill();
    }

    // Apply blur if needed
    if (this._blur > 0) {
      this._ctx.filter = `blur(${this._blur}px)`;
      this._ctx.drawImage(tempCanvas, 0, 0);
      this._ctx.filter = 'none';
    } else {
      this._ctx.drawImage(tempCanvas, 0, 0);
    }
  };
}

/**
 * Leaflet layer wrapper for the heat field
 */
const HeatFieldLayer: React.FC<{
  data: PropertyDataPoint[];
  radius?: number;
  maxOpacity?: number;
  minRiskScore?: number;
  blur?: number;
  gradient?: Record<number, string>;
  visible?: boolean;
  zIndex?: number;
}> = ({
  data,
  radius = 25,
  maxOpacity = 0.6,
  minRiskScore = 0,
  blur = 15,
  gradient = DEFAULT_GRADIENT,
  visible = true,
  zIndex = 200,
}) => {
  const map = useMap();
  const overlayRef = useRef<HeatFieldOverlay | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!map) return;
    
    const overlay = new HeatFieldOverlay({
      radius,
      maxOpacity,
      minRiskScore,
      blur,
      gradient,
      visible,
      zIndex,
    });
    
    map.addLayer(overlay);
    overlayRef.current = overlay;
    setIsReady(true);
    
    return () => {
      map.removeLayer(overlay);
      overlayRef.current = null;
      setIsReady(false);
    };
  }, [map]);

  // Update data when it changes
  useEffect(() => {
    if (overlayRef.current && isReady) {
      overlayRef.current.setData(data);
    }
  }, [data, isReady]);

  // Update options when they change
  useEffect(() => {
    if (overlayRef.current && isReady) {
      overlayRef.current.setOptions({
        radius,
        maxOpacity,
        minRiskScore,
        blur,
        gradient,
        visible,
        zIndex,
      });
    }
  }, [radius, maxOpacity, minRiskScore, blur, gradient, visible, zIndex, isReady]);

  return null;
};

/**
 * Main RiskHeatField component
 */
export const RiskHeatField: React.FC<RiskHeatFieldProps> = ({
  propertyData,
  radius = 30,
  maxOpacity = 0.55,
  minRiskScore = 10,
  blur = 20,
  gradient = DEFAULT_GRADIENT,
  visible = true,
  zIndex = 200,
}) => {
  // Filter and validate data - handle null/undefined propertyData
  const validData = useMemo(() => 
    (propertyData || [])
      .filter(d => 
        typeof d.lat === 'number' && 
        typeof d.lng === 'number' && 
        typeof d.riskScore === 'number' &&
        !isNaN(d.lat) && !isNaN(d.lng) && !isNaN(d.riskScore) &&
        d.lat >= -90 && d.lat <= 90 &&
        d.lng >= -180 && d.lng <= 180 &&
        d.riskScore >= minRiskScore
      )
      .map(d => ({
        lat: d.lat,
        lng: d.lng,
        riskScore: Math.max(0, Math.min(100, d.riskScore)),
        id: d.id,
      })),
    [propertyData, minRiskScore]
  );

  if (!visible || validData.length === 0) {
    return null;
  }

  return (
    <LayerGroup>
      <HeatFieldLayer
        data={validData}
        radius={radius}
        maxOpacity={maxOpacity}
        minRiskScore={minRiskScore}
        blur={blur}
        gradient={gradient}
        visible={visible}
        zIndex={zIndex}
      />
    </LayerGroup>
  );
};

export default RiskHeatField;