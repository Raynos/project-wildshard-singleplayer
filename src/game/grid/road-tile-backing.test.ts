import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial, Sphere } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { contentHash } from '../shardfile/contentHash';
import { finishRoadSteps, type CullPlan } from './roadCull';
import { decodeRoadTile, encodeRoadTile, type RoadTileStore } from './roadTileArchive';
import { RoadTileBacking } from './roadTileBacking';
import { compactRoadTileSteps } from './roadTileGeometry';
import { coarseRoadTileSteps } from './roadTileCoarse';

function fixture(count = 8, run = 3): { mesh: Mesh; plan: CullPlan; close: () => void } {
  const geometry = new BufferGeometry(), positions = new Float32Array(count * 9), index = new Uint32Array(count * run * 2);
  const bins: CullPlan['bins'][number][] = [];
  for (let tile = 0; tile < count; tile++) {
    positions.set([tile, 0, 0, tile + 1, 0, 0, tile, 0, 1], tile * 9);
    const start = tile * run * 2;
    for (let at = 0; at < run * 2; at++) index[start + at] = tile * 3 + at % 3;
    bins.push({ start, count: run, levels: [{ start: start + run, count: run }], sphere: new Sphere(undefined, 1), tile: { x: tile * 2, z: 0 } });
  }
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material);
  return { mesh, plan: { source: index, bins, lod: [150] }, close: () => { geometry.dispose(); material.dispose(); } };
}
async function serialBodies(mesh: Mesh, plan: CullPlan): Promise<Map<string, Uint8Array>> {
  const bodies = new Map<string, Uint8Array>(), parents = new Map<string, { x: number; z: number }>();
  for (const bin of plan.bins) {
    const at = bin.tile; if (at === undefined) throw new Error('Missing fixture tile');
    const data = finishRoadSteps(compactRoadTileSteps(mesh.geometry, plan, at.x, at.z));
    try { const bytes = encodeRoadTile(data); bodies.set(await contentHash(bytes), bytes); }
    finally { data.geometry.dispose(); }
    const x = Math.floor(at.x / 2), z = Math.floor(at.z / 2); parents.set([x, z].join(','), { x, z });
  }
  for (const at of parents.values()) {
    const data = finishRoadSteps(coarseRoadTileSteps(mesh.geometry, plan, at.x, at.z));
    try { const bytes = encodeRoadTile(data); bodies.set(await contentHash(bytes), bytes); }
    finally { data.geometry.dispose(); }
  }
  return bodies;
}
async function capture(backing: RoadTileBacking, mesh: Mesh, plan: CullPlan): Promise<void> {
  const steps = backing.capture(mesh, plan); let complete = false;
  try {
    for (;;) {
      const next = steps.next(), pending = backing.flush();
      if (pending !== null) await pending;
      if (next.done) { complete = true; return; }
    }
  } finally {
    try { if (!complete) steps.return(); }
    finally { await backing.settlePending(); }
  }
}
function gatedStore(first: number, quota = true): {
  store: RoadTileStore; bodies: Map<string, Uint8Array>; started: Promise<void>; release: () => void;
  counts: { reads: number; active: number; peak: number; writes: number; pins: number; releases: number };
} {
  const bodies = new Map<string, Uint8Array>(), gates: (() => void)[] = [];
  let start = (): void => undefined;
  const started = new Promise<void>(resolve => { start = resolve; });
  const counts = { reads: 0, active: 0, peak: 0, writes: 0, pins: 0, releases: 0 };
  const store: RoadTileStore = {
    get: async hash => {
      counts.reads++; counts.active++; counts.peak = Math.max(counts.peak, counts.active);
      try {
        if (counts.reads <= first) await new Promise<void>(resolve => { gates.push(resolve); if (gates.length === first) start(); });
        return bodies.get(hash)?.slice() ?? null;
      } finally { counts.active--; }
    },
    put: (hash, bytes) => { counts.writes++; if (quota) bodies.set(hash, bytes.slice()); return Promise.resolve(quota); },
    pin: () => { counts.pins++; return () => { counts.releases++; }; },
  };
  return { store, bodies, counts, started, release: () => { for (const resolve of [...gates].reverse()) resolve(); } };
}

