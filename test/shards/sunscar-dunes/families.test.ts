import { describe, expect, it } from 'vitest';
import { parseFamilyMaterial, parseGroundLayer } from '@wildshard/engine/render/families/params';
import { sandAtDusk, sandEntry, SKY_ENTRY } from '../../../src/shards/sunscar-dunes/look/families';

// SF50 (A10): Signal Dunes' sand and sky as family entries; the dusk adapter reproduces the retired sand shader's dusk terms.
const grain = { mean: 0.49, glintMean: 0.002 };
describe('Signal Dunes on the material families', () => {
  it('declares valid PBR-ground and emissive-sky entries', () => {
    const sand = parseFamilyMaterial(sandEntry(0, grain));
    if (sand.family !== 'pbr' || sand.ground === null) throw new Error('the sand is a PBR ground');
    expect(sand.ground.pools).toEqual({ low: [1, 0.72, 0.32], high: [1, 0.42, 0.14], split: 0.5, radius: 10, gain: 0.17 });
    expect(sand.ground.keyShadow?.rect).toEqual([-520, -520, 520, 520]);
    const sky = parseFamilyMaterial(SKY_ENTRY);
    if (sky.family !== 'emissive' || sky.sky === null) throw new Error('the sky is an emissive dome');
    expect(sky.sky.window).toEqual([0.35, 0.95]);
  });

  it('at the first sunset its dusk terms are the ground layer defaults (the family was fitted there)', () => {
    const at0 = sandAtDusk(0, grain), defaults = parseGroundLayer({});
    expect(at0.contrast).toEqual(defaults.contrast);
    expect(at0.albedo).toBe(defaults.albedo);
    expect(at0.shade).toEqual({ ...defaults.shade, floor: [0, 0, 0] });
    expect(at0.away.amount).toBe(0);
    expect(at0.grain.strength).toBe(1);
  });

  it('moves the dusk terms as the retired shader did, and every value validates', () => {
    const late = sandAtDusk(1, grain);
    expect(late.contrast.strength).toBeCloseTo(0.25);
    expect(late.grain.strength).toBeCloseTo(0.25);
    expect(late.albedo).toBe(1);
    expect(late.shade.tint).toEqual([0.95, 0.85, 0.9]);
    expect(late.shade.gain).toBeCloseTo(1.15);
    expect(late.shade.lift).toEqual([0, 0, 0]);
    expect(late.shade.floor[0]).toBeCloseTo(0.019);
    expect(late.away.amount).toBeCloseTo(0.55);
    for (const d of [0, 0.25, 0.5, 0.62, 0.74, 0.86, 1, 1.4, -1]) expect(() => parseGroundLayer({ ...sandAtDusk(d, grain) })).not.toThrow();
  });
});
