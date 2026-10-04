// oxlint-disable-next-line import/no-nodejs-modules -- The template's admitted bytes are read from the tree.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Content hashes for the admitted-asset reader.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { RenderRings } from '../src/game/grid/rings';
import { TileDecoder } from '../src/game/grid/tileDecoder';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { clientRingCatalogue, clientRingPorts, type PreparedRingTile } from '../src/game/shardfile/clientRings';
import { clientTileViews } from '../src/game/shardfile/clientViews';
import source from '../src/shards/_template/shard.config';

function isMesh(o: Object3D): o is Mesh { return o instanceof Mesh; }
const meshes = (root: Object3D): Mesh[] => { const out: Mesh[] = []; root.traverse((o) => { if (isMesh(o)) out.push(o); }); return out; };
const flush = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

const assets = new Map(source.files.map((file) => [file.hash, new Uint8Array(readFileSync(new URL(`../src/shards/_template/assets/${file.hash}`, import.meta.url)))]));
const options = { base: 'https://shards.test/template/shard.json', offline: false, firstParty: true,
  fetch: (url: string): Promise<Response> => { const bytes = assets.get(url.split('/').at(-1) ?? ''); return Promise.resolve(bytes === undefined ? new Response(null, { status: 404 }) : new Response(bytes.slice())); },
  hash: (bytes: Uint8Array): Promise<string> => Promise.resolve(createHash('sha256').update(bytes).digest('hex')) };

it('streams the template shardfile through prepared ring tiles: not ready before full coarse coverage, no overlap, unloads to nothing', async () => {
  const scope = new Scope('template-rings'), root = new Group(), family = scope.own(new MeshStandardMaterial({ vertexColors: true }));
  const views = clientTileViews({ terrain: source.terrain?.family ?? null, materials: new Map([['pbr', family]]), textures: new Map() });
  const instances = new Map([['template-solo', { source, assets: new ClientAssets(source, assets, options), root, views }]]);
  const decoder = new TileDecoder(), discarded: string[] = [];
  const ports = clientRingPorts(instances, { scope, decoder });
  const rings = new RenderRings<PreparedRingTile>([{ instance: 'template-solo', origin: { x: 0, z: 0 } }], new ResidencyAllocator(), clientRingCatalogue(instances),
    { ...ports, discard: (tile, prepared) => { discarded.push(tile.key); ports.discard?.(tile, prepared); } }, { uploadsPerFrame: 4 });
  // the template has no far proxy: its 16 L1 tiles are its coarse level, and the view is not ready until all of them draw
  rings.step({ x: 0, z: 0, vx: 0, vz: 0 });
  expect(rings.ready()).toBe(false);
  let steps = 0;
  while (!rings.ready() && steps++ < 200) { await flush(); rings.step({ x: 0, z: 0, vx: 0, vz: 0 }); }
  expect(rings.ready()).toBe(true);
  const coarse = (): Mesh[] => meshes(root).filter((m) => m.name.startsWith('terrain:') && m.geometry.getAttribute('position').count === 17 * 17);
  expect(coarse()).toHaveLength(16);
  // refine near the spawn, then drive off to a corner: every coarse triangle still drawn lies outside every fine tile
  const check = (): void => {
    const fine = meshes(root).filter((m) => m.name.startsWith('terrain:') && m.geometry.getAttribute('position').count > 17 * 17).map((m) => new Box3().setFromObject(m));
    for (const m of coarse()) {
      if (!m.visible) continue;
      const index = m.geometry.index, position = m.geometry.getAttribute('position'), v = new Vector3();
      for (let t = 0, n = Math.min(m.geometry.drawRange.count, index?.count ?? 0); t < n; t += 3) {
        const c = new Vector3(); for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(position, index?.getX(t + k) ?? 0)); c.multiplyScalar(1 / 3).add(m.position);
        expect(fine.some((b) => c.x > b.min.x && c.x < b.max.x && c.z > b.min.z && c.z < b.max.z)).toBe(false);
      }
    }
    return undefined;
  };
  for (let i = 0; i < 60; i++) { await flush(); rings.step({ x: 0, z: 0, vx: 0, vz: 0 }); }
  expect(rings.stats().resident.l0).toBeGreaterThan(0);
  check();
  for (let i = 0; i < 120; i++) { await flush(); rings.step({ x: 200 * i / 120, z: -200 * i / 120, vx: 30, vz: -30 }); expect(rings.ready()).toBe(true); }
  check();
  rings.dispose(); decoder.dispose();
  await flush();
  expect(root.children).toHaveLength(0);
  scope.dispose();
  expect(scope.census.geometries).toBe(0);
});
