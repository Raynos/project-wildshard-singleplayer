// oxlint-disable-next-line import/no-nodejs-modules -- reads the G208 Pine census plan (a copy of progress/memory/g208-pine-rings/plan.json under test/fixtures, which the Vercel tree keeps).
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { BoxGeometry, type BufferGeometry, DataTexture, Group, InstancedMesh, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { CHUNK_HALF } from '../src/engine/core/config';
import { compileRuntimeRenderPlan } from '../src/game/grid/runtimeRenderPlan';
import { runtimeAccountedBytes } from '../src/game/grid/runtimeCost';
import { preflightRenderPlan, textureCost, toRuntimeRenderPlan, wantedL1Chunks, type PreflightPlan } from '../src/game/grid/runtimeRenderPreflight';
import { PINE_RUNTIME_COST } from '../src/shards/pine-hollow/data/runtimeCost';

const texture = (size: number): DataTexture => { const t = new DataTexture(new Uint8Array(size * size * 4), size, size); t.generateMipmaps = false; return t; };
const geoBytes = (g: BufferGeometry): number => Object.values(g.attributes).reduce((s, a) => s + a.array.byteLength, 0) + (g.index?.array.byteLength ?? 0);

/** A region subtree in its cell-local frame: a one-mesh terrain, a cell-wide instanced forest, three props in two tiles. */
function region(): { root: Group; shared: DataTexture; own: DataTexture; prop: BoxGeometry; terrain: PlaneGeometry; forest: InstancedMesh } {
  const root = new Group(); root.position.set(5000, 0, -555); // the render offset never matters: bounds are root-local
  const terrain = new PlaneGeometry(500, 500, 15, 15).rotateX(-Math.PI / 2);
  root.add(new Mesh(terrain, new MeshBasicMaterial({ map: texture(64) })));
  const forest = new InstancedMesh(new BoxGeometry(1, 8, 1), new MeshBasicMaterial(), 50);
  root.add(forest);
  const shared = texture(32), own = texture(16), prop = new BoxGeometry(4, 4, 4);
  const at = (x: number, z: number, map: DataTexture): void => { const m = new Mesh(prop.clone(), new MeshBasicMaterial({ map })); m.position.set(x, 0, z); root.add(m); };
  at(-CHUNK_HALF + 30, -CHUNK_HALF + 30, shared); at(-CHUNK_HALF + 60, -CHUNK_HALF + 40, own); // both in L1 0/0
  at(CHUNK_HALF - 30, CHUNK_HALF - 30, shared); // L1 3/3
  return { root, shared, own, prop, terrain, forest };
}

it('classifies cell-wide drawables as non-streaming and position-bound ones into L1 chunks with shared dependencies', () => {
  const { root, shared, own, prop, terrain, forest } = region();
  const { plan, drawables } = preflightRenderPlan(root, { id: 'fixture', claimBytes: 10_000_000 });
  expect(drawables).toEqual({ chunked: 3, global: 2 });
  expect(plan.chunks.map(c => c.id)).toEqual(['chunk.l1.0.0', 'chunk.l1.3.3']);
  const sharedCost = textureCost(shared), ownCost = textureCost(own);
  expect(sharedCost).toEqual({ js: 32 * 32 * 4, gpu: 32 * 32 * 4 });
  // the shared texture is one dependency of both chunks, charged once; the single-tile texture is its chunk's own
  expect(plan.dependencies.filter(d => d.always !== true)).toEqual([{ id: 'dep.000', jsBytes: sharedCost.js, gpuBytes: sharedCost.gpu }]);
  const [a, b] = plan.chunks;
  expect(a?.dependencyIds).toEqual(['dep.000']); expect(b?.dependencyIds).toEqual(['dep.000']);
  expect((a?.jsBytes ?? 0) + (a?.gpuBytes ?? 0)).toBe(2 * 2 * geoBytes(prop) + ownCost.js + ownCost.gpu);
  // the terrain and the forest's geometry are the always dependency; the forest's instance matrices are non-streaming
  const global = plan.dependencies.find(d => d.always === true);
  expect(global?.gpuBytes).toBe(geoBytes(terrain) + geoBytes(forest.geometry) + 64 * 64 * 4);
  expect(plan.nonStreamingBytes).toBe(2 * forest.instanceMatrix.array.byteLength);
});

it('hands a classification to the checked plan with every unclassified byte in the residual', () => {
  const { root } = region();
  const { plan } = preflightRenderPlan(root, { id: 'fixture', claimBytes: 10_000_000 });
  const measured = { ...PINE_RUNTIME_COST, rev: 'abcdef123', evidence: 'progress/memory/g208-pine-rings/plan.json' };
  const whole = runtimeAccountedBytes(measured), inventory = compileRuntimeRenderPlan(toRuntimeRenderPlan(plan, measured, whole), measured);
  expect(inventory.full.totalBytes).toBe(whole);
  expect(inventory.full.dependencies.map(d => d.id)).toEqual(['dep.000']);
  // one chunk dropped: its own bytes leave, the dependency it shares with the resident chunk stays charged once
  const [a] = plan.chunks; if (a === undefined) throw new Error('fixture chunk');
  expect(inventory.footprint(['chunk.l1.3.3']).totalBytes).toBe(whole - a.jsBytes - a.gpuBytes);
});

const census = JSON.parse(readFileSync('test/fixtures/g208/pine-plan.json', 'utf8')) as { build: { build: string }; plan: PreflightPlan };
// the served HEAD (scripts/serve-build.sh --head) of build be4c277-muytjp7n
const pin = { rev: 'be4c27711', evidence: 'progress/memory/g208-pine-rings/plan.json' };

it('refuses Pine\'s census plan against the shipped images-first measurement: different pins, no discount', () => {
  const whole = runtimeAccountedBytes(PINE_RUNTIME_COST);
  expect(() => compileRuntimeRenderPlan(toRuntimeRenderPlan(census.plan, pin, whole), PINE_RUNTIME_COST)).toThrow(/reviewed measurement/u);
});

it('Pine by rings (arithmetic on the census plan): covers the whole claim and saves nothing within the L1 radius', () => {
  // The census pin has no same-pin WebContent reading yet: the shipped figures under the census provenance check only the
  // accounting arithmetic, never a cost a page admits.
  const measured = { ...PINE_RUNTIME_COST, ...pin }, whole = runtimeAccountedBytes(measured);
  const inventory = compileRuntimeRenderPlan(toRuntimeRenderPlan(census.plan, pin, whole), measured);
  expect(inventory.full.totalBytes).toBe(whole); // the residual keeps every unclassified byte
  expect(inventory.full.chunks).toHaveLength(16);
  const saved = (x: number, z: number): number => whole - inventory.footprint([...wantedL1Chunks(census.plan, x, z)]).totalBytes;
  // inside Pine and on its edge the 400 m L1 ring wants all 16 tiles: G208 saves 0 bytes where the gap is
  expect(saved(0, 0)).toBe(0); expect(saved(0, 210)).toBe(0); expect(saved(0, CHUNK_HALF)).toBe(0);
  // approaching on the road it saves tens of MB, never the hundreds Pine's border needs
  const out50 = saved(0, CHUNK_HALF + 50), out150 = saved(0, CHUNK_HALF + 150);
  expect(out50).toBeGreaterThan(40_000_000); expect(out50).toBeLessThan(60_000_000);
  expect(out150).toBeGreaterThan(out50); expect(out150).toBeLessThan(100_000_000);
});
