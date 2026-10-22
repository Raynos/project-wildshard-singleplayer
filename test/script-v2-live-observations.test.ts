import { expect,test } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { fixtureBytes } from './fixtures/nativeBytes';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { captureNativeV2Observations,type V2NativeObservationRow } from '../src/engine/script/liveObservationsV2';
import { prepareV2Observations } from '../src/engine/script/observationsV2';
import { layoutV2 } from '../src/format/scriptWireV2';

async function world() {
  const rapier = await loadRapier(Uint8Array.from(fixtureBytes(new URL('../public/assets/physics/rapier.wasm',import.meta.url))));
  const host = createSimHost({ ...SIM_LEVEL,quests: [] },{ rapier });host.state.tick = 12;
  const actor = host.entities.get('boar:1');if (actor === undefined) throw new Error('Missing original native fixture');
  actor.position.set(4,2,5);actor.yaw = .25;actor.hp = actor.maxHp/2;host.player.position.set(6,2,5);
  return { host,actor };
}
function row(): V2NativeObservationRow {
  return { identity: 'animal',handle: 1,self: 10,player: 11,observed: new Map([[10,'boar:1'],[11,'player']]),target: 11,
    enabled: true,due: true,divisor: 6,fuel: 1000,previousTick: 6,currentTick: 12,state: [],parameters: [],fields: [],ground: true,sight: true,walkRadius: null };
}
test('native capture reads the actual host at each original slot, without moving bodies or RNG', async () => {
  const { host,actor } = await world();
  try {
    const declaration = { ...row(),observed: new Map([[10,actor.entityId],[11,host.player.id]]) }, rng = host.rng.snapshot();
    const first = captureNativeV2Observations(host,[declaration],null), firstRow = first.bindings[0];
    expect(firstRow?.sample).toMatchObject({ atTick: 12,target: 11,pose: { x: 4,y: 2,z: 5,yaw: .25 },hpShare: .5,groundY: host.groundHeightAt(4,5),lineOfSight: true });
    expect(first.players[0]).toMatchObject({ identity: host.player.id,handle: 11,atTick: 12,pose: { x: 6,y: 2,z: 5 } });
    actor.position.x = 9;host.player.position.x = 11;
    const later = captureNativeV2Observations(host,[declaration],null);
    expect(firstRow?.sample.pose?.x).toBe(4);expect(first.players[0]?.pose?.x).toBe(6);
    expect(later.bindings[0]?.sample.pose?.x).toBe(9);expect(later.players[0]?.pose?.x).toBe(11);
    expect(host.rng.snapshot()).toEqual(rng);expect(host.state.tick).toBe(12);
    const layout = layoutV2(1024,1,new Map([[1,1],[5,1],[7,1]])), batch = { ...first,edges: [],events: [],actions: new Set<number>(),eventKinds: new Set<number>() };
    const prepared = prepareV2Observations(layout,12,batch), memory = new DataView(new ArrayBuffer(65536));prepared.write(memory);
    actor.position.x = 50;prepared.write(memory);
    const bank = layout.regions[4];if (bank === undefined) throw new Error('Missing observation bank');
    expect(memory.getFloat64(layout.io+bank.offset+24,true)).toBe(4);
  } finally { host.dispose(); }
});
test('standard queries use the explicitly lent navmesh and real current physics', async () => {
  const { host,actor } = await world(), calls: number[][] = [];
  try {
    const declaration = { ...row(),observed: new Map([[10,actor.entityId],[11,host.player.id]]),walkRadius: 0 };
    const capture = () => captureNativeV2Observations(host,[declaration],{ closestWalkable: (point,radius) => { calls.push([point.x,point.y,point.z,Number(radius)]);return new Vector3(7,2,8); } });
    expect(capture().bindings[0]?.sample).toMatchObject({ walk: { x: 7,z: 8 },lineOfSight: true });
    expect(calls).toEqual([[4,2,5,0]]);
    host.physics.world.createCollider(host.physics.R.ColliderDesc.cuboid(.1,1,1).setTranslation(5,2,5));host.physics.step();
    expect(capture().bindings[0]?.sample.lineOfSight).toBe(false);
    expect(captureNativeV2Observations(host,[declaration],{ closestWalkable: () => null }).bindings[0]?.sample.walk).toBeUndefined();
    expect(() => captureNativeV2Observations(host,[declaration],null)).toThrow('declaration');
  } finally { host.dispose(); }
});
test('the whole phase preflights ownership before any terrain or navigation query', async () => {
  const { host,actor } = await world();let queried = 0;
  try {
    const declaration = { ...row(),observed: new Map([[10,actor.entityId],[11,host.player.id]]),walkRadius: 1 }, navigation = { closestWalkable: () => { queried++;return null; } };
    const invalid = [
      { ...declaration,observed: new Map([[10,'foreign'],[11,host.player.id]]) },
      { ...declaration,player: 10 },{ ...declaration,self: 99 },{ ...declaration,currentTick: 11 },
      { ...declaration,target: 99 },{ ...declaration,walkRadius: Number.NaN },
    ];
    for (const bad of invalid) expect(() => captureNativeV2Observations(host,[declaration,bad],navigation)).toThrow();
    expect(queried).toBe(0);
    actor.hp = Number.NaN;expect(() => captureNativeV2Observations(host,[declaration],navigation)).toThrow('health');
  } finally { host.dispose(); }
  expect(() => captureNativeV2Observations(host,[],null)).toThrow('phase');
});
