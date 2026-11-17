/**
 * StormMap — Orbital Intelligence Spatial Operating System for Atlas Helios UI v2
 *
 * Central spatial operating system combining:
 * - Storm tracking with animated trajectories
 * - Property intelligence nodes with risk scoring
 * - Risk heat field density overlays
 * - Real-time state indicators (LIVE/SYNCING/STALE/DEGRADED/OFFLINE)
 * - NOAA radar overlay with adjustable opacity
 * - Synchronized minimap for navigation context
 * - Multi-layer base maps (OSM/Dark/Light/Satellite)
 *
 * API endpoints:
 *   GET /api/v1/maps/storm-markers     — point locations of active alerts
 *   GET /api/v1/maps/alerts-geojson    — polygon geometries of active alerts
 *   GET /api/v1/properties/intelligence — property risk intelligence data
 *   GET /api/v1/storms/trajectories    — animated storm paths
 */
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  useMapEvents,
  useMap,
  LayersControl,
  LayerGroup,
  Polygon,
  Polyline,
  Rectangle,
} from 'react-leaflet';
import { api } from '../services/api';
import {
  MapPin,
  Wind,
  RefreshCw,
  WifiOff,
  Navigation,
  Layers,
  Sun,
  Moon,
  Satellite,
  Activity,
  Zap,
  Thermometer,
  Map,
  Eye,
  EyeOff,
  AlertTriangle,
  Target,
} from 'lucide-react';
import type {
  FeatureCollection,
  Feature,
  GeoJsonProperties,
  Geometry,
} from 'geojson';
import { StormTrajectory } from './StormMap/StormTrajectory';
import { PropertyNode, type PropertyNodeProps } from './StormMap/PropertyNode';
import { RiskHeatField, type PropertyDataPoint } from './StormMap/RiskHeatField';
import type { StormEventSummary } from '../types/ai';
import { useMapLayersStore } from '../stores/mapLayersStore';
import './StormMap.css';

const { Overlay } = LayersControl;

// ──────────────── Constants ────────────────

/** Default US-centered map view */
const US_CENTER: [number, number] = [39.8283, -98.5795];
const US_ZOOM = 4;

/** Severity → visual configuration. Colors mirror the design-system CSS variables. */
const SEVERITY_CONFIG: Record<
  string,
  { color: string; radius: number; badgeClass: string }
> = {
  Extreme: { color: '#ef4444', radius: 12, badgeClass: 'badge-extreme' },
  Severe: { color: '#f97316', radius: 10, badgeClass: 'badge-severe' },
  Moderate: { color: '#fbbf24', radius: 8, badgeClass: 'badge-moderate' },
  Minor: { color: '#3b82f6', radius: 6, badgeClass: 'badge-minor' },
  Unknown: { color: '#6b7280', radius: 6, badgeClass: 'badge-info' },
};

interface BaseTile {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  icon: ReactNode;
}

/** Base map tile configurations (OpenStreetMap-based) */
const BASE_TILES: BaseTile[] = [
  {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    icon: <Layers size={16} />,
  },
  {
    id: 'dark',
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    icon: <Moon size={16} />,
  },
  {
    id: 'light',
    name: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    icon: <Sun size={16} />,
  },
  {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
    icon: <Satellite size={16} />,
  },
];

/** NWS radar & GOES satellite overlay configurations */
const RADAR_URL = 'https://radar.weather.gov/ridge/standard/{z}/{x}/{y}_0.png';
const RADAR_ATTRIBUTION = 'NOAA National Weather Service';
const GOES_SATELLITE_URL =
  'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-east-vis-1km-900913/{z}/{x}/{y}.png';
const GOES_ATTRIBUTION = 'NOAA GOES-East / Iowa Environmental Mesonet';
const DEFAULT_RADAR_OPACITY = 0.6;

// ──────────────── Types ────────────────

interface StormMapProps {
  /** Optional storm events/polygons to render (e.g. company StormEvent data) */
  storms?: any[];
  /** Called when the user clicks empty map space */
  onMapClick?: (lat: number, lng: number) => void;
  /** Currently selected location — the map will center on it.
   *  Supports both `lng` (preferred) and `lon` (alias) for backward compatibility. */
  selectedLocation: { lat: number; lng?: number; lon?: number } | null;
  /** Height of the map container (defaults to 100%) */
  height?: string;

  // Orbital Intelligence layer toggles
  /** Show storm trajectories overlay */
  showTrajectories?: boolean;
  /** Show property intelligence nodes overlay */
  showPropertyNodes?: boolean;
  /** Show risk heat field overlay */
  showRiskHeatField?: boolean;
  /** Show intelligence panel on property click */
  showIntelligencePanel?: boolean;

  // ── Storm Intelligence additive props (docs/AI_STORM_ARCHITECTURE.md §6.3) ──
  /** Storm events from GET /storm-intel/overview — rendered as severity-tinted outlines. */
  stormEvents?: StormEventSummary[];
  /** Called when the user clicks a storm-intel event polygon. */
  onStormEventClick?: (event: StormEventSummary) => void;
  /** Lead ids the copilot highlighted — rendered as pulsing markers (coords resolved from /leads). */
  highlightLeadIds?: string[];
  /** Programmatic fly-to target; a new object reference triggers a fly animation. */
  focus?: { center: { lat: number; lng: number }; zoom: number } | null;
  /** Copilot-controlled overlay visibility. Omitted keys leave existing behaviour untouched. */
  overlayVisibility?: { alertPolygons?: boolean; stormOutlines?: boolean; radar?: boolean };
}

/** Marker returned by GET /api/v1/maps/storm-markers */
interface StormMarker {
  id: string;
  lat: number;
  lon: number;
  type: string;
  severity: string;
  urgency?: string;
  headline?: string;
  description?: string;
  effective?: string;
  expires?: string;
  area?: string;
  icon?: string;
  color?: string;
  [key: string]: any;
}