test('bounded independent archives drain before capture returns and retain every serial byte', async () => {
  const f = fixture(), scope = new Scope('road pipeline'), store = gatedStore(6), expected = await serialBodies(f.mesh, f.plan);
  const backing = new RoadTileBacking(scope, store.store, { pitch: 125, plans: new Map() });
  const work = capture(backing, f.mesh, f.plan);
  await store.started;
  expect(store.counts.reads).toBe(6); expect(backing.state().backedTiles).toBe(0);
  await expect(backing.settlePending()).rejects.toThrow('capture must close');
  store.release(); await work;
  expect(store.counts.peak).toBe(6); expect(store.counts.active).toBe(0);
  expect(store.counts.reads).toBe(16); expect(backing.state().backedTiles).toBe(16);
  expect([...store.bodies.keys()].sort()).toEqual([...expected.keys()].sort());
  for (const [hash, bytes] of expected) expect(store.bodies.get(hash)).toEqual(bytes);
  const warm = fixture(), writes = store.counts.writes;
  await capture(backing, warm.mesh, warm.plan);
  expect(store.counts.writes).toBe(writes); expect(backing.state().backedTiles).toBe(32);
  scope.dispose(); expect(store.counts.releases).toBe(store.counts.pins); warm.close(); f.close();
});

test('large conservative scratch estimates retain the original serial path', async () => {
  const f = fixture(2, 60_000), scope = new Scope('large road scratch'), store = gatedStore(1);
  const backing = new RoadTileBacking(scope, store.store, { pitch: 125, plans: new Map() });
  const work = capture(backing, f.mesh, f.plan); await store.started;
  expect(store.counts.reads).toBe(1); store.release(); await work;
  expect(store.counts.peak).toBe(1); expect(store.counts.reads).toBe(4);
  scope.dispose(); expect(store.counts.releases).toBe(store.counts.pins); f.close();
});

test('quota failure drains every started operation and publishes no failed source', async () => {
  const f = fixture(), scope = new Scope('road pipeline quota'), store = gatedStore(6, false);
  const backing = new RoadTileBacking(scope, store.store, { pitch: 125, plans: new Map() });
  const work = capture(backing, f.mesh, f.plan), refused = expect(work).rejects.toThrow('storage refused');
  await store.started; store.release(); await refused;
  expect(store.counts.reads).toBe(6); expect(store.counts.active).toBe(0);
  expect(backing.state().materials).toBe(0); expect(backing.state().backedTiles).toBe(0);
  expect(store.counts.releases).toBe(store.counts.pins); scope.dispose(); f.close();
});

test('retirement joins late reads, refuses late writes and releases each pin once', async () => {
  const f = fixture(), scope = new Scope('road pipeline retirement'), store = gatedStore(6);
  const backing = new RoadTileBacking(scope, store.store, { pitch: 125, plans: new Map() });
  const work = capture(backing, f.mesh, f.plan), refused = expect(work).rejects.toThrow('owner retired');
  await store.started; scope.dispose();
  let settled = false; const joining = (async () => { await backing.settlePending(); settled = true; })();
  await Promise.resolve(); expect(settled).toBe(false);
  store.release(); await refused; await joining;
  expect(store.counts.active).toBe(0); expect(store.counts.reads).toBe(6); expect(store.counts.writes).toBe(0);
  expect(store.counts.releases).toBe(store.counts.pins); expect(backing.state().materials).toBe(0); f.close();
});

test('out-of-order failures retain the first authored refusal after all started work drains', async () => {
  const f = fixture(), scope = new Scope('road authored refusal'), store = gatedStore(6);
  const first = new Error('first road write'), later = new Error('later road write');
  store.store.put = (_hash, bytes) => {
    const data = decodeRoadTile(bytes), x = data.plan.bins[0]?.tile?.x; data.geometry.dispose();
    return x === 0 ? Promise.reject(first) : x === 2 ? Promise.reject(later) : Promise.resolve(true);
  };
  const backing = new RoadTileBacking(scope, store.store, { pitch: 125, plans: new Map() });
  const work = capture(backing, f.mesh, f.plan), refused = expect(work).rejects.toBe(first);
  await store.started; store.release(); await refused;
  expect(store.counts.reads).toBe(6); expect(store.counts.active).toBe(0);
  expect(store.counts.releases).toBe(store.counts.pins); expect(backing.state().materials).toBe(0);
  scope.dispose(); f.close();
});
