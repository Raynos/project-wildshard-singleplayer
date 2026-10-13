// oxlint-disable-next-line import/no-nodejs-modules -- The generation catalogue belongs to this isolated source root.
import process from 'node:process';
import { expect, it } from 'vitest';
import { expectKeyedClosure } from './fixtures/authoringClosure';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

// G320 (SF87): Signal Dunes' sand maps and dune skirt are baked from authoring sources only.
it('keys the complete sand bake from authoring sources, with no runtime loader or retained output seed', () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'signal-sand');
  if (job === undefined) throw new Error('Missing Signal sand job');
  const audits = [job.entry, 'src/sdk/bake/source-loader.mjs'].map(entry => auditAuthoringInputs(root, 'sunscar-dunes', entry));
  expect(audits.flatMap(audit => audit.issues)).toEqual([]);
  const closure = [...new Set([...audits.flatMap(audit => audit.files), 'src/sdk/package.json', 'src/format/package.json', 'src/commons/package.json', 'package.json', 'pnpm-lock.yaml'])].sort();
  expectKeyedClosure(job.inputRoots, closure, 'sunscar-dunes');
  expect(job.inputRoots.filter(file => !isAuthoringInput(file, 'sunscar-dunes') && !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file))).toEqual([]);
  expect(job.command).toEqual(['--experimental-transform-types', '--import', './src/sdk/bake/source-loader.mjs', job.entry]);
  expect(job.seedOutputs).toEqual([]);
  // the client's look rows (look/, data/sand.json, data/skirt.json) are outputs or runtime, never this bake's inputs
  expect(closure.filter(file => file.includes('/look/') || file.endsWith('/sand.json') || file.endsWith('/skirt.json'))).toEqual([]);
});
