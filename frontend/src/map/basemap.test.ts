import { describe, expect, it } from 'vitest';
import {
  OPENFREEMAP_STYLES,
  RASTER,
  basemapOptions,
  defaultBasemap,
  isMapmapConfigured,
  mapmapStyleUrl,
  rasterFor,
  vectorStyleFor,
} from './basemapConfig';

const configured = {
  VITE_MAPMAP_STYLE_LIGHT: 'https://api.mapmap.ai/styles/auctum-ledger-light-abc123.json',
  VITE_MAPMAP_STYLE_DARK: 'https://api.mapmap.ai/styles/auctum-ledger-dark-def456.json',
  VITE_MAPMAP_KEY: 'snk_browser',
};

describe('basemap config', () => {
  it('uses the AUCTUM style for the matching theme, with the browser key attached', () => {
    expect(mapmapStyleUrl('light', configured)).toBe('https://api.mapmap.ai/styles/auctum-ledger-light-abc123.json?api_key=snk_browser');
    expect(vectorStyleFor('auctum', 'dark', configured)?.url).toContain('auctum-ledger-dark-def456.json?api_key=snk_browser');
    expect(vectorStyleFor('auctum', 'dark', configured)?.attribution).toMatch(/MapMap/);
  });

  it('offers AUCTUM first and by default once configured', () => {
    expect(defaultBasemap('light', configured)).toBe('auctum');
    expect(basemapOptions(configured)[0]).toEqual({ id: 'auctum', name: 'AUCTUM', kind: 'vector' });
  });

  it('without MapMap, defaults to the free OpenFreeMap vector style for the theme', () => {
    expect(isMapmapConfigured({})).toBe(false);
    expect(mapmapStyleUrl('light', { VITE_MAPMAP_STYLE_LIGHT: 'http://insecure.example/style.json' })).toBeNull();
    expect(defaultBasemap('dark', {})).toBe('dark');
    expect(basemapOptions({}).map((o) => o.id)).toEqual(['light', 'dark', 'satellite']);
    expect(vectorStyleFor('light', 'dark', {})?.url).toBe(OPENFREEMAP_STYLES.light);
    expect(vectorStyleFor('auctum', 'light', {})?.url).toBe(OPENFREEMAP_STYLES.light);
    expect(vectorStyleFor('satellite', 'light', {})).toBeNull();
  });

  it('falls back to a keyless raster that matches the theme', () => {
    expect(rasterFor('satellite', 'dark')).toBe(RASTER.satellite);
    expect(rasterFor('auctum', 'dark')).toBe(RASTER.grayDark);
    expect(rasterFor('light', 'dark')).toBe(RASTER.grayLight);
  });

  it('never uses the OpenStreetMap tile server or CARTO (which now needs a key)', () => {
    const urls = [...Object.values(RASTER).map((r) => r.url), ...Object.values(OPENFREEMAP_STYLES)];
    for (const url of urls) expect(url).not.toMatch(/tile\.openstreetmap\.org|cartocdn/);
  });
});
