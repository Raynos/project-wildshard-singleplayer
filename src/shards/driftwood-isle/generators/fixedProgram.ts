import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { bakeQueryTerrain, readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { assetCost } from '@wildshard/sdk/assets';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { nameBlob } from '@wildshard/sdk/blobs';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import type { Shardfile } from '@wildshard/sdk/shardfile';
import { castawayHead } from './castawayHead';
import { driftwoodOwnedScene } from './scene';
import { driftwoodGroundBytes } from './groundRows';
import inventory from '../data/fixedGeometry.json' with { type: 'json' };

/** The complete native inputs; every other value is constructed from this producer's author source. */
export const DRIFTWOOD_FIXED_INPUTS: readonly string[] = [
  '/assets/models/driftwood-hero/faces/wendell-head.glb',
  '/assets/models/driftwood-blender/voxel-ao.bin',
];
const text = new TextEncoder();
const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;

/** Construct original model, tile, terrain and layout bytes without publishing a source-tree handoff. */
export async function driftwoodFixedBytes(inputs: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Uint8Array>> {
  if (inputs.size !== DRIFTWOOD_FIXED_INPUTS.length || DRIFTWOOD_FIXED_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) {
    throw new Error('Driftwood fixed native input inventory differs');
  }
  const headBytes = inputs.get(DRIFTWOOD_FIXED_INPUTS[0] ?? ''), aoBytes = inputs.get(DRIFTWOOD_FIXED_INPUTS[1] ?? '');
  if (headBytes === undefined || aoBytes === undefined) throw new Error('Missing Driftwood fixed native bytes');
  const headSource = await readSourceModel(headBytes);
  headSource.gltf.scene.updateMatrixWorld(true);
  const heads: Mesh[] = [];
  headSource.gltf.scene.traverse(node => { if (isMesh(node)) heads.push(node); });
  if (heads.length !== 1) throw new Error('Wendell head source must contain one mesh');
  const headMesh = heads[0];
  if (headMesh === undefined) throw new Error('Missing authored Wendell head');
  const head = castawayHead(headMesh.geometry.clone().applyMatrix4(headMesh.matrixWorld));
  const { baked, fixed } = driftwoodOwnedScene(head, aoBytes);
  const material = new MeshStandardMaterial({ vertexColors: true }), files = new Map<string, Uint8Array>();
  const blobRows = new Map<string, { name: string; kind: 'glb'; source: string }>(), aliases = new Map<string, string>();
  try {
    for (const [name, geometry] of fixed.geometries) {
      const customAttributes = Object.fromEntries(Object.keys(geometry.attributes).filter(key => !['position', 'normal', 'color', 'uv'].includes(key))
        .map(key => [key === 'aSway' ? '_SWAY' : `_${key.toUpperCase()}`, key]));
      const bytes = staticGlb([{ geometry, material, customAttributes, ...(['bridge-plank-unit', 'bridge-rope-unit'].includes(name)
        ? { nativeAttributes: true, compactIndex: true } : name === 'cover-driftwood' ? { compactIndex: true } : {}) }], name);
      files.set(`baked/fixed-models/${name}.glb`, bytes);
      const blob = nameBlob(`models/fixed/${name}.glb`, 'glb', bytes);
      const row = blobRows.get(blob.file.hash) ?? { name: `models/fixed/${name}.glb`, kind: 'glb', source: `assets/${blob.file.hash}` };
      const original = inventory.draws.find(draw => draw.source.endsWith(`/fixed-models/${name}.glb`));
      if (original === undefined) throw new Error(`Missing fixed-model source identity: ${name}`);
      blobRows.set(blob.file.hash, row); aliases.set(original.source, row.name);
      files.set(row.source, blob.bytes);
    }
    for (const [name, value] of Object.entries(fixed.rows)) files.set(`data/${name}.json`, text.encode(`${JSON.stringify(value, null, 2)}\n`));
    if (baked.props === null) throw new Error('Driftwood scene must contain its static world');
    const library = new Map<string, Shardfile['files'][number]>(), templateFiles: string[] = [];
    for (const part of baked.pieces) {
      const hash = hashImmutableBytes(part.glb);
      if (!library.has(hash)) library.set(hash, { hash, kind: 'glb', compressed: part.glb.byteLength, ...assetCost('glb', part.glb), dependencies: [], critical: false });
      templateFiles.push(hash); baked.assets.set(hash, part.glb);
    }
    const libraryFiles = [...library.values()].sort((a, b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
    const queries = bakeQueryTerrain(readNativeTerrain(driftwoodGroundBytes()), { normalEpsilon: 0.6, datum: -0.8 });
    for (const [hash, bytes] of queries.assets) baked.assets.set(hash, bytes);
    const product = { terrain: queries.terrain, props: { ...baked.props.props, wholeLibrary: templateFiles }, tiles: baked.shardfile.tiles,
      files: [...baked.shardfile.files, ...libraryFiles, ...queries.files].sort((a, b) => a.hash.localeCompare(b.hash)),
      library: templateFiles, critical: [...baked.shardfile.critical, ...queries.critical], templateFiles,
      report: baked.props.report, libraryCost: { resident: libraryFiles.reduce((sum, file) => sum + file.decoded + file.gpu, 0),
        compressed: libraryFiles.reduce((sum, file) => sum + file.compressed, 0) } };
    for (const [hash, bytes] of baked.assets) files.set(`assets/${hash}`, bytes);
    files.set('data/fixedTiles.generated.json', text.encode(`${JSON.stringify(product)}\n`));
    const blobs = [...blobRows.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const byUrl = Object.fromEntries([...aliases].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    files.set('data/fixedBlobs.generated.json', text.encode(`${JSON.stringify({ blobs, byUrl }, null, 2)}\n`));
    return files;
  } finally {
    material.dispose();
    for (const geometry of fixed.geometries.values()) geometry.dispose();
    headSource.gltf.scene.traverse(node => {
      if (isMesh(node)) {
        node.geometry.dispose();
        for (const sourceMaterial of Array.isArray(node.material) ? node.material : [node.material]) sourceMaterial.dispose();
      }
    });
  }
}

/** The one native fixed-model step stores only owned files in the injected cache outside src. */
export async function driftwoodFixedFiles(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'fixed-models', native: true, inputs: DRIFTWOOD_FIXED_INPUTS }, driftwoodFixedBytes);
  if (files.size === 0 || !files.has('data/fixedTiles.generated.json') || !files.has('data/fixedBlobs.generated.json')) {
    throw new Error('Driftwood fixed cache inventory differs');
  }
  return files;
}
