import { Box3, BufferGeometry, InstancedBufferAttribute, InstancedMesh, Mesh, Sphere, Vector3, type Material, type Object3D } from 'three';
import * as v from 'valibot';
import { prepareRigLoader } from '@wildshard/engine/anim/rig';
import type { Scope } from '@wildshard/engine/app/scope';
import { ownSceneResource } from '@wildshard/engine/app/sceneOwnership';
import { workSlice } from '@wildshard/engine/core/workSlice';
import { nativeWholeGeometry } from '@wildshard/engine/models/nativeGeometry';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import type { WorldSceneSlabChunk, WorldSceneSlabFile, WorldSceneSlabKey, WorldSceneSlabLibrary } from '@wildshard/format/worldSceneSlabs';
import type { ShardProduct } from './shardProduct';
import { runtimeProduct } from './runtimeProduct';
import { SharedTileBuilds, type TileContent } from './tileContent';
import type { ControlRefinement } from './controlRefinement';

type WholeLibrary = Extract<WorldScenesSection['libraries'][number], { kind: 'whole' }>;
type SlabTile = WorldSceneSlabLibrary['tiles'][number];
/** the bake's tag on each slab mesh (`sdk/bake/slabs.ts`): its key, tile and place in its file */
const SlabTag = v.object({ key: v.string(), tile: v.number(), chunk: v.number() });
const EMPTY: ReadonlySet<number> = new Set();

function slabMesh(node: Object3D): node is Mesh { return node instanceof Mesh; }
function materialList(mesh: Mesh): Material[] { return Array.isArray(mesh.material) ? mesh.material : [mesh.material]; }

/** a tile's chunks in file order, then each file's chunk order (as its build returns their geometries) */
const chunksOf = (entry: SlabTile): readonly WorldSceneSlabChunk[] => entry.files.flatMap(file => file.chunks);

/**
 * One verified slab file's chunk geometries in its row's order: each mesh of the GLB is one chunk (its extras name its
 * key, tile and place), taken with its native channels exactly as baked and its frozen bounds from the row. Parser
 * staging never outlives the read.
 */
async function readSlabChunks(owner: Scope, product: ShardProduct, tile: number, file: WorldSceneSlabFile): Promise<BufferGeometry[]> {
  const live = (): void => { if (owner.disposed || owner.disposing) throw new Error('Slab owner is retired'); };
  live();
  if (product.shardfile.files.find(row => row.hash === file.file)?.kind !== 'glb') throw new Error('Slab file needs a declared GLB');
  const admitted = runtimeProduct(product.shardfile);
  if (admitted === null) throw new Error('Slab file needs an admitted product');
  const staging = new Set<BufferGeometry>(), materials = new Set<Material>(), out: BufferGeometry[] = [];
  try {
    const bytes = await admitted.assets.read(file.file); live();
    const gltf = await (await prepareRigLoader()).createRigLoader().parseBytesAsync(bytes, ''); live();
    const meshes: Mesh[] = [];
    gltf.scene.traverse((node: Object3D) => {
      if (!slabMesh(node)) return;
      meshes.push(node); staging.add(node.geometry);
      for (const material of materialList(node)) materials.add(material);
    });
    if (meshes.length !== file.chunks.length) throw new Error('Slab file chunk count differs from its row');
    const placed = meshes.map(mesh => ({ mesh, tag: v.parse(SlabTag, mesh.userData['slab']) })).sort((a, b) => a.tag.chunk - b.tag.chunk);
    for (const [index, { mesh, tag }] of placed.entries()) {
      const row = file.chunks[index];
      if (row === undefined || tag.chunk !== index || tag.tile !== tile || tag.key !== row.key) throw new Error('Slab chunk differs from its row');
      const geometry = nativeWholeGeometry(mesh, 'take');
      const [x0, y0, z0, x1, y1, z1] = row.box, [sx, sy, sz, radius] = row.sphere;
      geometry.boundingBox = new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1));
      geometry.boundingSphere = new Sphere(new Vector3(sx, sy, sz), radius);
      out.push(geometry);
    }
    await admitted.releaseTransport([file.file]); live();
    return out;
  } catch (error) { for (const geometry of out) geometry.dispose(); throw error; }
  finally { for (const geometry of staging) geometry.dispose(); for (const material of materials) material.dispose(); admitted.assets.releaseTiles(); }
}

/**
 * NF11: a refine library's fine geometry as its baked slabs (`kind: 'slabs'`, NF10), in place of the run-time join. Each
 * draw key draws under its original anchor (`key.node`, the key's first source): attaching a tile adds that key's chunks
 * as plain meshes, one a frame, children of the anchor in its own frame, so its band (`until`) and its parent's
 * visibility hold them as they held the anchor; retiring removes them. No join, clone or CPU transform. The anchor itself
 * keeps its channel-less stand-in and draws nothing; an anchor merged into another
 * key draws nothing at all.
 */
