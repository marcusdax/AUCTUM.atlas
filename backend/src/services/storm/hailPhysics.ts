/**
 * Hail Kinetic Energy & Roof Vulnerability Model
 *
 * Grounded in NHESS / CLIMADA physical hail damage modeling (Schmid et al., 2024):
 * - Ice density rho_ice = 900 kg/m^3, drag Cd = 0.60, air density rho_air = 1.225 kg/m^3
 * - Spherical mass m = (pi/6) * rho_ice * D^3
 * - Terminal velocity v_t = sqrt(4 * rho_ice * g * D / (3 * rho_air * Cd))
 * - Kinetic energy E_kin = 0.5 * m * v_t^2 (Joules), adjusted by horizontal wind oblique factor
 * - Probabilistic p10 / p50 / p90 Mean Damage Ratio bands (K-Dense uncertainty discipline)
 */

export type RoofMaterial = 'three_tab_asphalt' | 'architectural_shingle' | 'metal_class4';

export interface HailUnderwritingInput {
  hailInches: number;
  windMph?: number;
  roofType?: RoofMaterial;
  siteImpactScore?: number;
}

export interface HailUnderwritingResult {
  hailInches: number;
  hailMm: number;
  windMph: number;
  roofType: RoofMaterial;
  terminalVelocityMs: number;
  singleImpactEnergyJ: number;
  effectiveEnergyJ: number;
  materialThresholdMm: number;
  damageRatioBand: {
    p10: number;
    p50: number;
    p90: number;
  };
  supplementReadiness: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  recommendedActions: string[];
  methodology: string;
}

const GRAVITY = 9.80665;
const RHO_ICE = 900; // kg/m^3
const RHO_AIR = 1.225; // kg/m^3
const DRAG_COEFF = 0.6;

interface MaterialCurve {
  thresholdMm: number;
  scaleMm: number;
  maxRatio: number;
  label: string;
}

const MATERIAL_CURVES: Record<RoofMaterial, MaterialCurve> = {
  three_tab_asphalt: {
    thresholdMm: 22,
    scaleMm: 12,
    maxRatio: 0.96,
    label: 'Standard 3-Tab Asphalt Shingle',
  },
  architectural_shingle: {
    thresholdMm: 28,
    scaleMm: 14,
    maxRatio: 0.92,
    label: 'Architectural Laminated Shingle',
  },
  metal_class4: {
    thresholdMm: 46,
    scaleMm: 18,
    maxRatio: 0.72,
    label: 'Standing-Seam Metal / UL 2218 Class 4',
  },
};

function round(val: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(val * f) / f;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function normalizeRoofMaterial(raw: unknown): RoofMaterial {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'architectural_shingle' || s === 'architectural') return 'architectural_shingle';
  if (s === 'metal_class4' || s === 'metal' || s === 'class4') return 'metal_class4';
  return 'three_tab_asphalt';
}

export function evaluateHailUnderwriting(input: HailUnderwritingInput): HailUnderwritingResult {
  const hailInches = clamp(Number(input.hailInches) || 0, 0, 6);
  const windMph = clamp(Number(input.windMph) || 0, 0, 160);
  const roofType = normalizeRoofMaterial(input.roofType);
  const siteImpactScore = clamp(Number(input.siteImpactScore) || 0, 0, 100);

  const hailMm = hailInches * 25.4;
  const diameterM = hailMm / 1000;

  // Vertical terminal velocity & spherical mass
  const terminalVelocityMs =
    diameterM > 0
      ? Math.sqrt((4 * RHO_ICE * GRAVITY * diameterM) / (3 * RHO_AIR * DRAG_COEFF))
      : 0;
  const massKg = (Math.PI / 6) * RHO_ICE * diameterM ** 3;
  const singleImpactEnergyJ = 0.5 * massKg * terminalVelocityMs ** 2;

  // Wind horizontal velocity adds oblique vector kinetic energy: v_eff^2 = v_t^2 + v_wind^2
  const windMs = windMph * 0.44704;
  const effectiveSpeedMs = diameterM > 0 ? Math.sqrt(terminalVelocityMs ** 2 + windMs ** 2) : 0;
  const effectiveEnergyJ = 0.5 * massKg * effectiveSpeedMs ** 2;

  const curve = MATERIAL_CURVES[roofType];
  // Effective equivalent diameter scaling from wind kinetic boost (up to +18%)
  const windBoostMm =
    singleImpactEnergyJ > 0 ? Math.min(10, (effectiveEnergyJ / singleImpactEnergyJ - 1) * 8) : 0;
  const effectiveDiamMm = hailMm + windBoostMm + (siteImpactScore >= 60 ? 2 : 0);

  const z = (effectiveDiamMm - curve.thresholdMm) / curve.scaleMm;
  const rawP50 = hailInches <= 0.1 ? 0 : curve.maxRatio * logistic(z * 2.1 - 0.6);
  const p50 = round(clamp(rawP50, 0, curve.maxRatio), 3);
  const spread = clamp(0.06 + 0.14 * (1 - Math.abs(2 * p50 - 1)), 0.04, 0.2);
  const p10 = round(clamp(p50 - spread, 0, p50), 3);
  const p90 = round(clamp(p50 + spread, p50, 0.99), 3);

  let supplementReadiness: HailUnderwritingResult['supplementReadiness'] = 'LOW';
  if (p50 >= 0.68 || (hailInches >= 1.75 && siteImpactScore >= 60)) {
    supplementReadiness = 'CRITICAL';
  } else if (p50 >= 0.42 || hailInches >= 1.25) {
    supplementReadiness = 'HIGH';
  } else if (p50 >= 0.18 || hailInches >= 0.85) {
    supplementReadiness = 'MODERATE';
  }

  const recommendedActions: string[] = [];
  if (supplementReadiness === 'CRITICAL' || supplementReadiness === 'HIGH') {
    recommendedActions.push(
      `Document 10x10 ft test squares across cardinal roof slopes for ${curve.label}.`,
      'Capture chalked bruised-mat close-ups, soft-metal gutter/flashing dents, and collateral screen photos.',
      'Attach NOAA/NWS storm verification packet + SHA-256 chain timestamps to carrier supplement.'
    );
  } else if (supplementReadiness === 'MODERATE') {
    recommendedActions.push(
      'Perform soft-metal collateral check (box vents, furnace caps, gutter aprons) before full tear-off bid.',
      'Pair physical inspection photos with radar swath proximity verification.'
    );
  } else {
    recommendedActions.push(
      'Log baseline preventive roof health passport and monitor future NOAA Hail/Wind advisories.'
    );
  }

  return {
    hailInches: round(hailInches, 2),
    hailMm: round(hailMm, 1),
    windMph: round(windMph, 1),
    roofType,
    terminalVelocityMs: round(terminalVelocityMs, 2),
    singleImpactEnergyJ: round(singleImpactEnergyJ, 2),
    effectiveEnergyJ: round(effectiveEnergyJ, 2),
    materialThresholdMm: curve.thresholdMm,
    damageRatioBand: { p10, p50, p90 },
    supplementReadiness,
    recommendedActions,
    methodology:
      'NHESS/CLIMADA spherical hail kinetic energy physics (rho=900 kg/m^3, Cd=0.60, wind-vector obliquity) with nominal p10-p90 logistic vulnerability bounds.',
  };
}
