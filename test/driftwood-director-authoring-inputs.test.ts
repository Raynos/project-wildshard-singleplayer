// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the retained authoring job in the isolated source tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

it('confines the complete Driftwood director compiler and resolver to authoring source, preserving both pinned products', () => {
  const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='driftwood-director');
  if(job===undefined)throw new Error('Missing Driftwood director job');
  expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs',job.entry]);
  expect(auditAuthoringInputs(root,'driftwood-isle',job.entry).issues).toEqual([]);
  expect(auditAuthoringInputs(root,'driftwood-isle','src/sdk/bake/source-loader.mjs').issues).toEqual([]);
  expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'driftwood-isle')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/driftwood-isle/assets/25121a8616589da2265bc6d0537c86eabec4d64d26d0bd757268d80dac2cba1b','src/shards/driftwood-isle/behaviour/director.json']);
  expect(job.buildOutputs).toEqual({}); // The complete shard product must pass before activation/removal.

});
