import {parse} from 'valibot';
import {ActorProjectionStepV2Schema} from '@wildshard/format/actorProjectionV2';
import type {OriginalGuardBinding} from './fixtures/originalPageGuard';
import {Scope} from '../src/engine/shared/app/scope';
import guardProjection from '../src/shards/nalati-grasslands/data/crowdProjection.json' with {type:'json'};
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { createPageCrowds } from '../src/game/client/ambient/pageCrowds';
import type { SkyRig } from '../src/engine/client/world/skyRig';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { admittedSheepBody } from './fake/admittedSheep';
import view from '../src/shards/nalati-grasslands/data/crowdView.json' with { type: 'json' };
import { setTerrainHeight, setTerrainPlacement } from '../src/engine/shared/world/terrainHeight';
import { pageAir } from '../src/game/client/population/pageAir';

/** The live Nalati sheep body, read through the page crowd's own product reader. */
const sheepBody = admittedSheepBody;

function projectedRows(guard:OriginalGuardBinding['row']){
  const rows=parse(ActorProjectionStepV2Schema,guardProjection);
  rows.clock=guard.clock;rows.every=guard.every;
  const keys=new Map([['dogThinkAt',guard.clock],['barkT',guard.memory.bark],['rest',guard.memory.rest],['snarl',guard.memory.snarl],['low',guard.memory.low]]);
  for(const column of rows.columns){if(column.source.kind==='memory')column.source.key=keys.get(column.source.key)??column.source.key;if(column.source.kind==='crowd')column.source.distance=guard.straggler;}
  for(const operation of rows.operations){if(operation.kind==='memory')operation.key=keys.get(operation.key)??operation.key;
    if(operation.kind==='sound-position'){operation.cue=guard.bark;operation.height=guard.soundHeight;}
    if(operation.kind==='state')operation.states=guard.states;}
  return rows;
}

test('an unrelated marsh crowd uses its own bounds, identity, material and native cadence', async () => {
  setTerrainHeight(() => 0); setTerrainPlacement(() => [0, 1, 0], () => -1000);
  const sky = legacyDouble<SkyRig>({ csm: legacyDouble<SkyRig['csm']>({ lights: [] }), sunDir: new Vector3(0, 1, 0), setupMaterial: () => undefined });
  const body = await sheepBody(), geometry = body.geometry,scope=new Scope('marsh.guard');
  const row = { id: 'marsh.cranes', kind: 'flock', x: 12, z: -25, count: 3, seed: 17, range: 20, runSpeed: 4, walkSpeed: .8, grazeStep: .2, bleatCue: 'crane.call' };
  const guard = { signal: 'dog', clock: 'marsh.guardClock', every: .2, straggler: 15, bark: 'crane.alarm', soundHeight: .8, memory: { bark: 'marsh.bark', rest: 'marsh.rest', snarl: 'marsh.snarl', low: 'marsh.low' }, states: ['idle', 'alert', 'stalk', 'wander'] };
  const data = { guard:{projection:projectedRows(guard)}, slug: 'reed-marsh', hull: null, bounds: [-40, 70, -90, 40], rows: [row], material: { rim: .3, bands: .6 }, view: { ...view, name: 'marsh.cranes' } };
  const wet = pageAir.wetAt.bind(pageAir), grass = pageAir.grassHeightAt.bind(pageAir);
  pageAir.wetAt = () => false; pageAir.grassHeightAt = () => 0;
  try {
    const invalidGuard={...data.guard.projection,operations:data.guard.projection.operations.map(operation=>operation.kind==='state'?{...operation,states:['missing.guard.state']}:operation)};
    expect(()=>createPageCrowds(sky,5,body,{...data,guard:{projection:invalidGuard}},[])).toThrow('Invalid crowd guardian states');
    const crowds = createPageCrowds(sky, 5, body, data,[]);
    expect(crowds.runtime.policies.has('marsh.cranes')).toBe(true);
    expect(() => crowds.factory({ x: 0, z: 0, count: 3, seed: 22, range: 20 }, 0)).toThrow('roster');
    const draw = crowds.factory({ x: 12, z: -25, count: 3, seed: 22, range: 20 }, 0);
    expect(draw.mesh.name).toBe('marsh.cranes'); expect(draw.n).toBe(3);
    crowds.advance(draw, 0, 1, new Vector3(14, 0, -20), .1, .1, crowds.runtime.advance);
    expect(() => crowds.factory({ x: 12, z: -25, count: 3, seed: 22, range: 20 }, 0)).toThrow('roster');
    draw.mesh.geometry.dispose();
    for (const material of Array.isArray(draw.mesh.material) ? draw.mesh.material : [draw.mesh.material]) material.dispose();
    draw.mesh.customDepthMaterial?.dispose();
    expect(() => createPageCrowds(sky, 5, body, { ...data, bounds: [10, -10, 0, 40] })).toThrow('bounds');
  } finally { scope.dispose();pageAir.wetAt = wet; pageAir.grassHeightAt = grass; geometry.dispose(); }
});

