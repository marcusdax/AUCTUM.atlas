/**
 * Native Node zlib response compression middleware (Brotli & Gzip).
 * Shrinks large GeoJSON and CRM JSON payloads by ~70-85% without adding external dependencies.
 */
import type { NextFunction, Request, Response } from 'express';
import zlib from 'node:zlib';

const MIN_BYTES = 1024;
const SKIP_CONTENT_TYPE_RE = /^(image|video|audio|font|application\/octet-stream|application\/pdf|application\/zip|text\/event-stream)/i;

export function compressionMiddleware(req: Request, res: Response, next: NextFunction) {
  const acceptEncoding = String(req.headers['accept-encoding'] || '').toLowerCase();
  const useBr = acceptEncoding.includes('br');
  const useGzip = !useBr && acceptEncoding.includes('gzip');

  if ((!useBr && !useGzip) || req.method === 'HEAD') {
    return next();
  }

  const origJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.headersSent) return res;
    const contentType = String(res.getHeader('Content-Type') || '');
    if (SKIP_CONTENT_TYPE_RE.test(contentType)) {
      return origJson(body);
    }

    const serialized = JSON.stringify(body);
    if (Buffer.byteLength(serialized, 'utf8') < MIN_BYTES) {
      return origJson(body);
    }

    const buf = Buffer.from(serialized, 'utf8');
    try {
      const compressed = useBr
        ? zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } })
        : zlib.gzipSync(buf, { level: 6 });

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Encoding', useBr ? 'br' : 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.removeHeader('Content-Length');
      return res.send(compressed);
    } catch {
      return origJson(body);
    }
  }) as Response['json'];

  return next();
}
