// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the retained authoring job in the isolated source tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

it('confines the complete Pine clock director compiler and resolver to authoring source, preserving both pinned products', () => {
  const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='pine-clock-director');
  if(job===undefined)throw new Error('Missing Pine clock director job');
  expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs',job.entry]);
  expect(auditAuthoringInputs(root,'pine-hollow',job.entry).issues).toEqual([]);
  expect(auditAuthoringInputs(root,'pine-hollow','src/sdk/bake/source-loader.mjs').issues).toEqual([]);
  expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'pine-hollow')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/pine-hollow/assets/4bca3aaa1d0e5b78ef167939efa53c7a67c50377529cff637044aae9c5c84251','src/shards/pine-hollow/behaviour/director.json']);
  expect(job.buildOutputs).toEqual({}); // The complete shard product must pass before activation/removal.

});
