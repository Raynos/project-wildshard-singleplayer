// oxlint-disable-next-line import/no-nodejs-modules -- Fuzz committed parser seeds and the shipped, shared physics binary.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { assetCost, parseGlb, visitGlbTriangles } from '../src/game/shardfile/assets';
import { encodeTerrainTile, decodeTerrainTile } from '../src/engine/world/terrainTileData';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { addBakedTerrainCollider } from '../src/engine/physics/terrainTiles';
import { Scope } from '../src/engine/app/scope';

function triangle(position = 0, index = 2, vertices = 3, aliases = 0): Uint8Array {
  const binary = vertices * 12 + 8;
  const accessor = { bufferView: 0, componentType: 5126, count: vertices, type: 'VEC3' };
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, buffers: [{ byteLength: binary }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: vertices * 12 }, { buffer: 0, byteOffset: vertices * 12, byteLength: 6 }],
    accessors: [accessor, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }, ...Array.from({ length: aliases }, () => accessor)],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 }));
  const length = Math.ceil(json.length / 4) * 4, bytes = new Uint8Array(28 + length + binary), view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
  view.setUint32(12, length, true); view.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20, 20 + length); bytes.set(json, 20);
  view.setUint32(20 + length, binary, true); view.setUint32(24 + length, 0x004e4942, true);
  [position, 0, 0, 1, 0, 0, 0, 0, 1].forEach((value, i) => view.setFloat32(28 + length + i * 4, value, true));
  [0, 1, index].forEach((value, i) => view.setUint16(28 + length + vertices * 12 + i * 2, value, true));
  return bytes;
}
function mutations(seed: Uint8Array): Uint8Array[] {
  const result = [seed]; let state = 43558;
  const next = (): number => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
  for (let i = 0; i < 128; i++) {
    const bytes = seed.slice();
    for (let j = 0; j < 1 + i % 4; j++) { const at = next() % bytes.length; bytes[at] = (bytes[at] ?? 0) ^ (1 << (next() % 8)); }
    result.push(bytes, seed.slice(0, next() % seed.length));
  }
  return result;
}
function admitted(kind: string, bytes: Uint8Array): boolean {
  let cost;
  try {
    cost = assetCost(kind, bytes);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(RangeError);
    expect(error).not.toBeInstanceOf(WebAssembly.RuntimeError);
    return false;
  }
  for (const value of Object.values(cost)) expect(Number.isSafeInteger(value) && value >= 0).toBe(true);
  return true;
}
it('refuses nonfinite GLB positions and out-of-range indices during cost admission, before any decoder or collider', () => {
  expect(parseGlb(triangle()).triangles).toBe(1);
  for (const value of [Number.NaN, Infinity, -Infinity]) expect(() => parseGlb(triangle(value))).toThrow('nonfinite GLB position');
  expect(() => parseGlb(triangle(0, 3))).toThrow('index outside positions');
  expect(() => parseGlb(triangle(0, 2, 3000, 7500))).toThrow('aggregate accessor cap');
});
it('bounds 1,285 deterministic valid, bit-mutated and truncated GLB/KTX2/WAV/terrain payloads', () => {
  const seeds = [
    { kind: 'glb', bytes: triangle() },
    { kind: 'glb', bytes: new Uint8Array(readFileSync('test/fixtures/shard-assets/triangle.glb')) },
    { kind: 'ktx2', bytes: new Uint8Array(readFileSync('test/fixtures/shard-assets/pixel.ktx2')) },
    { kind: 'audio', bytes: new Uint8Array(readFileSync('test/fixtures/shard-assets/sample.wav')) },
    { kind: 'binary', bytes: encodeTerrainTile({ resolution: 3, x: -1, z: -1, size: 2, heights: new Float32Array(9) }) },
  ];
  for (const seed of seeds) {
    expect(admitted(seed.kind, seed.bytes)).toBe(true);
    for (const bytes of mutations(seed.bytes)) {
      if (!admitted(seed.kind, bytes)) continue;
      if (seed.kind === 'glb') visitGlbTriangles(bytes, (vertices) => { for (const vertex of vertices) expect(Object.values(vertex).every(Number.isFinite)).toBe(true); });
    }
  }
});
it('constructs, steps, snapshots and releases admitted geometry in independent worlds using one Rapier module', async () => {
  const rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm')));
  const seed = encodeTerrainTile({ resolution: 3, x: -1, z: -1, size: 2, heights: new Float32Array(9) });
  let worlds = 0;
  for (const bytes of mutations(seed)) {
    // Terrain magic mutations become opaque binary files, so only the terrain decoder authorises heightfield construction.
    try { decodeTerrainTile(bytes); } catch (error) { expect(error).toBeInstanceOf(Error); continue; }
    const physics = new Physics(rapier), scope = new Scope('fuzz terrain');
    try {
      const collider = addBakedTerrainCollider(physics, bytes, scope);
      physics.step(); expect(collider.isValid()).toBe(true); expect(physics.snapshot().length).toBeGreaterThan(0); worlds++;
    } finally { scope.dispose(); expect(physics.world.colliders.len()).toBe(0); physics.dispose(); }
  }
  expect(worlds).toBeGreaterThan(20);
  let meshes = 0;
  for (const bytes of mutations(triangle())) {
    if (!admitted('glb', bytes)) continue;
    const vertices: number[] = [];
    visitGlbTriangles(bytes, (points) => { for (const point of points) vertices.push(point.x, point.y, point.z); });
    const physics = new Physics(rapier);
    try {
      const collider = physics.world.createCollider(rapier.ColliderDesc.trimesh(new Float32Array(vertices), Uint32Array.from({ length: vertices.length / 3 }, (_v, i) => i)));
      physics.step(); expect(collider.isValid()).toBe(true); expect(physics.snapshot().length).toBeGreaterThan(0); meshes++;
    } finally { physics.dispose(); }
  }
  expect(meshes).toBeGreaterThan(0);
});
