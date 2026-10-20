import type { Animal } from '../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../src/engine/entities/species/registry';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type: 'json' };
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { createPageCrowds, thinkCrowdGuard } from '../src/game/ambient/crowdPage';
import type { SkyRig } from '../src/engine/world/skyRig';
import { legacyDouble } from './fake/FakeGame';
import { buildSheepGeometry, SHEEP_PIVOTS, SHEEP_PART_NAMES } from '../src/shards/nalati-grasslands-legacy/species/sheep';
import view from '../src/shards/nalati-grasslands/data/crowdView.json' with { type: 'json' };
import { setTerrainHeight, setTerrainPlacement } from '../src/engine/world/terrainHeight';
import { wildEnv } from '../src/game/population/pageGroups';

test('an unrelated marsh crowd uses its own bounds, identity, material and native cadence', () => {
  setTerrainHeight(() => 0); setTerrainPlacement(() => [0, 1, 0], () => -1000);
  const sky = legacyDouble<SkyRig>({ csm: legacyDouble<SkyRig['csm']>({ lights: [] }), sunDir: new Vector3(0, 1, 0), setupMaterial: () => undefined });
  const geometry = buildSheepGeometry(), body = { geometry, pivots: SHEEP_PIVOTS, parts: SHEEP_PART_NAMES };
  const row = { id: 'marsh.cranes', kind: 'flock', x: 12, z: -25, count: 3, seed: 17, range: 20, runSpeed: 4, walkSpeed: .8, grazeStep: .2, bleatCue: 'crane.call' };
  const guard = { signal: 'dog', clock: 'marsh.guardClock', every: .2, straggler: 15, bark: 'crane.alarm', soundHeight: .8, memory: { bark: 'marsh.bark', rest: 'marsh.rest', snarl: 'marsh.snarl', low: 'marsh.low' }, states: ['idle', 'alert', 'stalk', 'wander'] };
  const data = { guard, slug: 'reed-marsh', hull: null, bounds: [-40, 70, -90, 40], rows: [row], material: { rim: .3, bands: .6 }, view: { ...view, name: 'marsh.cranes' } };
  const wet = wildEnv.wetAt.bind(wildEnv), grass = wildEnv.grassHeightAt.bind(wildEnv);
  wildEnv.wetAt = () => false; wildEnv.grassHeightAt = () => 0;
  try {
    const crowds = createPageCrowds(sky, 5, body, data);
    expect(crowds.runtime.policies.has('marsh.cranes')).toBe(true);
    expect(() => crowds.factory({ x: 0, z: 0, count: 3, seed: 22, range: 20 }, 0)).toThrow('roster');
    const draw = crowds.factory({ x: 12, z: -25, count: 3, seed: 22, range: 20 }, 0);
    const actor = legacyDouble<Animal>({ alive: true, position: new Vector3(12, 0, -25), mem: {}, lookTarget: new Vector3(), lookWeight: 0, state: 'idle', yaw: 0, setMotion: () => undefined });
    crowds.guardian(actor, 0, ReturnProgram.page(admission), new Rng(4));
    const frame = legacyDouble<ThinkCtx>({ dt: .1, t: 1, player: new Vector3(), pathYaw: () => 0, steer: () => undefined, confine: () => undefined });
    thinkCrowdGuard(actor, frame); expect(actor.mem['marsh.guardClock']).toBe(1); expect(Number.isFinite(actor.mem['marsh.bark'])).toBe(true);
    frame.t = 1.1; thinkCrowdGuard(actor, frame); expect(actor.mem['marsh.guardClock']).toBe(1);
    expect(draw.mesh.name).toBe('marsh.cranes'); expect(draw.n).toBe(3);
    crowds.advance(draw, 0, 1, new Vector3(14, 0, -20), .1, .1, crowds.runtime.advance);
    expect(() => crowds.factory({ x: 12, z: -25, count: 3, seed: 22, range: 20 }, 0)).toThrow('roster');
    draw.mesh.geometry.dispose();
    for (const material of Array.isArray(draw.mesh.material) ? draw.mesh.material : [draw.mesh.material]) material.dispose();
    draw.mesh.customDepthMaterial?.dispose();
    expect(() => createPageCrowds(sky, 5, body, { ...data, bounds: [10, -10, 0, 40] })).toThrow('bounds');
  } finally { wildEnv.wetAt = wet; wildEnv.grassHeightAt = grass; geometry.dispose(); }
});
