/**
 * Renders a marketing piece as an SVG at true print size (points). The same
 * element is previewed on screen and serialized for SVG / PNG / print export,
 * so what you see is what gets printed.
 */
import React, { forwardRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { layoutPiece, type BrandColors, type PieceContent, type PieceKind } from './templates';

export interface QrSvg {
  viewBox: string;
  inner: string;
}

/** Builds the QR as SVG markup (dark modules on white), split so it can be nested. */
export async function buildQrSvg(url: string): Promise<QrSvg> {
  const markup = await QRCode.toString(url, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#111111', light: '#FFFFFF' },
  });
  const viewBox = markup.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 1 1';
  const inner = markup.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return { viewBox, inner };
}

export function useQrSvg(url: string | null): QrSvg | null {
  const [qr, setQr] = useState<QrSvg | null>(null);
  useEffect(() => {
    let alive = true;
    if (!url) {
      setQr(null);
      return undefined;
    }
    buildQrSvg(url).then((q) => alive && setQr(q)).catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [url]);
  return qr;
}

export interface PieceSvgProps {
  kind: PieceKind;
  content: PieceContent;
  colors: BrandColors;
  qr: QrSvg | null;
  /** Logo as a data: URL so exports are self-contained. */
  logoDataUrl?: string | null;
  className?: string;
  title?: string;
}

const FONT = "Archivo, 'Helvetica Neue', Arial, sans-serif";

const PieceSvg = forwardRef<SVGSVGElement, PieceSvgProps>(function PieceSvg(
  { kind, content, colors, qr, logoDataUrl, className, title },
  ref,
) {
  const l = layoutPiece(kind, content, colors, Boolean(logoDataUrl));
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${l.width} ${l.height}`}
      width={`${l.width / 72}in`}
      height={`${l.height / 72}in`}
      className={className}
      role="img"
      aria-label={title ?? content.headline}
    >
      <rect x={0} y={0} width={l.width} height={l.height} fill={l.background} />
      {l.accentBar && <rect x={0} y={l.accentBar.y} width={l.width} height={l.accentBar.height} fill={l.accentBar.fill} />}
      {l.holeGuide && (
        <circle
          cx={l.holeGuide.cx}
          cy={l.holeGuide.cy}
          r={l.holeGuide.r}
          fill="none"
          stroke={l.holeGuide.stroke}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.6}
        />
      )}
      {l.logo && logoDataUrl && (
        <image href={logoDataUrl} x={l.logo.x} y={l.logo.y} width={l.logo.size} height={l.logo.size} preserveAspectRatio="xMidYMid meet" />
      )}
      {/* White plate keeps the QR scannable on any brand color. */}
      <rect
        x={l.qr.x - l.qr.plate}
        y={l.qr.y - l.qr.plate}
        width={l.qr.size + l.qr.plate * 2}
        height={l.qr.size + l.qr.plate * 2}
        fill="#FFFFFF"
      />
      {qr ? (
        <svg x={l.qr.x} y={l.qr.y} width={l.qr.size} height={l.qr.size} viewBox={qr.viewBox} dangerouslySetInnerHTML={{ __html: qr.inner }} />
      ) : (
        <rect x={l.qr.x} y={l.qr.y} width={l.qr.size} height={l.qr.size} fill="#E5E5E5" />
      )}
      {l.texts.map((t) => (
        <text key={t.role} x={t.x} y={t.y} fontFamily={FONT} fontSize={t.fontSize} fontWeight={t.weight} fill={t.fill}>
          {t.lines.map((line, i) => (
            <tspan key={i} x={t.x} dy={i === 0 ? 0 : t.lineHeight}>
              {line}
            </tspan>
          ))}
        </text>
      ))}
    </svg>
  );
});

export default PieceSvg;

// ─── Export helpers (all on-device) ─────────────────────────────────────────

export function serializeSvg(svg: SVGSVGElement): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
}

function triggerDownload(href: string, fileName: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadSvg(svg: SVGSVGElement, fileName: string) {
  const url = URL.createObjectURL(new Blob([serializeSvg(svg)], { type: 'image/svg+xml' }));
  triggerDownload(url, `${fileName}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Rasterizes at `dpi`, capped so very large pieces stay within browser canvas limits. */
export async function downloadPng(svg: SVGSVGElement, fileName: string, dpi = 150) {
  const [, , w, h] = (svg.getAttribute('viewBox') ?? '0 0 1 1').split(' ').map(Number);
  const scale = Math.min(dpi / 72, 8000 / Math.max(w, h));
  const url = URL.createObjectURL(new Blob([serializeSvg(svg)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the piece'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not encode PNG');
    const pngUrl = URL.createObjectURL(blob);
    triggerDownload(pngUrl, `${fileName}.png`);
    setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Opens the browser's print dialog at the piece's true size (choose "Save as PDF" for a file). */
export function printPiece(svg: SVGSVGElement, title: string) {
  const width = svg.getAttribute('width');
  const height = svg.getAttribute('height');
  const win = window.open('', '_blank', 'noopener=no,width=900,height=900');
  if (!win) throw new Error('Allow pop-ups to print');
  const doc = win.document;
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title></title>` +
      `<style>@page{size:${width} ${height};margin:0}html,body{margin:0;padding:0}svg{display:block;width:${width};height:${height}}</style>` +
      `</head><body></body></html>`,
  );
  doc.close();
  doc.title = title;
  doc.body.appendChild(doc.importNode(svg, true));
  win.focus();
  setTimeout(() => win.print(), 300);
}

/** Fetches an image and returns it as a data: URL (so it survives SVG/PNG export). */
export async function toDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
