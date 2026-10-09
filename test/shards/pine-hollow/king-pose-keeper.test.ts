import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../../../src/engine/sim/snapshot';
import { pineBake } from '../../../src/shards/pine-hollow/runtime/baked';
import { installKingPoseKeeper, KING_POSE_STEP } from '../../../src/shards/pine-hollow/runtime/kingPoseKeeper';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
const recipe = pineBake().parked.find(row => row.kind === 'antler-king');
if (recipe === undefined) throw new Error('Missing actual parked King recipe');
const recipes = [0, 1].map(i => ({ id: `king:${String(i)}`, spec: recipe.spec,
  seed: recipe.seed + i, scale: recipe.scale, at: { x: 3 * i, y: 0, z: 4 }, yaw: 0 }));
const level = { ...SIM_LEVEL, entities: [] };

function install(host: SimHost): { retire: (id: string) => void; heads: Vector3[] } {
  const heads: Vector3[] = [];
  // Equipment reads the previous render's head, then the cage getter publishes only its parent chain.
  host.onStep('test.equipment', () => {
    const body = host.entities.get('king:0'); if (body === undefined) return;
    heads.push(body.headWorld(new Vector3()));
  }, undefined, 'afterBodies');
  const keeper = installKingPoseKeeper(host);
  recipes.forEach(row => {
    const body = host.spawn(row);
    body.driven = true;
    keeper.attach(Object.assign(body, { hidden: false, sampleTerrain: (): void => undefined }));
  });
  host.onStep('test.motion', () => {
    host.entities.forEach(body => {
      body.mem['act'] = 1 + Math.floor(host.state.tick / 20) % 4;
      if (host.state.tick % 20 === 0) body.startAttack(1.1);
      body.setMotion(0.2, 2, 4);
    });
  });
  return { retire: keeper.retire, heads };
}

it('publishes real moved-body poses after equipment, and retires the exact pose owner', () => {
  const host = createSimHost(level, { rapier }), { heads, retire } = install(host);
  try {
    const body = host.entities.get('king:0'); if (body === undefined) throw new Error('Missing actual King');
    const old = body.headWorld(new Vector3());
    host.step(); expect(heads[0]).toEqual(old);
    const rendered = body.headWorld(new Vector3()); expect(rendered.distanceTo(old)).toBeGreaterThan(0.001);
    host.step(); expect(heads[1]).toEqual(rendered);
    retire(body.entityId); host.retire(body.entityId); host.step();
    const saved = snapshotSimHost(host).adapters.find(row => row.id === KING_POSE_STEP);
    expect(saved?.state).toMatchObject({ version: 1, bodies: [{ id: 'king:1' }] });
    expect(heads).toHaveLength(2);
  } finally { host.dispose(); }
});

it('validates the whole two-King continuation before mutation and restores an exact native suffix', () => {
  const host = createSimHost(level, { rapier }); install(host);
  try {
    for (let tick = 0; tick < 80; tick++) host.step();
    const saved = snapshotSimHost(host), adapter = host.adapters.get(KING_POSE_STEP);
    if (adapter === undefined) throw new Error('Missing actual pose continuation');
    const original = adapter.snapshot();
    const corrupt = structuredClone(original);
    if (typeof corrupt !== 'object' || corrupt === null || !('bodies' in corrupt) || !Array.isArray(corrupt['bodies'])) throw new Error('Missing pose rows');
    const second: unknown = corrupt['bodies'][1];
    if (typeof second !== 'object' || second === null) throw new Error('Missing second pose');
    Object.assign(second, { pose: {} });
    expect(() => adapter.restore(corrupt)).toThrow(); expect(adapter.snapshot()).toEqual(original);
    const copy = restoreSimHost(level, { rapier }, saved, restored => { install(restored); });
    try {
      expectSameSimSnapshot(snapshotSimHost(copy), saved);
      for (let tick = 0; tick < 200; tick++) { host.step(); copy.step(); }
      expectSameSimSnapshot(snapshotSimHost(copy), snapshotSimHost(host));
      expect(copy.entities.get('king:0')?.headWorld(new Vector3())).toEqual(host.entities.get('king:0')?.headWorld(new Vector3()));
    } finally { copy.dispose(); }
  } finally { host.dispose(); }
});
