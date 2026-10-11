// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the retained authoring job in the isolated source tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

it('confines the complete Signal skitterer compiler and resolver to authoring source, preserving the pinned transport', () => {
  const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='signal-skitterer-behaviour');
  if(job===undefined)throw new Error('Missing Signal skitterer job');
  expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs',job.entry]);
  expect(auditAuthoringInputs(root,'sunscar-dunes',job.entry).issues).toEqual([]);
  expect(auditAuthoringInputs(root,'sunscar-dunes','src/sdk/bake/source-loader.mjs').issues).toEqual([]);
  expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'sunscar-dunes')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/sunscar-dunes/behaviour/skitterer.json']);
  expect(job.buildOutputs).toEqual({}); // The complete shard product must pass before activation/removal.

});