/** Response shape from GET /api/v1/maps/storm-markers */
interface StormMarkersResponse {
  markers: StormMarker[];
  count: number;
  timestamp: string;
}

// ──────────────── Orbital Intelligence Types ────────────────

/** Storm trajectory point with severity */
interface StormTrajectoryPoint {
  id: string;
  stormId: string;
  coordinates: [number, number][];
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  timestamp: string;
  speed?: number; // knots
  direction?: number; // degrees
}

/** Response for storm trajectories */
interface StormTrajectoriesResponse {
  trajectories: StormTrajectoryPoint[];
  count: number;
  timestamp: string;
}

/** Property intelligence data point */
interface PropertyIntelligence {
  id: string;
  lat: number;
  lng: number;
  address: string;
  propertyType: 'Residential' | 'Commercial' | 'Industrial' | 'Agricultural' | 'Unknown';
  riskScore: number; // 0-100
  status: 'LIVE' | 'SYNCING' | 'STALE' | 'DEGRADED' | 'OFFLINE';
  lastSync?: string;
  metadata?: Record<string, unknown>;
}

/** Response for property intelligence */
interface PropertyIntelligenceResponse {
  properties: PropertyIntelligence[];
  count: number;
  timestamp: string;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

// ──────────────── Utility functions ────────────────

/** Get severity config, falling back to Unknown */
const getSeverityConfig = (
  severity: string
): (typeof SEVERITY_CONFIG)[string] => SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.Unknown;

/** Storm-intel severities are uppercase (`EXTREME`); legacy NOAA alerts are Titlecase. */
const normalizeSeverity = (severity: unknown): string => {
  const raw = String(severity ?? '').trim();
  if (!raw) return 'Unknown';
  const titled = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return SEVERITY_CONFIG[titled] ? titled : raw;
};

/** Format an ISO date string for display */
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return 'N/A';
  }
};

/** Truncate text to maxLen and append an ellipsis */
const truncate = (text: string | undefined, maxLen: number): string => {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
};

/** Convert a GeoJSON geometry (Polygon or MultiPolygon) to Leaflet LatLngExpression arrays.
 *  GeoJSON uses [lng, lat] ordering; Leaflet uses [lat, lng]. */
const geometryToLatLngs = (
  geometry: Geometry | null | undefined
): L.LatLngExpression[] | null => {
  if (!geometry) return null;
  if (!('coordinates' in geometry)) return null;

  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0] as [number, number][];
    return ring.map((coord) => [coord[1], coord[0]] as [number, number]);
  }

  if (geometry.type === 'MultiPolygon') {
    // Render the first polygon's outer ring
    const ring = geometry.coordinates[0]?.[0] as [number, number][] | undefined;
    if (!ring) return null;
    return ring.map((coord) => [coord[1], coord[0]] as [number, number]);
  }

  return null;
};

/** Path options derived from a feature's severity */
const featurePathOptions = (feature: Feature): L.PathOptions => {
  const cfg = getSeverityConfig(feature?.properties?.severity || 'Unknown');
  return {
    fillColor: cfg.color,
    fillOpacity: 0.15,
    color: cfg.color,
    weight: 2,
    opacity: 0.4,
  };
};

/** Render a single GeoJSON feature as a react-leaflet element with a React popup */
const renderFeature = (feature: Feature, index: number): ReactNode => {
  const properties = (feature?.properties ?? {}) as GeoJsonProperties;
  const cfg = getSeverityConfig(properties?.severity ?? 'Unknown');
  const geometry = feature?.geometry;
  if (!geometry) return null;

  const key = `alert-${String(feature.id ?? index)}`;
  const pathOptions = featurePathOptions(feature);

  const popup = (
    <Popup
      className="storm-popup-modern"
      aria-label="Weather alert details"
    >
      <GeoJsonAlertPopup properties={properties} />
    </Popup>
  );

  switch (geometry.type) {
    case 'Point': {
      const [lng, lat] = geometry.coordinates as [number, number];
      return (
        <CircleMarker
          key={key}
          center={[lat, lng]}
          radius={cfg.radius}
          color="#ffffff"
          fillColor={cfg.color}
          fillOpacity={0.6}
          weight={2}
          className="storm-circle-marker"
        >
          {popup}
        </CircleMarker>
      );
    }
    case 'MultiPoint': {
      const coords = geometry.coordinates as [number, number][];
      return (
        <React.Fragment key={key}>
          {coords.map((coord, i) => {
            const [lng, lat] = coord;
            return (
              <CircleMarker
                key={`${key}-${i}`}
                center={[lat, lng]}
                radius={cfg.radius}
                color="#ffffff"
                fillColor={cfg.color}
                fillOpacity={0.6}
                weight={2}
                className="storm-circle-marker"
              >
                {popup}
              </CircleMarker>
            );
          })}
        </React.Fragment>
      );
    }
    case 'LineString': {
      const latLngs = (geometry.coordinates as [number, number][]).map(
        (coord) => [coord[1], coord[0]] as [number, number]
      );
      return (
        <Polyline key={key} positions={latLngs} pathOptions={pathOptions}>
          {popup}
        </Polyline>
      );
    }
    case 'MultiLineString': {
      const lines = geometry.coordinates as [number, number][][];
      return (
        <React.Fragment key={key}>
          {lines.map((line, i) => {
            const latLngs = line.map(
              (coord) => [coord[1], coord[0]] as [number, number]
            );
            return (
              <Polyline
                key={`${key}-${i}`}
                positions={latLngs}
                pathOptions={pathOptions}
              >
                {popup}
              </Polyline>
            );
          })}
        </React.Fragment>
      );
    }
    case 'Polygon':
    case 'MultiPolygon': {
      const coords = geometryToLatLngs(geometry);
      if (!coords) return null;
      return (
        <Polygon key={key} positions={coords} pathOptions={pathOptions}>
          {popup}
        </Polygon>
      );
    }
    default:
      return null;
  }
};

