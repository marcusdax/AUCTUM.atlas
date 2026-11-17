/**
 * Marketing Studio print templates — pure layout, no React.
 *
 * Every piece is laid out in points (72 per inch) at its true print size, so
 * the SVG the studio renders is the file that gets printed. The QR always sits
 * on a white plate with dark modules: scanners need contrast more than they
 * need brand colors.
 */

export type PieceKind = 'YARD_SIGN' | 'DOOR_HANGER' | 'FLYER' | 'POSTCARD' | 'TRUCK_MAGNET';

export interface BrandColors {
  primary: string;
  accent: string;
}

export interface PieceContent {
  headline: string;
  body: string;
  cta: string;
  companyName: string;
  phone: string | null;
}

interface TextSlot {
  role: 'company' | 'headline' | 'body' | 'cta' | 'phone';
  x: number;
  y: number; // baseline of the first line
  width: number;
  fontSize: number;
  maxLines: number;
  weight: 400 | 600 | 700 | 800;
  onAccent?: boolean;
}

interface KindSpec {
  label: string;
  widthIn: number;
  heightIn: number;
  qr: { x: number; y: number; size: number }; // inches
  logo?: { x: number; y: number; size: number }; // inches
  accentBar?: { y: number; height: number }; // inches, full width
  holeGuide?: { cx: number; cy: number; r: number }; // door-hanger cut line, inches
  slots: Array<Omit<TextSlot, 'x' | 'y' | 'width' | 'fontSize'> & { x: number; y: number; width: number; fontPt: number }>;
}

const PT = 72;

export const KIND_SPECS: Record<PieceKind, KindSpec> = {
  YARD_SIGN: {
    label: 'Yard sign · 24 × 18 in',
    widthIn: 24,
    heightIn: 18,
    logo: { x: 1, y: 1, size: 2.2 },
    qr: { x: 16, y: 3.6, size: 7 },
    accentBar: { y: 14, height: 4 },
    slots: [
      { role: 'company', x: 3.6, y: 2.4, width: 11.5, fontPt: 60, maxLines: 1, weight: 700 },
      { role: 'headline', x: 1, y: 6, width: 14, fontPt: 120, maxLines: 3, weight: 800 },
      { role: 'cta', x: 1, y: 15.6, width: 22, fontPt: 72, maxLines: 1, weight: 700, onAccent: true },
      { role: 'phone', x: 1, y: 17.3, width: 22, fontPt: 64, maxLines: 1, weight: 800, onAccent: true },
    ],
  },
  DOOR_HANGER: {
    label: 'Door hanger · 4.25 × 11 in',
    widthIn: 4.25,
    heightIn: 11,
    holeGuide: { cx: 2.125, cy: 1.1, r: 0.65 },
    logo: { x: 0.35, y: 2.1, size: 0.8 },
    qr: { x: 0.875, y: 6.55, size: 2.5 },
    accentBar: { y: 9.35, height: 1.65 },
    slots: [
      { role: 'company', x: 1.3, y: 2.6, width: 2.6, fontPt: 13, maxLines: 2, weight: 700 },
      { role: 'headline', x: 0.35, y: 3.55, width: 3.55, fontPt: 26, maxLines: 3, weight: 800 },
      { role: 'body', x: 0.35, y: 5.05, width: 3.55, fontPt: 10.5, maxLines: 5, weight: 400 },
      { role: 'cta', x: 0.35, y: 9.85, width: 3.55, fontPt: 14, maxLines: 2, weight: 700, onAccent: true },
      { role: 'phone', x: 0.35, y: 10.7, width: 3.55, fontPt: 18, maxLines: 1, weight: 800, onAccent: true },
    ],
  },
  FLYER: {
    label: 'Flyer · 8.5 × 11 in',
    widthIn: 8.5,
    heightIn: 11,
    logo: { x: 0.6, y: 0.5, size: 1.1 },
    qr: { x: 5.35, y: 6.2, size: 2.6 },
    accentBar: { y: 9.6, height: 1.4 },
    slots: [
      { role: 'company', x: 1.95, y: 1.2, width: 6, fontPt: 22, maxLines: 1, weight: 700 },
      { role: 'headline', x: 0.6, y: 2.75, width: 7.3, fontPt: 44, maxLines: 3, weight: 800 },
      { role: 'body', x: 0.6, y: 5.3, width: 4.4, fontPt: 14, maxLines: 12, weight: 400 },
      { role: 'cta', x: 0.6, y: 10.2, width: 7.3, fontPt: 20, maxLines: 1, weight: 700, onAccent: true },
      { role: 'phone', x: 0.6, y: 10.7, width: 7.3, fontPt: 20, maxLines: 1, weight: 800, onAccent: true },
    ],
  },
  POSTCARD: {
    label: 'Postcard · 6 × 4 in',
    widthIn: 6,
    heightIn: 4,
    logo: { x: 0.3, y: 0.3, size: 0.6 },
    qr: { x: 4.05, y: 1.15, size: 1.65 },
    accentBar: { y: 3.3, height: 0.7 },
    slots: [
      { role: 'company', x: 1.05, y: 0.7, width: 4.6, fontPt: 12, maxLines: 1, weight: 700 },
      { role: 'headline', x: 0.3, y: 1.5, width: 3.5, fontPt: 20, maxLines: 3, weight: 800 },
      { role: 'body', x: 0.3, y: 2.55, width: 3.5, fontPt: 8.5, maxLines: 3, weight: 400 },
      { role: 'phone', x: 0.3, y: 3.75, width: 5.4, fontPt: 15, maxLines: 1, weight: 800, onAccent: true },
    ],
  },
  TRUCK_MAGNET: {
    label: 'Truck magnet · 24 × 12 in',
    widthIn: 24,
    heightIn: 12,
    logo: { x: 1, y: 1, size: 3 },
    qr: { x: 17, y: 1, size: 6 },
    accentBar: { y: 8.5, height: 3.5 },
    slots: [
      { role: 'company', x: 4.4, y: 2.6, width: 12, fontPt: 80, maxLines: 2, weight: 800 },
      { role: 'headline', x: 1, y: 6.6, width: 15.5, fontPt: 54, maxLines: 2, weight: 700 },
      { role: 'phone', x: 1, y: 10.9, width: 22, fontPt: 110, maxLines: 1, weight: 800, onAccent: true },
    ],
  },
};

