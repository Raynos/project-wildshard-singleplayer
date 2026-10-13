// oxlint-disable-next-line import/no-nodejs-modules -- The generation catalogue belongs to this isolated source root.
import process from 'node:process';
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
  const closure = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/package.json', 'src/format/package.json', 'src/commons/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
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
