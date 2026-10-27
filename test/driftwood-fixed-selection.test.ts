import { expect, test } from 'vitest';
import * as v from 'valibot';
import { Material, Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { tierLibrarySteps } from '../src/format/tierSelection';
import { fixedDraws } from '../src/game/models/fixedDraws';
import { assembleWholeGeometryViews } from '../src/game/plugin/geometry';
import { driftwoodFixedModelOutput } from '../src/shards/driftwood-isle/generators/fixedModels';
import { FIXED_MODEL_NAMES } from '../src/shards/driftwood-isle/generators/modelFiles';
import { GULL_DRAW } from '../src/shards/driftwood-isle/generators/gullDraw';
import { FISH_DRAW } from '../src/shards/driftwood-isle/generators/fishDraw';
import { driftwoodFixedFiles } from './fixtures/driftwoodSceneBanks';

const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;

test('the original L0 partitions and whole templates cover every individual fixed file', async () => {
  const files = await driftwoodFixedFiles(), meshes: Mesh[] = [];
  const bytes = files.get('data/fixedTiles.generated.json');
  if (bytes === undefined) throw new Error('Missing original fixed layout');
  const rows = v.parse(v.object({ props: v.object({ wholeLibrary: v.array(v.string()),
    tiles: v.array(v.object({ lod: v.number(), file: v.string(), additionalFiles: v.optional(v.array(v.string())) })) }) }),
  JSON.parse(new TextDecoder().decode(bytes)));
  const refs = new Set(rows.props.wholeLibrary.concat(rows.props.tiles
    .flatMap(row => row.lod === 0 ? [row.file].concat(row.additionalFiles ?? []) : [])));
  try {
    for (const ref of refs) {
      const wire = files.get(`assets/${ref}`);
      if (wire === undefined) throw new Error('Missing original whole geometry');
      const loaded = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(Uint8Array.from(wire).buffer, '');
      loaded.scene.traverse((node: Object3D) => { if (isMesh(node)) meshes.push(node); });
    }
    const assembled = assembleWholeGeometryViews(meshes);
    try {
      expect(assembled.size).toBe(90);
      expect([...assembled.keys()].sort((a, b) => a.localeCompare(b))).toEqual(Object.values(FIXED_MODEL_NAMES)
        .map(name => name.slice(name.lastIndexOf('/') + 1, -4)).sort((a, b) => a.localeCompare(b)));
      for (const view of assembled.values()) expect(view.geometry.getAttribute('position').count).toBeGreaterThan(0);
    } finally { for (const view of assembled.values()) view.geometry.dispose(); }
  } finally {
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (material instanceof Material) material.dispose();
    }
  }
});

test('whole-covered fixed files leave phone play but stay available to posed and no-owner readers', async () => {
  const native = await driftwoodFixedFiles();
  const emitted = await driftwoodFixedModelOutput({ cached: () => Promise.resolve(native) });
  const independent = new Set([GULL_DRAW, FISH_DRAW].map(row => row.tiers.phone.geometry));
  const source = { identity: { slug: 'fixed-selection' }, files: emitted.files,
    library: emitted.files.map(file => file.hash), critical: [] };
  const descriptor = { index: { files: emitted.files }, sections: new Map<string, unknown>([
    ['custom/fixedLayouts', { draws: emitted.files.map(file => ({ file: file.name })) }],
  ]) };
  const steps = tierLibrarySteps(source, 'phone', descriptor);
  let step = steps.next(); while (step.done !== true) step = steps.next();
  expect(emitted.files).toHaveLength(90);
  expect(emitted.files.filter(file => !step.value.has(file.hash)).map(file => file.name).sort((a, b) => (a ?? '').localeCompare(b ?? '')))
    .toEqual([...independent].sort((a, b) => a.localeCompare(b)));
  const fallback = emitted.files.find(file => file.tier === 'desktop');
  if (fallback?.name === undefined) throw new Error('Missing covered fixed file');
  // Selection schedules entry traffic; it neither deletes the original named
  // file nor replaces a cold/no-owner read with a whole-world constructor.
  const reads: string[] = [];
  const draws = fixedDraws({ slug: source.identity.slug, file: name => {
    reads.push(name);
    const row = emitted.files.find(file => file.name === name), bytes = row === undefined ? undefined : emitted.assets.get(row.hash);
    if (bytes === undefined) throw new Error('Missing original named geometry');
    return Promise.resolve(bytes);
  } }, [{ slot: 'fallback', file: fallback.name, channels: [] }]);
  await draws.load();
  expect(draws.ready).toBe(true);
  expect(reads).toEqual([fallback.name]);
  const geometry = draws.handle('fallback').take();
  try { expect(geometry.getAttribute('position').count).toBeGreaterThan(0); } finally { geometry.dispose(); }
});
