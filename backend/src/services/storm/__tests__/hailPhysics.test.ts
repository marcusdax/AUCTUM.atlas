import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHailUnderwriting, normalizeRoofMaterial } from '../hailPhysics';

test('evaluateHailUnderwriting scales kinetic energy and damage ratios monotonically with hail diameter', () => {
  const pea = evaluateHailUnderwriting({ hailInches: 0.5, windMph: 20, roofType: 'three_tab_asphalt' });
  const quarter = evaluateHailUnderwriting({ hailInches: 1.0, windMph: 20, roofType: 'three_tab_asphalt' });
  const golfball = evaluateHailUnderwriting({ hailInches: 1.75, windMph: 55, roofType: 'three_tab_asphalt' });

  assert.equal(pea.hailMm, 12.7);
  assert.ok(quarter.singleImpactEnergyJ > pea.singleImpactEnergyJ);
  assert.ok(golfball.singleImpactEnergyJ > quarter.singleImpactEnergyJ);
  assert.ok(golfball.effectiveEnergyJ > golfball.singleImpactEnergyJ);
  assert.ok(pea.damageRatioBand.p10 <= pea.damageRatioBand.p50);
  assert.ok(pea.damageRatioBand.p50 <= pea.damageRatioBand.p90);
  assert.ok(golfball.damageRatioBand.p50 > quarter.damageRatioBand.p50);
  assert.equal(golfball.supplementReadiness, 'CRITICAL');
});

test('metal_class4 resists hail better than three_tab_asphalt at identical diameter', () => {
  const asphalt = evaluateHailUnderwriting({ hailInches: 1.25, windMph: 35, roofType: 'three_tab_asphalt' });
  const metal = evaluateHailUnderwriting({ hailInches: 1.25, windMph: 35, roofType: 'metal_class4' });

  assert.ok(asphalt.damageRatioBand.p50 > metal.damageRatioBand.p50);
  assert.equal(normalizeRoofMaterial('class4'), 'metal_class4');
  assert.equal(normalizeRoofMaterial('unknown'), 'three_tab_asphalt');
});
