#!/usr/bin/env node
/**
 * Publish the AUCTUM map themes in map-styles/ to MapMap and print the style URLs.
 *
 *   MAPMAP_API_KEY=snk_... node scripts/publish-map-styles.mjs
 *
 * First run creates the styles; later runs publish a new version of the same
 * styles (ids are remembered in map-styles/published.json), so the URLs the app
 * uses keep working. Put the printed values in frontend/.env (or the compose
 * build args) as VITE_MAPMAP_STYLE_LIGHT / VITE_MAPMAP_STYLE_DARK.
 *
 * Use a server key here (it can publish). The app's browser key (VITE_MAPMAP_KEY)
 * should be a separate key with scope "maps" and allowed_origins set to your site.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'map-styles');
const api = (process.env.MAPMAP_API_URL || 'https://api.mapmap.ai').replace(/\/+$/, '');
const key = process.env.MAPMAP_API_KEY?.trim();
if (!key) {
  console.error('Set MAPMAP_API_KEY to a MapMap key that can publish styles.');
  process.exit(1);
}

const publishedPath = join(dir, 'published.json');
const published = existsSync(publishedPath) ? JSON.parse(readFileSync(publishedPath, 'utf8')) : {};

async function call(method, path, body) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const out = {};
for (const variant of ['light', 'dark']) {
  const file = join(dir, `auctum-ledger-${variant}.json`);
  const { name, theme } = JSON.parse(readFileSync(file, 'utf8'));
  const existing = published[variant]?.id;
  const result = existing
    ? await call('POST', `/styles/${encodeURIComponent(existing)}`, { theme })
    : await call('POST', '/styles', { name, theme });
  const id = result.id ?? existing;
  out[variant] = { id, version: result.version, style_url: result.style_url };
  console.log(`${variant}: ${id} v${result.version}  ${result.style_url}`);
}

writeFileSync(publishedPath, `${JSON.stringify(out, null, 2)}\n`);
console.log('\nAdd to frontend/.env (or the compose build args):');
console.log(`VITE_MAPMAP_STYLE_LIGHT=${api}/styles/${out.light.id}.json`);
console.log(`VITE_MAPMAP_STYLE_DARK=${api}/styles/${out.dark.id}.json`);
console.log('VITE_MAPMAP_KEY=<browser key: scope "maps", allowed_origins = your site>');