export const KIND_ORDER: PieceKind[] = ['DOOR_HANGER', 'YARD_SIGN', 'FLYER', 'POSTCARD', 'TRUCK_MAGNET'];

/** Starter copy, so a rep never faces a blank piece. */
export const STARTERS: Record<PieceKind, { title: string; headline: string; body: string; cta: string }> = {
  DOOR_HANGER: {
    title: 'Storm response door hanger',
    headline: 'Hail hit your street this week',
    body: 'We inspected roofs in your neighborhood after the storm. Damage is often invisible from the ground. Get a free, no-pressure inspection and a photo report.',
    cta: 'Scan for a free inspection',
  },
  YARD_SIGN: {
    title: 'Job-site yard sign',
    headline: 'New roof by our crew',
    body: '',
    cta: 'Scan to see this job',
  },
  FLYER: {
    title: 'Neighborhood flyer',
    headline: 'Free storm damage inspection',
    body: 'Licensed and insured local roofer. Photo report of every slope. We work directly with your insurance adjuster. No obligation.',
    cta: 'Scan to book your inspection',
  },
  POSTCARD: {
    title: 'Follow-up postcard',
    headline: 'Still worried about that storm?',
    body: 'A free inspection takes 30 minutes and you keep the photo report either way.',
    cta: '',
  },
  TRUCK_MAGNET: {
    title: 'Truck door magnet',
    headline: 'Roofing · Storm repair',
    body: '',
    cta: '',
  },
};

// ─── Text fitting ───────────────────────────────────────────────────────────

/** Average glyph width as a fraction of font size, by weight (sans-serif UI font). */
const CHAR_W: Record<TextSlot['weight'], number> = { 400: 0.52, 600: 0.56, 700: 0.58, 800: 0.6 };

/**
 * Greedy word wrap by estimated width. Returns the lines that fit, with an
 * ellipsis on the last one when the text overflows, and an `overflow` flag the
 * editor shows as a warning.
 */