export class SlabLibrary {
  private readonly builds: SharedTileBuilds<readonly BufferGeometry[]>;
  private readonly entries = new Map<number, SlabTile>();
  private readonly keys = new Map<string, WorldSceneSlabKey>();
  private serial = 0;
  constructor(owner: Scope, product: ShardProduct, private readonly whole: WholeLibrary, private readonly row: WorldSceneSlabLibrary,
    private readonly queue: ControlRefinement, private readonly cover: (tile: number) => Promise<void>) {
    if (row.of !== whole.id) throw new Error('Slab library covers another library');
    for (const key of row.keys) {
      if (key.castFrom !== undefined) throw new Error('Slab key casting from a band has no run-time draw');
      for (const source of key.sources) { if (this.keys.has(source)) throw new Error('Slab source belongs to two keys'); this.keys.set(source, key); }
    }
    for (const model of whole.models) if (!this.keys.has(model.id)) throw new Error(`Slab library omits refine model ${model.id}`);
    for (const entry of row.tiles) this.entries.set(entry.tile, entry);
    const bounds = new Map(product.shardfile.tiles.filter(tile => tile.lod === 0).map(tile => [tile.z * 8 + tile.x, tile.drawBounds ?? tile.bounds] as const));
    this.builds = new SharedTileBuilds(owner, async (tile, scope) => {
      const entry = this.entries.get(tile); if (entry === undefined) throw new Error('Missing slab tile');
      const chunks: BufferGeometry[] = [];
      const box = bounds.get(tile);
      const at = { x: -250 + (tile % 8 + 0.5) * 62.5, y: box === undefined ? 0 : (box.min[1] + box.max[1]) / 2,
        z: -250 + (Math.floor(tile / 8) + 0.5) * 62.5, ...(box === undefined ? {} : { bounds: box }) };
      await queue.add(`${row.id}:${String(tile)}:${String(this.serial++)}`, at, async () => {
        if (scope.disposed || scope.disposing) return;
        await this.cover(tile);
        for (const file of entry.files) {
          if (scope.disposed || scope.disposing) return;
          let read: readonly BufferGeometry[];
          try { read = await readSlabChunks(scope, product, tile, file); }
          catch (error) { if (scope.disposed || scope.disposing) return; throw error; }
          for (const geometry of read) ownSceneResource(geometry, scope);
          chunks.push(...read);
        }
      });
      if (!scope.disposed && !scope.disposing && chunks.length !== chunksOf(entry).length) throw new Error('Slab tile chunk count differs from its row');
      return chunks;
    });
  }
  /** an anchor's frozen stand-in until its key's first chunk: no channels (the anchor stays hidden) */
  geometry(id: string): BufferGeometry | null { return this.whole.models.some(model => model.id === id) ? new BufferGeometry() : null; }
  /** a slab is already in its anchor's frame: no source transform */
  sourceTransform(): boolean { return false; }
  bind(id: string, mesh: Mesh, lifetime: Scope, _sourceTransform = false): TileContent {
    const key = this.keys.get(id); if (key === undefined) throw new Error('Missing slab model');
    // a merged anchor's triangles draw under its key's own anchor
    if (key.sources[0] !== id) { mesh.visible = false; return { id: `slab:${this.row.id}:${id}:${mesh.uuid}`, tiles: () => EMPTY, ready: () => this.queue.ready, attach: () => Promise.resolve() }; }
    const tiles = new Set(this.row.tiles.filter(entry => chunksOf(entry).some(chunk => chunk.key === key.id)).map(entry => entry.tile));
    // NR4: a channel-less anchor stays out of the draw until its key's first chunk
    let hidden = false, laid = false;
    if (mesh.visible) { mesh.visible = false; hidden = true; }
    const lay = (): void => {
      laid = true;
      if (hidden) { mesh.visible = true; hidden = false; }
      // EP7: it stays visible for its chunks (and its band), but never draws itself: its triangle-less draw issued an
      // empty call a frame on a plain-mesh program its instanced chunks no longer use. It keeps its channel-less
      // stand-in, so the precompile skips it too (NR4) instead of linking that plain program and its depth variant
      mesh.layers.disableAll();
    };
    return { id: `slab:${this.row.id}:${id}:${mesh.uuid}`, tiles: () => tiles, ready: () => this.queue.ready,
      attach: async (tile, scope) => {
        if (!tiles.has(tile) || lifetime.disposed || lifetime.disposing || scope.disposed || scope.disposing) return;
        const geometries = await this.builds.hold(tile, scope), entry = this.entries.get(tile);
        if (entry === undefined || lifetime.disposed || lifetime.disposing || scope.disposed || scope.disposing) return;
        const drawn: Mesh[] = [];
        scope.onDispose(() => { for (const part of drawn) part.removeFromParent(); drawn.length = 0; });
        const slice = workSlice(undefined, scope);
        for (const [index, chunk] of chunksOf(entry).entries()) {
          if (chunk.key !== key.id) continue;
          if (lifetime.disposed || lifetime.disposing || scope.disposed || scope.disposing) return;
          const geometry = geometries[index]; if (geometry === undefined) throw new Error('Missing slab chunk');
          if (!laid) lay();
          // EP7: one identity instance with white colours, so a chunk draws through the same program as the instanced
          // copies of its material (the sets, sitters and walkers on nine-architecture) instead of a plain-mesh one;
          // the colours exist before its first frame (three binds only attributes it uploaded before the draw hooks)
          const part = new InstancedMesh(geometry, mesh.material, 1);
          part.instanceColor = new InstancedBufferAttribute(new Float32Array([1, 1, 1]), 3);
          part.name = `${mesh.name}:slab:${String(tile)}:${String(index)}`; part.matrixAutoUpdate = false;
          part.castShadow = key.castShadow; part.receiveShadow = key.receiveShadow; part.renderOrder = key.renderOrder;
          part.layers.mask = key.layers; part.frustumCulled = key.frustumCulled;
          mesh.add(part); drawn.push(part);
          // one chunk a frame: its upload (≤ 4 MB) is the only one its first draw makes
          await slice.yield();
        }
      } };
  }
}
