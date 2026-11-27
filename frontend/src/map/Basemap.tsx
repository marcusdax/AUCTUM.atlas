/**
 * <Basemap /> — drop into any react-leaflet <MapContainer> in place of a <TileLayer>.
 *
 * Renders a vector style (AUCTUM on MapMap, or the free OpenFreeMap styles) through
 * MapLibre underneath the existing Leaflet overlays, following the app's light/dark
 * theme; satellite and fallbacks are raster. MapLibre is loaded on demand, so pages
 * and tests that never show a vector map never load it.
 */
import { useCallback, useEffect, useState } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import {
  currentThemeMode,
  defaultBasemap,
  rasterFor,
  vectorStyleFor,
  type BasemapId,
  type ThemeMode,
} from './basemapConfig';

/** Tracks <html data-theme> so maps follow the app's theme toggle. */
export function useThemeMode(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>(currentThemeMode);
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(() => setMode(currentThemeMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return mode;
}

function VectorBasemap({ styleUrl, attribution, onFail }: { styleUrl: string; attribution: string; onFail: () => void }) {
  const map = useMap();
  useEffect(() => {
    let disposed = false;
    let layer: { remove: () => void } | null = null;
    map.attributionControl?.addAttribution(attribution);
    (async () => {
      try {
        await import('maplibre-gl/dist/maplibre-gl.css');
        const [maplibre, worker] = await Promise.all([
          import('maplibre-gl'),
          // MapLibre locates its worker next to its own script, which bundlers move; ship the
          // (self-contained) worker as an asset and point MapLibre at it explicitly.
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
        ]);
        maplibre.setWorkerUrl(worker.default);
        // The bridge reads maplibregl from the global scope.
        (window as unknown as { maplibregl?: unknown }).maplibregl =
          (maplibre as unknown as { default?: unknown }).default ?? maplibre;
        const { maplibreGL } = await import('@maplibre/maplibre-gl-leaflet');
        if (disposed) return;
        const gl = maplibreGL({ style: styleUrl, attributionControl: false, interactive: false });
        gl.addTo(map);
        // Keep the basemap under every overlay, including tile overlays such as radar.
        gl.getContainer()?.style.setProperty('z-index', '0');
        const mlMap = gl.getMaplibreMap();
        const add3DBuildings = () => {
          if (disposed) return;
          if (!mlMap || typeof mlMap.getStyle !== 'function') return;
          if (mlMap.getLayer('auctum-3d-buildings')) return;
          const style = mlMap.getStyle();
          const sources = (style && style.sources) || {};
          const vecSource = Object.keys(sources).find((k) => sources[k]?.type === 'vector');
          if (!vecSource) return;
          try {
            mlMap.addLayer({
              id: 'auctum-3d-buildings',
              source: vecSource,
              'source-layer': 'building',
              type: 'fill-extrusion',
              minzoom: 13.5,
              paint: {
                'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'render_height'], 0, '#1e293b', 20, '#334155', 60, '#475569'],
                'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
                'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
                'fill-extrusion-opacity': 0.52,
              },
            });
          } catch {
            // Ignore when the vector style lacks a building source layer
          }
        };
        mlMap.on('load', add3DBuildings);
        mlMap.on('style.load', add3DBuildings);
        // A rejected key or a missing style falls back to raster instead of a blank map.
        mlMap.on('error', (e) => {
          const status = (e?.error as { status?: number } | undefined)?.status;
          if (status === 401 || status === 403 || status === 404) onFail();
        });
        layer = gl;
      } catch {
        if (!disposed) onFail();
      }
    })();
    return () => {
      disposed = true;
      layer?.remove();
      map.attributionControl?.removeAttribution(attribution);
    };
  }, [map, styleUrl, attribution, onFail]);
  return null;
}

export interface BasemapProps {
  /** Which basemap to show; defaults to AUCTUM when configured, otherwise the free map for the theme. */
  id?: BasemapId;
  /** Force the lightweight raster version (used for the small overview minimap). */
  raster?: boolean;
}

export default function Basemap({ id, raster = false }: BasemapProps) {
  const theme = useThemeMode();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const chosen = id ?? defaultBasemap(theme);
  const vector = raster ? null : vectorStyleFor(chosen, theme);
  const onFail = useCallback(() => setFailedUrl(vector?.url ?? null), [vector?.url]);

  if (vector && vector.url !== failedUrl) {
    return <VectorBasemap key={vector.url} styleUrl={vector.url} attribution={vector.attribution} onFail={onFail} />;
  }
  const source = rasterFor(chosen, theme);
  return <TileLayer key={source.url} url={source.url} attribution={source.attribution} maxZoom={source.maxZoom} />;
}