// ──────────────── Sub-components ────────────────

/** Captures the underlying Leaflet map instance and reports it via onReady. */
interface MapInstanceCaptureProps {
  onReady: (map: L.Map | null) => void;
}
const MapInstanceCapture: React.FC<MapInstanceCaptureProps> = ({ onReady }) => {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    return () => onReady(null);
  }, [map, onReady]);
  return null;
};

/** Captures background map clicks and forwards lat/lng to the parent */
interface MapClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void;
}
const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
};

/** Pans the map when the center/zoom state changes (skips the initial render) */
interface MapControllerProps {
  center: L.LatLngExpression;
  zoom: number;
}
const MapController: React.FC<MapControllerProps> = ({ center, zoom }) => {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    map.setView(center, zoom, { animate: true, duration: 0.6 });
  }, [center, zoom, map]);

  return null;
};

/** Flies to a copilot-provided focus target whenever a new `focus` object arrives. */
interface FocusControllerProps {
  focus: { center: { lat: number; lng: number }; zoom: number } | null;
}
const FocusController: React.FC<FocusControllerProps> = ({ focus }) => {
  const map = useMap();
  const lastFocus = useRef<FocusControllerProps['focus']>(null);

  useEffect(() => {
    if (!focus || lastFocus.current === focus) return;
    lastFocus.current = focus;
    const lat = Number(focus.center?.lat);
    const lng = Number(focus.center?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    const rawZoom = Number(focus.zoom);
    const zoom = Number.isFinite(rawZoom) ? Math.max(3, Math.min(15, Math.round(rawZoom))) : 8;
    map.flyTo([lat, lng], zoom, { animate: true, duration: 0.8 });
  }, [focus, map]);

  return null;
};

/** React-rendered popup content for the API storm markers */
interface AlertPopupProps {
  marker: StormMarker;
}
const AlertPopup: React.FC<AlertPopupProps> = ({ marker }) => {
  const cfg = getSeverityConfig(marker.severity);

  return (
    <div className="popup-content-modern">
      <div className="popup-header">
        <span className={`badge ${cfg.badgeClass}`}>{marker.severity}</span>
        <span className="popup-urgency-badge">{marker.urgency || 'N/A'}</span>
      </div>
      <h4>{marker.headline || marker.type || 'Weather Alert'}</h4>
      {marker.effective && (
        <p className="popup-period">
          <strong>Effective:</strong> {formatDate(marker.effective)}
        </p>
      )}
      {marker.expires && (
        <p className="popup-period">
          <strong>Expires:</strong> {formatDate(marker.expires)}
        </p>
      )}
      {marker.area && (
        <p className="popup-area">
          <strong>Area:</strong> {marker.area}
        </p>
      )}
      {marker.description && (
        <p className="popup-description">
          {truncate(marker.description, 200)}
        </p>
      )}
    </div>
  );
};

/** React-rendered popup content for a GeoJSON alert feature */
interface GeoJsonAlertPopupProps {
  properties: GeoJsonProperties;
}
const GeoJsonAlertPopup: React.FC<GeoJsonAlertPopupProps> = ({ properties }) => {
  const cfg = getSeverityConfig(properties?.severity || 'Unknown');
  const effective = formatDate(properties?.effective);
  const expires = formatDate(properties?.expires);
  const headline = properties?.headline || properties?.type || 'Weather Alert';

  return (
    <div className="popup-content-modern">
      <div className="popup-header">
        <span className={`badge ${cfg.badgeClass}`}>
          {properties?.severity || 'Unknown'}
        </span>
        <span className="popup-urgency-badge">{properties?.urgency || 'N/A'}</span>
      </div>
      <h4>{headline}</h4>
      {properties?.effective && (
        <p className="popup-period">
          <strong>Effective:</strong> {effective}
        </p>
      )}
      {properties?.expires && (
        <p className="popup-period">
          <strong>Expires:</strong> {expires}
        </p>
      )}
      {properties?.area && (
        <p className="popup-area">
          <strong>Area:</strong> {properties.area}
        </p>
      )}
      {properties?.description && (
        <p className="popup-description">
          {truncate(properties.description, 200)}
        </p>
      )}
    </div>
  );
};

/** Renders all GeoJSON alert features as individual react-leaflet layers with React popups */
const GeoJsonAlertLayers: React.FC<{ data: FeatureCollection }> = ({ data }) => {
  if (!data?.features?.length) return null;
  return (
    <>
      {data.features.map((feature, index) => renderFeature(feature, index))}
    </>
  );
};

/** A small synchronized minimap that mirrors the main map's viewport. */
interface MinimapProps {
  mainMap: L.Map;
}
const Minimap: React.FC<MinimapProps> = ({ mainMap }) => {
  const miniMap = useMap();
  const [bounds, setBounds] = useState<L.LatLngBounds>(mainMap.getBounds());
  const [center, setCenter] = useState<L.LatLng>(mainMap.getCenter());

  // Keep the minimap in sync with the main map's viewport
  useEffect(() => {
    if (!mainMap || !miniMap) return;

    const sync = () => {
      setBounds(mainMap.getBounds());
      setCenter(mainMap.getCenter());
      miniMap.fitBounds(mainMap.getBounds(), {
        padding: [8, 8],
        animate: false,
        maxZoom: 4,
// minZoom omitted: not in @types/leaflet FitBoundsOptions
      });
    };

    sync();
    mainMap.on('moveend', sync);
    mainMap.on('zoomend', sync);
    return () => {
      mainMap.off('moveend', sync);
      mainMap.off('zoomend', sync);
    };
  }, [mainMap, miniMap]);

  // Ensure the tile pane is laid out correctly after mounting
  useEffect(() => {
    const id = window.setTimeout(() => miniMap.invalidateSize(), 120);
    return () => window.clearTimeout(id);
  }, [miniMap]);

  // Clicking the minimap pans the main map
  const handleMinimapClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      mainMap.setView(e.latlng, mainMap.getZoom());
    },
    [mainMap]
  );
  useMapEvents({ click: handleMinimapClick });

  return (
    <>
      <Rectangle
        bounds={bounds}
        pathOptions={{
          color: '#3b82f6',
          weight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 0.12,
          interactive: false,
        }}
      />
      <CircleMarker
        center={center}
        radius={5}
        color="#ffffff"
        fillColor="#3b82f6"
        fillOpacity={0.95}
        weight={1}
      />
    </>
  );
};

