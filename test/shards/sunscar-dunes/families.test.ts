import { describe, expect, it } from 'vitest';
import { parseFamilyMaterial, parseGroundLayer, type GroundLayerParams } from '@wildshard/format/materialFamilies';
import { curvedParams } from '@wildshard/format/materials';
import { duskSkyEntry } from '../../../src/shards/sunscar-dunes/runtime/looks/duskFamilies';
import { SAND_LOOK, SKY_LOOK } from '../../../src/shards/sunscar-dunes/data/familyLook';

// SF50 (A10): Signal Dunes' sand and sky as family entries (data/familyLook.ts); the sand's dusk curves (`look.curves`
// rows) reproduce the retired sand shader's dusk terms.
const sand = parseFamilyMaterial(SAND_LOOK.entry);
const sandAtDusk = (dusk: number): GroundLayerParams => {
  const params = curvedParams(sand, SAND_LOOK.curves, () => dusk);
  if (params.family !== 'pbr' || params.ground === null) throw new Error('the sand is a PBR ground');
  return params.ground;
};
describe('Signal Dunes on the material families', () => {
  it('declares valid PBR-ground and emissive-sky entries', () => {
    if (sand.family !== 'pbr' || sand.ground === null) throw new Error('the sand is a PBR ground');
    expect(sand.ground.pools).toEqual({ low: [1, 0.72, 0.32], high: [1, 0.42, 0.14], split: 0.5, radius: 10, gain: 0.17 });
    expect(sand.ground.keyShadow?.rect).toEqual([-520, -520, 520, 520]);
    const sky = parseFamilyMaterial(duskSkyEntry(SKY_LOOK));
    if (sky.family !== 'emissive' || sky.sky === null) throw new Error('the sky is an emissive dome');
    expect(sky.sky.window).toEqual([0.35, 0.95]);
  });

  it('at the first sunset its dusk terms are the ground layer defaults (the family was fitted there)', () => {
    const at0 = sandAtDusk(0), defaults = parseGroundLayer({});
    expect(at0.contrast).toEqual(defaults.contrast);
    expect(at0.albedo).toBe(defaults.albedo);
    expect(at0.shade).toEqual({ ...defaults.shade, floor: [0, 0, 0] });
    expect(at0.away.amount).toBe(0);
    expect(at0.grain.strength).toBe(1);
  });

  it('moves the dusk terms as the retired shader did, and every value validates', () => {
    const late = sandAtDusk(1);
    expect(late.contrast.strength).toBeCloseTo(0.25);
    expect(late.grain.strength).toBeCloseTo(0.25);
    expect(late.albedo).toBe(1);
    expect(late.shade.tint).toEqual([0.95, 0.85, 0.9]);
    expect(late.shade.gain).toBeCloseTo(1.15);
    expect(late.shade.lift).toEqual([0, 0, 0]);
    expect(late.shade.floor[0]).toBeCloseTo(0.019);
    expect(late.away.amount).toBeCloseTo(0.55);
    for (const d of [0, 0.25, 0.5, 0.62, 0.74, 0.86, 1, 1.4, -1]) expect(() => parseGroundLayer({ ...sandAtDusk(d) })).not.toThrow();
  });
});
