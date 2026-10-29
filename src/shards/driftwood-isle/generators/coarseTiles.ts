import { BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { bakeProps, type BakedProps } from '@wildshard/sdk/bake/props';
import { coarseCopy } from '@wildshard/sdk/bake/coarseCopy';
import { compressGlb } from '@wildshard/sdk/bake/glbCompression';
import { assetCost } from '@wildshard/sdk/assets';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { driftwoodFixedSource } from './fixedSource';
import { pierCoarse } from './pierCoarse';
import { islandCoarse } from './islandCoarse';
import { islandFoliagePlacements } from './islandDressing';
import { shoreBoulderFacts } from './shoreBoulders';

/** The voxel AO the fixed world's sources read (generators/fixedSource.ts), the coarse tiles' one input file. */
export const DRIFTWOOD_AO = '/assets/models/driftwood-blender/voxel-ao.bin';

/** Tile streaming T8 (G786) / G748: Driftwood's coarse L1 tiles, its fixed world's whole shapes simplified in their own
 *  vertex colours (`coarseCopy`, 10 %, 2 m error, sloppy past the target: the fixed sources are unwelded) and baked as the props bake's coarse source. The occupied parents only
 *  (rows with files); runtime piers add their own authored silhouettes at the same world poses, and the island's palms and
 *  shore boulders theirs (D200: their merged meshes draw only the render ring's tiles). The fixed producer
 *  merges these parents, replacing vacant metadata; the output hook supplies the same bytes at build time. */
export function driftwoodCoarseTiles(aoBytes: Uint8Array): Pick<BakedProps, 'tiles' | 'files' | 'assets'> & { readonly models: BakedProps['props']['tiles'] } {
  const fixed = driftwoodFixedSource(aoBytes), material = new MeshStandardMaterial({ vertexColors: true });
  const world = [...fixed.geometries].flatMap(([id, geometry]) => { const pose = fixed.world.get(id); return pose === undefined ? [] : [{ mesh: new Mesh(geometry, material), transform: pose }]; });
  const coarse = coarseCopy(world, 0.1, 2, { sloppy: true });
  // Near piers remain runtime-owned library templates. These silhouettes use
  // their authored world poses only in L1, outside the road's entry footprint.
  const piers = new Group(), pierGeometries: BufferGeometry[] = [];
  for (const row of fixed.piers) {
    const at = row.world; if (at === null) continue;
    const geometry = pierCoarse(row.params), mesh = new Mesh(geometry, material);
    pierGeometries.push(geometry); mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(new Matrix4().makeRotationY(at.rot).setPosition(at.x, at.deckY, at.z));
    piers.add(mesh);
  }
  // D200: the phone tier's palms (Jake's device), the shore boulders every tier places
  const foliage = islandFoliagePlacements().tiers.phone;
  const islandGeometry = islandCoarse(foliage.palms.placements, shoreBoulderFacts().placements);
  const coarseWorld = new Group().add(coarse.group, piers, new Mesh(islandGeometry, material));
  // the props bake always builds a far proxy (unused here, the far view has its own): one small triangle stands in for it
  const marker = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3))
    .setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3)).setAttribute('color', new Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
  const far = new Group().add(new Mesh(marker, new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })));
  try {
    const baked = bakeProps({ static: new Group(), coarse: coarseWorld, far, family: 'pbr' });
    const tiles = baked.tiles.filter(tile => tile.lod === 1 && tile.files.length > 0), keep = new Set(tiles.flatMap(tile => tile.files));
    const remapped = new Map<string, BakedProps['files'][number]>(), assets = new Map<string, Uint8Array>();
    for (const file of baked.files.filter(row => keep.has(row.hash))) {
      const original = baked.assets.get(file.hash);
      if (original === undefined) throw new Error('Missing Driftwood coarse tile bytes');
      const packed = compressGlb(original), bytes = packed.length < original.length ? packed : original;
      const next = { ...file, hash: hashImmutableBytes(bytes), compressed: bytes.length, ...assetCost('glb', bytes) };
      remapped.set(file.hash, next); assets.set(next.hash, bytes);
    }
    const remap = (hash: string): BakedProps['files'][number] => {
      const file = remapped.get(hash);
      if (file === undefined) throw new Error('Missing Driftwood coarse tile reference');
      return file;
    };
    return { tiles: tiles.map(tile => {
      const files = tile.files.map(remap);
      const cost = files.reduce((sum, file) => ({ compressed: sum.compressed + file.compressed, decoded: sum.decoded + file.decoded,
        gpu: sum.gpu + file.gpu, triangles: sum.triangles + file.triangles, draws: sum.draws + file.draws }),
      { compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0 });
      return Object.assign(tile, cost, { files: files.map(file => file.hash) });
    }), files: [...remapped.values()], assets,
      models: baked.props.tiles.filter(model => model.lod === 1 && keep.has(model.file)).map(model => Object.assign(model, { file: remap(model.file).hash })) };
  } finally { coarse.dispose(); islandGeometry.dispose(); for (const geometry of pierGeometries) geometry.dispose(); material.dispose(); marker.dispose(); for (const geometry of fixed.geometries.values()) geometry.dispose(); }
}

/** The coarse tiles' bytes for the product, through the build's owned-byte cache (never a generated file under src). */
export function driftwoodCoarseOutput(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  return ctx.cached({ id: 'driftwood-coarse-tiles', native: true, inputs: [DRIFTWOOD_AO] }, inputs => {
    const ao = inputs.get(DRIFTWOOD_AO);
    if (ao === undefined || ao.byteLength === 0) throw new Error('Missing Driftwood voxel AO');
    return driftwoodCoarseTiles(ao).assets;
  });
}