export function wrapText(
  text: string,
  widthPt: number,
  fontPt: number,
  maxLines: number,
  weight: TextSlot['weight'] = 400,
): { lines: string[]; overflow: boolean } {
  const maxChars = Math.max(1, Math.floor(widthPt / (fontPt * CHAR_W[weight])));
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let i = 0;
  for (; i < words.length; i += 1) {
    let word = words[i];
    if (word.length > maxChars) word = `${word.slice(0, maxChars - 1)}…`;
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  const overflow = lines.length === maxLines && (i < words.length);
  if (!overflow && line) lines.push(line);
  if (overflow) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length + 1 <= maxChars ? `${last}…` : `${last.slice(0, maxChars - 1)}…`;
  }
  return { lines: lines.slice(0, maxLines), overflow };
}

// ─── Colors ─────────────────────────────────────────────────────────────────

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((acc, c, idx) => acc + c * [0.2126, 0.7152, 0.0722][idx], 0);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function textOn(bg: string): string {
  return contrast(bg, '#FFFFFF') >= contrast(bg, '#111111') ? '#FFFFFF' : '#111111';
}

// ─── Layout ─────────────────────────────────────────────────────────────────

export interface LaidOutText {
  role: TextSlot['role'];
  x: number;
  y: number;
  fontSize: number;
  weight: number;
  fill: string;
  lines: string[];
  lineHeight: number;
}

export interface Layout {
  width: number; // points
  height: number;
  background: string;
  accentBar?: { y: number; height: number; fill: string };
  holeGuide?: { cx: number; cy: number; r: number; stroke: string };
  logo?: { x: number; y: number; size: number };
  qr: { x: number; y: number; size: number; plate: number };
  texts: LaidOutText[];
  overflow: Array<TextSlot['role']>;
  warnings: string[];
}

export function layoutPiece(kind: PieceKind, content: PieceContent, colors: BrandColors): Layout {
  const spec = KIND_SPECS[kind];
  const onPrimary = textOn(colors.primary);
  const onAccent = textOn(colors.accent);
  const valueFor = (role: TextSlot['role']) =>
    ({
      company: content.companyName,
      headline: content.headline,
      body: content.body,
      cta: content.cta,
      phone: content.phone ? `Call ${content.phone}` : '',
    })[role];

  const overflow: Layout['overflow'] = [];
  const texts: LaidOutText[] = [];
  for (const slot of spec.slots) {
    const value = valueFor(slot.role);
    if (!value) continue;
    const fontSize = slot.fontPt;
    const { lines, overflow: over } = wrapText(value, slot.width * PT, fontSize, slot.maxLines, slot.weight);
    if (over) overflow.push(slot.role);
    texts.push({
      role: slot.role,
      x: slot.x * PT,
      y: slot.y * PT,
      fontSize,
      weight: slot.weight,
      fill: slot.onAccent ? onAccent : onPrimary,
      lines,
      lineHeight: fontSize * 1.15,
    });
  }

  const warnings: string[] = [];
  if (contrast(colors.primary, onPrimary) < 4.5) warnings.push('Text on the main color is hard to read; pick a darker or lighter main color.');
  if (spec.accentBar && contrast(colors.accent, onAccent) < 4.5) warnings.push('Text on the accent color is hard to read; pick a darker or lighter accent.');
  if (!content.phone) warnings.push('No company phone on file: add one in Settings → Company so the piece has a fallback to the QR.');

  const plate = spec.qr.size * PT * 0.08;
  return {
    width: spec.widthIn * PT,
    height: spec.heightIn * PT,
    background: colors.primary,
    accentBar: spec.accentBar && { y: spec.accentBar.y * PT, height: spec.accentBar.height * PT, fill: colors.accent },
    holeGuide: spec.holeGuide && {
      cx: spec.holeGuide.cx * PT,
      cy: spec.holeGuide.cy * PT,
      r: spec.holeGuide.r * PT,
      stroke: onPrimary,
    },
    logo: spec.logo && { x: spec.logo.x * PT, y: spec.logo.y * PT, size: spec.logo.size * PT },
    qr: { x: spec.qr.x * PT, y: spec.qr.y * PT, size: spec.qr.size * PT, plate },
    texts,
    overflow,
    warnings,
  };
}

/** Where a piece's QR points. Uses VITE_PUBLIC_APP_URL when set so printed codes never point at localhost. */
export function scanUrl(code: string, base: string): string {
  return `${base.replace(/\/+$/, '')}/m/${code}`;
}

export function isLocalBase(base: string): boolean {
  try {
    const host = new URL(base).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local');
  } catch {
    return true;
  }
}
