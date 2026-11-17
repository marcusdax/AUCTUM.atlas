/**
 * Basemap configuration for every map in the app.
 *
 *   AUCTUM     MapMap-hosted AUCTUM Ledger vector style (light + dark, follows the app
 *              theme). Needs, at build time:
 *                VITE_MAPMAP_STYLE_LIGHT  e.g. https://api.mapmap.ai/styles/auctum-ledger-light-abc123.json
 *                VITE_MAPMAP_STYLE_DARK   e.g. https://api.mapmap.ai/styles/auctum-ledger-dark-def456.json
 *                VITE_MAPMAP_KEY          browser key (scope "maps", allowed_origins = your site); public
 *              Publish the styles with `node scripts/publish-map-styles.mjs` (see map-styles/).
 *   Light/Dark OpenFreeMap vector styles: free, open source, no key, commercial use allowed.
 *   Satellite  Esri World Imagery raster.
 *
 * If a vector style cannot load, the map falls back to Esri's gray canvas raster.
 * Never used: OpenStreetMap's own tile server (its policy does not allow app traffic)
 * and CARTO's free basemaps (they now require an API key).
 */

export type ThemeMode = 'light' | 'dark';
export type BasemapId = 'auctum' | 'light' | 'dark' | 'satellite';

export interface RasterSource {
  url: string;
  attribution: string;
  maxZoom: number;
}

export interface BasemapOption {
  id: BasemapId;
  name: string;
  kind: 'vector' | 'raster';
}

type Env = Record<string, string | boolean | undefined>;

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const OMT = '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>';
export const MAPMAP_ATTRIBUTION = `${OSM} ${OMT} &middot; <a href="https://mapmap.ai/">MapMap</a>`;
export const OPENFREEMAP_ATTRIBUTION = `${OSM} ${OMT} &middot; <a href="https://openfreemap.org/">OpenFreeMap</a>`;

export const OPENFREEMAP_STYLES: Record<ThemeMode, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const ESRI = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';
export const RASTER: Record<'satellite' | 'grayLight' | 'grayDark', RasterSource> = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: `Imagery ${ESRI}`,
    maxZoom: 19,
  },
  grayLight: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: `${ESRI} &mdash; Esri, HERE, Garmin, ${OSM}`,
    maxZoom: 16,
  },
  grayDark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: `${ESRI} &mdash; Esri, HERE, Garmin, ${OSM}`,
    maxZoom: 16,
  },
};

const read = (env: Env, key: string) => {
  const v = env[key];
  return typeof v === 'string' ? v.trim() : '';
};

/** The MapMap style URL for a theme, with the browser key attached, or null if not configured. */
export function mapmapStyleUrl(theme: ThemeMode, env: Env = import.meta.env): string | null {
  const base = read(env, theme === 'dark' ? 'VITE_MAPMAP_STYLE_DARK' : 'VITE_MAPMAP_STYLE_LIGHT');
  if (!/^https:\/\//i.test(base)) return null;
  const key = read(env, 'VITE_MAPMAP_KEY');
  if (!key) return base;
  const url = new URL(base);
  url.searchParams.set('api_key', key);
  return url.toString();
}

export function isMapmapConfigured(env: Env = import.meta.env): boolean {
  return mapmapStyleUrl('light', env) !== null;
}

/** The vector style (and its attribution) for a basemap, or null for raster-only choices. */
export function vectorStyleFor(
  id: BasemapId,
  theme: ThemeMode,
  env: Env = import.meta.env
): { url: string; attribution: string } | null {
  if (id === 'auctum') {
    const url = mapmapStyleUrl(theme, env);
    return url ? { url, attribution: MAPMAP_ATTRIBUTION } : { url: OPENFREEMAP_STYLES[theme], attribution: OPENFREEMAP_ATTRIBUTION };
  }
  if (id === 'light' || id === 'dark') return { url: OPENFREEMAP_STYLES[id], attribution: OPENFREEMAP_ATTRIBUTION };
  return null;
}

/** Raster used for satellite, the overview minimap, and when a vector style fails to load. */
export function rasterFor(id: BasemapId, theme: ThemeMode): RasterSource {
  if (id === 'satellite') return RASTER.satellite;
  const dark = id === 'dark' || (id === 'auctum' && theme === 'dark');
  return dark ? RASTER.grayDark : RASTER.grayLight;
}

/** What the basemap switcher offers, best first. */
export function basemapOptions(env: Env = import.meta.env): BasemapOption[] {
  const rest: BasemapOption[] = [
    { id: 'light', name: 'Light', kind: 'vector' },
    { id: 'dark', name: 'Dark', kind: 'vector' },
    { id: 'satellite', name: 'Satellite', kind: 'raster' },
  ];
  return isMapmapConfigured(env) ? [{ id: 'auctum', name: 'AUCTUM', kind: 'vector' }, ...rest] : rest;
}

/** Default basemap: AUCTUM when configured, otherwise the free vector map matching the app theme. */
export function defaultBasemap(theme: ThemeMode, env: Env = import.meta.env): BasemapId {
  return isMapmapConfigured(env) ? 'auctum' : theme;
}

/**
 * Current app theme. Reads <html data-theme>, then the app's saved choice: the Layout sets
 * data-theme in an effect that runs after child maps first render, so the attribute can be
 * missing on first paint. AUCTUM is light by default (not the OS preference), as in Layout.
 */
export function currentThemeMode(): ThemeMode {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  try {
    return window.localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