/** Accessible, self-contained base-map layer dropdown */
interface LayerDropdownProps {
  options: { id: string; name: string; icon: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}
const LayerDropdown: React.FC<LayerDropdownProps> = ({
  options,
  value,
  onChange,
  label = 'Base map layer',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeydown);
    };
  }, [open]);

  return (
    <div className="tile-selector" ref={containerRef}>
      <button
        type="button"
        className="control-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? 'base-layer-list' : undefined}
        title={label}
        aria-label={label}
        onClick={() => setOpen(!open)}
      >
        {selected.icon}
      </button>
      {open && (
        <ul
          id="base-layer-list"
          role="listbox"
          className="tile-dropdown"
          aria-label={label}
        >
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                role="option"
                aria-selected={opt.id === value}
                className={`tile-option ${opt.id === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
              >
                {opt.icon}
                <span>{opt.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ──────────────── Main component ────────────────

const StormMap: React.FC<StormMapProps> = ({
  storms = [],
  onMapClick,
  selectedLocation,
  height = '100%',
  // Orbital Intelligence props
  showTrajectories = true,
  showPropertyNodes = true,
  showRiskHeatField = true,
  showIntelligencePanel = false,
  // Storm Intelligence additive props
  stormEvents = [],
  onStormEventClick,
  highlightLeadIds = [],
  focus = null,
  overlayVisibility,
}) => {
  const {
    detectionLayers,
    trackingAlgos,
    setDetectionLayer,
  } = useMapLayersStore();

  const showRadar =
    typeof overlayVisibility?.radar === 'boolean'
      ? overlayVisibility.radar
      : detectionLayers.nexrad;
  const setShowRadar = (next: boolean) => setDetectionLayer('nexrad', next);

  const [baseLayerId, setBaseLayerId] = useState(BASE_TILES[0].id);
  const [radarOpacity, setRadarOpacity] = useState(DEFAULT_RADAR_OPACITY);

  // Storm Intelligence overlay visibility (wired to shared mapLayersStore)
  const alertPolygonsVisible =
    overlayVisibility?.alertPolygons !== false && detectionLayers.spc;
  const stormOutlinesVisible =
    overlayVisibility?.stormOutlines !== false && detectionLayers.lsr;

  // Highlighted lead ids (copilot) — deduplicated, stable key for the lookup query
  const highlightIds = useMemo(
    () => Array.from(new Set((highlightLeadIds ?? []).filter(Boolean))),
    [highlightLeadIds]
  );

  // Orbital Intelligence layer toggles (wired to shared trackingAlgos)
  const showTrajectoriesLayer = showTrajectories && trackingAlgos.titan;
  const showPropertyNodesLayer =
    showPropertyNodes && (trackingAlgos.hail || trackingAlgos.wind || trackingAlgos.tvs);
  const showRiskHeatLayer =
    showRiskHeatField && (trackingAlgos.hail || trackingAlgos.flood);
  const [showIntelPanel, setShowIntelPanel] = useState(showIntelligencePanel);
  const [selectedProperty, setSelectedProperty] = useState<PropertyIntelligence | null>(null);

  const { data: hexGrid } = useQuery<{
    features: Array<{
      geometry: { type: 'Polygon'; coordinates: [number, number][][] };
      properties: {
        h3Index: string;
        center: { lat: number; lng: number };
        stormCount: number;
        leadCount: number;
        jobCount: number;
        spaceCount: number;
        maxScore: number;
        severity: string;
        saturationPct: number;
        labels: string[];
      };
    }>;
  }>({
    queryKey: ['storm-intel', 'hex-grid', 7],
    queryFn: () => api.get('/storm-intel/hex-grid?days=7').then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
  });

  // Source of truth for programmatic centering
  const selectedLng = selectedLocation?.lng ?? selectedLocation?.lon;
  const hasSelectedLocation =
    selectedLocation != null && selectedLng != null;
  const selectedPosition: [number, number] | null = hasSelectedLocation
    ? [selectedLocation!.lat, selectedLng!]
    : null;

  const initialCenter: [number, number] = selectedPosition ?? US_CENTER;
  const initialZoom = selectedPosition ? 10 : US_ZOOM;

  const [mapCenter, setMapCenter] = useState<[number, number]>(initialCenter);
  const [mapZoom, setMapZoom] = useState(initialZoom);

  // Mirror selected-location changes into mapCenter/mapZoom (skip the first render)
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    if (selectedPosition) {
      setMapCenter(selectedPosition);
      setMapZoom(10);
    }
  }, [selectedPosition, hasSelectedLocation]);

  // Captures the main map instance for the minimap
  const [mainMap, setMainMap] = useState<L.Map | null>(null);

  // ------------------------------------------------------------------
  // Data fetching (react-query)
  // ------------------------------------------------------------------
  const {
    data: markersData,
    isLoading: isMarkersLoading,
    error: markersError,
    refetch: refetchMarkers,
  } = useQuery({
    queryKey: ['storm-markers'],
    queryFn: () =>
      api
        .get('/maps/storm-markers')
        .then((res) => res.data as StormMarkersResponse),
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
    retry: 2,
  });

  const {
    data: alertsGeoJson,
    isLoading: isAlertsLoading,
    error: alertsError,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ['alerts-geojson'],
    queryFn: () =>
      api
        .get('/maps/alerts-geojson')
        .then((res) => res.data as FeatureCollection),
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
    retry: 2,
  });

  // Orbital Intelligence: Storm Trajectories
  const {
    data: trajectoriesData,
    isLoading: isTrajectoriesLoading,
    error: trajectoriesError,
    refetch: refetchTrajectories,
  } = useQuery({
    queryKey: ['storm-trajectories'],
    queryFn: () =>
      api
        .get('/maps/storm-trajectories')
        .then((res) => res.data as StormTrajectoriesResponse),
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
    retry: 2,
    enabled: showTrajectoriesLayer,
  });

  // Orbital Intelligence: Property Intelligence Nodes
  const {
    data: propertyIntelData,
    isLoading: isPropertyLoading,
    error: propertyError,
    refetch: refetchProperties,
  } = useQuery({
    queryKey: ['property-intelligence'],
    queryFn: () =>
      api
        .get('/maps/property-intelligence')
        .then((res) => res.data as PropertyIntelligenceResponse),
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
    retry: 2,
    enabled: showPropertyNodesLayer || showRiskHeatLayer,
  });

  // Storm Intelligence: resolve copilot-highlighted lead ids to map coordinates.
  // highlightLeadIds only carries ids; coords come from the company lead list.
  const { data: highlightLeadData } = useQuery({
    queryKey: ['map-highlight-leads', highlightIds.join('|')],
    queryFn: () => api.get('/leads', { params: { limit: 100 } }).then((res) => res.data),
    enabled: highlightIds.length > 0,
    staleTime: 60_000,
    retry: 1,
  });

  const isLoading = isMarkersLoading || isAlertsLoading || isTrajectoriesLoading || isPropertyLoading;
  const isError = !!markersError || !!alertsError || !!trajectoriesError || !!propertyError;
  const errorMessage = (() => {
    const err = (markersError ?? alertsError ?? trajectoriesError ?? propertyError) as
      | { message?: string }
      | undefined;
    return err?.message || 'Unable to load storm data';
  })();
  const handleRetry = useCallback(() => {
    refetchMarkers();
    refetchAlerts();
    refetchTrajectories();
    refetchProperties();
  }, [refetchMarkers, refetchAlerts, refetchTrajectories, refetchProperties]);

  // ------------------------------------------------------------------
  // Map control handlers
  // ------------------------------------------------------------------
  const handleCenterMap = useCallback(() => {
    setMapCenter(US_CENTER);
    setMapZoom(US_ZOOM);
  }, []);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMapCenter([latitude, longitude]);
        setMapZoom(8);
        onMapClick?.(latitude, longitude);
      },
      () => {
        // Geolocation failed — silently ignore
      }
    );
  }, [onMapClick]);

  // ------------------------------------------------------------------
  // Memoized layers
  // ------------------------------------------------------------------
  const activeTile =
    BASE_TILES.find((t) => t.id === baseLayerId) ?? BASE_TILES[0];

  const circleMarkerLayers = useMemo(() => {
    const markers = markersData?.markers ?? [];
    return markers.filter((m) => m.lat != null && m.lon != null);
  }, [markersData?.markers]);

  const stormPolygonLayers = useMemo(() => {
    return storms
      .filter(
        (s) =>
          s?.geometry?.type === 'Polygon' ||
          s?.geometry?.type === 'MultiPolygon'
      )
      .map((storm) => {
        const coords = geometryToLatLngs(storm.geometry);
        if (!coords) return null;
        const cfg = getSeverityConfig(storm.severity || 'Unknown');
        return {
          key: `storm-${storm.id}`,
          positions: coords,
          cfg,
          data: storm,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
  }, [storms]);

  // Orbital Intelligence: Memoized trajectory layers
  const trajectoryLayers = useMemo(() => {
    if (!showTrajectoriesLayer || !trajectoriesData?.trajectories) return [];
    return trajectoriesData.trajectories.filter(
      (t) => t.coordinates && t.coordinates.length >= 2
    );
  }, [showTrajectoriesLayer, trajectoriesData?.trajectories]);

  // Orbital Intelligence: Memoized property nodes
  const propertyNodes = useMemo(() => {
    if (!showPropertyNodesLayer || !propertyIntelData?.properties) return [];
    return propertyIntelData.properties.filter(
      (p) => p.lat != null && p.lng != null && p.riskScore != null
    );
  }, [showPropertyNodesLayer, propertyIntelData?.properties]);

  // Orbital Intelligence: Risk heat field data
  const riskHeatData = useMemo((): PropertyDataPoint[] => {
    if (!showRiskHeatLayer || !propertyIntelData?.properties) return [];
    return propertyIntelData.properties
      .filter((p) => p.lat != null && p.lng != null && p.riskScore != null)
      .map((p) => ({
        lat: p.lat,
        lng: p.lng,
        riskScore: p.riskScore,
        id: p.id,
      }));
  }, [showRiskHeatLayer, propertyIntelData?.properties]);

  // Storm Intelligence: event outlines from /storm-intel/overview (additive layer).
  // Only events with usable Polygon/MultiPolygon geometry are drawn (contract §5.7).
  const stormEventPolygonLayers = useMemo(() => {
    if (!stormOutlinesVisible) return [];
    return (stormEvents ?? [])
      .filter((event) => {
        const geometry = event?.geometry as Geometry | null | undefined;
        return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
      })
      .map((event) => {
        const positions = geometryToLatLngs(event.geometry as Geometry);
        if (!positions) return null;
        const cfg = getSeverityConfig(normalizeSeverity(event.severity));
        return { key: `storm-event-${event.id}`, positions, cfg, event };
      })
      .filter((layer): layer is NonNullable<typeof layer> => layer !== null);
  }, [stormEvents, stormOutlinesVisible]);

  // Storm Intelligence: copilot-highlighted leads resolved to map coordinates.
  // `highlightLeadIds` only carries ids, so coordinates come from GET /leads.
  const highlightedLeads = useMemo(() => {
    if (!highlightIds.length) return [];
    const rawList = (highlightLeadData as { data?: unknown } | undefined)?.data;
    if (!Array.isArray(rawList)) return [];
    const wanted = new Set(highlightIds);
    const leads: Array<{
      id: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
      cfg: (typeof SEVERITY_CONFIG)[string];
    }> = [];

    for (const lead of rawList as Array<Record<string, any>>) {
      if (!lead || !wanted.has(lead.id)) continue;
      const coords = lead.propertyLatLng as
        | { lat?: unknown; lng?: unknown; lon?: unknown }
        | undefined;
      const lat = Number(coords?.lat);
      const lng = Number(coords?.lng ?? coords?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

      const score = Number(lead.stormImpactScore ?? lead.score);
      const severity =
        Number.isFinite(score) && score > 0
          ? score >= 80
            ? 'Extreme'
            : score >= 60
              ? 'Severe'
              : score >= 40
                ? 'Moderate'
                : 'Minor'
          : 'Unknown';

      leads.push({
        id: String(lead.id),
        name:
          [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || 'Lead',
        address: String(lead.propertyAddress ?? ''),
        lat,
        lng,
        cfg: getSeverityConfig(severity),
      });
    }
    return leads;
  }, [highlightIds, highlightLeadData]);

  const geoJsonData: FeatureCollection = alertsGeoJson ?? {
    type: 'FeatureCollection',
    features: [],
  };

  // Handle property selection
  const handlePropertyClick = useCallback((property: PropertyNodeProps) => {
    const fullProperty = propertyIntelData?.properties.find(
      (p) => p.id === property.id
    );
    if (fullProperty) {
      setSelectedProperty(fullProperty);
      setShowIntelPanel(true);
    }
  }, [propertyIntelData?.properties]);

  const closeIntelPanel = useCallback(() => {
    setShowIntelPanel(false);
    setSelectedProperty(null);
  }, []);

  // Handle trajectory click (center on storm)
  const handleTrajectoryClick = useCallback((trajectory: StormTrajectoryPoint) => {
    if (trajectory.coordinates.length > 0) {
      const center = trajectory.coordinates[0];
      setMapCenter(center);
      setMapZoom(8);
    }
  }, []);

  return (
    <div className="storm-map-modern" style={{ height }}>
      {/* ── Floating map controls ── */}
      <div className="map-controls-modern" role="region" aria-label="Map controls">
        <div className="control-group">
          <button
            className="control-btn"
            onClick={handleCenterMap}
            title="Center on United States"
            aria-label="Center map on United States"
          >
            <MapPin size={20} />
          </button>
          <button
            className="control-btn"
            onClick={handleLocateMe}
            title="Center on my location"
            aria-label="Center map on my location"
          >
            <Navigation size={20} />
          </button>
        </div>

        <div className="control-group">
          <LayerDropdown
            options={BASE_TILES.map((t) => ({
              id: t.id,
              name: t.name,
              icon: t.icon,
            }))}
            value={baseLayerId}
            onChange={setBaseLayerId}
            label="Base map layer"
          />
        </div>

        <div className="control-group">
          <button
            className={`control-btn ${showRadar ? 'radar-active' : ''}`}
            onClick={() => setShowRadar(!showRadar)}
            title={showRadar ? 'Hide radar overlay' : 'Show radar overlay'}
            aria-label={showRadar ? 'Hide radar overlay' : 'Show radar overlay'}
            aria-pressed={showRadar}
          >
            <Wind size={20} aria-hidden={showRadar} />
          </button>
          <button
            className="control-btn"
            onClick={handleRetry}
            title="Refresh map data"
            aria-label="Refresh map data"
            disabled={isLoading}
          >
            <RefreshCw
              size={18}
              className={isLoading ? 'animate-spin' : ''}
            />
          </button>
        </div>

        {/* Radar intensity slider (only when radar is visible) */}
        {showRadar && (
          <div className="radar-control-panel" aria-label="Radar intensity">
            <label className="radar-slider-label">
              <Wind size={14} aria-hidden />
              <span>Radar intensity</span>
              <span className="radar-opacity-value">
                {Math.round(radarOpacity * 100)}%
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              aria-label="Radar overlay opacity"
              value={Math.round(radarOpacity * 100)}
              onChange={(e) =>
                setRadarOpacity(Math.max(0, Math.min(1, Number(e.target.value) / 100)))
              }
              className="radar-slider-input"
            />
          </div>
        )}
      </div>

      {/* ── Status banner (non-blocking loading / error) ── */}
      {isLoading && (
        <div className="map-status-banner loading" role="status">
          <RefreshCw size={16} className="animate-spin" />
          <span>Loading storm data…</span>
        </div>
      )}
      {isError && (
        <div className="map-status-banner error" role="alert">
          <WifiOff size={16} className="error-icon" />
          <span>{errorMessage}</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRetry}
            aria-label="Retry loading storm data"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Info bar ── */}
      <div className="map-info-modern" aria-live="polite">
        <Layers size={14} />
        <span>Click anywhere on the map for weather details</span>
        {markersData?.count != null && markersData.count > 0 && (
          <>
            <span className="info-divider" aria-hidden="true" />
            <span>{markersData.count} active alert{markersData.count !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>

      {/* ── Minimap (synchronized sibling) ── */}
      {mainMap && (
        <div className="minimap-container" aria-label="Map minimap">
          {/* Minimap: a second, non-interactive Leaflet map that mirrors the main map viewport */}
          <MapContainer
            center={US_CENTER}
            zoom={3}
            minZoom={2}
            maxZoom={5}
            zoomControl={false}
            attributionControl={false}
            className="minimap-map"
            style={{ height: '100%', width: '100%' }}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            boxZoom={false}
            keyboard={false}
            touchZoom={false}
          >
            <TileLayer
              url={activeTile.url}
              attribution={activeTile.attribution}
              maxZoom={5}
            />
            <Minimap mainMap={mainMap} />
          </MapContainer>
        </div>
      )}

      {/* ── Leaflet map ── */}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <MapInstanceCapture onReady={setMainMap} />

        {/* Base map (selected via the custom dropdown above) */}
        <TileLayer
          key={activeTile.id}
          url={activeTile.url}
          attribution={activeTile.attribution}
          maxZoom={activeTile.maxZoom}
          opacity={1}
        />

        {/* NWS radar overlay (toggled + opacity controlled above) */}
        {showRadar && (
          <TileLayer
            key="radar"
            url={RADAR_URL}
            attribution={RADAR_ATTRIBUTION}
            opacity={radarOpacity}
            maxZoom={15}
          />
        )}

        {/* GOES Satellite hemispheric visible/cloud overlay */}
        {detectionLayers.goes && (
          <TileLayer
            key="goes-satellite"
            url={GOES_SATELLITE_URL}
            attribution={GOES_ATTRIBUTION}
            opacity={0.45}
            maxZoom={12}
          />
        )}

        {/* Lightning Detection pulse halos on convective markers */}
        {detectionLayers.lightning &&
          circleMarkerLayers
            .filter((m) =>
              /tornado|thunderstorm|severe|extreme|hail|lightning/i.test(
                `${m.type} ${m.severity}`,
              ),
            )
            .map((m) => (
              <CircleMarker
                key={`lightning-${m.id}`}
                center={[m.lat, m.lon]}
                radius={16}
                interactive={false}
                pathOptions={{
                  color: '#cb8622',
                  weight: 1.5,
                  opacity: 0.75,
                  fillColor: '#cb8622',
                  fillOpacity: 0.14,
                  className: 'motion-safe:animate-pulse',
                }}
              />
            ))}

        {/* Orbital Intelligence: TITAN Cell Trajectories, Property Nodes & Risk Heat */}
        {showTrajectoriesLayer &&
          trajectoryLayers.map((traj) => (
            <StormTrajectory
              key={traj.id}
              coordinates={traj.coordinates}
              severity={traj.severity}
              speed={traj.speed}
            />
          ))}

        {showRiskHeatLayer && riskHeatData.length > 0 && (
          <RiskHeatField propertyData={riskHeatData} visible={true} />
        )}

        {showPropertyNodesLayer &&
          propertyNodes.map((prop) => (
            <PropertyNode
              key={prop.id}
              id={prop.id}
              lat={prop.lat}
              lng={prop.lng}
              address={prop.address}
              propertyType={prop.propertyType}
              riskScore={prop.riskScore}
              status={prop.status}
              onClick={handlePropertyClick}
            />
          ))}

        {/* Layer control: storm alert overlays */}
        <LayersControl position="bottomright" collapsed={true}>
          <Overlay checked name="Storm Alert Markers">
            <LayerGroup>
              {circleMarkerLayers.map((marker) => {
                const cfg = getSeverityConfig(marker.severity);
                return (
                  <CircleMarker
                    key={marker.id}
                    center={[marker.lat, marker.lon]}
                    radius={cfg.radius}
                    color="#ffffff"
                    fillColor={cfg.color}
                    fillOpacity={0.6}
                    weight={2}
                    className="storm-circle-marker"
                  >
                    <Popup
                      className="storm-popup-modern"
                      aria-label={`Alert: ${marker.type}`}
                    >
                      <AlertPopup marker={marker} />
                    </Popup>
                  </CircleMarker>
                );
              })}
            </LayerGroup>
          </Overlay>

          {alertPolygonsVisible && (
            <Overlay checked name="Alert Polygons">
              <LayerGroup>
                <GeoJsonAlertLayers data={geoJsonData} />
              </LayerGroup>
            </Overlay>
          )}

          {stormPolygonLayers.length > 0 && (
            <Overlay name="Storm Areas">
              <LayerGroup>
                {stormPolygonLayers.map((layer) => (
                  <Polygon
                    key={layer.key}
                    positions={layer.positions}
                    pathOptions={{
                      fillColor: layer.cfg.color,
                      fillOpacity: 0.15,
                      color: layer.cfg.color,
                      weight: 2,
                      opacity: 0.4,
                    }}
                  >
                    <Popup className="storm-popup-modern">
                      <div className="popup-content-modern">
                        <div className="popup-header">
                          <span className={`badge ${layer.cfg.badgeClass}`}>
                            {layer.data.severity || 'Unknown'}
                          </span>
                        </div>
                        <h4>
                          {layer.data.headline ||
                            layer.data.name ||
                            layer.data.type ||
                            'Storm Area'}
                        </h4>
                        {layer.data.description && (
                          <p className="popup-description">
                            {truncate(layer.data.description, 200)}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Polygon>
                ))}
              </LayerGroup>
            </Overlay>
          )}

          {/* Storm Intelligence events (additive §6.3 — polygons from /storm-intel) */}
          {stormEventPolygonLayers.length > 0 && (
            <Overlay checked name="Storm Intelligence Events">
              <LayerGroup>
                {stormEventPolygonLayers.map((layer) => (
                  <Polygon
                    key={layer.key}
                    positions={layer.positions}
                    pathOptions={{
                      fillColor: layer.cfg.color,
                      fillOpacity: 0.18,
                      color: layer.cfg.color,
                      weight: 2,
                      opacity: 0.6,
                    }}
                    eventHandlers={
                      onStormEventClick
                        ? {
                            click: (event) => {
                              // Keep the click from bubbling into the background map click
                              // handler (which would open the weather-details popover).
                              if (event.originalEvent) {
                                L.DomEvent.stopPropagation(event.originalEvent);
                              }
                              onStormEventClick(layer.event);
                            },
                          }
                        : undefined
                    }
                  >
                    <Popup
                      className="storm-popup-modern"
                      aria-label={`Storm event: ${layer.event.name}`}
                    >
                      <div className="popup-content-modern">
                        <div className="popup-header">
                          <span className={`badge ${layer.cfg.badgeClass}`}>
                            {normalizeSeverity(layer.event.severity)}
                          </span>
                          <span className="popup-urgency-badge">
                            {String(layer.event.eventType ?? 'STORM').replace(/_/g, ' ')}
                          </span>
                        </div>
                        <h4>{layer.event.name || 'Storm event'}</h4>
                        {layer.event.area && (
                          <p className="popup-area">
                            <strong>Area:</strong> {layer.event.area}
                          </p>
                        )}
                        <p className="popup-period">
                          <strong>Leads:</strong> {layer.event.leadCount ?? 0} ·{' '}
                          <strong>Jobs:</strong> {layer.event.jobCount ?? 0}
                        </p>
                      </div>
                    </Popup>
                  </Polygon>
                ))}
              </LayerGroup>
            </Overlay>
          )}

          {/* H3 Geospatial Hex Territory Saturation Overlay (uber/h3-js) */}
          {hexGrid?.features && hexGrid.features.length > 0 && (
            <Overlay checked name="H3 Territory Hexes">
              <LayerGroup>
                {hexGrid.features.map((feat) => {
                  const p = feat.properties;
                  const ring = (feat.geometry.coordinates[0] ?? []).map(
                    ([lng, lat]) => [lat, lng] as [number, number]
                  );
                  if (ring.length < 3) return null;
                  const hexColor =
                    p.severity === 'EXTREME'
                      ? '#ef4444'
                      : p.severity === 'SEVERE'
                        ? '#f97316'
                        : p.leadCount > 0
                          ? '#06b6d4'
                          : '#3b82f6';
                  return (
                    <Polygon
                      key={`h3-${p.h3Index}`}
                      positions={ring}
                      pathOptions={{
                        fillColor: hexColor,
                        fillOpacity: p.saturationPct >= 50 ? 0.28 : 0.14,
                        color: hexColor,
                        weight: 1.5,
                        dashArray: '4 4',
                      }}
                      eventHandlers={
                        onMapClick
                          ? {
                              click: (e) => {
                                if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
                                onMapClick(p.center.lat, p.center.lng);
                              },
                            }
                          : undefined
                      }
                    >
                      <Popup className="storm-popup-modern">
                        <div className="popup-content-modern">
                          <div className="popup-header">
                            <span className="popup-urgency-badge">H3 RES-7 · {p.h3Index}</span>
                          </div>
                          <h4>{p.labels[0] || `Territory Hex ${p.h3Index.slice(-6)}`}</h4>
                          <p className="popup-period">
                            <strong>Leads:</strong> {p.leadCount} · <strong>Jobs:</strong> {p.jobCount} ·{' '}
                            <strong>Saturation:</strong> {p.saturationPct}%
                          </p>
                          <p className="popup-area">
                            <strong>Severity:</strong> {p.severity} · <strong>Peak Risk:</strong> {p.maxScore}/100
                          </p>
                        </div>
                      </Popup>
                    </Polygon>
                  );
                })}
              </LayerGroup>
            </Overlay>
          )}
        </LayersControl>

        {/* Storm Intelligence: copilot-highlighted leads (pulse markers) */}
        {highlightedLeads.map((lead) => (
          <React.Fragment key={`highlight-${lead.id}`}>
            <CircleMarker
              center={[lead.lat, lead.lng]}
              radius={18}
              interactive={false}
              pathOptions={{
                color: lead.cfg.color,
                weight: 1,
                opacity: 0.5,
                fillColor: lead.cfg.color,
                fillOpacity: 0.15,
                className: 'motion-safe:animate-pulse',
              }}
            />
            <CircleMarker
              center={[lead.lat, lead.lng]}
              radius={7}
              pathOptions={{
                color: lead.cfg.color,
                weight: 2,
                fillColor: lead.cfg.color,
                fillOpacity: 0.95,
              }}
            >
              <Popup
                className="storm-popup-modern"
                aria-label={`Highlighted lead: ${lead.name}`}
              >
                <div className="popup-content-modern">
                  <div className="popup-header">
                    <span className="badge badge-info">Copilot highlight</span>
                  </div>
                  <h4>{lead.name}</h4>
                  {lead.address && <p className="popup-area">{lead.address}</p>}
                </div>
              </Popup>
            </CircleMarker>
          </React.Fragment>
        ))}

        {/* Programmatic center/zoom control */}
        <MapController center={mapCenter} zoom={mapZoom} />

        {/* Copilot fly-to (new object reference = new animation) */}
        <FocusController focus={focus} />

        {/* Background map click handler */}
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

        {/* Selected location indicator */}
        {selectedPosition && (
          <Circle
            center={selectedPosition}
            radius={5000}
            pathOptions={{
              fillColor: '#3b82f6',
              fillOpacity: 0.2,
              color: '#3b82f6',
              weight: 2,
              opacity: 0.6,
            }}
            aria-label="Selected location indicator"
          >
            <Popup
              className="storm-popup-modern"
              aria-label="Selected location"
            >
              <div className="popup-content-modern">
                <div className="popup-header">
                  <span className="badge badge-info">Location</span>
                </div>
                <h4>Selected Location</h4>
                <p className="popup-period">
                  Lat: {selectedLocation!.lat.toFixed(4)}
                </p>
                <p className="popup-period">
                  Lng: {selectedLng!.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Circle>
        )}
      </MapContainer>
    </div>
  );
};

export default StormMap;
