// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the retained authoring job in the isolated source tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { auditAuthoringInputs, isAuthoringInput } from '../scripts/authoring-inputs.mjs';
import { discoverGeneration } from '../scripts/generate.mjs';

it('confines the complete Nalati Qara compiler and resolver to authoring source, preserving both pinned products', () => {
  const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='nalati-qara');
  if(job===undefined)throw new Error('Missing Nalati Qara job');
  expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs',job.entry]);
  expect(auditAuthoringInputs(root,'nalati-grasslands',job.entry).issues).toEqual([]);
  expect(auditAuthoringInputs(root,'nalati-grasslands','src/sdk/bake/source-loader.mjs').issues).toEqual([]);
  expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'nalati-grasslands')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
  expect(job.seedOutputs).toEqual([]);
  expect(job.outputs).toEqual(['src/shards/nalati-grasslands/behaviour/qara.generated.json']);
  expect(job.buildOutputs).toEqual({'src/shards/nalati-grasslands/behaviour/qara.generated.json':'1f83e2bd97ccaf81fdb95c073a5d980d07ebe2b824be6b63e8b0037be3a39f47'}); // Preserve the existing activation pin.

});
