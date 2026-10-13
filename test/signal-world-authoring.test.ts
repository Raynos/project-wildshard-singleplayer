// oxlint-disable-next-line import/no-nodejs-modules -- The generation catalogue belongs to this isolated source root.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare retained author inputs with the released public source bytes.
import { readFileSync } from 'node:fs';
import { Mesh, type Object3D } from 'three';
import { colliderRows } from '@wildshard/sdk/bake/kinds';
import { expect, it } from 'vitest';
import { Rng as EngineRng } from '@wildshard/engine/core/rng';
import { rock as engineRock } from '@wildshard/engine/world/geometryKit';
import { boxDesc as engineBoxDesc } from '@wildshard/engine/world/registry';
import { Rng } from '@wildshard/sdk/random';
import { expectKeyedClosure } from './fixtures/authoringClosure';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';
import { rock } from '../src/shards/sunscar-dunes/generators/rocks';
import { boxDesc } from '../src/shards/sunscar-dunes/generators/kinds';
import { SEED } from '../src/shards/sunscar-dunes/data/layout';

// G320 (SF87): Signal Dunes' code-built world (rocks, dressing, tower, caravan, well, braziers, the lash and its plait) is
// baked from authoring sources only.
it('keys the complete world bake from authoring sources, with no runtime loader, public/ model or retained output seed', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'signal-world');
  if (job === undefined) throw new Error('Missing Signal world job');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'sunscar-dunes', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const closure = [...new Set([...audits.flatMap(audit => audit.files), 'src/shards/sunscar-dunes/assets/models/dry-well.glb', 'src/sdk/package.json', 'src/format/package.json', 'src/commons/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expectKeyedClosure(job.inputRoots, closure, 'sunscar-dunes');
  expect(job.inputRoots.filter(file => !isAuthoringInput(file, 'sunscar-dunes') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file))).toEqual([]);
  expect(job.command).toEqual(['--experimental-transform-types', '--import', './src/sdk/bake/source-loader.mjs', job.entry]);
  expect(job.seedOutputs).toEqual([]);
  // the bake's own rows (data/<piece>.json) and the generated glove are outputs or runtime assets, never its inputs
  expect(closure.filter(file => job.outputs.includes(file) || file.startsWith('public/'))).toEqual([]);
});

it('authors the engine kit\'s rock bit for bit over the same seeded stream (every seed the world bake uses)', () => {
  for (const [r, detail, seed, squash, rough] of [[1, 1, SEED + 3, 0.55, 0.3], [1, 0, SEED + 5, 0.7, 0.32], [1, 0, SEED + 31, 0.5, 0.25], [1, 0, SEED + 41, 0.6, 0.3], [1, 1, SEED + 51, 0.75, 0.3], [2.5, 2, 7, 0.7, 0.28]] as const) {
    const ours = rock(r, detail, new Rng(seed), squash, rough), theirs = engineRock(r, detail, new EngineRng(seed), squash, rough);
    expect(Array.from(ours.getAttribute('position').array)).toEqual(Array.from(theirs.getAttribute('position').array));
    expect(Array.from(ours.getAttribute('normal').array)).toEqual(Array.from(theirs.getAttribute('normal').array));
    expect(ours.getIndex()).toBe(theirs.getIndex());
  }
});

it('writes the physics registry\'s own box row, key for key', () => {
  for (const [c, surface] of [[{ x: 1.5, z: -2, hw: 0.4, hd: 0.3, rot: 0.25, yTop: 3, yBottom: 1 }, 'rock'], [{ x: 0, z: 0, hw: 1, hd: 1, rot: 0, yTop: 1, yBottom: 1 }, undefined],
    [{ x: -7, z: 9, hw: 0.07, hd: 0.07, rot: -1.2, yTop: 0.2, yBottom: -0.3 }, 'flesh']] as const) {
    expect(JSON.stringify(boxDesc(c, surface))).toBe(JSON.stringify(engineBoxDesc(c, surface)));
  }
});


it('fits/cuts the retained well against the released library and preserves every source/collider channel', async () => {
  const [{ facetModel, wellShell }, { fitGeometry, withoutTriangles }, { readSourceModel }, { bakeSignalWell, buildWellFrame }, { signalDunesField }] = await Promise.all([
    import('../src/shards/sunscar-dunes/generators/facets'), import('../src/game/plugin/geometry'), import('../src/sdk/bake/skinned'),
    import('../src/shards/sunscar-dunes/generators/places'), import('../src/shards/sunscar-dunes/generators/tiles'),
  ]);
  const retained = readFileSync('src/shards/sunscar-dunes/assets/models/dry-well.glb');
  expect(retained.equals(readFileSync('public/assets/sunscar-dunes/models/dry-well/dry-well.glb'))).toBe(true);
  const a = await facetModel(new Uint8Array(retained), 0.55), b = fitGeometry(a.clone(), { size: 3.4, by: 'span' }), maxX = b.boundingBox?.max.x ?? 2;
  const released = withoutTriangles(b, (x, y, z) => x > maxX - 0.3 || (Math.hypot(x, z) < 0.5 && y > 0.75 && y < 1.95)), prepared = wellShell(a);
  const baked = bakeSignalWell(prepared), frame = buildWellFrame(signalDunesField().heightAt);
  expect(baked.colliders).toStrictEqual(colliderRows(frame.colliders));
  const { gltf } = await readSourceModel(baked.glb), nodes: Mesh[] = [];
  const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
  gltf.scene.traverse(node => { if (isMesh(node)) nodes.push(node); });
  const node = nodes.find((_, i) => baked.kinds[i]?.name === 'shell'); if (node === undefined) throw new Error('Missing baked well');
  expect(node.geometry.getIndex()).toBeNull();
  for (const [channel, expected] of Object.entries(released.attributes)) expect(node.geometry.getAttribute(channel).array).toStrictEqual(expected.array);
  expect(prepared.boundingBox).toStrictEqual(released.boundingBox); expect(prepared.boundingSphere).toStrictEqual(released.boundingSphere);
});
