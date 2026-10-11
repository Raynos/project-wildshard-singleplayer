// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the retained authoring job in the isolated source tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

it('confines the complete Nalati weapon hook compiler and resolver to authoring source, preserving both pinned products', () => {
  const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='nalati-weapon-hooks');
  if(job===undefined)throw new Error('Missing Nalati weapon hook job');
  expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs',job.entry]);
  expect(auditAuthoringInputs(root,'nalati-grasslands',job.entry).issues).toEqual([]);
  expect(auditAuthoringInputs(root,'nalati-grasslands','src/sdk/bake/source-loader.mjs').issues).toEqual([]);
  expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'nalati-grasslands')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/nalati-grasslands/assets/141ad375895d4f14fc900f0954c566ff077d1621741aed238edffa672f41a9ac','src/shards/nalati-grasslands/behaviour/weapons.json']);
  expect(job.buildOutputs).toEqual({}); // The complete shard product must pass before activation/removal.

});
