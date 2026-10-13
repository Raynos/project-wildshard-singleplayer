// oxlint-disable-next-line import/no-nodejs-modules -- The generation catalogue belongs to this isolated source root.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Compares the retained model sources with the public copies the library reads.
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import type { BufferGeometry } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { expectKeyedClosure } from './fixtures/authoringClosure';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';
import { bindRigid as libraryBindRigid, createModelLibrary, fitGeometry as libraryFitGeometry } from '../src/sdk/looks/modelLibrary';
import { bindRigid, facetModel, fitGeometry } from '../src/shards/sunscar-dunes/generators/facets';
import { DUNE_MODELS, DUNE_MESH_URLS } from '../src/shards/sunscar-dunes/data/files';
import { FACET_AO_FLOOR } from '../src/shards/sunscar-dunes/data/facets';
import { MANTA_HULL, STRIDER_HULL } from '../src/shards/sunscar-dunes/data/hulls';

const MODELS = ['dune-strider', 'dune-matriarch'] as const;
const retained = (name: string): string => `src/shards/sunscar-dunes/assets/models/${name}.glb`;
const attributes = (g: BufferGeometry): Record<string, number[]> => Object.fromEntries(Object.keys(g.attributes).sort().map(name => [name, Array.from(g.getAttribute(name).array)]));

// G320 (SF87): Signal Dunes' creature rigs (the skitterer, the strider, the ray and the Matriarch) are baked from
// authoring sources only.
it('keys the complete rig bake from authoring sources and declares every output it writes', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'signal-rigs');
  if (job === undefined) throw new Error('Missing Signal rigs job');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'sunscar-dunes', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const closure = [...new Set([...audits.flatMap(audit => audit.files), ...MODELS.map(retained), 'src/sdk/package.json', 'src/format/package.json', 'src/commons/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expectKeyedClosure(job.inputRoots, closure, 'sunscar-dunes');
  expect(job.inputRoots.filter(file => !isAuthoringInput(file, 'sunscar-dunes') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file))).toEqual([]);
  expect(job.command).toEqual(['--experimental-transform-types', '--import', './src/sdk/bake/source-loader.mjs', job.entry]);
  expect(job.seedOutputs).toEqual([]);
  expect([...job.outputs].sort()).toEqual(['public/assets/sunscar-dunes/rigs/matriarch.glb', 'public/assets/sunscar-dunes/rigs/ray.glb', 'public/assets/sunscar-dunes/rigs/skitterer.glb',
    'public/assets/sunscar-dunes/rigs/strider.glb', 'src/shards/sunscar-dunes/data/striderRig.baked.ts']);
  expect(closure.filter(file => job.outputs.includes(file) || file.startsWith('public/'))).toEqual([]);
});

it('retains the generated models byte for byte and takes them in exactly as the model library does', async () => {
  const parser = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const loaded = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation((url) => {
    const bytes = readFileSync(`public${url}`);
    return parser.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  });
  try {
    const library = createModelLibrary({ ...DUNE_MODELS, meshes: [...MODELS], hd: [] }, '[test]');
    await library.preload();
    expect(DUNE_MODELS.aoFloor).toBe(FACET_AO_FLOOR);
    for (const [name, fit] of [['dune-strider', STRIDER_HULL.fit], ['dune-matriarch', MANTA_HULL.fit]] as const) {
      const bytes = new Uint8Array(readFileSync(retained(name)));
      expect(bytes).toEqual(new Uint8Array(readFileSync(`public${DUNE_MESH_URLS[name]}`)));
      const ours = await facetModel(bytes, FACET_AO_FLOOR), theirs = library.mesh(name);
      if (theirs === null) throw new Error(`${name} missing`);
      expect(attributes(ours)).toEqual(attributes(theirs));
      expect([ours.getIndex(), ours.boundingBox]).toEqual([theirs.getIndex(), theirs.boundingBox]);
      // the fit and the rigid bind are the library's own
      const a = bindRigid(fitGeometry(ours.clone(), fit), (x, y, z) => (x > 0 ? 1 : 0) + (y > 0.5 ? 2 : 0) + (z > 0 ? 4 : 0));
      const b = libraryBindRigid(libraryFitGeometry(theirs.clone(), fit), (x, y, z) => (x > 0 ? 1 : 0) + (y > 0.5 ? 2 : 0) + (z > 0 ? 4 : 0));
      expect(attributes(a)).toEqual(attributes(b));
      expect(fitGeometry(ours.clone(), { size: 2, by: 'height', floor: 0.3, yaw: 0.4, centre: 'base' }).getAttribute('position').array)
        .toEqual(libraryFitGeometry(theirs.clone(), { size: 2, by: 'height', floor: 0.3, yaw: 0.4, centre: 'base' }).getAttribute('position').array);
    }
  } finally { loaded.mockRestore(); errors.mockRestore(); }
});
